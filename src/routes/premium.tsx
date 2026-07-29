import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Check, X, Zap, Crown, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSubscriptionAsync, formatTierName, type PremiumTier } from "@/lib/premium";
import { createCheckoutSession } from "@/lib/stripeCheckout.server";
import { useGardenPlants } from "@/lib/myGarden";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Premium — Verdant" },
      { name: "description", content: "Upgrade to Premium and unlock advanced plant care features." },
    ],
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [currentTier, setCurrentTier] = useState<PremiumTier>("free");
  const [checkoutBusyTier, setCheckoutBusyTier] = useState<PremiumTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gardenPlants = useGardenPlants();

  useEffect(() => {
    if (!user) return;
    getSubscriptionAsync(user.uid).then((sub) => setCurrentTier(sub.tier));
  }, [user]);

  const tiers = [
    {
      id: "free" as const,
      name: "Free",
      price: 0,
      icon: Sparkles,
      features: [
        { name: "Up to 5 plants", included: true },
        { name: "100 MB photo storage", included: true },
        { name: "Basic watering calendar", included: true },
        { name: "Weather alerts", included: false },
        { name: "Expert support", included: false },
        { name: "Advanced watering AI", included: false },
        { name: "Garden design", included: false },
        { name: "Smart home integration", included: false },
      ],
      highlighted: false,
    },
    {
      id: "plus" as const,
      name: "Premium Plus",
      price: billingCycle === "monthly" ? 4.99 : 49.99,
      icon: Zap,
      period: billingCycle === "yearly" ? "per year" : "per month",
      features: [
        { name: "Up to 25 plants", included: true },
        { name: "1 GB photo storage", included: true },
        { name: "Smart watering calendar", included: true },
        { name: "Weather-based alerts", included: true },
        { name: "Expert Q&A (5/month)", included: true },
        { name: "Advanced watering AI", included: true },
        { name: "Garden design", included: false },
        { name: "Smart home integration", included: false },
      ],
      highlighted: false,
    },
    {
      id: "pro" as const,
      name: "Premium Pro",
      price: billingCycle === "monthly" ? 9.99 : 99.99,
      icon: Crown,
      period: billingCycle === "yearly" ? "per year" : "per month",
      badge: "Most Popular",
      features: [
        { name: "Unlimited plants", included: true },
        { name: "10 GB photo storage", included: true },
        { name: "Unlimited watering alerts", included: true },
        { name: "Unlimited weather alerts", included: true },
        { name: "Unlimited expert Q&A", included: true },
        { name: "Advanced watering AI", included: true },
        { name: "Garden design tool", included: true },
        { name: "Smart sensor integration", included: true },
      ],
      highlighted: true,
    },
  ];

  const handleUpgrade = async (tier: "plus" | "pro") => {
    setError(null);

    if (!user) {
      navigate({ to: "/login" });
      return;
    }

    setCheckoutBusyTier(tier);
    try {
      const res = await createCheckoutSession({
        data: {
          userId: user.uid,
          userEmail: user.email || "",
          tier,
          cycle: billingCycle,
          successUrl: `${window.location.origin}/premium?checkout=success`,
          cancelUrl: `${window.location.origin}/premium?checkout=cancelled`,
        },
      });

      if (res.status === "ok") {
        window.location.href = res.data.checkoutUrl;
      } else {
        setError(res.status === "error" ? res.message : "Checkout is unavailable right now.");
      }
    } finally {
      setCheckoutBusyTier(null);
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl mb-2">Unlock Premium</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Get advanced AI watering predictions and expert plant care guidance
        </p>

        {/* Billing toggle */}
        <div className="inline-flex bg-muted rounded-full p-1 mb-4">
          {(["monthly", "yearly"] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`ios-tap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                billingCycle === cycle
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {cycle === "monthly" ? "Monthly" : "Yearly"}
              {cycle === "yearly" && <span className="text-xs ml-1">Save 2 months</span>}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="leaf-card p-4 mb-4 text-sm text-destructive text-center">{error}</div>
      )}

      {/* Pricing cards */}
      <div className="space-y-4 mb-8">
        {tiers.map((tier) => {
          const Icon = tier.icon;
          const isCurrent = tier.id === currentTier;
          const isBusy = checkoutBusyTier === tier.id;
          return (
            <div
              key={tier.id}
              className={`rounded-3xl overflow-hidden transition-all ${
                tier.highlighted
                  ? "leaf-card ring-2 ring-primary scale-105 shadow-xl"
                  : "leaf-card"
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 text-center">
                  {tier.badge}
                </div>
              )}

              {/* Tier header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                      <h3 className="font-display text-xl">{tier.name}</h3>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  {tier.price === 0 ? (
                    <p className="text-3xl font-bold">Free</p>
                  ) : (
                    <>
                      <p className="text-4xl font-bold text-primary">
                        €{tier.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">{tier.period}</p>
                    </>
                  )}
                </div>

                {/* CTA Button */}
                {tier.id === "free" ? (
                  <button
                    disabled
                    className="ios-tap w-full h-11 rounded-full font-semibold flex items-center justify-center gap-2 bg-muted text-foreground cursor-default"
                  >
                    {isCurrent ? "Current Plan" : "Free"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={isCurrent || isBusy}
                    className={`ios-tap w-full h-11 rounded-full font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                      tier.highlighted
                        ? "bg-primary text-primary-foreground"
                        : "border-2 border-primary text-primary hover:bg-primary/5"
                    }`}
                  >
                    {isCurrent ? (
                      "Current Plan"
                    ) : isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <>
                        Start Free Trial
                        <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Features */}
              <div className="border-t border-border px-6 py-4 space-y-2">
                {tier.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    {feature.included ? (
                      <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0" strokeWidth={2} />
                    )}
                    <span
                      className={
                        feature.included
                          ? "text-foreground"
                          : "text-muted-foreground/50 line-through"
                      }
                    >
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <section className="mb-8">
        <h2 className="text-lg font-display mb-4 px-1">Common Questions</h2>

        <div className="space-y-3">
          {[
            {
              q: "Can I try Premium free?",
              a: "Yes! Start a 14-day free trial of any Premium plan. A card is required at signup, but you won't be charged until the trial ends — cancel anytime before then.",
            },
            {
              q: "Can I cancel anytime?",
              a: "Absolutely. Cancel your subscription anytime with no penalty.",
            },
            {
              q: "What payment methods do you accept?",
              a: "We accept all major credit cards via Stripe's secure checkout.",
            },
            {
              q: "Do I lose my data if I downgrade?",
              a: "No, your plant data stays safe. You just lose access to Premium features.",
            },
          ].map((faq, i) => (
            <details
              key={i}
              className="leaf-card p-4 cursor-pointer group"
            >
              <summary className="flex items-center justify-between font-medium text-sm">
                <span>{faq.q}</span>
                <span className="text-muted-foreground group-open:rotate-180 transition-transform">
                  ↓
                </span>
              </summary>
              <p className="text-sm text-muted-foreground mt-3">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Current plan info */}
      <section className="leaf-card p-4 mb-8">
        <h3 className="font-medium text-sm mb-2">Current Plan: {formatTierName(currentTier)}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          You're tracking {gardenPlants.length} plant{gardenPlants.length === 1 ? "" : "s"}.
        </p>
        <Link
          to="/settings"
          className="ios-tap flex items-center justify-between text-xs font-medium text-primary hover:underline"
        >
          View your account
          <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </Link>
      </section>
    </AppShell>
  );
}
