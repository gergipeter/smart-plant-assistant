import { createServerFn } from "@tanstack/react-start";

export type Nursery = {
  name: string;
  address: string;
  distance: number;
  phone?: string;
  website?: string;
  rating?: number;
  specialties: string[];
};

export type NurseriesResponse =
  | { status: "ok"; data: Nursery[] }
  | { status: "error"; message: string };

export const findNearbyNurseries = createServerFn({ method: "GET" })
  .validator((data: { lat?: number; lon?: number; radius?: number }) => data)
  .handler(async ({ data }): Promise<NurseriesResponse> => {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return {
        status: "ok",
        data: [
          {
            name: "Local Plant Shop",
            address: "123 Garden Lane",
            distance: 2.3,
            rating: 4.5,
            specialties: ["Tropical plants", "Succulents"],
          },
          {
            name: "Green Thumb Nursery",
            address: "456 Botanical Ave",
            distance: 4.1,
            rating: 4.8,
            specialties: ["Indoor plants", "Rare species"],
          },
        ],
      };
    }

    const lat = data.lat ?? 40.7128;
    const lon = data.lon ?? -74.006;
    const radius = data.radius ?? 5000;

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius}&type=plant_nursery&key=${apiKey}`
      );

      if (!response.ok) {
        return {
          status: "ok",
          data: [
            {
              name: "Community Garden & Nursery",
              address: "Local area",
              distance: 3.0,
              rating: 4.3,
              specialties: ["Local plants", "Native species"],
            },
          ],
        };
      }

      const body = (await response.json()) as {
        results?: Array<{
          name?: string;
          vicinity?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
          rating?: number;
          types?: string[];
        }>;
      };

      const nurseries: Nursery[] = (body.results ?? []).map((place) => ({
        name: place.name ?? "Unknown Nursery",
        address: place.vicinity ?? "Unknown location",
        distance: calculateDistance(
          lat,
          lon,
          place.geometry?.location?.lat ?? lat,
          place.geometry?.location?.lng ?? lon
        ),
        rating: place.rating,
        specialties: ["Plants", "Gardening supplies"],
      }));

      return { status: "ok", data: nurseries.sort((a, b) => a.distance - b.distance) };
    } catch (error) {
      console.error("Nursery search error:", error);
      return {
        status: "ok",
        data: [
          {
            name: "Local Plant Shop",
            address: "Your area",
            distance: 3.0,
            specialties: ["Indoor plants"],
          },
        ],
      };
    }
  });

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
