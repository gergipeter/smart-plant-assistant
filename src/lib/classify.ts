import { plants, speciesCatalog, expandedSpeciesCatalog, type Plant } from "@/lib/plants";
import type { PlantNetResult } from "@/lib/plantnet.server";
import type { ProjectSpeciesEntry } from "@/lib/plantnet.server";
import type { VisionSpeciesGuess } from "@/lib/image-recognition.server";

// expandedSpeciesCatalog is already deduped against plants/speciesCatalog by
// scientific name in plants.ts, so no overlap to worry about here.
const allPlants = [...plants, ...speciesCatalog, ...expandedSpeciesCatalog];

export type Prediction = { className: string; probability: number };

type MobileNetModel = { classify: (input: TfImageSource) => Promise<Prediction[]> };
type TfImageSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

let modelPromise: Promise<MobileNetModel> | null = null;

// Lazy client-only load: tfjs registers a WebGL/canvas backend at import time,
// which breaks Nitro's cloudflare SSR build if imported at module top-level.
function loadModel(): Promise<MobileNetModel> {
  if (!modelPromise) {
    modelPromise = Promise.all([
      import("@tensorflow/tfjs"),
      import("@tensorflow-models/mobilenet"),
    ]).then(([, mobilenet]) => mobilenet.load());
  }
  return modelPromise;
}

export async function classifyImage(source: TfImageSource): Promise<Prediction[]> {
  const model = await loadModel();
  return model.classify(source);
}

// Plant-specific keywords beyond name/scientific name, since MobileNet's
// ImageNet classes don't include most houseplant species by their common names.
const plantKeywords: Record<string, string[]> = {
  monstera: ["philodendron", "split-leaf", "split leaf", "swiss cheese"],
  fiddle: ["ficus lyrata", "banyan"],
  snake: ["sansevieria", "bowstring hemp"],
  pothos: ["devil's ivy", "epipremnum"],
  calathea: ["goeppertia", "zebra plant"],
  "zz-plant": ["zamioculcas", "zz", "eternity plant"],
  "peace-lily": ["spathiphyllum", "peace lily"],
  "aloe-vera": ["aloe"],
  "spider-plant": ["chlorophytum", "spider plant", "airplane plant"],
  "philodendron-brasil": ["philodendron", "heartleaf"],
  "rubber-plant": ["ficus elastica", "rubber plant", "rubber tree"],
  "jade-plant": ["crassula", "jade plant", "money plant", "lucky plant"],
  orchid: ["phalaenopsis", "orchid", "moth orchid"],
  peperomia: ["peperomia", "radiator plant"],
  "boston-fern": ["nephrolepis", "boston fern", "sword fern"],
  "english-ivy": ["hedera", "english ivy"],
  "chinese-money-plant": ["pilea", "coin plant", "missionary plant", "ufo plant"],
  "string-of-pearls": ["curio", "senecio rowleyanus", "string of pearls", "bead plant"],
  "bird-of-paradise": ["strelitzia", "bird of paradise"],
  "areca-palm": ["dypsis", "areca palm", "butterfly palm", "palm"],
  croton: ["codiaeum", "croton"],
  anthurium: ["anthurium", "flamingo flower", "laceleaf"],
  "dracaena-marginata": ["dracaena", "dragon tree", "madagascar dragon tree"],
  haworthia: ["haworthiopsis", "haworthia", "zebra cactus"],
  "christmas-cactus": ["schlumbergera", "christmas cactus", "thanksgiving cactus"],
  "air-plant": ["tillandsia", "air plant"],
  bromeliad: ["guzmania", "bromeliad", "bromelia"],
  begonia: ["begonia"],
  "african-violet": ["saintpaulia", "african violet"],
  "money-tree": ["pachira", "money tree", "guiana chestnut"],
  "prayer-plant": ["maranta", "prayer plant"],
  "asparagus-fern": ["asparagus setaceus", "asparagus fern"],
  "cast-iron-plant": ["aspidistra", "cast iron plant", "cast-iron plant"],
  "chinese-evergreen": ["aglaonema", "chinese evergreen"],
  kalanchoe: ["kalanchoe"],
  "ponytail-palm": ["beaucarnea", "ponytail palm", "elephant foot tree", "nolina"],
};

// Below this weighted score, we don't trust the match enough to claim it —
// see MIN_MATCH_SCORE below.
const MIN_MATCH_SCORE = 0.12;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// True if `needle` (a whole word or multi-word phrase) appears as a
// contiguous run of whole words inside `haystack` — avoids false positives
// like "aloe" matching inside an unrelated longer word.
function containsPhrase(haystackWords: string[], needleWords: string[]): boolean {
  if (needleWords.length > haystackWords.length) return false;
  for (let i = 0; i <= haystackWords.length - needleWords.length; i++) {
    let match = true;
    for (let j = 0; j < needleWords.length; j++) {
      if (haystackWords[i + j] !== needleWords[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function scorePlant(plant: Plant, predictions: Prediction[]): number {
  const haystacks = [
    normalize(plant.name),
    normalize(plant.scientific),
    ...(plantKeywords[plant.id] ?? []).map(normalize),
  ].map((h) => h.split(" "));

  let score = 0;
  for (const prediction of predictions) {
    // MobileNet labels are comma-separated synonym groups (e.g. "vase, jar, pot") —
    // score each synonym phrase independently so they don't merge into one long run.
    const synonyms = prediction.className.split(",").map((s) => normalize(s).split(" "));
    for (const labelWords of synonyms) {
      for (const needleWords of haystacks) {
        if (containsPhrase(labelWords, needleWords) || containsPhrase(needleWords, labelWords)) {
          score += prediction.probability;
          break;
        }
      }
    }
  }
  return score;
}

export function matchPlant(predictions: Prediction[]): {
  plant: Plant | null;
  prediction: Prediction;
} {
  let best: Plant | null = null;
  let bestScore = 0;
  for (const plant of allPlants) {
    const score = scorePlant(plant, predictions);
    if (score > bestScore) {
      bestScore = score;
      best = plant;
    }
  }

  return {
    plant: bestScore >= MIN_MATCH_SCORE ? best : null,
    prediction: predictions[0],
  };
}

// Pl@ntNet returns real botanical names, so we can match precisely on
// genus + species rather than the fuzzy keyword scoring MobileNet's noisy
// ImageNet labels need. Falls back to common-name overlap if no catalog
// plant's scientific name matches any returned species.
const MIN_PLANTNET_SCORE = 0.1;

// Independent of whether we have catalog data for it, this is the bar for
// trusting Pl@ntNet's own top identification enough to show it as "we know
// what this is, we just don't have care info for it" rather than "unsure".
const MIN_IDENTIFIED_SCORE = 0.2;

function scientificNameMatches(catalogScientific: string, resultScientific: string): boolean {
  const a = normalize(catalogScientific).split(" ");
  const b = normalize(resultScientific).split(" ");
  // Compare genus + species (first two words) — ignores cultivar suffixes
  // like "'Brasil'" that PlantNet may omit or that our catalog includes.
  return a.length >= 2 && b.length >= 2 && a[0] === b[0] && a[1] === b[1];
}

export function matchPlantByScientificName(results: PlantNetResult[]): {
  plant: Plant | null;
  top: PlantNetResult | null;
  // True when Pl@ntNet itself was confident about `top`, even if `plant` is
  // null because that species isn't in our catalog — lets the UI say
  // "we know what this is, we just don't track it" instead of "not sure".
  identifiedButUncataloged: boolean;
} {
  const top = results[0] ?? null;
  if (!top) return { plant: null, top: null, identifiedButUncataloged: false };

  let best: Plant | null = null;
  let bestScore = 0;

  for (const plant of allPlants) {
    for (const result of results) {
      let score = 0;
      if (scientificNameMatches(plant.scientific, result.scientificName)) {
        score = result.score;
      } else {
        const commonHaystacks = [normalize(plant.name).split(" ")];
        for (const common of result.commonNames) {
          const commonWords = normalize(common).split(" ");
          for (const needleWords of commonHaystacks) {
            if (
              containsPhrase(commonWords, needleWords) ||
              containsPhrase(needleWords, commonWords)
            ) {
              score = Math.max(score, result.score * 0.6);
            }
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = plant;
      }
    }
  }

  const plant = bestScore >= MIN_PLANTNET_SCORE ? best : null;

  return {
    plant,
    top,
    identifiedButUncataloged: !plant && top.score >= MIN_IDENTIFIED_SCORE,
  };
}

// Vision's guesses are free-text (web-entity titles, ImageNet-style labels)
// rather than structured botanical names — no genus/species split to compare
// like Pl@ntNet, so match against catalog name/scientific name/keyword
// phrases the same way the on-device MobileNet path does, just against
// Vision's (generally more specific) candidate list instead.
const MIN_VISION_MATCH_SCORE = 0.15;

export function matchPlantByVisionGuess(guesses: VisionSpeciesGuess[]): {
  plant: Plant | null;
  top: VisionSpeciesGuess | null;
} {
  const top = guesses[0] ?? null;
  if (!top) return { plant: null, top: null };

  let best: Plant | null = null;
  let bestScore = 0;

  for (const plant of allPlants) {
    const haystacks = [
      normalize(plant.name).split(" "),
      normalize(plant.scientific).split(" "),
      ...(plantKeywords[plant.id] ?? []).map((k) => normalize(k).split(" ")),
    ];

    for (const guess of guesses) {
      const guessWords = normalize(guess.name).split(" ");
      for (const needleWords of haystacks) {
        if (containsPhrase(guessWords, needleWords) || containsPhrase(needleWords, guessWords)) {
          if (guess.score > bestScore) {
            bestScore = guess.score;
            best = plant;
          }
          break;
        }
      }
    }
  }

  return { plant: bestScore >= MIN_VISION_MATCH_SCORE ? best : null, top };
}

// When a Vision guess doesn't match anything in our ~300-plant local
// catalog, it may still name a real species — Pl@ntNet's own flora dump
// (getSpecies/getProjectSpecies, ~5500 real botanical entries with
// family/genus/GBIF/POWO/IUCN data) is a much larger corpus to check the
// guess against before giving up entirely. Matches on common-name overlap
// since Vision guesses are rarely proper scientific-name text.
const MIN_SPECIES_CORPUS_SCORE = 0.15;

export function matchVisionGuessToSpecies(
  guesses: VisionSpeciesGuess[],
  speciesCorpus: ProjectSpeciesEntry[],
): ProjectSpeciesEntry | null {
  let best: ProjectSpeciesEntry | null = null;
  let bestScore = 0;

  for (const guess of guesses) {
    if (guess.score < MIN_SPECIES_CORPUS_SCORE) continue;
    const guessWords = normalize(guess.name).split(" ");

    for (const entry of speciesCorpus) {
      if (!entry?.scientificNameWithoutAuthor) continue;
      const haystacks = [
        normalize(entry.scientificNameWithoutAuthor).split(" "),
        ...entry.commonNames.map((c) => normalize(c).split(" ")),
      ];
      for (const needleWords of haystacks) {
        if (containsPhrase(guessWords, needleWords) || containsPhrase(needleWords, guessWords)) {
          if (guess.score > bestScore) {
            bestScore = guess.score;
            best = entry;
          }
          break;
        }
      }
    }
  }

  return best;
}
