// Shared "how long since this care action" math for lastWatered/lastFertilized/
// lastRepotted — these fields hold real ISO 8601 timestamps (see plants.ts's
// doc comments), not display strings. This replaces what used to be 4
// separately-duplicated regex parsers (waterCalendar.ts, careDueStatus.ts,
// advancedWateringIntegration.ts, and the send-watering-reminders Edge
// Function each had their own copy of the same "6 days ago" -> 6 logic).
//
// TEMPORARY: some already-persisted garden_plants rows (and, until the seed
// data conversion lands, some seed plants) may still hold the old-style
// "N days ago" / "Just watered" display strings from before this migration.
// The fallback below keeps those parsing correctly until every source is
// confirmed converted (see the DB backfill script) — remove it once that's
// done, since silently supporting two formats forever defeats the point of
// having real timestamps.
const LEGACY_DAYS_PATTERN = /(\d+)\s*day/;

export function daysSinceCareDate(iso: string, now: Date = new Date()): number {
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    const days = (now.getTime() - parsed.getTime()) / 86_400_000;
    return Math.max(0, Math.floor(days));
  }

  // Legacy fallback — iso wasn't a valid date, so it's probably still an
  // old-style "N days ago" string.
  const match = iso.match(LEGACY_DAYS_PATTERN);
  return match ? parseInt(match[1], 10) : 0;
}
