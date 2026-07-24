import type { Plant } from "@/lib/plants";

const DEFAULT_WATER_INTERVAL_DAYS = 10;

// "6 days ago" / "1 day ago" / "Just added" -> days elapsed since last watering.
function parseLastWatered(lastWatered: string): number {
  const match = lastWatered.match(/(\d+)\s*day/);
  return match ? parseInt(match[1], 10) : 0;
}

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
    const daysSinceLastWater = parseLastWatered(plant.lastWatered);
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
