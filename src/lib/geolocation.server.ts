import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

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

// Cloudflare Workers attach this directly on the incoming platform Request
// (not a header, not typed by any TanStack/h3 type) — undefined outside a
// real Workers deployment (e.g. local `vite dev`), so every field is
// optional here even though Cloudflare always sets them on real requests.
type CloudflareRequestCf = {
  city?: string;
  region?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
};

export const getUserLocation = createServerFn({ method: "GET" }).handler(
  async (): Promise<LocationResponse> => {
    // Reads the visitor's real edge location straight from Cloudflare's
    // request metadata — instant, free, and actually the visitor's location.
    // The previous implementation called ipapi.co server-side, which
    // geolocated Cloudflare's own datacenter IP instead of the visitor's
    // (routinely landing on New York/Ashburn regardless of who was asking).
    const cf = (getRequest() as Request & { cf?: CloudflareRequestCf }).cf;
    const lat = cf?.latitude ? parseFloat(cf.latitude) : undefined;
    const lon = cf?.longitude ? parseFloat(cf.longitude) : undefined;

    if (lat !== undefined && !Number.isNaN(lat) && lon !== undefined && !Number.isNaN(lon)) {
      return {
        status: "ok",
        data: {
          lat,
          lon,
          city: cf?.city ?? "Unknown",
          region: cf?.region ?? "Unknown",
          country: cf?.country ?? "Unknown",
        },
      };
    }

    // No `cf` data (local dev, or a non-Cloudflare deploy target) — fall
    // back to IP geolocation rather than a silently wrong hardcoded city.
    try {
      const response = await fetch("https://ipapi.co/json/");
      if (!response.ok) {
        return { status: "error", message: "Could not determine location." };
      }

      const body = (await response.json()) as {
        latitude?: number;
        longitude?: number;
        city?: string;
        region?: string;
        country_name?: string;
      };

      if (body.latitude === undefined || body.longitude === undefined) {
        return { status: "error", message: "Could not determine location." };
      }

      return {
        status: "ok",
        data: {
          lat: body.latitude,
          lon: body.longitude,
          city: body.city ?? "Unknown",
          region: body.region ?? "Unknown",
          country: body.country_name ?? "Unknown",
        },
      };
    } catch (error) {
      console.error("Geolocation error:", error);
      return {
        status: "error",
        message: "Could not determine location.",
      };
    }
  },
);
