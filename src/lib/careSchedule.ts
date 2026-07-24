// Per-plant on/off state for the three Schedule toggles (water, fertilizer,
// repot) shown on Plant Detail — persisted so they survive a reload instead
// of silently resetting to defaults, same localStorage pattern as reminders.ts.
const STORAGE_KEY = "verdant.care-schedule.v1";

export type CareTask = "water" | "fertilizer" | "repot";
export type CareToggles = Record<CareTask, boolean>;

const DEFAULTS: CareToggles = { water: true, fertilizer: true, repot: false };

type ScheduleMap = Record<string, CareToggles>;

function loadAll(): ScheduleMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ScheduleMap;
  } catch {
    return {};
  }
}

function saveAll(map: ScheduleMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getCareToggles(plantId: string): CareToggles {
  return { ...DEFAULTS, ...loadAll()[plantId] };
}

export function setCareToggle(plantId: string, task: CareTask, enabled: boolean): CareToggles {
  const all = loadAll();
  const next = { ...DEFAULTS, ...all[plantId], [task]: enabled };
  all[plantId] = next;
  saveAll(all);
  return next;
}
