import { createServerFn } from "@tanstack/react-start";
import type { ApiResult } from "./plantnet.server";

const API_BASE = "https://plant.id/api/v3";

export type PlantIdResult = {
  scientificName: string;
  commonNames: string[];
  score: number;
};

function requireApiKey(): { ok: true; key: string } | { ok: false; message: string } {
  const apiKey = process.env.PLANT_ID_API_KEY;
  if (!apiKey) return { ok: false, message: "Plant.id identification is not configured." };
  return { ok: true, key: apiKey };
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

// Plant.id's v3 identification API — a second, independent botanical
// classifier alongside Pl@ntNet. Its `suggestions[].probability` is already
// a 0-1 confidence score comparable in shape to Pl@ntNet's `results[].score`,
// which is what lets the scan flow merge the two into one combined ranking.
export const identifyPlantViaPlantId = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }): Promise<ApiResult<PlantIdResult[]>> => {
    const auth = requireApiKey();
    if (!auth.ok) return { status: "error", message: auth.message };

    const image = data.get("image");
    if (!(image instanceof Blob)) return { status: "error", message: "No image provided." };

    let response: Response;
    try {
      const base64 = await blobToBase64(image);
      response = await fetch(`${API_BASE}/identification?details=common_names`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": auth.key,
        },
        body: JSON.stringify({
          images: [`data:image/jpeg;base64,${base64}`],
          similar_images: false,
        }),
      });
    } catch {
      return { status: "error", message: "Could not reach the Plant.id API." };
    }

    if (response.status === 429) return { status: "quota-exceeded" };
    if (!response.ok) {
      return { status: "error", message: `Plant.id identification failed (${response.status}).` };
    }

    let body: {
      result?: {
        classification?: {
          suggestions?: {
            name?: string;
            probability?: number;
            details?: { common_names?: string[] };
          }[];
        };
      };
    };
    try {
      body = await response.json();
    } catch {
      return { status: "error", message: "Received an invalid response." };
    }

    const suggestions = body.result?.classification?.suggestions ?? [];
    const results: PlantIdResult[] = suggestions
      .filter((s): s is { name: string; probability: number; details?: { common_names?: string[] } } =>
        typeof s.name === "string" && typeof s.probability === "number",
      )
      .map((s) => ({
        scientificName: s.name,
        commonNames: s.details?.common_names ?? [],
        score: s.probability,
      }));

    return { status: "ok", data: results };
  });
