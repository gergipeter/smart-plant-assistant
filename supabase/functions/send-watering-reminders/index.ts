// Daily watering-reminder check. Scheduled via pg_cron (see
// supabase/schema.sql's cron.schedule call) — not triggered by the app
// itself. For each user who has watering_reminders enabled, finds plants
// due for water and would email them a summary.
//
// SEND STEP IS STUBBED: no email provider is wired up yet (see
// notifications.server.ts's header comment for why — Supabase's SMTP only
// fires for its own auth emails, it has no API for arbitrary content).
// Replace `sendReminderEmail` below with a real provider call (Resend,
// SendGrid, etc.) once one is set up; everything upstream of it — who's
// due, what plants, dedup by day — is real and already runs.
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

  let remindersSent = 0;
  for (const [userId, duePlants] of duePlantsByUser) {
    const { data: userRes } = await admin.auth.admin.getUserById(userId);
    const email = userRes?.user?.email;
    if (!email) continue;

    await sendReminderEmail(email, duePlants);
    remindersSent++;
  }

  return new Response(
    JSON.stringify({ checked: optedInUserIds.size, usersWithDuePlants: duePlantsByUser.size, remindersSent }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
