// Tracks consecutive days on which every to-do item was marked done,
// persisted as a set of completed-date strings (YYYY-MM-DD, local).
const STORAGE_KEY = "verdant.streak.v1";

type StreakData = { completedDates: string[] };

function loadData(): StreakData {
  if (typeof window === "undefined") return { completedDates: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completedDates: [] };
    const parsed = JSON.parse(raw) as StreakData;
    if (Array.isArray(parsed.completedDates)) return parsed;
  } catch {
    // ignore
  }
  return { completedDates: [] };
}

function saveData(data: StreakData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function toDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
}

// Call once all of today's tasks are done — idempotent per day.
export function recordDayCompleted(now: Date = new Date()): void {
  const data = loadData();
  const key = toDateKey(now);
  if (!data.completedDates.includes(key)) {
    saveData({ completedDates: [...data.completedDates, key] });
  }
}

// Current streak: consecutive days ending today or yesterday (so the streak
// doesn't zero out the instant midnight passes before today's tasks are done).
export function getCurrentStreak(now: Date = new Date()): number {
  const done = new Set(loadData().completedDates);
  const cursor = new Date(now);

  if (!done.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!done.has(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (done.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// All completed-day keys (YYYY-MM-DD, local), unsorted — for rendering a
// history view (e.g. a calendar heatmap) without exposing the raw storage
// shape to callers.
export function getCompletedDates(): Set<string> {
  return new Set(loadData().completedDates);
}

// Longest run of consecutive completed days ever recorded, independent of
// whether the current streak is still active.
export function getLongestStreak(): number {
  const dates = [...loadData().completedDates].sort();
  if (dates.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const next = new Date(dates[i]);
    const dayDiff = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    current = dayDiff === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

export { toDateKey };
