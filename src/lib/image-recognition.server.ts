import { createServerFn } from "@tanstack/react-start";
import type { ApiResult, Json } from "./plantnet.server";

export type HealthIndicator = {
  name: string;
  confidence: number;
  severity?: "critical" | "warning" | "info";
};

export type ImageAnalysisResult = {
  healthAssessment: string;
  detectedIssues: HealthIndicator[];
  leafCondition: string;
  overallHealth: number;
  recommendations: string[];
};

export const analyzePlantImage = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }): Promise<ApiResult<ImageAnalysisResult>> => {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      return { status: "error", message: "Image recognition service not configured." };
    }

    const image = data.get("image");
    if (!(image instanceof Blob)) {
      return { status: "error", message: "No image provided." };
    }

    try {
      const base64 = await blobToBase64(image);

      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64 },
                features: [
                  { type: "LABEL_DETECTION", maxResults: 15 },
                  { type: "OBJECT_LOCALIZATION", maxResults: 8 },
                  { type: "WEB_DETECTION", maxResults: 5 },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        return { status: "error", message: "Image analysis failed." };
      }

      const body = (await response.json()) as {
        responses?: Array<{
          labelAnnotations?: Array<{ description?: string; score?: number }>;
          webDetection?: { webEntities?: Array<{ description?: string; score?: number }> };
        }>;
      };

      const annotations = body.responses?.[0];
      if (!annotations) {
        return { status: "error", message: "No analysis results returned." };
      }

      const labels = annotations.labelAnnotations ?? [];
      const webEntities = annotations.webDetection?.webEntities ?? [];

      // Detect health issues from labels
      const issueKeywords = {
        "yellow leaves": { severity: "warning" as const, health: -15 },
        yellowing: { severity: "warning" as const, health: -15 },
        wilting: { severity: "critical" as const, health: -30 },
        "brown leaves": { severity: "warning" as const, health: -10 },
        pest: { severity: "critical" as const, health: -25 },
        spider: { severity: "critical" as const, health: -25 },
        mealybug: { severity: "critical" as const, health: -25 },
        mold: { severity: "warning" as const, health: -20 },
        fungal: { severity: "warning" as const, health: -20 },
        rot: { severity: "critical" as const, health: -35 },
        powdery: { severity: "warning" as const, health: -20 },
      };

      const detectedIssues: HealthIndicator[] = [];
      let healthPenalty = 0;

      labels.forEach((label) => {
        const desc = label.description?.toLowerCase() ?? "";
        for (const [keyword, config] of Object.entries(issueKeywords)) {
          if (desc.includes(keyword)) {
            detectedIssues.push({
              name: label.description ?? keyword,
              confidence: label.score ?? 0.7,
              severity: config.severity,
            });
            healthPenalty += config.health;
          }
        }
      });

      // Detect positive indicators
      const healthKeywords = [
        "plant",
        "leaf",
        "green",
        "foliage",
        "lush",
        "vibrant",
        "blooming",
        "flower",
      ];
      const hasHealthyIndicators = labels.some((l) =>
        healthKeywords.some((k) => l.description?.toLowerCase().includes(k))
      );

      let overallHealth = 85;
      if (hasHealthyIndicators) overallHealth = 90;
      if (detectedIssues.length > 0) overallHealth = Math.max(30, 85 + healthPenalty);
      if (detectedIssues.some((i) => i.severity === "critical")) overallHealth = Math.max(20, overallHealth - 20);

      // Build assessment
      const leafCondition =
        detectedIssues.length === 0
          ? "Leaves appear healthy with good color and structure"
          : `Detected ${detectedIssues.length} potential issue${detectedIssues.length !== 1 ? "s" : ""}: ${detectedIssues.map((i) => i.name.toLowerCase()).join(", ")}`;

      const healthAssessment =
        overallHealth >= 80
          ? "Your plant looks thriving and healthy!"
          : overallHealth >= 60
            ? "Your plant is doing okay, but could use some attention."
            : overallHealth >= 40
              ? "Your plant is showing signs of stress and needs care."
              : "Your plant is in critical condition and needs immediate attention.";

      const recommendations: string[] = [];
      if (detectedIssues.some((i) => i.name.toLowerCase().includes("yellow"))) {
        recommendations.push("Check watering schedule—overwatering causes yellowing");
        recommendations.push("Ensure adequate drainage and light");
      }
      if (detectedIssues.some((i) => i.name.toLowerCase().includes("wilting"))) {
        recommendations.push("Water immediately if soil is dry");
        recommendations.push("Move away from direct heat sources");
      }
      if (detectedIssues.some((i) => i.severity === "critical")) {
        recommendations.push("Consider isolating plant to prevent spread of pests/disease");
        recommendations.push("Inspect undersides of leaves and stems closely");
      }
      if (detectedIssues.some((i) => i.name.toLowerCase().includes("mold"))) {
        recommendations.push("Improve air circulation");
        recommendations.push("Reduce humidity and watering frequency");
      }
      if (recommendations.length === 0) {
        recommendations.push("Continue current care routine");
        recommendations.push("Monitor for any changes in appearance");
        recommendations.push("Water when top inch of soil is dry");
      }

      return {
        status: "ok",
        data: {
          healthAssessment,
          detectedIssues,
          leafCondition,
          overallHealth,
          recommendations,
        },
      };
    } catch (error) {
      console.error("Image analysis error:", error);
      return { status: "error", message: "Could not analyze plant image." };
    }
  });

// ---------------------------------------------------------------------------
// species guess (scan fallback) — reuses the same Vision API key as the
// health-check above, but calls WEB_DETECTION/LABEL_DETECTION for species
// naming instead of health keywords. Used by the Scan flow as a second
// identification opinion when Pl@ntNet errors out or returns a low-confidence
// top match — Vision's web detection is often able to name a plant from
// visually similar images across the web even when Pl@ntNet's botanical
// classifier can't place it.
// ---------------------------------------------------------------------------

export type VisionSpeciesGuess = {
  name: string;
  score: number;
};

// Generic web/vision vocabulary that Vision's web-entity and label detectors
// surface constantly — never useful as a "species name" guess, so filtered
// out before scoring candidates.
const GENERIC_ENTITY_WORDS = new Set([
  "plant",
  "plants",
  "flowerpot",
  "flower pot",
  "houseplant",
  "houseplants",
  "leaf",
  "leaves",
  "flora",
  "botany",
  "tree",
  "shrub",
  "herb",
  "flower",
  "flowering plant",
  "vegetation",
  "garden",
  "gardening",
  "annual plant",
  "perennial plant",
  "terrestrial plant",
  "groundcover",
]);

function isGenericEntity(description: string): boolean {
  return GENERIC_ENTITY_WORDS.has(description.toLowerCase().trim());
}

export const identifyPlantViaVision = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    return data;
  })
  .handler(async ({ data }): Promise<ApiResult<VisionSpeciesGuess[]>> => {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      return { status: "error", message: "Image recognition service not configured." };
    }

    const image = data.get("image");
    if (!(image instanceof Blob)) {
      return { status: "error", message: "No image provided." };
    }

    try {
      const base64 = await blobToBase64(image);

      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64 },
                features: [
                  { type: "WEB_DETECTION", maxResults: 10 },
                  { type: "LABEL_DETECTION", maxResults: 10 },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        return { status: "error", message: "Image analysis failed." };
      }

      const body = (await response.json()) as {
        responses?: Array<{
          labelAnnotations?: Array<{ description?: string; score?: number }>;
          webDetection?: {
            webEntities?: Array<{ description?: string; score?: number }>;
            bestGuessLabels?: Array<{ label?: string }>;
          };
        }>;
      };

      const annotations = body.responses?.[0];
      if (!annotations) {
        return { status: "error", message: "No analysis results returned." };
      }

      const candidates = new Map<string, number>();

      // Web entities carry Vision's own relevance score and are the
      // strongest signal here — they're drawn from visually similar images
      // across the web, which often includes the species' actual name.
      for (const entity of annotations.webDetection?.webEntities ?? []) {
        if (!entity.description || isGenericEntity(entity.description)) continue;
        const score = entity.score ?? 0.5;
        const existing = candidates.get(entity.description) ?? 0;
        if (score > existing) candidates.set(entity.description, score);
      }

      // Vision's single best-guess label has no score of its own — treat it
      // as a moderately confident vote alongside the scored web entities.
      for (const guess of annotations.webDetection?.bestGuessLabels ?? []) {
        if (!guess.label || isGenericEntity(guess.label)) continue;
        const existing = candidates.get(guess.label) ?? 0;
        candidates.set(guess.label, Math.max(existing, 0.5));
      }

      // Labels are the weakest signal (broad ImageNet-style tags) — only
      // worth keeping when nothing more specific came back from web
      // detection, so they don't drown out real species names.
      if (candidates.size === 0) {
        for (const label of annotations.labelAnnotations ?? []) {
          if (!label.description || isGenericEntity(label.description)) continue;
          const score = label.score ?? 0.5;
          const existing = candidates.get(label.description) ?? 0;
          if (score > existing) candidates.set(label.description, score);
        }
      }

      const guesses = Array.from(candidates.entries())
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return { status: "ok", data: guesses };
    } catch (error) {
      console.error("Vision species guess error:", error);
      return { status: "error", message: "Could not analyze plant image." };
    }
  });

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
