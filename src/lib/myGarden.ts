import { useEffect, useState } from "react";
import { plants, type Plant, type PlantStatus } from "@/lib/plants";
import type { PlantNetResult, ProjectSpeciesEntry } from "@/lib/plantnet.server";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getSubscriptionAsync, TIER_FEATURES } from "@/lib/premium";

const STORAGE_KEY = "verdant.my-garden.v1";
const DEMO_HIDDEN_KEY = "verdant.demo-catalog-hidden.v1";

// The 5 built-in catalog plants act as demo content shown on first run.
// Once a user explicitly dismisses them (see hideDemoCatalog), this flag
// persists so a genuinely empty garden can render its empty state instead
// of the demo plants reappearing on every visit.
export function isDemoCatalogHidden(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEMO_HIDDEN_KEY) === "1";
}

export function hideDemoCatalog(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_HIDDEN_KEY, "1");
}

export function showDemoCatalog(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_HIDDEN_KEY);
}

// ---- localStorage backend (signed-out / Supabase not configured) ----

function loadLocalGarden(): Plant[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Plant[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

function saveLocalGarden(saved: Plant[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // ignore
  }
}

// ---- Supabase backend (signed-in) ----

async function loadRemoteGarden(userId: string): Promise<Plant[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("garden_plants")
    .select("data")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((row) => row.data as Plant);
}

async function upsertRemotePlant(userId: string, plant: Plant): Promise<void> {
  if (!supabase) return;
  await supabase.from("garden_plants").upsert({
    id: plant.id,
    user_id: userId,
    data: plant,
    updated_at: new Date().toISOString(),
  });
}

// Reads the current session synchronously from supabase-js's in-memory
// cache (populated on client init / after auth state changes) — avoids an
// async round trip just to decide which storage backend to use.
function getCurrentUserId(): string | null {
  if (!supabase) return null;
  // supabase-js persists the session in localStorage and hydrates this
  // synchronously on client creation, so this read is safe post-mount.
  const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  if (!key) return null;
  try {
    const session = JSON.parse(localStorage.getItem(key) || "null");
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Merges the static catalog-owned garden with anything the user has scanned
// and added, hydrating after mount to avoid SSR mismatch. When signed in
// with Supabase configured, garden data is fetched from (and written to)
// the `garden_plants` table; otherwise it falls back to localStorage so the
// app keeps working fully offline / signed-out.
export function useGardenPlants(): Plant[] {
  const [garden, setGarden] = useState<Plant[]>(plants);

  useEffect(() => {
    const base = isDemoCatalogHidden() ? [] : plants;
    const userId = isSupabaseConfigured ? getCurrentUserId() : null;

    if (userId) {
      loadRemoteGarden(userId).then((remote) => setGarden([...base, ...remote]));
    } else {
      setGarden([...base, ...loadLocalGarden()]);
    }
  }, []);

  return garden;
}

// Checks the user's own added-plant count (the demo catalog doesn't count —
// it's dismissible sample content, not something a free user "owns") against
// their tier's maxPlants limit. Returns true if signed out / Supabase not
// configured (no way to enforce a cross-device limit without an account —
// falls back to the localStorage-only free experience).
export async function canAddPlant(userId: string | undefined): Promise<boolean> {
  if (!userId) return true;

  const sub = await getSubscriptionAsync(userId);
  const limit = TIER_FEATURES[sub.tier].maxPlants;

  const remoteUserId = isSupabaseConfigured ? getCurrentUserId() : null;
  const owned = remoteUserId ? (await loadRemoteGarden(remoteUserId)).length : loadLocalGarden().length;

  return owned < limit;
}

// Returns the id actually stored under — either the existing entry's id if
// this plant (by id or scientific name) was already saved, or the new
// plant's own id once freshly added. Callers should navigate using this
// return value rather than assuming `plant.id` was the one saved.
//
// Writes are synchronous-looking (id is generated client-side and returned
// immediately) but persist in the background: to Supabase when signed in,
// to localStorage otherwise. A signed-in write also mirrors to
// localStorage so useGardenPlant()'s synchronous-feeling read has a cache.
export function addToMyGarden(plant: Plant): string {
  const saved = loadLocalGarden();
  const existing = saved.find((p) => p.id === plant.id || p.scientific === plant.scientific);
  if (existing) return existing.id;

  saveLocalGarden([...saved, plant]);

  const userId = isSupabaseConfigured ? getCurrentUserId() : null;
  if (userId) {
    upsertRemotePlant(userId, plant).catch((err) => {
      console.error("Failed to sync plant to Supabase:", err);
    });
  }

  return plant.id;
}

export function getFromMyGarden(id: string): Plant | undefined {
  return loadLocalGarden().find((p) => p.id === id);
}

// Persists a full updated Plant (e.g. after appending/editing a timeline
// entry — see plant.$id.tsx's handleUpload). Upserts: if this plant wasn't
// already saved (e.g. it's one of the static demo-catalog plants the user
// hasn't explicitly added), it's saved now as an owned copy so the edit
// isn't silently lost. Same fire-and-forget persistence pattern as
// addToMyGarden — updates the local cache immediately, syncs to Supabase in
// the background when signed in.
export function updatePlantInGarden(plant: Plant): void {
  const saved = loadLocalGarden();
  const index = saved.findIndex((p) => p.id === plant.id);
  const next = index >= 0 ? saved.map((p, i) => (i === index ? plant : p)) : [...saved, plant];
  saveLocalGarden(next);

  const userId = isSupabaseConfigured ? getCurrentUserId() : null;
  if (userId) {
    upsertRemotePlant(userId, plant).catch((err) => {
      console.error("Failed to sync plant update to Supabase:", err);
    });
  }
}

// Creates a new "cutting" plant linked back to `parent`, and records the
// cutting on the parent's `childPlantIds` — both writes go through
// updatePlantInGarden/addToMyGarden's normal upsert-and-sync path, so the
// lineage survives across devices the same way any other garden edit does.
// Returns the new cutting's id.
export function propagatePlant(parent: Plant, cuttingName?: string): string {
  const now = new Date();
  const id = `${parent.id}-cutting-${now.getTime().toString(36)}`;
  const monthShort = now.toLocaleString("en-US", { month: "short", year: "numeric" });
  const dateLong = now.toLocaleString("en-US", { month: "long", day: "numeric" });

  const cutting: Plant = {
    ...parent,
    id,
    name: cuttingName?.trim() || `${parent.name} (cutting)`,
    health: parent.health,
    status: "healthy",
    lastWatered: "Just added",
    nextTask: "Let it root",
    propagatedFromId: parent.id,
    childPlantIds: undefined,
    timeline: [
      {
        id: `${id}-1`,
        month: monthShort,
        date: dateLong,
        emoji: parent.emoji,
        gradient: parent.gradient,
        health: parent.health,
        change: "new",
        headline: "Propagated as a cutting",
        detail: `Taken from ${parent.name}. Track its own rooting and growth here.`,
      },
    ],
  };

  addToMyGarden(cutting);
  updatePlantInGarden({ ...parent, childPlantIds: [...(parent.childPlantIds ?? []), id] });

  return id;
}

// Client-only lookup for a single saved plant, used as a fallback when the
// SSR-safe getPlant() (static catalog only) doesn't find a match. `hydrated`
// distinguishes "still resolving" from "genuinely not found" so callers
// don't flash a 404 before the lookup has run.
export function useGardenPlant(id: string): { plant: Plant | undefined; hydrated: boolean } {
  const [plant, setPlant] = useState<Plant | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const local = getFromMyGarden(id);
    if (local) {
      setPlant(local);
      setHydrated(true);
      return;
    }

    const userId = isSupabaseConfigured ? getCurrentUserId() : null;
    if (userId) {
      loadRemoteGarden(userId).then((remote) => {
        setPlant(remote.find((p) => p.id === id));
        setHydrated(true);
      });
    } else {
      setHydrated(true);
    }
  }, [id]);

  return { plant, hydrated };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Neutral placeholder styling for species we have no curated data for —
// reuses the app's oklch color convention (light bg + dark text, same hue).
const PLACEHOLDER_GRADIENT = "bg-[oklch(0.84_0.04_150)]";
const PLACEHOLDER_TONE = "text-[oklch(0.31_0.04_150)]";

export function buildScannedPlant(top: PlantNetResult): Plant {
  const id = `scan-${slugify(top.scientificName)}-${Date.now().toString(36)}`;
  const name = top.commonNames[0] ?? top.scientificName;
  const status: PlantStatus = "healthy";

  return {
    id,
    name,
    scientific: top.scientificName,
    emoji: "🌱",
    gradient: PLACEHOLDER_GRADIENT,
    tone: PLACEHOLDER_TONE,
    status,
    health: 75,
    origin: "Unknown",
    toxicity: "Mildly toxic",
    water:
      "We don't have verified care guidance for this species yet — check a trusted plant-care source.",
    sunlight:
      "We don't have verified care guidance for this species yet — check a trusted plant-care source.",
    soil: "We don't have verified care guidance for this species yet — check a trusted plant-care source.",
    fact: `Identified via Pl@ntNet scan (${Math.round(top.score * 100)}% confidence). Not yet in our curated catalog.`,
    lastWatered: "Just added",
    nextTask: "Research care needs",
    timeline: [
      {
        id: `${id}-1`,
        month: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
        date: new Date().toLocaleString("en-US", { month: "long", day: "numeric" }),
        emoji: "🌱",
        gradient: PLACEHOLDER_GRADIENT,
        health: 75,
        change: "new",
        headline: "Added to your garden",
        detail: `Identified as ${top.scientificName} via Pl@ntNet scan.`,
      },
    ],
  };
}

// Same shape as buildScannedPlant, but for a species picked from the
// Explore reference library (plantnet.server.ts's getSpecies/getVarieties)
// rather than an identify scan — no confidence score exists here, so the
// fact/detail text says "from Pl@ntNet's species database" instead.
export function buildPlantFromSpecies(entry: ProjectSpeciesEntry): Plant {
  const id = `species-${slugify(entry.scientificNameWithoutAuthor)}-${Date.now().toString(36)}`;
  const name = entry.commonNames[0] ?? entry.scientificNameWithoutAuthor;
  const status: PlantStatus = "healthy";

  return {
    id,
    name,
    scientific: entry.scientificNameWithoutAuthor,
    emoji: "🌱",
    gradient: PLACEHOLDER_GRADIENT,
    tone: PLACEHOLDER_TONE,
    status,
    health: 75,
    origin: "Unknown",
    toxicity: "Mildly toxic",
    water:
      "We don't have verified care guidance for this species yet — check a trusted plant-care source.",
    sunlight:
      "We don't have verified care guidance for this species yet — check a trusted plant-care source.",
    soil: "We don't have verified care guidance for this species yet — check a trusted plant-care source.",
    fact: `From Pl@ntNet's species database${entry.family ? ` (${entry.family})` : ""}. Not yet in our curated catalog.`,
    lastWatered: "Just added",
    nextTask: "Research care needs",
    timeline: [
      {
        id: `${id}-1`,
        month: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
        date: new Date().toLocaleString("en-US", { month: "long", day: "numeric" }),
        emoji: "🌱",
        gradient: PLACEHOLDER_GRADIENT,
        health: 75,
        change: "new",
        headline: "Added to your garden",
        detail: `Added from Explore as ${entry.scientificNameWithoutAuthor}.`,
      },
    ],
  };
}
