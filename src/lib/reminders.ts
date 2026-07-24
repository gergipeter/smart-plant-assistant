// In-app "time to take a photo" reminders, per plant. No push notifications —
// this just persists a preferred interval and the last-photo date so the UI
// can show a due/overdue banner next time the app is opened.
const STORAGE_KEY = "verdant.photo-reminders.v1";

export type ReminderSettings = {
  enabled: boolean;
  intervalDays: number;
  lastPhotoAt: string | null; // ISO date string
};

const DEFAULT_INTERVAL_DAYS = 30;

function defaults(): ReminderSettings {
  return { enabled: true, intervalDays: DEFAULT_INTERVAL_DAYS, lastPhotoAt: null };
}

type ReminderMap = Record<string, ReminderSettings>;

function loadAll(): ReminderMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ReminderMap;
  } catch {
    return {};
  }
}

function saveAll(map: ReminderMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getReminder(plantId: string): ReminderSettings {
  return loadAll()[plantId] ?? defaults();
}

export function setReminderSettings(
  plantId: string,
  patch: Partial<Pick<ReminderSettings, "enabled" | "intervalDays">>,
): ReminderSettings {
  const all = loadAll();
  const next = { ...defaults(), ...all[plantId], ...patch };
  all[plantId] = next;
  saveAll(all);
  return next;
}

export function recordPhotoTaken(plantId: string, when: Date = new Date()): ReminderSettings {
  const all = loadAll();
  const next = { ...defaults(), ...all[plantId], lastPhotoAt: when.toISOString() };
  all[plantId] = next;
  saveAll(all);
  return next;
}

export type ReminderStatus = {
  due: boolean;
  daysSinceLastPhoto: number | null;
  daysUntilDue: number | null;
};

export function getReminderStatus(plantId: string, now: Date = new Date()): ReminderStatus {
  const settings = getReminder(plantId);
  if (!settings.enabled) return { due: false, daysSinceLastPhoto: null, daysUntilDue: null };

  if (!settings.lastPhotoAt) {
    return { due: true, daysSinceLastPhoto: null, daysUntilDue: 0 };
  }

  const msSinceLastPhoto = now.getTime() - new Date(settings.lastPhotoAt).getTime();
  const daysSinceLastPhoto = Math.floor(msSinceLastPhoto / (24 * 60 * 60 * 1000));
  const daysUntilDue = settings.intervalDays - daysSinceLastPhoto;

  return {
    due: daysUntilDue <= 0,
    daysSinceLastPhoto,
    daysUntilDue,
  };
}
