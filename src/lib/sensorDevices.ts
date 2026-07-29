// Management (list/register/delete/rotate) for physical sensor devices, from
// the signed-in user's own browser — separate from sensorReadings.ts, which
// is the read side for a device's data once it's reporting. Writes here go
// through the anon key + RLS ("Users manage their own sensor devices"), same
// as myGarden.ts's remote garden calls; there's no admin/service-role
// involvement on this path since the user themselves owns these rows.
//
// The device's bearer token is never stored in the clear: only its SHA-256
// hash (secret_token_hash) and last four characters (secret_token_last_four,
// for display) are persisted. The raw token is returned to the caller
// exactly once, from registerSensorDevice/rotateSensorDeviceToken — the
// caller must show it immediately (to flash into firmware); it can never be
// read back afterwards, by this app or anyone with DB access.
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type SensorDevice = {
  id: string;
  plantId: string;
  name: string;
  tokenLastFour: string;
  createdAt: string;
  lastSeenAt: string | null;
};

export async function listSensorDevices(): Promise<SensorDevice[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("sensor_devices")
    .select("id, plant_id, name, secret_token_last_four, created_at, last_seen_at")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    plantId: row.plant_id,
    name: row.name,
    tokenLastFour: row.secret_token_last_four,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }));
}

// 192 bits of randomness as hex — well past what's brute-forceable, matches
// the schema comment's `openssl rand -hex 24` suggestion so a device
// re-paired via either path looks the same to the ingest endpoint.
function generateSecretToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type NewSensorDevice = SensorDevice & { secretToken: string };

// Returns the new device including its raw secret_token — this is the ONLY
// point the token is ever available in full; the caller must show it to the
// user immediately (to flash into firmware) since it isn't recoverable later.
export async function registerSensorDevice(plantId: string, name: string): Promise<NewSensorDevice | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const secretToken = generateSecretToken();
  const secretTokenHash = await sha256Hex(secretToken);
  const { data, error } = await supabase
    .from("sensor_devices")
    .insert({
      user_id: user.id,
      plant_id: plantId,
      name,
      secret_token_hash: secretTokenHash,
      secret_token_last_four: secretToken.slice(-4),
    })
    .select("id, plant_id, name, secret_token_last_four, created_at, last_seen_at")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    plantId: data.plant_id,
    name: data.name,
    tokenLastFour: data.secret_token_last_four,
    createdAt: data.created_at,
    lastSeenAt: data.last_seen_at,
    secretToken,
  };
}

// Issues a fresh token for an existing device without losing its reading
// history — use when a token may have leaked, instead of delete + re-register.
export async function rotateSensorDeviceToken(deviceId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const secretToken = generateSecretToken();
  const secretTokenHash = await sha256Hex(secretToken);
  const { error } = await supabase
    .from("sensor_devices")
    .update({ secret_token_hash: secretTokenHash, secret_token_last_four: secretToken.slice(-4) })
    .eq("id", deviceId);

  if (error) return null;
  return secretToken;
}

export async function deleteSensorDevice(deviceId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from("sensor_devices").delete().eq("id", deviceId);
}
