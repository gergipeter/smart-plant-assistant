import type { Plant } from "@/lib/plants";
import { daysSinceCareDate } from "@/lib/careDates";

const DEFAULT_FERTILIZER_INTERVAL_DAYS = 28;
const DEFAULT_REPOT_INTERVAL_DAYS = 540;

// A plant only counts as due for fertilizing/repotting once it has a
// last-done date at all — unlike watering (which every plant tracks from
// the moment it's added), fertilize/repot are opt-in per plant (see
// careSchedule.ts's toggles) and there's nothing to compare against until
// the user logs the first one via markFertilized/markRepotted below.
export function isDueForFertilizing(plant: Plant): boolean {
  if (!plant.lastFertilized) return false;
  const interval = plant.fertilizerIntervalDays ?? DEFAULT_FERTILIZER_INTERVAL_DAYS;
  return daysSinceCareDate(plant.lastFertilized) >= interval;
}

export function isDueForRepotting(plant: Plant): boolean {
  if (!plant.lastRepotted) return false;
  const interval = plant.repotIntervalDays ?? DEFAULT_REPOT_INTERVAL_DAYS;
  return daysSinceCareDate(plant.lastRepotted) >= interval;
}

// Returns the updated Plant with lastFertilized/lastRepotted reset to right
// now — callers persist it via updatePlantInGarden, same fire-and-forget
// pattern as every other garden edit.
export function markFertilized(plant: Plant): Plant {
  return { ...plant, lastFertilized: new Date().toISOString() };
}

export function markRepotted(plant: Plant): Plant {
  return { ...plant, lastRepotted: new Date().toISOString() };
}

// Resets lastWatered and clears a "needs water"/"needs mist" status back to
// healthy — callers persist it via updatePlantInGarden, same pattern as
// markFertilized/markRepotted above. Unlike those two (opt-in, no status
// effect), watering is the one care action every plant already tracks a
// status badge for, so this also flips status off the moment it's done.
export function markWatered(plant: Plant): Plant {
  const status = plant.status === "needs-water" || plant.status === "needs-mist"
    ? "healthy"
    : plant.status;
  return { ...plant, lastWatered: new Date().toISOString(), status };
}
