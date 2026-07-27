// Derives a timeline entry's health score/classification from real signals
// instead of the random number this used to be (see plant.$id.tsx's git
// history — it was `last.health + (Math.random() > 0.4 ? 4 : -3)`).
//
// The core limitation to be honest about: visual (embedding) similarity
// between two photos tells you HOW MUCH the plant looks different, not
// WHICH DIRECTION that change is. A plant sprouting new leaves and a plant
// developing brown spots can both show low similarity to the last photo —
// both are "the plant looks different now." So similarity alone can only
// ever support two conclusions: "looks about the same" (stable) or "looks
// different" (changed, direction unknown) — never "improved," and never
// "declined" on its own.
//
// Disease detection (Pl@ntNet's identifyDisease, run manually via
// HealthChecks.tsx) is the one signal with real directional meaning: a
// confident disease match is unambiguously bad. When the user runs that
// check on an entry, applyDiseaseAdjustment can revise that entry's score
// downward and reclassify it as "declined" — see adjustEntryForDisease.
import type { TimelineChange } from "./plants";

const HIGH_SIMILARITY_THRESHOLD = 0.85; // "looks about the same"
const LOW_SIMILARITY_THRESHOLD = 0.6; // below this, treat as a real visible change

export type HealthScoreResult = {
  health: number;
  change: TimelineChange;
};

// similarity is null when no previous photo exists to compare against, or
// the embedding call failed — in that case we can't derive anything from
// vision, so the entry is neutral (no score change, "stable").
export function scoreFromSimilarity(previousHealth: number, similarity: number | null): HealthScoreResult {
  if (similarity === null) {
    return { health: previousHealth, change: "stable" };
  }

  if (similarity >= HIGH_SIMILARITY_THRESHOLD) {
    // Little visible change — nudge slightly toward healthy as a mild
    // "no new problem visible" signal, not a strong claim either way.
    return { health: clamp(previousHealth + 1), change: "stable" };
  }

  if (similarity <= LOW_SIMILARITY_THRESHOLD) {
    // Real visible change, direction unknown — flat health (we don't know
    // if it's better or worse) but flagged for the user to look at.
    return { health: previousHealth, change: "changed" };
  }

  // Middle band — some change, not dramatic. Still neutral on direction.
  return { health: previousHealth, change: "stable" };
}

// Called after a manual disease check (see HealthChecks.tsx) returns a
// confident match on an entry that was previously scored by
// scoreFromSimilarity alone. Disease detection has real directional
// meaning, so this is the one case allowed to assert "declined."
const DISEASE_CONFIDENCE_THRESHOLD = 0.4; // matches Pl@ntNet score scale (0-1)
const DISEASE_HEALTH_PENALTY = 8;

export function adjustEntryForDisease(
  current: HealthScoreResult,
  topDiseaseScore: number,
): HealthScoreResult {
  if (topDiseaseScore < DISEASE_CONFIDENCE_THRESHOLD) return current;
  return {
    health: clamp(current.health - DISEASE_HEALTH_PENALTY),
    change: "declined",
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}
