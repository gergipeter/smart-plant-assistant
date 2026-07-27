import type { Plant } from "@/lib/plants";

const DEFAULT_FERTILIZER_INTERVAL_DAYS = 28;
const DEFAULT_REPOT_INTERVAL_DAYS = 540;

// Mirrors waterCalendar.ts's parseLastWatered: "6 days ago" / "Just added" -> days elapsed.
function daysSince(dateLabel: string): number {
  const match = dateLabel.match(/(\d+)\s*day/);
  return match ? parseInt(match[1], 10) : 0;
}

// A plant only counts as due for fertilizing/repotting once it has a
// last-done date at all — unlike watering (which every plant tracks from
// the moment it's added), fertilize/repot are opt-in per plant (see
// careSchedule.ts's toggles) and there's nothing to compare against until
// the user logs the first one via markFertilized/markRepotted below.
export function isDueForFertilizing(plant: Plant): boolean {
  if (!plant.lastFertilized) return false;
  const interval = plant.fertilizerIntervalDays ?? DEFAULT_FERTILIZER_INTERVAL_DAYS;
  return daysSince(plant.lastFertilized) >= interval;
}

export function isDueForRepotting(plant: Plant): boolean {
  if (!plant.lastRepotted) return false;
  const interval = plant.repotIntervalDays ?? DEFAULT_REPOT_INTERVAL_DAYS;
  return daysSince(plant.lastRepotted) >= interval;
}

// Returns the updated Plant with lastFertilized/lastRepotted reset to "Just
// fertilized"/"Just repotted" — callers persist it via updatePlantInGarden,
// same fire-and-forget pattern as every other garden edit.
export function markFertilized(plant: Plant): Plant {
  return { ...plant, lastFertilized: "Just fertilized" };
}

export function markRepotted(plant: Plant): Plant {
  return { ...plant, lastRepotted: "Just repotted" };
}
