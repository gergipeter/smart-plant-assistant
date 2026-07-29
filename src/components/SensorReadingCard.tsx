import { useEffect, useState } from "react";
import { Droplets, BatteryLow } from "lucide-react";
import { getLatestSensorReading, type SensorReading } from "@/lib/sensorReadings";

// Renders nothing at all (not even a loading flash) when the plant has no
// registered sensor — most plants won't have one, and this sits in the Care
// Guide's "water" tab alongside always-static text, so an empty/loading
// state would read as broken rather than "no hardware attached."
export function SensorReadingCard({ plantId }: { plantId: string }) {
  const [reading, setReading] = useState<SensorReading | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getLatestSensorReading(plantId).then((r) => {
      if (!cancelled) setReading(r);
    });
    return () => {
      cancelled = true;
    };
  }, [plantId]);

  if (!reading) return null;

  const minutesAgo = Math.round((Date.now() - new Date(reading.createdAt).getTime()) / 60000);
  const staleness =
    minutesAgo < 60
      ? `${minutesAgo}m ago`
      : minutesAgo < 60 * 24
        ? `${Math.round(minutesAgo / 60)}h ago`
        : `${Math.round(minutesAgo / (60 * 24))}d ago`;

  return (
    <div className="leaf-card p-4 mb-4 flex items-center gap-3">
      <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
        <Droplets className="h-[1.125rem] w-[1.125rem] text-primary" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Live soil moisture: {Math.round(reading.soilMoisture)}%</p>
        <p className="text-xs text-muted-foreground mt-0.5">From your sensor · {staleness}</p>
      </div>
      {reading.batteryPercent !== null && reading.batteryPercent < 20 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <BatteryLow className="h-3.5 w-3.5" strokeWidth={1.75} />
          {Math.round(reading.batteryPercent)}%
        </div>
      )}
    </div>
  );
}
