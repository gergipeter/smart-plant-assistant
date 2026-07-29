// Daily watering-reminder check. Scheduled via pg_cron (see
// supabase/schema.sql's cron.schedule call) — not triggered by the app
// itself. For each user who has watering_reminders enabled, finds plants
// due for water and notifies them by push (if they have a registered
// device — see push_subscriptions/pushNotifications.ts) and/or email.
//
// EMAIL SEND: uses Resend's plain HTTP API (no SDK needed — works natively
// from Deno). Requires RESEND_API_KEY set via `supabase secrets set`
// (Edge Functions read secrets from Supabase's own store, NOT the app's
// .env — see .env.example's comment). Resend's shared sandbox sender
// (onboarding@resend.dev) only delivers to the account owner's own verified
// email until a real sending domain is verified in Resend's dashboard — real
// end users won't receive anything until that's done.
//
// PUSH SEND STEP IS STILL STUBBED (sendPushToTokens below): Deno edge
// functions can't import firebase-admin (Node-only), so sending FCM v1
// messages here means minting a Google OAuth2 access token from the same
// service-account JSON (FIREBASE_KEY, see .env.example), then POSTing to
// https://fcm.googleapis.com/v1/projects/{projectId}/messages:send per
// token. That's a genuine "needs a live Firebase project to verify against"
// step — everything upstream (who's due, what plants, dedup, which devices)
// is real and already runs; wire the actual HTTP call once you can test it
// against your Firebase project.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_WATER_INTERVAL_DAYS = 10;

type GardenPlantRow = {
  user_id: string;
  data: {
    id: string;
    name: string;
    lastWatered: string;
    waterIntervalDays?: number;
  };
};

// plant.lastWatered is a real ISO timestamp (see plants.ts's doc comment) —
// EXCEPT for any not-yet-backfilled row still holding the old "N days ago"
// display-string format (see the migration's backfill script). This
// fallback mirrors careDates.ts's daysSinceCareDate; Deno can't import from
// src/lib/ so it's duplicated here, simplified now that it's parsing a real
// date in the common case rather than always regex-matching.
function daysSinceLastWatered(lastWatered: string): number {
  const parsed = new Date(lastWatered);
  if (!Number.isNaN(parsed.getTime())) {
    const days = (Date.now() - parsed.getTime()) / 86_400_000;
    return Math.max(0, Math.floor(days));
  }
  const match = lastWatered.match(/(\d+)\s*day/);
  return match ? parseInt(match[1], 10) : 0;
}

function isDueForWater(plant: GardenPlantRow["data"]): boolean {
  const interval = plant.waterIntervalDays ?? DEFAULT_WATER_INTERVAL_DAYS;
  return daysSinceLastWatered(plant.lastWatered) >= interval;
}

async function sendReminderEmail(
  apiKey: string,
  appUrl: string,
  email: string,
  duePlants: { name: string }[],
): Promise<void> {
  const plantList = duePlants.map((p) => p.name).join(", ");
  const subject =
    duePlants.length === 1
      ? `${duePlants[0].name} needs water`
      : `${duePlants.length} plants need water`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Verdant <onboarding@resend.dev>",
        to: email,
        subject,
        html: `<p>These plants are due for water: <strong>${plantList}</strong>.</p><p><a href="${appUrl}">Open Verdant</a></p>`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend send failed for ${email} (${res.status}): ${body}`);
    }
  } catch (err) {
    // One user's send failing must not abort the whole batch — log and move on.
    console.error(`Resend send threw for ${email}:`, err);
  }
}

// STUB — see file header. Logs instead of calling the FCM v1 HTTP API.
async function sendPushToTokens(
  tokens: string[],
  duePlants: { name: string }[],
): Promise<void> {
  const body = `${duePlants.length} plant(s) due for water — ${duePlants.map((p) => p.name).join(", ")}`;
  console.log(`[STUB] Would push to ${tokens.length} device(s): "${body}"`);
}

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Missing key degrades to "no emails sent, everything else still runs" —
  // matches this function's existing per-user resilience rather than 500ing
  // the whole run over a config gap.
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const appUrl = Deno.env.get("APP_URL") ?? "https://smart-plant-assistant.gergipeter.workers.dev";
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not set — reminder emails will not be sent this run.");
  }

  const { data: prefs, error: prefsError } = await admin
    .from("notification_preferences")
    .select("user_id")
    .eq("watering_reminders", true);

  if (prefsError) {
    return new Response(JSON.stringify({ error: prefsError.message }), { status: 500 });
  }

  const optedInUserIds = new Set((prefs ?? []).map((p) => p.user_id));
  if (optedInUserIds.size === 0) {
    return new Response(JSON.stringify({ checked: 0, remindersSent: 0 }), { status: 200 });
  }

  const { data: gardenRows, error: gardenError } = await admin
    .from("garden_plants")
    .select("user_id, data")
    .in("user_id", [...optedInUserIds]);

  if (gardenError) {
    return new Response(JSON.stringify({ error: gardenError.message }), { status: 500 });
  }

  const duePlantsByUser = new Map<string, { name: string }[]>();
  for (const row of (gardenRows ?? []) as GardenPlantRow[]) {
    if (!isDueForWater(row.data)) continue;
    const list = duePlantsByUser.get(row.user_id) ?? [];
    list.push({ name: row.data.name });
    duePlantsByUser.set(row.user_id, list);
  }

  const { data: pushRows } = await admin
    .from("push_subscriptions")
    .select("user_id, fcm_token")
    .in("user_id", [...duePlantsByUser.keys()]);

  const tokensByUser = new Map<string, string[]>();
  for (const row of (pushRows ?? []) as { user_id: string; fcm_token: string }[]) {
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.fcm_token);
    tokensByUser.set(row.user_id, list);
  }

  let remindersSent = 0;
  for (const [userId, duePlants] of duePlantsByUser) {
    const tokens = tokensByUser.get(userId);
    if (tokens && tokens.length > 0) {
      await sendPushToTokens(tokens, duePlants);
    }

    const { data: userRes } = await admin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (email && resendApiKey) {
      await sendReminderEmail(resendApiKey, appUrl, email, duePlants);
    }

    remindersSent++;
  }

  return new Response(
    JSON.stringify({ checked: optedInUserIds.size, usersWithDuePlants: duePlantsByUser.size, remindersSent }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
