import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, Wind, Droplets } from "lucide-react";
import { getWeather, type WeatherData } from "@/lib/weather.server";

export function WeatherCard({
  lat,
  lon,
  city,
  region,
  country,
}: {
  lat?: number;
  lon?: number;
  city?: string;
  region?: string;
  country?: string;
}) {
  // ipapi.co returns the literal string "Unknown" per-field (not an absent
  // field) when it can't resolve part of the IP lookup — filter those out
  // rather than showing "Unknown, Unknown" as if it were a real place. Also
  // drops region when it's identical to the city (common for city-states/
  // city-as-region IP records) to avoid "Budapest, Budapest, Hungary".
  const locationParts = [city, region === city ? undefined : region, country].filter(
    (part): part is string => !!part && part !== "Unknown",
  );
  const locationLabel = locationParts.length > 0 ? locationParts.join(", ") : null;
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWeather = async () => {
      try {
        const result = await getWeather({ data: { lat, lon } });
        if (result.status === "ok") {
          setWeather(result.data);
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError("Failed to load weather data");
      } finally {
        setLoading(false);
      }
    };

    loadWeather();
  }, [lat, lon]);

  if (loading) {
    return (
      <div className="leaf-card h-20 animate-pulse bg-secondary" />
    );
  }

  // Weather failing (e.g. no OPENWEATHER_API_KEY configured) shouldn't hide
  // the location itself — that's a separate, already-successful lookup.
  if (error || !weather) {
    if (!locationLabel) return null;
    return (
      <div className="leaf-card flex items-center gap-3 p-4 mb-7">
        <p className="text-sm text-muted-foreground">{locationLabel}</p>
      </div>
    );
  }

  const getWeatherIcon = (condition: string) => {
    if (condition.includes("rain")) return <CloudRain className="h-5 w-5" />;
    if (condition.includes("cloud")) return <Cloud className="h-5 w-5" />;
    return <Sun className="h-5 w-5" />;
  };

  return (
    <div className="leaf-card flex items-start gap-3 p-4 mb-7">
      <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
        {getWeatherIcon(weather.condition)}
      </div>
      <div className="flex-1">
        {locationLabel && (
          <p className="text-sm font-semibold">{locationLabel}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {Math.round(weather.temp)}°C · {weather.condition}
        </p>
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Droplets className="h-3 w-3" />
            {weather.humidity}%
          </span>
          <span className="flex items-center gap-1">
            <Wind className="h-3 w-3" />
            {weather.windSpeed}m/s
          </span>
          {weather.rainfall > 0 && (
            <span className="flex items-center gap-1">
              <CloudRain className="h-3 w-3" />
              {weather.rainfall}mm
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
