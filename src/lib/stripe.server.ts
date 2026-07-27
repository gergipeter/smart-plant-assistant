// Stripe server-side helpers: creates Checkout sessions and verifies
// webhook signatures. Never import this from client code — it uses the
// secret key.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { PremiumTier } from "./premium";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

// Price IDs come from Stripe Dashboard > Product catalog — create one
// recurring Price per tier/cycle combination and set these env vars to
// their IDs (price_...), not the product ID.
export function getPriceId(tier: Exclude<PremiumTier, "free">, cycle: "monthly" | "yearly"): string | null {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${cycle.toUpperCase()}`;
  return process.env[key] || null;
}

// Service-role Supabase client for server-side writes that must bypass RLS
// (the webhook has no user session — Stripe calls it directly, not the
// signed-in user). Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
