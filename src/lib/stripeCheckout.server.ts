import { createServerFn } from "@tanstack/react-start";
import type { ApiResult } from "./plantnet.server";
import { getStripe, getPriceId } from "./stripe.server";
import { PREMIUM_PRICING, type PremiumTier } from "./premium";

export type CreateCheckoutInput = {
  userId: string;
  userEmail: string;
  tier: Exclude<PremiumTier, "free">;
  cycle: "monthly" | "yearly";
  successUrl: string;
  cancelUrl: string;
};

export const createCheckoutSession = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid data");
    const d = data as Record<string, unknown>;
    const tier = d.tier;
    const cycle = d.cycle;
    if (tier !== "plus" && tier !== "pro") throw new Error("Invalid tier");
    if (cycle !== "monthly" && cycle !== "yearly") throw new Error("Invalid cycle");
    if (typeof d.userId !== "string" || !d.userId) throw new Error("Missing userId");
    if (typeof d.userEmail !== "string" || !d.userEmail) throw new Error("Missing userEmail");
    if (typeof d.successUrl !== "string" || typeof d.cancelUrl !== "string") {
      throw new Error("Missing redirect URLs");
    }
    return {
      userId: d.userId,
      userEmail: d.userEmail,
      tier,
      cycle,
      successUrl: d.successUrl,
      cancelUrl: d.cancelUrl,
    } satisfies CreateCheckoutInput;
  })
  .handler(async ({ data }): Promise<ApiResult<{ checkoutUrl: string }>> => {
    const stripe = getStripe();
    if (!stripe) {
      return { status: "error", message: "Payments are not configured." };
    }

    const priceId = getPriceId(data.tier, data.cycle);
    if (!priceId) {
      return { status: "error", message: `No price configured for ${data.tier}/${data.cycle}.` };
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: data.userEmail,
        client_reference_id: data.userId,
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        metadata: {
          userId: data.userId,
          tier: data.tier,
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            userId: data.userId,
            tier: data.tier,
          },
        },
      });

      if (!session.url) {
        return { status: "error", message: "Stripe did not return a checkout URL." };
      }

      return { status: "ok", data: { checkoutUrl: session.url } };
    } catch (error) {
      console.error("Stripe checkout error:", error);
      return { status: "error", message: "Could not start checkout." };
    }
  });

// Reference so callers can compute display prices without duplicating
// premium.ts's pricing table.
export { PREMIUM_PRICING };
