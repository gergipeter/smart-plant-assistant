import { createServerFn } from "@tanstack/react-start";

export type WeatherData = {
  temp: number;
  condition: string;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  icon: string;
};

export type WeatherResponse =
  | { status: "ok"; data: WeatherData }
  | { status: "error"; message: string };

export const getWeather = createServerFn({ method: "GET" })
  .validator((data: { lat?: number; lon?: number }) => data)
  .handler(async ({ data }): Promise<WeatherResponse> => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return { status: "error", message: "Weather service not configured." };
    }

    const lat = data.lat ?? 40.7128;
    const lon = data.lon ?? -74.006;

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
      );

      if (!response.ok) {
        return { status: "error", message: "Failed to fetch weather data." };
      }

      const body = (await response.json()) as {
        main?: { temp?: number; humidity?: number };
        weather?: { main?: string; icon?: string }[];
        wind?: { speed?: number };
        rain?: { "1h"?: number };
      };

      const weather: WeatherData = {
        temp: body.main?.temp ?? 20,
        condition: body.weather?.[0]?.main ?? "Unknown",
        humidity: body.main?.humidity ?? 50,
        rainfall: body.rain?.["1h"] ?? 0,
        windSpeed: body.wind?.speed ?? 0,
        icon: body.weather?.[0]?.icon ?? "01d",
      };

      return { status: "ok", data: weather };
    } catch (error) {
      console.error("Weather API error:", error);
      return { status: "error", message: "Could not reach weather service." };
    }
  });
