import { createServerFn } from "@tanstack/react-start";

// Wikimedia Commons' MediaWiki API, `generator=search` over the File
// namespace (6) — real photos other people have uploaded and categorized by
// species, not a single curated thumbnail like speciesPhoto.server.ts's
// Wikipedia summary endpoint. No API key needed; same User-Agent etiquette
// as speciesPhoto.server.ts (https://api.wikimedia.org/wiki/Wikimedia_REST_API).
const WIKIMEDIA_USER_AGENT =
  "VerdantPlantCareApp/1.0 (https://github.com/gergipeter/smart-plant-assistant)";

export type SpeciesGalleryPhoto = {
  thumbUrl: string;
  fullUrl: string;
  title: string;
  descriptionUrl: string;
};

export type SpeciesGalleryResult =
  | { status: "ok"; photos: SpeciesGalleryPhoto[] }
  | { status: "not-found" }
  | { status: "error"; message: string };

export const getSpeciesGallery = createServerFn({ method: "GET" })
  .validator((data: { scientificName: string }) => data)
  .handler(async ({ data }): Promise<SpeciesGalleryResult> => {
    const query = data.scientificName.trim();
    if (!query) return { status: "not-found" };

    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `${query} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "400",
      origin: "*",
    });

    let response: Response;
    try {
      response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
        headers: { "User-Agent": WIKIMEDIA_USER_AGENT },
      });
    } catch {
      return { status: "error", message: "Could not reach Wikimedia Commons." };
    }

    if (!response.ok) return { status: "error", message: `Request failed (${response.status}).` };

    try {
      const body = (await response.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title: string;
              imageinfo?: { thumburl?: string; url?: string; descriptionurl?: string }[];
            }
          >;
        };
      };

      const pages = body.query?.pages;
      if (!pages) return { status: "not-found" };

      const photos: SpeciesGalleryPhoto[] = Object.values(pages)
        .map((page) => {
          const info = page.imageinfo?.[0];
          if (!info?.thumburl || !info.url || !info.descriptionurl) return null;
          return {
            thumbUrl: info.thumburl,
            fullUrl: info.url,
            title: page.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
            descriptionUrl: info.descriptionurl,
          };
        })
        .filter((p): p is SpeciesGalleryPhoto => p !== null);

      if (photos.length === 0) return { status: "not-found" };
      return { status: "ok", photos };
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }
  });
