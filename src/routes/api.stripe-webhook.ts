// Stripe webhook receiver — a raw HTTP endpoint, not a createServerFn RPC,
// since Stripe's servers call this directly (not our client code) and
// signature verification needs the unparsed request body.
import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import { getStripe, getSupabaseAdmin } from "@/lib/stripe.server";

async function upgradeSubscription(userId: string, tier: "plus" | "pro", subscriptionId?: string, customerId?: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    console.error("Stripe webhook: Supabase admin client not configured, cannot upgrade subscription.");
    return;
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const { error } = await admin.from("subscriptions").upsert({
    user_id: userId,
    tier,
    start_date: now.toISOString(),
    end_date: endDate.toISOString(),
    auto_renew: true,
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: subscriptionId ?? null,
    updated_at: now.toISOString(),
  });

  if (error) console.error("Stripe webhook: failed to upsert subscription:", error);
}

async function downgradeToFree(userId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { error } = await admin
    .from("subscriptions")
    .update({ tier: "free", auto_renew: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) console.error("Stripe webhook: failed to downgrade subscription:", error);
}

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const stripe = getStripe();
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!stripe || !webhookSecret) {
          return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 500 });
        }

        const signature = request.headers.get("stripe-signature");
        const rawBody = await request.text();

        let event: Stripe.Event;
        try {
          if (!signature) throw new Error("Missing stripe-signature header");
          event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (error) {
          console.error("Stripe webhook signature verification failed:", error);
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
        }

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.client_reference_id || session.metadata?.userId;
            const tier = session.metadata?.tier;
            if (userId && (tier === "plus" || tier === "pro")) {
              await upgradeSubscription(
                userId,
                tier,
                typeof session.subscription === "string" ? session.subscription : undefined,
                typeof session.customer === "string" ? session.customer : undefined,
              );
            }
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            const userId = subscription.metadata?.userId;
            if (userId) await downgradeToFree(userId);
            break;
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            const userId = subscription.metadata?.userId;
            const tier = subscription.metadata?.tier;
            if (userId && subscription.status !== "active" && subscription.status !== "trialing") {
              await downgradeToFree(userId);
            } else if (userId && (tier === "plus" || tier === "pro") && subscription.status === "active") {
              await upgradeSubscription(userId, tier, subscription.id, typeof subscription.customer === "string" ? subscription.customer : undefined);
            }
            break;
          }

          default:
            break;
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
