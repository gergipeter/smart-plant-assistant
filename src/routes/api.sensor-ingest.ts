// Soil-moisture sensor ingestion — a raw HTTP endpoint, not a createServerFn
// RPC, since a physical device (ESP8266/ESP32 firmware, see
// hardware/sensor-firmware/README.md) calls this directly over plain HTTP/JSON and
// can't do TanStack Start's RPC handshake or hold a Supabase user session.
// Same shape as api.stripe-webhook.ts: verify the caller out-of-band (there
// a webhook signature, here a per-device bearer token), then write via the
// service-role client, which bypasses RLS.
import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/lib/stripe.server";

type IngestBody = {
  soilMoisture: unknown;
  batteryPercent?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Fixed-window limit tracked per-device on sensor_devices.window_started_at /
// window_hit_count (see supabase/schema.sql) — a real sensor reports every few
// minutes at most, so this only bites token brute-forcing / abuse, not normal
// use. No separate table/cron needed: the window resets lazily on next hit.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_HITS = 12;

export const Route = createFileRoute("/api/sensor-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const admin = getSupabaseAdmin();
        if (!admin) {
          return new Response(JSON.stringify({ error: "Not configured" }), { status: 500 });
        }

        const auth = request.headers.get("authorization");
        const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
        if (!token) {
          return new Response(JSON.stringify({ error: "Missing bearer token" }), { status: 401 });
        }

        let body: IngestBody;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
        }

        if (!isFiniteNumber(body.soilMoisture) || body.soilMoisture < 0 || body.soilMoisture > 100) {
          return new Response(
            JSON.stringify({ error: "soilMoisture must be a number between 0 and 100" }),
            { status: 400 },
          );
        }
        const batteryPercent = isFiniteNumber(body.batteryPercent) ? body.batteryPercent : null;

        // Lookup is by hash, not the raw token — the DB never stores or
        // compares the plaintext bearer credential, so there's nothing for a
        // leaked backup/log/query result to expose beyond what the device
        // itself holds.
        const tokenHash = await sha256Hex(token);
        const { data: device, error: deviceError } = await admin
          .from("sensor_devices")
          .select("id, user_id, plant_id, window_started_at, window_hit_count")
          .eq("secret_token_hash", tokenHash)
          .maybeSingle();

        if (deviceError || !device) {
          return new Response(JSON.stringify({ error: "Unknown device token" }), { status: 401 });
        }

        const now = new Date();
        const nowIso = now.toISOString();
        const windowStarted = new Date(device.window_started_at);
        const windowExpired = now.getTime() - windowStarted.getTime() > RATE_LIMIT_WINDOW_MS;
        const nextHitCount = windowExpired ? 1 : device.window_hit_count + 1;

        if (!windowExpired && nextHitCount > RATE_LIMIT_MAX_HITS) {
          return new Response(JSON.stringify({ error: "Too many requests" }), {
            status: 429,
            headers: { "retry-after": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
          });
        }

        await admin
          .from("sensor_devices")
          .update({
            window_started_at: windowExpired ? nowIso : device.window_started_at,
            window_hit_count: nextHitCount,
          })
          .eq("id", device.id);

        const { error: insertError } = await admin.from("sensor_readings").insert({
          device_id: device.id,
          user_id: device.user_id,
          plant_id: device.plant_id,
          soil_moisture: body.soilMoisture,
          battery_percent: batteryPercent,
          created_at: nowIso,
        });

        if (insertError) {
          console.error("sensor-ingest: failed to insert reading:", insertError);
          return new Response(JSON.stringify({ error: "Failed to store reading" }), { status: 500 });
        }

        await admin.from("sensor_devices").update({ last_seen_at: nowIso }).eq("id", device.id);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
