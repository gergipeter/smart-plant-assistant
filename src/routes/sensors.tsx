import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useGardenPlants } from "@/lib/myGarden";
import { getSubscriptionAsync } from "@/lib/premium";
import {
  listSensorDevices,
  registerSensorDevice,
  deleteSensorDevice,
  rotateSensorDeviceToken,
  type SensorDevice,
  type NewSensorDevice,
} from "@/lib/sensorDevices";
import { Cpu, Copy, Check, Trash2, Lock, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/sensors")({
  head: () => ({
    meta: [
      { title: "Sensors — Verdant" },
      { name: "description", content: "Connect a physical soil-moisture sensor to a plant." },
    ],
  }),
  component: SensorsPage,
});

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ios-tap shrink-0 h-7 w-7 rounded-full bg-secondary grid place-items-center"
      aria-label="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      )}
    </button>
  );
}

function SensorsPage() {
  const { user } = useAuth();
  const gardenPlants = useGardenPlants();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<SensorDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [registering, setRegistering] = useState(false);
  // Held only in this component's state, never persisted — see
  // sensorDevices.ts's registerSensorDevice doc comment: the full token is
  // only ever returned once, right after creation (or rotation).
  const [justRegistered, setJustRegistered] = useState<NewSensorDevice | null>(null);
  const [rotatedToken, setRotatedToken] = useState<{ deviceId: string; token: string } | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      return;
    }
    getSubscriptionAsync(user.uid).then((sub) => setHasAccess(sub.tier === "pro"));
  }, [user]);

  useEffect(() => {
    if (!hasAccess) return;
    listSensorDevices()
      .then(setDevices)
      .finally(() => setLoadingDevices(false));
  }, [hasAccess]);

  const handleRegister = async () => {
    if (!selectedPlantId || !deviceName.trim()) return;
    setRegistering(true);
    try {
      const device = await registerSensorDevice(selectedPlantId, deviceName.trim());
      if (device) {
        setDevices((prev) => [device, ...prev]);
        setJustRegistered(device);
        setDeviceName("");
        setSelectedPlantId("");
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    if (justRegistered?.id === deviceId) setJustRegistered(null);
    if (rotatedToken?.deviceId === deviceId) setRotatedToken(null);
    await deleteSensorDevice(deviceId);
  };

  const handleRotate = async (deviceId: string) => {
    setRotatingId(deviceId);
    try {
      const token = await rotateSensorDeviceToken(deviceId);
      if (token) {
        setRotatedToken({ deviceId, token });
        listSensorDevices().then(setDevices);
      }
    } finally {
      setRotatingId(null);
    }
  };

  const plantName = (plantId: string) => gardenPlants.find((p) => p.id === plantId)?.name ?? plantId;

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
          <Cpu className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-display text-2xl leading-tight">Sensors</h1>
          <p className="text-xs text-muted-foreground">Connect a physical soil-moisture sensor</p>
        </div>
      </header>

      {hasAccess === null && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {hasAccess === false && (
        <Link to="/premium" className="ios-tap leaf-card p-4 flex items-center gap-3 block">
          <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0">
            <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sensor integration</p>
            <p className="text-xs text-muted-foreground">
              Connect real hardware for live soil moisture readings — Pro
            </p>
          </div>
        </Link>
      )}

      {hasAccess && (
        <>
          <section className="leaf-card p-4 mb-6">
            <h2 className="text-sm font-medium mb-3">Register a new device</h2>
            <div className="space-y-3">
              <select
                value={selectedPlantId}
                onChange={(e) => setSelectedPlantId(e.target.value)}
                className="w-full h-10 rounded-lg bg-secondary px-3 text-sm"
              >
                <option value="">Choose a plant…</option>
                {gardenPlants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Device name (e.g. Windowsill ESP8266)"
                className="w-full h-10 rounded-lg bg-secondary px-3 text-sm placeholder:text-muted-foreground"
              />
              <button
                onClick={handleRegister}
                disabled={!selectedPlantId || !deviceName.trim() || registering}
                className="ios-tap w-full h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {registering ? "Registering…" : "Generate device token"}
              </button>
            </div>

            {justRegistered && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Copy this token into your device's firmware now — it won't be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate text-xs font-mono bg-card rounded px-2 py-1.5">
                    {justRegistered.secretToken}
                  </code>
                  <CopyButton text={justRegistered.secretToken} />
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-1">
              Your devices
            </h2>
            {loadingDevices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No sensors registered yet.
              </p>
            ) : (
              <div className="ios-group">
                {devices.map((d) => (
                  <div key={d.id} className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
                        <Cpu className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {plantName(d.plantId)} · token ···{d.tokenLastFour} ·{" "}
                          {d.lastSeenAt
                            ? `last seen ${new Date(d.lastSeenAt).toLocaleString()}`
                            : "never reported in"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRotate(d.id)}
                        disabled={rotatingId === d.id}
                        aria-label={`Rotate token for ${d.name}`}
                        className="ios-tap shrink-0 h-8 w-8 rounded-full grid place-items-center text-muted-foreground disabled:opacity-50"
                      >
                        {rotatingId === d.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        aria-label={`Remove ${d.name}`}
                        className="ios-tap shrink-0 h-8 w-8 rounded-full grid place-items-center text-muted-foreground"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>

                    {rotatedToken?.deviceId === d.id && (
                      <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          New token for {d.name} — copy it into the firmware now, it won't be shown again.
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 min-w-0 truncate text-xs font-mono bg-card rounded px-2 py-1.5">
                            {rotatedToken.token}
                          </code>
                          <CopyButton text={rotatedToken.token} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
