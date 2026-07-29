// Premium subscription management and feature gating.
// Reads/writes Supabase's `subscriptions` table when signed in; falls back
// to localStorage when signed out or Supabase isn't configured, same
// pattern as myGarden.ts.
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type PremiumTier = "free" | "plus" | "pro";

export interface Subscription {
  userId: string;
  tier: PremiumTier;
  startDate: string;
  endDate?: string; // undefined if active
  autoRenew: boolean;
  paymentMethod?: string;
}

export interface TierFeatureSet {
  maxPlants: number;
  photoStorage: number; // MB
  weatherAlerts: boolean;
  expertSupport: boolean;
  expertQuestionsPerMonth: number; // 0 = no access; Infinity = unlimited
  advancedWateringAlgorithm: boolean;
  gardenDesign: boolean;
  sensorIntegration: boolean;
  customReports: boolean;
}

// Runtime feature table — actual values used by hasFeature/getFeatureLimit.
// (Distinct from PREMIUM_PRICING below, which is just monthly/yearly cost.)
export const TIER_FEATURES: Record<PremiumTier, TierFeatureSet> = {
  free: {
    maxPlants: 5,
    photoStorage: 100,
    weatherAlerts: false,
    expertSupport: false,
    expertQuestionsPerMonth: 0,
    advancedWateringAlgorithm: false,
    gardenDesign: false,
    sensorIntegration: false,
    customReports: false,
  },
  plus: {
    maxPlants: 25,
    photoStorage: 1000,
    weatherAlerts: true,
    expertSupport: true,
    expertQuestionsPerMonth: 5,
    advancedWateringAlgorithm: true,
    gardenDesign: false,
    sensorIntegration: false,
    customReports: false,
  },
  pro: {
    maxPlants: 999,
    photoStorage: 10000,
    weatherAlerts: true,
    expertSupport: true,
    expertQuestionsPerMonth: Infinity,
    advancedWateringAlgorithm: true,
    gardenDesign: true,
    sensorIntegration: true,
    customReports: true,
  },
};

export const PREMIUM_PRICING = {
  plus: {
    monthly: 4.99,
    yearly: 49.99, // ~2 months free
  },
  pro: {
    monthly: 9.99,
    yearly: 99.99, // ~2 months free
  },
};

const SUBSCRIPTION_KEY = "verdant.subscription.v1";

function defaultSubscription(userId: string): Subscription {
  return {
    userId,
    tier: "free",
    startDate: new Date().toISOString(),
    autoRenew: false,
  };
}

function readLocalSubscriptions(): Record<string, Subscription> {
  try {
    return JSON.parse(localStorage.getItem(SUBSCRIPTION_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalSubscription(subscription: Subscription): void {
  const subs = readLocalSubscriptions();
  subs[subscription.userId] = subscription;
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subs));
}

function getLocalSubscription(userId: string): Subscription {
  const sub = readLocalSubscriptions()[userId];
  if (!sub) return defaultSubscription(userId);
  if (sub.endDate && new Date(sub.endDate) < new Date()) return defaultSubscription(userId);
  return sub;
}

type SubscriptionRow = {
  user_id: string;
  tier: PremiumTier;
  start_date: string;
  end_date: string | null;
  auto_renew: boolean;
};

function fromRow(row: SubscriptionRow): Subscription {
  return {
    userId: row.user_id,
    tier: row.tier,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    autoRenew: row.auto_renew,
  };
}

// Get user's subscription. Synchronous (matches existing call sites) —
// reads localStorage directly. Use getSubscriptionAsync for the
// Supabase-backed, cross-device-accurate version when signed in.
export function getSubscription(userId: string): Subscription {
  return getLocalSubscription(userId);
}

export async function getSubscriptionAsync(userId: string): Promise<Subscription> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      const sub = fromRow(data as SubscriptionRow);
      if (sub.endDate && new Date(sub.endDate) < new Date()) return defaultSubscription(userId);
      return sub;
    }
  }
  return getLocalSubscription(userId);
}

// Create/update subscription. Writes localStorage immediately and mirrors
// to Supabase in the background when signed in.
export function setSubscription(subscription: Subscription): void {
  writeLocalSubscription(subscription);

  if (isSupabaseConfigured && supabase) {
    supabase
      .from("subscriptions")
      .upsert({
        user_id: subscription.userId,
        tier: subscription.tier,
        start_date: subscription.startDate,
        end_date: subscription.endDate ?? null,
        auto_renew: subscription.autoRenew,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("Failed to sync subscription to Supabase:", error);
      });
  }
}

// Check if feature is available for user
export function hasFeature(userId: string, feature: keyof TierFeatureSet): boolean {
  const sub = getSubscription(userId);
  return TIER_FEATURES[sub.tier][feature] === true;
}

// Get feature limit for user (e.g., max plants)
export function getFeatureLimit(userId: string, feature: keyof TierFeatureSet): number {
  const sub = getSubscription(userId);
  const value = TIER_FEATURES[sub.tier][feature];
  return typeof value === "number" ? value : 0;
}

// Upgrade subscription
export function upgradeSubscription(userId: string, tier: PremiumTier): Subscription {
  const now = new Date();
  const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const subscription: Subscription = {
    userId,
    tier,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    autoRenew: true,
  };

  setSubscription(subscription);
  return subscription;
}

// Format premium tier for display
export function formatTierName(tier: PremiumTier): string {
  return {
    free: "Free",
    plus: "Premium Plus",
    pro: "Premium Pro",
  }[tier];
}
