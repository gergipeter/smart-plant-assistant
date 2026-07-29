import { createServerFn } from "@tanstack/react-start";

// Wikipedia's REST summary endpoint, used purely for its thumbnail field —
// gives real reference photos for the large majority of species, filling
// the gap left by GBIF's very sparse species-media coverage (spot-checked:
// GBIF had photos for ~1 of 5 common houseplants, often scientific-paper
// figures rather than clean photos; Wikipedia had clean photos for ~8/10
// random species from Pl@ntNet's "useful" project). Requires a real
// User-Agent header or Wikipedia's API returns 429s — this is documented
// API etiquette (https://api.wikimedia.org/wiki/Wikimedia_REST_API), not a
// workaround for a limit meant to block us.
const WIKIPEDIA_USER_AGENT = "VerdantPlantCareApp/1.0 (https://github.com/gergipeter/smart-plant-assistant)";

export type SpeciesPhotoResult =
  | { status: "ok"; url: string; attributionUrl: string }
  | { status: "not-found" }
  | { status: "error"; message: string };

// Catalog/scan data sometimes carries cultivar or common-name noise baked
// into the scientific name (e.g. "Epipremnum aureum (Pothos) 'dwarf'").
// Wikipedia's summary endpoint fuzzy-redirects near-miss titles instead of
// 404ing, so querying with that noise can silently land on the wrong
// species' page (or a genus/disambiguation page) and return its thumbnail
// as if it were correct. Stripping down to the genus + species binomial
// keeps the lookup on the actual article title.
function cleanBinomial(scientificName: string): string {
  return scientificName
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*'[^']*'/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
}

// Loose match: the requested genus (and, if present, species epithet) must
// appear in the returned page's title or description. Rejects thumbnails
// from redirects/disambiguation that landed on an unrelated page.
function pageMatchesSpecies(binomial: string, pageTitle: string, description: string): boolean {
  const [genus, species] = binomial.toLowerCase().split(" ");
  const haystack = `${pageTitle} ${description}`.toLowerCase();
  if (!genus || !haystack.includes(genus)) return false;
  if (species && !haystack.includes(species)) return false;
  return true;
}

export const getSpeciesPhoto = createServerFn({ method: "GET" })
  .validator((data: { scientificName: string }) => data)
  .handler(async ({ data }): Promise<SpeciesPhotoResult> => {
    const binomial = cleanBinomial(data.scientificName);
    if (!binomial) return { status: "not-found" };
    const title = binomial.replace(/\s+/g, "_");

    let response: Response;
    try {
      response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { "User-Agent": WIKIPEDIA_USER_AGENT } },
      );
    } catch {
      return { status: "error", message: "Could not reach Wikipedia." };
    }

    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "error", message: `Request failed (${response.status}).` };

    try {
      const body = (await response.json()) as {
        title?: string;
        description?: string;
        extract?: string;
        thumbnail?: { source?: string };
        content_urls?: { desktop?: { page?: string } };
      };
      const url = body.thumbnail?.source;
      if (!url) return { status: "not-found" };
      if (!pageMatchesSpecies(binomial, body.title ?? "", `${body.description ?? ""} ${body.extract ?? ""}`)) {
        return { status: "not-found" };
      }
      return {
        status: "ok",
        url,
        attributionUrl: body.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      };
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }
  });
