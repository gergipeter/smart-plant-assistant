import { createServerFn } from "@tanstack/react-start";
import type { ApiResult } from "./plantnet.server";

export type TrefleEnrichment = {
  bloomMonths?: string[];
  waterNeeds?: string;
  careLevel?: string;
  toxicity?: "toxic" | "non-toxic" | "unknown";
  companionPlants?: string[];
  propagationMethods?: string[];
  matureHeight?: string;
  matureSpread?: string;
  hardyTemperature?: string;
};

export const enrichPlantData = createServerFn({ method: "GET" })
  .validator((data: { scientificName?: string; commonName?: string }) => data)
  .handler(async ({ data }): Promise<ApiResult<TrefleEnrichment>> => {
    const apiKey = process.env.TREFLE_API_KEY;
    if (!apiKey) {
      return { status: "error", message: "Trefle service not configured." };
    }

    const searchQuery = data.scientificName || data.commonName || "";
    if (!searchQuery) {
      return { status: "error", message: "Plant name required." };
    }

    try {
      const searchResponse = await fetch(
        `https://trefle.io/api/v1/plants/search?q=${encodeURIComponent(searchQuery)}&token=${apiKey}`
      );

      if (!searchResponse.ok) {
        return { status: "error", message: "Trefle search failed." };
      }

      const searchBody = (await searchResponse.json()) as {
        data?: { id?: number; scientific_name?: string }[];
      };

      const plantId = searchBody.data?.[0]?.id;
      if (!plantId) {
        return { status: "error", message: `No plant found for "${searchQuery}".` };
      }

      const detailResponse = await fetch(
        `https://trefle.io/api/v1/plants/${plantId}?token=${apiKey}`
      );

      if (!detailResponse.ok) {
        return { status: "error", message: "Trefle detail fetch failed." };
      }

      const detail = (await detailResponse.json()) as {
        data?: {
          id?: number;
          specifications?: {
            bloom_months?: string[];
            water_needs?: string;
            hardiness?: { min?: number; max?: number };
            mature_height?: { cm?: number };
            mature_spread?: { cm?: number };
          };
          growth?: {
            light?: string;
            maintenance?: string;
          };
          taxonomy?: {
            class?: string;
          };
          edible?: boolean;
          edible_part?: string[];
          flower_color?: string[];
          foliage_color?: string[];
        };
      };

      const specs = detail.data?.specifications;
      const growth = detail.data?.growth;

      const cmToFt = (cm?: number) =>
        cm ? `${Math.round((cm / 30.48) * 10) / 10} ft` : undefined;

      const enrichment: TrefleEnrichment = {
        bloomMonths: specs?.bloom_months?.length ? specs.bloom_months : undefined,
        waterNeeds: specs?.water_needs || growth?.light || "Moderate",
        careLevel: growth?.maintenance || "Moderate",
        toxicity: detail.data?.edible ? "non-toxic" : "unknown",
        companionPlants: undefined,
        propagationMethods: ["Seeds", "Cuttings"],
        matureHeight: cmToFt(specs?.mature_height?.cm),
        matureSpread: cmToFt(specs?.mature_spread?.cm),
        hardyTemperature:
          specs?.hardiness?.min != null && specs?.hardiness?.max != null
            ? `${specs.hardiness.min}°F to ${specs.hardiness.max}°F`
            : undefined,
      };

      return { status: "ok", data: enrichment };
    } catch (error) {
      console.error("Trefle enrichment error:", error);
      return { status: "error", message: "Could not enrich plant data." };
    }
  });
