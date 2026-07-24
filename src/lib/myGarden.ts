import { useEffect, useState } from "react";
import { plants, type Plant, type PlantStatus } from "@/lib/plants";
import type { PlantNetResult } from "@/lib/plantnet.server";

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

export function loadMyGarden(): Plant[] {
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

function saveMyGarden(saved: Plant[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // ignore
  }
}

// Returns the id actually stored under — either the existing entry's id if
// this plant (by id or scientific name) was already saved, or the new
// plant's own id once freshly added. Callers should navigate using this
// return value rather than assuming `plant.id` was the one saved.
export function addToMyGarden(plant: Plant): string {
  const saved = loadMyGarden();
  // De-dupe by id (catalog plants keep a stable id) or scientific name
  // (scanned plants get a fresh id per scan, e.g. Date.now()-based).
  const existing = saved.find((p) => p.id === plant.id || p.scientific === plant.scientific);
  if (existing) return existing.id;
  saveMyGarden([...saved, plant]);
  return plant.id;
}

export function getFromMyGarden(id: string): Plant | undefined {
  return loadMyGarden().find((p) => p.id === id);
}

// Merges the static catalog-owned garden with anything the user has scanned
// and added, hydrating from localStorage after mount to avoid SSR mismatch.
// The catalog is demo content shown by default on first run; once dismissed
// via hideDemoCatalog(), only user-added plants remain, which can be zero —
// see the dashboard's empty state for that case.
export function useGardenPlants(): Plant[] {
  const [garden, setGarden] = useState<Plant[]>(plants);

  useEffect(() => {
    const base = isDemoCatalogHidden() ? [] : plants;
    setGarden([...base, ...loadMyGarden()]);
  }, []);

  return garden;
}

// Client-only lookup for a single saved plant, used as a fallback when the
// SSR-safe getPlant() (static catalog only) doesn't find a match. `hydrated`
// distinguishes "still resolving" from "genuinely not found" so callers
// don't flash a 404 before the localStorage check has run.
export function useGardenPlant(id: string): { plant: Plant | undefined; hydrated: boolean } {
  const [plant, setPlant] = useState<Plant | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPlant(getFromMyGarden(id));
    setHydrated(true);
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
