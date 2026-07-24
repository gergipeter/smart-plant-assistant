import { savePhoto } from "@/lib/photoStore";
import { recordPhotoTaken } from "@/lib/reminders";

const STREAK_STORAGE_KEY = "verdant.streak.v1";

// Latest timeline entry per garden plant — matches the `hasPhoto: true`
// entries in plants.ts, so the slideshow/compare-slider have a real photo.
const DEMO_PHOTOS: Array<{ entryId: string; plantId: string; src: string }> = [
  { entryId: "m-5", plantId: "monstera", src: "/plants/monstera.jpg" },
  { entryId: "f-4", plantId: "fiddle", src: "/plants/fiddle.jpg" },
  { entryId: "s-3", plantId: "snake", src: "/plants/snake.jpg" },
  { entryId: "p-3", plantId: "pothos", src: "/plants/pothos.jpg" },
  { entryId: "c-4", plantId: "calathea", src: "/plants/calathea.jpg" },
];

function toDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function seedStreak(days: number): void {
  const dates: string[] = [];
  const cursor = new Date();
  for (let i = 0; i < days; i++) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify({ completedDates: dates }));
}

function seedReminders(): void {
  // Stagger "last photo taken" dates so the dashboard reminder banner and
  // watering calendar both have realistic, non-uniform state to show.
  const now = Date.now();
  recordPhotoTaken("monstera", new Date(now - 3 * 86400000));
  recordPhotoTaken("fiddle", new Date(now - 10 * 86400000));
  recordPhotoTaken("snake", new Date(now - 20 * 86400000));
  recordPhotoTaken("pothos", new Date(now - 6 * 86400000));
  recordPhotoTaken("calathea", new Date(now - 28 * 86400000));
}

async function seedPhotos(): Promise<void> {
  for (const { entryId, src } of DEMO_PHOTOS) {
    const res = await fetch(src);
    const blob = await res.blob();
    await savePhoto(entryId, blob);
  }
}

// Populates a fresh browser profile with realistic demo state — a 6-day
// care streak, staggered photo-reminder timestamps, and real photos wired
// into each garden plant's latest timeline entry — so every feature
// (streak badge, watering calendar, slideshow, compare-slider) has
// something to show immediately instead of an empty state.
export async function seedDemoData(): Promise<void> {
  seedStreak(6);
  seedReminders();
  await seedPhotos();
}
