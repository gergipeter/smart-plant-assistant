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

export const getSpeciesPhoto = createServerFn({ method: "GET" })
  .validator((data: { scientificName: string }) => data)
  .handler(async ({ data }): Promise<SpeciesPhotoResult> => {
    const title = data.scientificName.trim().replace(/\s+/g, "_");
    if (!title) return { status: "not-found" };

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
        thumbnail?: { source?: string };
        content_urls?: { desktop?: { page?: string } };
      };
      const url = body.thumbnail?.source;
      if (!url) return { status: "not-found" };
      return {
        status: "ok",
        url,
        attributionUrl: body.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      };
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }
  });
