import { useEffect, useState } from "react";
import { MapPin, Settings } from "lucide-react";
import { WeatherCard } from "./WeatherCard";
import { HardinessZoneInfo } from "./HardinessZoneInfo";
import { NurseriesFinder } from "./NurseriesFinder";
import { getUserLocation, type LocationData } from "@/lib/geolocation.server";

/**
 * Enhanced Dashboard Component
 * Integrates all API services for a rich plant care experience
 */
export function EnhancedDashboard() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [showNurseries, setShowNurseries] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectLocation = async () => {
      try {
        // Try browser geolocation first
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocation({
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                city: "Current Location",
                region: "",
                country: "",
              });
              setLoading(false);
            },
            async () => {
              // Fallback to IP-based geolocation
              const result = await getUserLocation();
              if (result.status === "ok") {
                setLocation(result.data);
              }
              setLoading(false);
            }
          );
        } else {
          // No geolocation support, use IP-based
          const result = await getUserLocation();
          if (result.status === "ok") {
            setLocation(result.data);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Location detection failed:", err);
        setLoading(false);
      }
    };

    detectLocation();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-secondary rounded-lg animate-pulse" />
        <div className="h-20 bg-secondary rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!location) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Location Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {location.city}
          {location.region && `, ${location.region}`}
        </div>
        <button
          onClick={() => setShowNurseries(true)}
          className="text-xs px-2 py-1 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
        >
          Find nurseries
        </button>
      </div>

      {/* Weather Information */}
      <WeatherCard lat={location.lat} lon={location.lon} />

      {/* Hardiness Zone Information */}
      <HardinessZoneInfo lat={location.lat} lon={location.lon} />

      {/* Nurseries Modal */}
      <NurseriesFinder
        lat={location.lat}
        lon={location.lon}
        isOpen={showNurseries}
        onClose={() => setShowNurseries(false)}
      />

      {/* API Status Info */}
      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-secondary/50">
        <p className="font-semibold mb-1">Enhanced Features Active:</p>
        <ul className="space-y-1">
          <li>✓ Real-time weather data</li>
          <li>✓ Location-based hardiness zone</li>
          <li>✓ Nearby nursery finder</li>
          <li>✓ AI plant doctor (ask for help)</li>
          <li>✓ Advanced image analysis</li>
          <li>✓ Push notifications (optional)</li>
        </ul>
      </div>
    </div>
  );
}
