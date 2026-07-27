import { createServerFn } from "@tanstack/react-start";

export type HardinessInfo = {
  zone: string;
  minTemp: number;
  maxTemp: number;
  region: string;
  seasonalTips: string;
};

export type HardinessResponse =
  | { status: "ok"; data: HardinessInfo }
  | { status: "error"; message: string };

// Simplified USDA Hardiness Zone mapping
function computeHardinessZone(lat: number, lon: number): HardinessInfo {
  const absLat = Math.abs(lat);

  if (absLat < 10) {
    return {
      zone: "11-13",
      minTemp: 40,
      maxTemp: 65,
      region: "Tropical",
      seasonalTips: "Year-round growth. Provide high humidity and consistent warmth.",
    };
  } else if (absLat < 20) {
    return {
      zone: "9-11",
      minTemp: 20,
      maxTemp: 50,
      region: "Subtropical",
      seasonalTips: "Mild winters. Protect tender plants from occasional frost.",
    };
  } else if (absLat < 30) {
    return {
      zone: "8-10",
      minTemp: 10,
      maxTemp: 40,
      region: "Warm Temperate",
      seasonalTips: "Moderate winters. Bring tropical plants indoors in winter.",
    };
  } else if (absLat < 40) {
    return {
      zone: "6-8",
      minTemp: -10,
      maxTemp: 30,
      region: "Temperate",
      seasonalTips: "Cold winters. Most houseplants thrive indoors; outdoor season is spring-fall.",
    };
  } else if (absLat < 50) {
    return {
      zone: "4-6",
      minTemp: -30,
      maxTemp: 10,
      region: "Cool Temperate",
      seasonalTips: "Harsh winters. Keep tender plants indoors. Short outdoor season.",
    };
  } else {
    return {
      zone: "1-3",
      minTemp: -50,
      maxTemp: -10,
      region: "Boreal",
      seasonalTips: "Very cold climate. All tropical houseplants must stay indoors year-round.",
    };
  }
}

export const getHardinessZone = createServerFn({ method: "GET" })
  .validator((data: { lat?: number; lon?: number }) => data)
  .handler(({ data }): HardinessResponse => {
    try {
      const lat = data.lat ?? 40.7128;
      const lon = data.lon ?? -74.006;
      const info = computeHardinessZone(lat, lon);
      return { status: "ok", data: info };
    } catch (error) {
      return { status: "error", message: "Could not determine hardiness zone." };
    }
  });
