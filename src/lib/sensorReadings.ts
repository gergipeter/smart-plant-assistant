// Reads for physical soil-moisture sensor data (src/routes/api.sensor-ingest.ts
// writes it via the service-role client; this file is the read side used by
// the signed-in user's own browser, going through the anon key + RLS "Users
// view their own sensor readings" policy — same split as myGarden.ts's
// loadRemoteGarden vs. the ingest route's admin writes).
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type SensorReading = {
  soilMoisture: number;
  batteryPercent: number | null;
  createdAt: string;
};

// Sensor data only exists in Supabase — a physical device can't write to a
// signed-out browser's localStorage — so this returns null when Supabase
// isn't configured or the user has no sensor registered for this plant,
// rather than a fallback "local" reading that could never be real.
export async function getLatestSensorReading(plantId: string): Promise<SensorReading | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("sensor_readings")
    .select("soil_moisture, battery_percent, created_at")
    .eq("plant_id", plantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    soilMoisture: data.soil_moisture,
    batteryPercent: data.battery_percent,
    createdAt: data.created_at,
  };
}

