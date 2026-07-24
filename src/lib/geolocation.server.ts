import { createServerFn } from "@tanstack/react-start";

export type LocationData = {
  lat: number;
  lon: number;
  city: string;
  region: string;
  country: string;
};

export type LocationResponse =
  | { status: "ok"; data: LocationData }
  | { status: "error"; message: string };

export const getUserLocation = createServerFn({ method: "GET" })
  .handler(async (): Promise<LocationResponse> => {
    try {
      const response = await fetch("https://ipapi.co/json/");

      if (!response.ok) {
        return {
          status: "ok",
          data: {
            lat: 40.7128,
            lon: -74.006,
            city: "New York",
            region: "NY",
            country: "US",
          },
        };
      }

      const body = (await response.json()) as {
        latitude?: number;
        longitude?: number;
        city?: string;
        region?: string;
        country_name?: string;
      };

      return {
        status: "ok",
        data: {
          lat: body.latitude ?? 40.7128,
          lon: body.longitude ?? -74.006,
          city: body.city ?? "Unknown",
          region: body.region ?? "Unknown",
          country: body.country_name ?? "Unknown",
        },
      };
    } catch (error) {
      console.error("Geolocation error:", error);
      return {
        status: "error",
        message: "Could not determine location. Using defaults.",
      };
    }
  });

export const geocodeAddress = createServerFn({ method: "GET" })
  .validator((data: { address?: string }) => data)
  .handler(async ({ data }): Promise<LocationResponse> => {
    if (!data.address) {
      return { status: "error", message: "Address required." };
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.address)}&format=json`
      );

      if (!response.ok || response.status === 404) {
        return { status: "error", message: "Address not found." };
      }

      const results = (await response.json()) as {
        lat?: string;
        lon?: string;
        address?: { city?: string; region?: string; country?: string };
      }[];

      if (!results.length) {
        return { status: "error", message: "No results found." };
      }

      const result = results[0];
      return {
        status: "ok",
        data: {
          lat: parseFloat(result.lat ?? "40.7128"),
          lon: parseFloat(result.lon ?? "-74.006"),
          city: result.address?.city ?? "Unknown",
          region: result.address?.region ?? "Unknown",
          country: result.address?.country ?? "Unknown",
        },
      };
    } catch (error) {
      console.error("Geocoding error:", error);
      return { status: "error", message: "Geocoding service unavailable." };
    }
  });
