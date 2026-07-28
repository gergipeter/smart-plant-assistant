import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, Lock, Loader2 } from "lucide-react";
import type { Plant } from "@/lib/plants";
import { useAuth } from "@/lib/auth";
import { getSubscriptionAsync } from "@/lib/premium";
import { getAdvancedWateringPredictions } from "@/lib/advancedWateringIntegration";
import { getUserLocation } from "@/lib/geolocation.server";
import type { WateringPrediction } from "@/lib/advancedWatering";

// Plus/Pro-only panel: real weather + hardiness-zone-aware watering
// predictions per plant, layered below the basic calendar (which stays
// available to everyone). Free users see a locked upsell instead.
export function AdvancedWateringInsights({ plants }: { plants: Plant[] }) {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [predictions, setPredictions] = useState<Record<string, WateringPrediction> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      return;
    }
    getSubscriptionAsync(user.uid).then((sub) => {
      setHasAccess(sub.tier === "plus" || sub.tier === "pro");
    });
  }, [user]);

  useEffect(() => {
    if (!hasAccess || plants.length === 0) return;
    setLoading(true);
    getUserLocation()
      .then((locRes) => {
        const lat = locRes.status === "ok" ? locRes.data.lat : undefined;
        const lon = locRes.status === "ok" ? locRes.data.lon : undefined;
        return getAdvancedWateringPredictions(plants, lat, lon);
      })
      .then(setPredictions)
      .finally(() => setLoading(false));
  }, [hasAccess, plants]);

  if (hasAccess === null) return null;

  if (!hasAccess) {
    return (
      <Link to="/premium" className="ios-tap leaf-card p-4 flex items-center gap-3 mb-7 block">
        <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0">
          <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Advanced watering AI</p>
          <p className="text-xs text-muted-foreground">
            Weather + hardiness-zone-aware predictions — Plus/Pro
          </p>
        </div>
      </Link>
    );
  }

  return (
    <section className="mb-7">
      <div className="flex items-center gap-1.5 text-lg font-display mb-3">
        <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.75} />
        Advanced watering AI
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing weather and conditions…
        </div>
      )}

      {!loading && !predictions && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Couldn't load weather data right now — try again later.
        </p>
      )}

      {!loading && predictions && (
        <div className="space-y-2">
          {plants.map((plant) => {
            const prediction = predictions[plant.id];
            if (!prediction) return null;
            return (
              <Link
                key={plant.id}
                to="/plant/$id"
                params={{ id: plant.id }}
                className="ios-tap leaf-card p-3 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0 text-lg">
                  {plant.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{plant.name}</p>
                  <p className="text-xs text-muted-foreground">{prediction.reason}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-primary">
                    {prediction.daysUntilWatering === 0 ? "Now" : `${prediction.daysUntilWatering}d`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{prediction.confidence}% confident</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
