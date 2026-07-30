import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PlantThumb } from "@/components/AppShell";
import { type Plant, type PlantStatus } from "@/lib/plants";
import { useGardenPlants, showDemoCatalog, updatePlantInGarden } from "@/lib/myGarden";
import {
  isDueForFertilizing,
  isDueForRepotting,
  markFertilized,
  markRepotted,
  markWatered,
} from "@/lib/careDueStatus";
import {
  Check,
  RefreshCw,
  Trash2,
  Droplets,
  Sparkles,
  Settings2,
  Flame,
  ChevronDown,
  Wand2,
  Camera,
  Sprout,
  Search,
  X,
  Leaf,
  CircleDot,
  Info,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getCurrentStreak, recordDayCompleted } from "@/lib/streaks";
import { WaterCalendar } from "@/components/WaterCalendar";
import { AdvancedWateringInsights } from "@/components/AdvancedWateringInsights";
import { GardenDigest } from "@/components/GardenDigest";
import { WeatherCard } from "@/components/WeatherCard";
import { HardinessZoneInfo } from "@/components/HardinessZoneInfo";
import { seedDemoData } from "@/lib/seedDemoData";
import { getUserLocation } from "@/lib/geolocation.server";
import { usePhotoUrl } from "@/lib/usePhotoUrl";
import { useT, statusLabelKeys, type TranslationKey } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verdant — Your AI plant care companion" },
      {
        name: "description",
        content:
          "Scan, diagnose, and care for your plants with weather-aware reminders and an AI plant doctor.",
      },
      { property: "og:title", content: "Verdant — Your AI plant care companion" },
      {
        property: "og:description",
        content:
          "Scan, diagnose, and care for your plants with weather-aware reminders and an AI plant doctor.",
      },
    ],
  }),
  component: Dashboard,
});

function greetingKey(): TranslationKey {
  const h = new Date().getHours();
  if (h < 12) return "home.greeting.morning";
  if (h < 18) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

const PULL_THRESHOLD = 64;

function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (refreshing) return;
    if ((containerRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.clientY;
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (startY.current === null || refreshing) return;
    const delta = e.clientY - startY.current;
    if (delta > 0) {
      // rubber-band: linear at first, increasingly resistant past the threshold
      const eased =
        delta <= PULL_THRESHOLD
          ? delta * 0.5
          : PULL_THRESHOLD * 0.5 + (delta - PULL_THRESHOLD) * 0.15;
      setPull(Math.min(eased, 100));
    }
  };

  const endPull = async () => {
    if (startY.current === null) return;
    startY.current = null;
    setDragging(false);
    if (pull > PULL_THRESHOLD) {
      setRefreshing(true);
      setPull(PULL_THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    setPull(0);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPull}
      onPointerCancel={endPull}
      style={{ touchAction: pull > 0 ? "none" : "pan-y" }}
    >
      <div
        className={`flex items-center justify-center overflow-hidden ${dragging ? "" : "transition-[height] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"}`}
        style={{ height: pull }}
      >
        <RefreshCw
          className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`}
          strokeWidth={1.75}
          style={{
            transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
            opacity: Math.min(pull / PULL_THRESHOLD, 1),
          }}
        />
      </div>
      {children}
    </div>
  );
}

const SWIPE_THRESHOLD = 72;

function SwipeableTaskRow({
  onComplete,
  isCompleted = false,
  children,
}: {
  onComplete: () => void;
  isCompleted?: boolean;
  children: React.ReactNode;
}) {
  const [dragX, setDragX] = useState(0);
  const [settling, setSettling] = useState(false);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (isCompleted) return;
    startX.current = e.clientX;
    dragging.current = true;
    setSettling(false);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current || startX.current === null || isCompleted) return;
    const delta = e.clientX - startX.current;
    // only allow left swipe (reveal complete action to the right edge);
    // rubber-band past the threshold so it doesn't feel like it snaps away
    const clamped = Math.max(Math.min(delta, 0), -220);
    const dragged =
      clamped < -SWIPE_THRESHOLD
        ? -SWIPE_THRESHOLD + (clamped + SWIPE_THRESHOLD) * 0.35
        : clamped;
    setDragX(dragged);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    startX.current = null;
    setSettling(true);
    if (dragX < -SWIPE_THRESHOLD) {
      setDragX(-140);
      // let the row glide the rest of the way before it disappears from the list
      setTimeout(onComplete, 180);
    } else {
      setDragX(0);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-end bg-primary px-5">
        <Check className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative bg-card"
        style={{
          transform: `translateX(${dragX}px)`,
          transition:
            dragging.current
              ? "none"
              : settling
                ? "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease"
                : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
          opacity: isCompleted ? 0.6 : 1,
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Attention-needed statuses surface first and get the large featured slot —
// the bento grid leads with whatever the user should act on today.
const PRIORITY_ORDER: Record<Plant["status"], number> = {
  quarantined: 0,
  "needs-water": 1,
  "needs-mist": 2,
  healthy: 3,
};

function GardenBentoCard({
  plant,
  featured,
  onWater,
}: {
  plant: Plant;
  featured: boolean;
  onWater: (plant: Plant) => void;
}) {
  const t = useT();
  const needsAttention = plant.status !== "healthy";
  const needsWaterOrMist = plant.status === "needs-water" || plant.status === "needs-mist";
  // Falls back to the user's own captured photo (saved via photoStore under
  // the plant's own id — see scan.tsx's add-to-garden handlers) when there's
  // no reference photo URL set, same as plant.$id.tsx's heroPhoto.
  const ownPhotoUrl = usePhotoUrl(plant.photo ? undefined : plant.id);
  const photo = plant.photo ?? ownPhotoUrl;
  return (
    <Link
      to="/plant/$id"
      params={{ id: plant.id }}
      className={`ios-tap leaf-card relative overflow-hidden flex flex-col justify-end ${featured ? "col-span-2 aspect-[16/10]" : "aspect-square"
        }`}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          <div className={`absolute inset-0 ${plant.gradient}`} />
          <span
            className={`absolute ${featured ? "top-4 right-4 text-6xl" : "top-3 right-3 text-4xl"} opacity-90 drop-shadow-sm`}
            aria-hidden
          >
            {plant.emoji}
          </span>
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/0" />

      {needsAttention && !needsWaterOrMist && (
        <span className="absolute top-3 left-3 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white/70" />
      )}

      {needsWaterOrMist && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onWater(plant);
          }}
          aria-label={t("home.waterThisPlant")}
          className="ios-tap absolute top-2.5 right-2.5 h-11 w-11 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-[0_4px_14px_-2px_var(--primary)] ring-2 ring-white animate-gentle-pulse"
        >
          <Droplets className="h-5 w-5" strokeWidth={2.25} />
        </button>
      )}

      <div className={`relative p-3.5 ${featured ? "pb-4" : ""}`}>
        <p
          className={`font-display leading-tight text-white ${featured ? "text-xl" : "text-[15px]"}`}
        >
          {plant.name}
        </p>
        {featured && (
          <p className="text-[11px] italic text-white/75 truncate mt-0.5">{plant.scientific}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span
            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-1 rounded-full backdrop-blur-sm ${needsAttention ? "bg-primary/90 text-primary-foreground" : "bg-white/20 text-white"
              }`}
          >
            {t(statusLabelKeys[plant.status])}
          </span>
          {featured && (
            <span className="text-[11px] text-white/80 tabular-nums">{plant.health}%</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function EmptyGarden({ onTryDemo, seeding }: { onTryDemo: () => void; seeding: boolean }) {
  const t = useT();
  return (
    <div className="leaf-card flex flex-col items-center text-center px-6 py-12 mb-8">
      <div className="h-14 w-14 rounded-full bg-secondary grid place-items-center mb-4">
        <Sprout className="h-6 w-6 text-primary" strokeWidth={1.75} />
      </div>
      <h2 className="font-display text-xl">{t("home.empty.title")}</h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[26ch]">{t("home.empty.body")}</p>
      <div className="flex flex-col w-full gap-2 mt-6">
        <Link
          to="/scan"
          className="ios-tap h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
        >
          <Camera className="h-4 w-4" strokeWidth={1.75} /> {t("home.empty.scanCta")}
        </Link>
        <button
          onClick={onTryDemo}
          disabled={seeding}
          className="ios-tap h-12 rounded-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {seeding ? (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" strokeWidth={1.75} />
          )}
          {t("home.empty.demoCta")}
        </button>
      </div>
    </div>
  );
}

type TaskKind = "Water" | "Mist" | "Fertilize" | "Repot";

type GardenTask = {
  id: string;
  plant: Plant;
  kind: TaskKind;
  labelKey: TranslationKey;
};

// Real to-do list derived from each plant's actual due-status, so any plant
// (scanned, catalog-added, or demo) shows up here the moment it's actually
// due — unlike the old hardcoded demo-only task list this replaces.
function buildGardenTasks(plants: Plant[]): GardenTask[] {
  const tasks: GardenTask[] = [];
  for (const plant of plants) {
    if (plant.status === "needs-water") {
      tasks.push({ id: `${plant.id}-water`, plant, kind: "Water", labelKey: "home.tasks.water" });
    } else if (plant.status === "needs-mist") {
      tasks.push({ id: `${plant.id}-mist`, plant, kind: "Mist", labelKey: "home.tasks.mist" });
    }
    if (isDueForFertilizing(plant)) {
      tasks.push({
        id: `${plant.id}-fertilize`,
        plant,
        kind: "Fertilize",
        labelKey: "home.tasks.fertilize",
      });
    }
    if (isDueForRepotting(plant)) {
      tasks.push({ id: `${plant.id}-repot`, plant, kind: "Repot", labelKey: "home.tasks.repot" });
    }
  }
  return tasks;
}

function Dashboard() {
  const t = useT();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const gardenPlants = useGardenPlants();
  const [streak, setStreak] = useState(0);
  const [showGardenInfo, setShowGardenInfo] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [coords, setCoords] = useState<{
    lat?: number;
    lon?: number;
    city?: string;
    region?: string;
    country?: string;
  }>({});

  useEffect(() => {
    setStreak(getCurrentStreak());
    setHydrated(true);
  }, []);

  useEffect(() => {
    // IP-based location (Cloudflare edge geo, falling back to ipapi.co
    // server-side) is only ever city-level accurate — used here as the
    // source for the readable place name (city/region/country, which GPS
    // alone can't give us) and as the coordinate fallback if the browser's
    // real GPS below is denied, unavailable, or times out.
    getUserLocation()
      .then((res) => {
        if (res.status !== "ok") return;
        setCoords((prev) => ({
          lat: prev.lat ?? res.data.lat,
          lon: prev.lon ?? res.data.lon,
          city: res.data.city,
          region: res.data.region,
          country: res.data.country,
        }));
      })
      .catch((err) => {
        // Network hiccup or transport error talking to the server fn —
        // without this, coords.city/region/country silently stay unset
        // forever with no retry, and WeatherCard just never shows a
        // location line (falls back to weather-only, no visible error).
        console.error("Failed to load user location:", err);
      });

    // Real device GPS — far more accurate than IP geolocation, especially
    // on mobile networks or behind a VPN. Overwrites the IP-based lat/lon
    // once resolved; silently no-ops on denial/timeout/unsupported browsers
    // since the IP-based fallback above already covers those cases.
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords((prev) => ({
            ...prev,
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          }));
        },
        () => {
          // Denied, unavailable, or timed out — IP-based coords (set above,
          // whenever that request resolves) remain in effect.
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
      );
    }
  }, []);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    try {
      await seedDemoData();
      setStreak(getCurrentStreak());
    } finally {
      setSeeding(false);
    }
  };

  // From the empty state's "Try a demo garden" — re-enable the catalog
  // (in case it was previously dismissed) then reload so useGardenPlants
  // picks it back up, matching handleHideDemo's reload-based approach.
  const handleSeedDemoDataAndShow = async () => {
    setSeeding(true);
    try {
      showDemoCatalog();
      await seedDemoData();
    } finally {
      window.location.reload();
    }
  };

  const isEmpty = hydrated && gardenPlants.length === 0;
  // Real to-do list: derived from each plant's actual due-status (water,
  // mist, fertilize, repot), so any plant shows up the moment it's due.
  const activeTasks = useMemo(() => buildGardenTasks(gardenPlants), [gardenPlants]);

  useEffect(() => {
    if (activeTasks.length > 0 && activeTasks.every((t) => done[t.id])) {
      recordDayCompleted();
      setStreak(getCurrentStreak());
    }
  }, [done, activeTasks]);

  // useGardenPlants only loads once per mount — this reflects a just-watered
  // plant's new status/lastWatered immediately without needing a full
  // reload, the same way `done`/`careDone` mask in-session task completion
  // above rather than re-fetching.
  const [wateredOverrides, setWateredOverrides] = useState<Record<string, Plant>>({});
  const liveGardenPlants = useMemo(
    () => gardenPlants.map((p) => wateredOverrides[p.id] ?? p),
    [gardenPlants, wateredOverrides],
  );

  const handleWaterPlant = (plant: Plant) => {
    const watered = markWatered(plant);
    updatePlantInGarden(watered);
    setWateredOverrides((prev) => ({ ...prev, [plant.id]: watered }));
  };

  const sortedGarden = useMemo(
    () => [...liveGardenPlants].sort((a, b) => PRIORITY_ORDER[a.status] - PRIORITY_ORDER[b.status]),
    [liveGardenPlants],
  );

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlantStatus | "all">("all");
  // Search/filter only earns its keep once the grid is long enough to
  // need it — below that, scanning the whole grid by eye is faster.
  const showSearch = gardenPlants.length > 4;
  const filteredGarden = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortedGarden.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.scientific.toLowerCase().includes(q);
    });
  }, [sortedGarden, query, statusFilter]);
  const attentionPlants = useMemo(
    () => liveGardenPlants.filter((p) => p.status !== "healthy"),
    [liveGardenPlants],
  );
  const attentionCount = attentionPlants.length;

  // Quick action: marks every attention-needing plant's matching task (water
  // or mist) done in one tap, reusing the same completion state the
  // swipeable task rows use — no separate "watered" persistence to invent.
  const handleWaterAll = () => {
    const attentionIds = new Set(attentionPlants.map((p) => p.id));
    setDone((d) => {
      const next = { ...d };
      for (const t of activeTasks) {
        if (attentionIds.has(t.plant.id) && (t.kind === "Water" || t.kind === "Mist")) {
          next[t.id] = true;
        }
      }
      return next;
    });
  };

  const [careDone, setCareDone] = useState<Record<string, boolean>>({});
  const duePlants = useMemo(
    () => ({
      fertilize: gardenPlants.filter((p) => isDueForFertilizing(p) && !careDone[`${p.id}-fertilize`]),
      repot: gardenPlants.filter((p) => isDueForRepotting(p) && !careDone[`${p.id}-repot`]),
    }),
    [gardenPlants, careDone],
  );

  // Batch fertilize/repot: unlike watering (which is purely a session-only
  // "done" checkbox — see handleWaterAll above), these actually persist the
  // new last-done date onto each Plant via updatePlantInGarden, since
  // fertilize/repot dates are stored on the plant itself (see plants.ts's
  // lastFertilized/lastRepotted) rather than derived from a static seed
  // string the way lastWatered currently is.
  const handleFertilizeAll = () => {
    for (const plant of duePlants.fertilize) {
      updatePlantInGarden(markFertilized(plant));
    }
    setCareDone((d) => {
      const next = { ...d };
      for (const plant of duePlants.fertilize) next[`${plant.id}-fertilize`] = true;
      return next;
    });
  };

  const handleRepotAll = () => {
    for (const plant of duePlants.repot) {
      updatePlantInGarden(markRepotted(plant));
    }
    setCareDone((d) => {
      const next = { ...d };
      for (const plant of duePlants.repot) next[`${plant.id}-repot`] = true;
      return next;
    });
  };

  const handleRefresh = () => new Promise<void>((resolve) => setTimeout(resolve, 900));

  return (
    <AppShell>
      <PullToRefresh onRefresh={handleRefresh}>
        <header className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t(greetingKey())}
            </p>
            <h1 className="text-3xl font-display mt-1">{t("home.heading")}</h1>
          </div>
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <Link
                to="/streak"
                className="ios-tap mt-1.5 h-8 px-2.5 rounded-full bg-secondary flex items-center gap-1 shrink-0"
                title={t("home.streakTitle", { count: streak })}
              >
                <Flame
                  className="h-3.5 w-3.5 text-primary"
                  strokeWidth={1.75}
                  fill="currentColor"
                  fillOpacity={0.2}
                />
                <span className="text-xs font-medium tabular-nums">{streak}</span>
              </Link>
            )}
            <Link
              to="/settings"
              className="ios-tap mt-1.5 h-8 w-8 rounded-full bg-secondary grid place-items-center shrink-0"
              aria-label={t("nav.settings")}
              title={t("nav.settings")}
            >
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        {isEmpty ? (
          <EmptyGarden onTryDemo={handleSeedDemoDataAndShow} seeding={seeding} />
        ) : (
          <>
            {/* Quick actions: water/fertilize/repot due today, combined into one compact card */}
            {(attentionCount > 0 || duePlants.fertilize.length > 0 || duePlants.repot.length > 0) && (
              <div className="leaf-card divide-y divide-border mb-7 overflow-hidden">
                {attentionCount > 0 && (
                  <button
                    onClick={handleWaterAll}
                    className="ios-tap w-full flex items-center gap-3 p-3.5 text-left"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 grid place-items-center">
                      <Droplets className="h-4 w-4 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t("home.waterAll.title", {
                          count: attentionCount,
                          plural: attentionCount === 1 ? "" : "s",
                        })}
                      </p>
                    </div>
                    <span className="ios-tap shrink-0 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold grid place-items-center">
                      {t("home.waterAll.done")}
                    </span>
                  </button>
                )}

                {duePlants.fertilize.length > 0 && (
                  <button
                    onClick={handleFertilizeAll}
                    className="ios-tap w-full flex items-center gap-3 p-3.5 text-left"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 grid place-items-center">
                      <Leaf className="h-4 w-4 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t("home.fertilizeAll.title", { count: duePlants.fertilize.length })}
                      </p>
                    </div>
                    <span className="ios-tap shrink-0 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold grid place-items-center">
                      {t("home.waterAll.done")}
                    </span>
                  </button>
                )}

                {duePlants.repot.length > 0 && (
                  <button
                    onClick={handleRepotAll}
                    className="ios-tap w-full flex items-center gap-3 p-3.5 text-left"
                  >
                    <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 grid place-items-center">
                      <CircleDot className="h-4 w-4 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t("home.repotAll.title", { count: duePlants.repot.length })}
                      </p>
                    </div>
                    <span className="ios-tap shrink-0 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold grid place-items-center">
                      {t("home.waterAll.done")}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* To-do — the real, always-visible list of what's due today, in
                place of the plant grid's own status badges */}
            <section className="mb-8">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-display">{t("home.tasksToday")}</h2>
                {activeTasks.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t("home.tasksDone", {
                      done: Object.values(done).filter(Boolean).length,
                      total: activeTasks.length,
                    })}
                  </span>
                )}
              </div>
              {activeTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t("home.tasks.empty")}
                </p>
              ) : (
                <div className="ios-group">
                  {activeTasks.map((task) => {
                    const isCompleted = done[task.id];
                    return (
                      <SwipeableTaskRow
                        key={task.id}
                        isCompleted={isCompleted}
                        onComplete={() => setDone((d) => ({ ...d, [task.id]: true }))}
                      >
                        <button
                          onClick={() => setDone((d) => ({ ...d, [task.id]: true }))}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${isCompleted ? "opacity-60" : ""}`}
                        >
                          <div
                            className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${isCompleted
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/30"
                              }`}
                          >
                            {isCompleted && (
                              <Check
                                className="h-3.5 w-3.5 text-primary-foreground"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                          <PlantThumb
                            emoji={task.plant.emoji}
                            photo={task.plant.photo}
                            gradient={task.plant.gradient}
                            className="h-10 w-10 rounded-full text-lg [&>span]:text-lg shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium transition-all ${isCompleted ? "line-through text-muted-foreground" : ""
                                }`}
                            >
                              {t(task.labelKey, { name: task.plant.name })}
                            </p>
                          </div>
                        </button>
                      </SwipeableTaskRow>
                    );
                  })}
                  {activeTasks.every((task) => done[task.id]) && (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {t("home.allDoneToday")}
                    </div>
                  )}
                </div>
              )}
              {Object.values(done).some(Boolean) && (
                <button
                  onClick={() => setDone({})}
                  className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground mx-auto"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t("home.resetTasks")}
                </button>
              )}
            </section>

            {/* My Garden */}
            <section className="mb-8">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-lg font-display">{t("home.myGarden")}</h2>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {attentionCount > 0 ? (
                    <>
                      <Droplets className="h-3 w-3" strokeWidth={1.75} />
                      {t("home.needsAttention", {
                        count: attentionCount,
                        plural: attentionCount === 1 ? "s" : "",
                      })}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" strokeWidth={1.75} />
                      {t("home.allThriving")}
                    </>
                  )}
                </span>
              </div>
              {showSearch && (
                <div className="mb-4">
                  <div className="relative">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("home.search.placeholder")}
                      className="w-full h-10 rounded-full bg-secondary pl-10 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        aria-label={t("home.search.clear")}
                        className="ios-tap absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted-foreground/20 grid place-items-center"
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
                    {(["all", "needs-water", "needs-mist", "quarantined", "healthy"] as const).map(
                      (s) => (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`ios-tap shrink-0 h-7 px-3 rounded-full text-xs font-medium transition-colors ${statusFilter === s
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground"
                            }`}
                        >
                          {s === "all" ? t("home.search.filterAll") : t(statusLabelKeys[s])}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {filteredGarden.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("home.search.noResults")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredGarden.map((p, i) => (
                    <GardenBentoCard
                      key={p.id}
                      plant={p}
                      featured={i === 0 && !query && statusFilter === "all"}
                      onWater={handleWaterPlant}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Garden info — weather, hardiness zone, watering calendar, and
                paywalled insights, tucked behind one collapsed section so
                the to-do list and garden grid stay the focal point */}
            <section>
              <button
                onClick={() => setShowGardenInfo((s) => !s)}
                className="ios-tap w-full flex items-center gap-3 leaf-card p-3.5 text-left"
              >
                <div className="h-8 w-8 shrink-0 rounded-full bg-secondary grid place-items-center">
                  <Info className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("home.gardenInfo.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("home.gardenInfo.sub")}</p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${showGardenInfo ? "rotate-180" : ""}`}
                  strokeWidth={1.75}
                />
              </button>

              {showGardenInfo && (
                <div className="mt-4 space-y-7">
                  <WeatherCard
                    lat={coords.lat}
                    lon={coords.lon}
                    city={coords.city}
                    region={coords.region}
                    country={coords.country}
                  />
                  <HardinessZoneInfo lat={coords.lat} lon={coords.lon} />
                  <WaterCalendar plants={gardenPlants} />
                  <AdvancedWateringInsights plants={gardenPlants} />
                  <GardenDigest plants={gardenPlants} />
                </div>
              )}
            </section>
          </>
        )}
      </PullToRefresh>
    </AppShell>
  );
}
