// Wires advancedWatering.ts's prediction algorithm to real inputs: weather
// (weather.server.ts), hardiness zone (hardiness-zone.server.ts), and each
// plant's growing-condition fields (defaulted when unset — most plants
// don't have soilType/drainageQuality/etc. filled in). Plus/Pro tier only;
// see hasFeature(userId, "advancedWateringAlgorithm").
import type { Plant } from "@/lib/plants";
import { getWeather } from "@/lib/weather.server";
import { getHardinessZone } from "@/lib/hardiness-zone.server";
import { daysSinceCareDate } from "@/lib/careDates";
import { getLatestSensorReading } from "@/lib/sensorReadings";
import {
  predictWateringForGarden,
  type EnvironmentData,
  type PlantWateringProfile,
  type WateringPrediction,
} from "@/lib/advancedWatering";

// Sensible defaults for plants without explicit growing-condition data —
// "average houseplant in an average pot," not tuned per-species.
const DEFAULT_SOIL_TYPE: PlantWateringProfile["soilType"] = "loam";
const DEFAULT_DRAINAGE: PlantWateringProfile["drainageQuality"] = "normal";
const DEFAULT_SUN_EXPOSURE: PlantWateringProfile["sunExposure"] = "partial";
const DEFAULT_CONTAINER_LITERS = 10;

function currentSeason(date: Date = new Date()): EnvironmentData["season"] {
  const month = date.getMonth(); // 0-11
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

// HardinessInfo.zone is a display range like "6-8"; predictWateringNeed
// wants a single number — use the lower bound as a conservative estimate.
function parseZoneNumber(zoneRange: string): number {
  const first = parseInt(zoneRange.split("-")[0], 10);
  return Number.isFinite(first) ? first : 7;
}

// plant.lastWatered is a real ISO timestamp (see plants.ts's doc comment),
// EXCEPT for any not-yet-backfilled garden_plants row still holding the old
// "N days ago" display-string format — daysSinceCareDate's temporary
// fallback (see careDates.ts) handles those transparently. Re-deriving an
// ISO string here (rather than passing plant.lastWatered straight through)
// keeps this working correctly during that transition; once the backfill is
// confirmed complete this can become `lastWatered: plant.lastWatered,`.
function toIsoLastWatered(lastWatered: string): string {
  const days = daysSinceCareDate(lastWatered);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// lastPhotoSoilMoisture is named for its original visual-analysis source,
// but predictWateringNeed only cares about "most recent known soil
// moisture %" — a real sensor reading (see sensorReadings.ts) is strictly
// better ground truth than a photo estimate, so it takes priority whenever
// a sensor is registered for this plant.
export async function plantToWateringProfile(plant: Plant): Promise<PlantWateringProfile> {
  const sensorReading = await getLatestSensorReading(plant.id);

  return {
    plantId: plant.id,
    baseWateringDays: plant.waterIntervalDays ?? 10,
    soilType: plant.soilType ?? DEFAULT_SOIL_TYPE,
    drainageQuality: plant.drainageQuality ?? DEFAULT_DRAINAGE,
    sunExposure: plant.sunExposure ?? DEFAULT_SUN_EXPOSURE,
    containerSize: plant.containerSizeLiters ?? DEFAULT_CONTAINER_LITERS,
    lastWatered: toIsoLastWatered(plant.lastWatered),
    lastPhotoSoilMoisture: sensorReading?.soilMoisture,
  };
}

export async function fetchEnvironmentData(lat?: number, lon?: number): Promise<EnvironmentData | null> {
  const [weatherRes, hardinessRes] = await Promise.all([
    getWeather({ data: { lat, lon } }),
    getHardinessZone({ data: { lat, lon } }),
  ]);

  if (weatherRes.status !== "ok") return null;

  return {
    temperature: weatherRes.data.temp,
    humidity: weatherRes.data.humidity,
    rainfall: weatherRes.data.rainfall,
    precipitation7d: weatherRes.data.rainfall * 3, // no 7-day history available; rough same-conditions estimate
    sunHours: 6, // not exposed by the weather API; assumes a typical daylight duration
    season: currentSeason(),
    hardinesZone: hardinessRes.status === "ok" ? parseZoneNumber(hardinessRes.data.zone) : 7,
  };
}

export async function getAdvancedWateringPredictions(
  plants: Plant[],
  lat?: number,
  lon?: number,
): Promise<Record<string, WateringPrediction> | null> {
  const environment = await fetchEnvironmentData(lat, lon);
  if (!environment) return null;

  const profiles = await Promise.all(plants.map(plantToWateringProfile));
  return predictWateringForGarden(profiles, environment);
}
