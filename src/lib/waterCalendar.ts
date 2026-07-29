import type { Plant } from "@/lib/plants";
import { daysSinceCareDate } from "@/lib/careDates";

const DEFAULT_WATER_INTERVAL_DAYS = 10;

export type WaterEvent = { plantId: string; plantName: string };

// Projects upcoming watering days for each plant over `daysAhead` days,
// starting today, based on each plant's last-watered date and interval.
export function buildWaterCalendar(
  plants: Plant[],
  daysAhead: number,
  now: Date = new Date(),
): Map<string, WaterEvent[]> {
  const byDate = new Map<string, WaterEvent[]>();

  for (const plant of plants) {
    const interval = plant.waterIntervalDays ?? DEFAULT_WATER_INTERVAL_DAYS;
    const daysSinceLastWater = daysSinceCareDate(plant.lastWatered, now);
    // Next due day, relative to today (0 = today), then repeating every `interval` days.
    let nextDue = interval - daysSinceLastWater;
    while (nextDue < 0) nextDue += interval;

    for (let offset = nextDue; offset < daysAhead; offset += interval) {
      const date = new Date(now);
      date.setDate(date.getDate() + offset);
      const key = date.toLocaleDateString("en-CA");
      const events = byDate.get(key) ?? [];
      events.push({ plantId: plant.id, plantName: plant.name });
      byDate.set(key, events);
    }
  }

  return byDate;
}
