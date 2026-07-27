// Daily watering-reminder check. Scheduled via pg_cron (see
// supabase/schema.sql's cron.schedule call) — not triggered by the app
// itself. For each user who has watering_reminders enabled, finds plants
// due for water and notifies them by push (if they have a registered
// device — see push_subscriptions/pushNotifications.ts) and/or email.
//
// EMAIL SEND STEP IS STUBBED: no email provider is wired up yet (see
// notifications.server.ts's header comment for why — Supabase's SMTP only
// fires for its own auth emails, it has no API for arbitrary content).
// Replace `sendReminderEmail` below with a real provider call (Resend,
// SendGrid, etc.) once one is set up.
//
// PUSH SEND STEP IS ALSO STUBBED (sendPushToTokens below): Deno edge
// functions can't import firebase-admin (Node-only), so sending FCM v1
// messages here means minting a Google OAuth2 access token from the same
// service-account JSON firebase.server.ts uses, then POSTing to
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

// Mirrors waterCalendar.ts's parseLastWatered: "6 days ago" / "Just added" -> days elapsed.
function daysSinceLastWatered(lastWatered: string): number {
  const match = lastWatered.match(/(\d+)\s*day/);
  return match ? parseInt(match[1], 10) : 0;
}

function isDueForWater(plant: GardenPlantRow["data"]): boolean {
  const interval = plant.waterIntervalDays ?? DEFAULT_WATER_INTERVAL_DAYS;
  return daysSinceLastWatered(plant.lastWatered) >= interval;
}

// STUB — see file header. Logs instead of sending until a provider is wired up.
async function sendReminderEmail(email: string, duePlants: { name: string }[]): Promise<void> {
  console.log(
    `[STUB] Would email ${email}: ${duePlants.length} plant(s) due for water — ${duePlants
      .map((p) => p.name)
      .join(", ")}`,
  );
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
    if (email) await sendReminderEmail(email, duePlants);

    remindersSent++;
  }

  return new Response(
    JSON.stringify({ checked: optedInUserIds.size, usersWithDuePlants: duePlantsByUser.size, remindersSent }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
