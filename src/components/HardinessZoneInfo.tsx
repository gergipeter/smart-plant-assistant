import { useEffect, useState } from "react";
import { Thermometer } from "lucide-react";
import {
  getHardinessZone as getHardinessZoneApi,
  type HardinessInfo,
} from "@/lib/hardiness-zone.server";

export function HardinessZoneInfo({
  lat,
  lon,
}: {
  lat?: number;
  lon?: number;
}) {
  const [info, setInfo] = useState<HardinessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadZone = async () => {
      try {
        const result = await getHardinessZoneApi({ data: { lat, lon } });
        if (result.status === "ok") {
          setInfo(result.data);
        }
      } catch (err) {
        console.error("Failed to load hardiness zone");
      } finally {
        setLoading(false);
      }
    };

    loadZone();
  }, [lat, lon]);

  if (loading || !info) return null;

  return (
    <div className="leaf-card p-4 mb-7">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
          <Thermometer className="h-[1.125rem] w-[1.125rem] text-primary" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            USDA Hardiness Zone {info.zone}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {info.region} · {info.minTemp}°F to {info.maxTemp}°F
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {info.seasonalTips}
          </p>
        </div>
      </div>
    </div>
  );
}
