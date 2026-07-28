import type { Plant, TimelineEntry } from "@/lib/plants";
import { dateLocale, type Locale } from "@/lib/i18n";

export type GardenDigest = {
  periodLabel: string; // e.g. "March 2026"
  plantCount: number;
  newPlantsThisMonth: { id: string; name: string }[];
  entriesThisMonth: number;
  healthTrend: number; // sum of health deltas across all plants' entries this month
  mostImproved: { id: string; name: string; delta: number } | null;
  mostDeclined: { id: string; name: string; delta: number } | null;
  plantsNeedingAttention: { id: string; name: string }[];
};

function isInMonth(entry: TimelineEntry, monthShort: string): boolean {
  return entry.month === monthShort;
}

// Aggregates a month's worth of garden activity from data the app already
// stores (Plant.timeline) — no new tracking needed, just a summary view over
// existing entries. Gated behind the "customReports" (Pro) feature — see
// premium.ts's TIER_FEATURES — since it's presented as "detailed plant care
// reports" there.
export function buildGardenDigest(plants: Plant[], locale: Locale, now: Date = new Date()): GardenDigest {
  const monthShort = now.toLocaleString(dateLocale(locale), { month: "short", year: "numeric" });
  const periodLabel = now.toLocaleString(dateLocale(locale), { month: "long", year: "numeric" });

  const newPlantsThisMonth: { id: string; name: string }[] = [];
  let entriesThisMonth = 0;
  let healthTrend = 0;
  let mostImproved: { id: string; name: string; delta: number } | null = null;
  let mostDeclined: { id: string; name: string; delta: number } | null = null;

  for (const plant of plants) {
    const monthEntries = plant.timeline.filter((e) => isInMonth(e, monthShort));
    entriesThisMonth += monthEntries.length;

    if (monthEntries.some((e) => e.change === "new")) {
      newPlantsThisMonth.push({ id: plant.id, name: plant.name });
    }

    if (monthEntries.length > 0) {
      const first = monthEntries[0];
      const last = monthEntries[monthEntries.length - 1];
      const delta = last.health - first.health;
      healthTrend += delta;

      if (delta > 0 && (!mostImproved || delta > mostImproved.delta)) {
        mostImproved = { id: plant.id, name: plant.name, delta };
      }
      if (delta < 0 && (!mostDeclined || delta < mostDeclined.delta)) {
        mostDeclined = { id: plant.id, name: plant.name, delta };
      }
    }
  }

  const plantsNeedingAttention = plants
    .filter((p) => p.status !== "healthy")
    .map((p) => ({ id: p.id, name: p.name }));

  return {
    periodLabel,
    plantCount: plants.length,
    newPlantsThisMonth,
    entriesThisMonth,
    healthTrend,
    mostImproved,
    mostDeclined,
    plantsNeedingAttention,
  };
}
