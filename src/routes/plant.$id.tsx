import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PlantThumb } from "@/components/AppShell";
import { getPlant, type Plant, type TimelineEntry, type TimelineChange } from "@/lib/plants";
import { useGardenPlant } from "@/lib/myGarden";
import { savePhoto } from "@/lib/photoStore";
import { saveEmbedding, getEmbedding, cosineSimilarity } from "@/lib/embeddingStore";
import { usePhotoUrl } from "@/lib/usePhotoUrl";
import { getReminderStatus, recordPhotoTaken } from "@/lib/reminders";
import { getCareToggles, setCareToggle, type CareTask } from "@/lib/careSchedule";
import { downloadPlantCareIcs } from "@/lib/calendarExport";
import { getPhotoEmbedding } from "@/lib/plantnet.server";
import { Slideshow } from "@/components/Slideshow";
import { CompareSlider } from "@/components/CompareSlider";
import { HealthChecks } from "@/components/HealthChecks";
import { useT, type TranslationKey } from "@/lib/i18n";
import {
  ArrowLeft,
  Droplets,
  Sun,
  Sprout,
  PawPrint,
  CalendarPlus,
  MapPin,
  Camera,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  MessageCircle,
  Images,
  BellRing,
  ChevronDown,
  SplitSquareHorizontal,
  Check,
  ScanEye,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PlantSearch = { highlight?: string; fromMsg?: string };

export const Route = createFileRoute("/plant/$id")({
  validateSearch: (search: Record<string, unknown>): PlantSearch => ({
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
    fromMsg: typeof search.fromMsg === "string" ? search.fromMsg : undefined,
  }),
  loader: ({ params }) => {
    // Static catalog lookup only (SSR-safe). A plant added via /scan lives
    // in localStorage and only resolves client-side — see useGardenPlant().
    return { plant: getPlant(params.id) ?? null };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.plant ? `${loaderData.plant.name} — Verdant` : "Plant — Verdant" },
      {
        name: "description",
        content: loaderData?.plant
          ? `AI care guide for ${loaderData.plant.name} (${loaderData.plant.scientific}).`
          : "Plant care guide.",
      },
      {
        property: "og:title",
        content: loaderData?.plant ? `${loaderData.plant.name} — Verdant` : "Plant — Verdant",
      },
      {
        property: "og:description",
        content: loaderData?.plant
          ? `AI care guide for ${loaderData.plant.name}.`
          : "Plant care guide.",
      },
    ],
  }),
  component: PlantDetail,
});

// Main page tabs organize dense content into focused sections
const mainTabs = [
  { id: "care", labelKey: "plant.tab.care" satisfies TranslationKey, icon: Sprout },
  { id: "timeline", labelKey: "plant.tab.timeline" satisfies TranslationKey, icon: Images },
  { id: "health", labelKey: "plant.tab.health" satisfies TranslationKey, icon: TrendingUp },
  { id: "schedule", labelKey: "plant.tab.schedule" satisfies TranslationKey, icon: CalendarPlus },
] as const;

// Sub-tabs within Care Guide
const careTabs = [
  { id: "water", labelKey: "plant.tab.water" satisfies TranslationKey, icon: Droplets },
  { id: "sunlight", labelKey: "plant.tab.sunlight" satisfies TranslationKey, icon: Sun },
  { id: "soil", labelKey: "plant.tab.soil" satisfies TranslationKey, icon: Sprout },
  { id: "toxicity", labelKey: "plant.tab.toxicity" satisfies TranslationKey, icon: PawPrint },
] as const;

function PlantDetail() {
  const t = useT();
  const { plant: staticPlant } = Route.useLoaderData();
  const { id } = Route.useParams();
  const { plant: gardenPlant, hydrated } = useGardenPlant(id);
  const plant = staticPlant ?? gardenPlant;

  if (!plant) {
    // Still checking localStorage for a scanned-and-added plant — avoid
    // flashing "not found" before that lookup resolves.
    if (staticPlant === null && !hydrated) return null;

    return (
      <AppShell>
        <div className="pt-24 text-center">
          <p className="text-sm text-muted-foreground">{t("plant.notFound")}</p>
          <Link to="/" className="ios-tap inline-block mt-4 text-sm font-medium text-primary">
            {t("plant.backToGarden")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return <PlantDetailView plant={plant} />;
}

function TimelineThumb({ entry, className }: { entry: TimelineEntry; className: string }) {
  const url = usePhotoUrl(entry.hasPhoto ? entry.id : undefined);
  if (url) {
    return <img src={url} alt={entry.headline} className={`object-cover ${className}`} />;
  }
  return <PlantThumb emoji={entry.emoji} gradient={entry.gradient} className={className} />;
}

// Cosine similarity between this upload's Pl@ntNet embedding and the
// previous photo's — a genuine visual-consistency signal (are these two
// photos of the same plant, roughly the same framing?), distinct from the
// simulated health score above it. undefined = still computing, null = no
// prior photo to compare against or the embeddings call failed.
function VisualSimilarityNote({ similarity }: { similarity: number | null | undefined }) {
  const t = useT();
  if (similarity === undefined) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <ScanEye className="h-3.5 w-3.5 animate-pulse shrink-0" strokeWidth={1.75} />
        {t("plant.comparingLast")}
      </p>
    );
  }
  if (similarity === null) return null;

  const pct = Math.round(similarity * 100);
  const labelKey: TranslationKey =
    pct >= 70
      ? "plant.visualMatch.high"
      : pct >= 40
        ? "plant.visualMatch.medium"
        : "plant.visualMatch.low";

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
      <ScanEye className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      {t("plant.visualMatch", { pct, label: t(labelKey) })}
    </p>
  );
}

function PlantDetailView({ plant }: { plant: Plant }) {
  const t = useT();
  const { highlight, fromMsg } = Route.useSearch();
  const [mainTab, setMainTab] = useState<(typeof mainTabs)[number]["id"]>("care");
  const [careTab, setCareTab] = useState<(typeof careTabs)[number]["id"]>("water");
  const [reminders, setReminders] = useState(() => getCareToggles(plant.id));
  const [entries, setEntries] = useState<TimelineEntry[]>(plant.timeline);
  const [uploading, setUploading] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showFact, setShowFact] = useState(false);
  const [lastUploadedPhoto, setLastUploadedPhoto] = useState<Blob | null>(null);
  const [syncedCalendar, setSyncedCalendar] = useState(false);
  // Cosine similarity (0-1) between this upload's Pl@ntNet embedding and the
  // previous entry's stored embedding — undefined while pending/unavailable,
  // null once resolved as "not computable" (no prior photo, or API error).
  const [visualSimilarity, setVisualSimilarity] = useState<number | null | undefined>(undefined);
  const [reminderStatus, setReminderStatus] = useState<ReturnType<typeof getReminderStatus> | null>(
    null,
  );
  // Collapsed by default — only pre-expand when arriving via a Doctor-chat
  // ?highlight= deep link that points at a specific month.
  const [expanded, setExpanded] = useState<string | null>(highlight ?? null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingBlobRef = useRef<Blob | null>(null);
  const entryRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    setReminderStatus(getReminderStatus(plant.id));
  }, [plant.id]);

  // React to incoming ?highlight= changes (e.g. clicking another month from chat)
  useEffect(() => {
    if (!highlight) return;
    setExpanded(highlight);
    setFlashId(highlight);
    const node = entryRefs.current[highlight];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const t = setTimeout(() => setFlashId(null), 1800);
    return () => clearTimeout(t);
  }, [highlight]);

  const careTabContent = {
    water: plant.water,
    sunlight: plant.sunlight,
    soil: plant.soil,
    toxicity: t("plant.toxicitySuffix", { toxicity: plant.toxicity }),
  }[careTab];

  const trend = useMemo(() => {
    if (entries.length < 2) return 0;
    return entries[entries.length - 1].health - entries[0].health;
  }, [entries]);

  const handleToggleReminder = (task: CareTask, enabled: boolean) => {
    setReminders(setCareToggle(plant.id, task, enabled));
    setSyncedCalendar(false);
  };

  const handleSyncCalendar = () => {
    downloadPlantCareIcs(plant, reminders);
    setSyncedCalendar(true);
  };

  const handleFileSelected = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    pendingBlobRef.current = file;
    handleUpload();
  };

  const handleUpload = () => {
    setUploading(true);
    setVisualSimilarity(undefined);
    const blob = pendingBlobRef.current;
    pendingBlobRef.current = null;
    setTimeout(async () => {
      const last = entries[entries.length - 1];
      const nextHealth = Math.max(30, Math.min(100, last.health + (Math.random() > 0.4 ? 4 : -3)));
      const delta = nextHealth - last.health;
      const change: TimelineChange = delta > 1 ? "improved" : delta < -1 ? "declined" : "stable";
      const now = new Date();
      const monthShort = now.toLocaleString("en-US", { month: "short", year: "numeric" });
      const dateLong = now.toLocaleString("en-US", { month: "long", day: "numeric" });
      const newEntry: TimelineEntry = {
        id: `u-${now.getTime()}`,
        month: monthShort,
        date: dateLong,
        emoji: plant.emoji,
        gradient: plant.gradient,
        health: nextHealth,
        change,
        headline:
          change === "improved"
            ? t("plant.newGrowth")
            : change === "declined"
              ? t("plant.minorStress")
              : t("plant.holdingSteady"),
        detail:
          change === "improved"
            ? t("plant.detail.improved")
            : change === "declined"
              ? t("plant.detail.declined")
              : t("plant.detail.stable"),
        hasPhoto: !!blob,
      };
      if (blob) {
        await savePhoto(newEntry.id, blob);
      }
      const next = [...entries, newEntry];
      setEntries(next);
      setExpanded(newEntry.id);
      setUploading(false);
      setLastUploadedPhoto(blob);
      setReminderStatus(getReminderStatus(plant.id));
      recordPhotoTaken(plant.id, now);

      // Real visual-consistency check: embed this photo via Pl@ntNet and
      // compare against the previous entry's stored embedding. Independent
      // of the simulated health score above — this is an actual signal
      // (cosine similarity of two real feature vectors), just not one that
      // maps to "health" on its own, so it's surfaced separately.
      if (blob) {
        const prevWithPhoto = [...entries].reverse().find((e) => e.hasPhoto);
        const [prevVector, embedRes] = await Promise.all([
          prevWithPhoto ? getEmbedding(prevWithPhoto.id) : Promise.resolve(undefined),
          getPhotoEmbedding({
            data: (() => {
              const fd = new FormData();
              fd.append("image", blob, "capture.jpg");
              return fd;
            })(),
          }),
        ]);
        if (embedRes.status === "ok") {
          await saveEmbedding(newEntry.id, embedRes.data);
          setVisualSimilarity(prevVector ? cosineSimilarity(prevVector, embedRes.data) : null);
        } else {
          setVisualSimilarity(null);
        }
      } else {
        setVisualSimilarity(null);
      }
    }, 1600);
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="-mx-5 -mt-8 relative">
        <div
          className={`h-64 ${plant.photo ? "" : plant.gradient} relative grid place-items-center rounded-b-[2.5rem] overflow-hidden`}
        >
          {plant.photo ? (
            <img
              src={plant.photo}
              alt={plant.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="text-7xl" aria-hidden>
              {plant.emoji}
            </span>
          )}
          <Link
            to="/"
            className="ios-tap absolute top-6 left-5 h-10 w-10 rounded-full bg-background/90 grid place-items-center shadow-sm"
            aria-label={t("plant.back")}
          >
            <ArrowLeft className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      <div className="mt-6 mb-6">
        <h1 className="font-display text-3xl">{plant.name}</h1>
        <p className="text-sm italic text-muted-foreground">{plant.scientific}</p>

        <div className="leaf-card p-4 mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{t("plant.health")}</span>
            <span className="text-foreground font-semibold">{plant.health}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${plant.health}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main content tabs */}
      <div className="flex gap-1 bg-muted rounded-full p-1 mb-6 sticky top-0 z-10">
        {mainTabs.map((tabDef) => {
          const Icon = tabDef.icon;
          const active = mainTab === tabDef.id;
          return (
            <button
              key={tabDef.id}
              onClick={() => setMainTab(tabDef.id)}
              className={`ios-tap flex-1 flex items-center justify-center gap-1 h-9 rounded-full transition-colors text-[11px] font-medium ${
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden xs:inline">{t(tabDef.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: CARE GUIDE */}
      {mainTab === "care" && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 px-1">
            {t("plant.careGuide")}
          </h2>
          <div className="flex gap-1 bg-muted rounded-full p-1 mb-4">
            {careTabs.map((tabDef) => {
              const Icon = tabDef.icon;
              const active = careTab === tabDef.id;
              return (
                <button
                  key={tabDef.id}
                  onClick={() => setCareTab(tabDef.id)}
                  className={`ios-tap flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full transition-colors ${
                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="text-[13px] font-medium">{t(tabDef.labelKey)}</span>
                </button>
              );
            })}
          </div>
          <div className="leaf-card p-4 mb-4">
            <p className="text-[15px] leading-relaxed">{careTabContent}</p>
          </div>

          {/* Fun facts in care tab */}
          <button
            onClick={() => setShowFact((s) => !s)}
            className="ios-tap w-full leaf-card p-4 text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {t("plant.didYouKnow")}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showFact ? "rotate-180" : ""}`}
                strokeWidth={1.75}
              />
            </div>
            {showFact && <p className="mt-2 text-[15px] leading-relaxed">{plant.fact}</p>}
            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" strokeWidth={1.75} />{" "}
              {t("plant.nativeTo", { origin: plant.origin })}
            </div>
          </button>
        </section>
      )}

      {/* TAB: GROWTH TIMELINE */}
      {mainTab === "timeline" && (
        <section className="mb-8">
          <h2 className="font-display text-xl mb-3 px-1">{t("plant.growthTimeline")}</h2>
          <span className="text-xs text-muted-foreground px-1 block mb-4">
            {t("plant.monthlyPhotos", {
              count: entries.length,
              label: entries.length === 1 ? t("plant.photo") : t("plant.photos"),
            })}
          </span>

        {reminderStatus?.due && (
          <div className="leaf-card p-4 flex items-center gap-3 mb-4 border-primary/40">
            <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
              <BellRing className="h-4 w-4 text-primary" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{t("plant.reminderTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {reminderStatus.daysSinceLastPhoto == null
                  ? t("plant.reminderBodyFirst")
                  : t("plant.reminderBodyDays", { days: reminderStatus.daysSinceLastPhoto })}
              </p>
            </div>
          </div>
        )}

        {entries.some((e) => e.hasPhoto) && (
          <button
            onClick={() => setShowSlideshow(true)}
            className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 mb-3"
          >
            <Images className="h-4 w-4" strokeWidth={1.75} />
            {t("plant.playSlideshow")}
          </button>
        )}

        {entries.length >= 2 && (
          <button
            onClick={() => setShowCompare(true)}
            className="ios-tap w-full h-12 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold flex items-center justify-center gap-2 mb-3"
          >
            <SplitSquareHorizontal className="h-4 w-4" strokeWidth={1.75} />
            {t("plant.compare")}
          </button>
        )}

        <div className="leaf-card p-4 flex items-center gap-3 mb-4">
          {trend > 0 ? (
            <TrendingUp className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
          ) : trend < 0 ? (
            <TrendingDown
              className="h-4 w-4 text-[oklch(0.4_0.13_35)] shrink-0"
              strokeWidth={1.75}
            />
          ) : (
            <Minus className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
          )}
          <p className="flex-1 text-sm font-medium">
            {trend > 0
              ? t("plant.healthUp", { points: trend })
              : trend < 0
                ? t("plant.healthDown", { points: Math.abs(trend) })
                : t("plant.healthSteady")}
          </p>
          <Link
            to="/doctor"
            search={{
              focus: plant.id,
              ask:
                trend < 0
                  ? t("plant.askDoctorDecline", { name: plant.name })
                  : t("plant.askDoctorChange", { name: plant.name }),
            }}
            className="ios-tap shrink-0 h-8 w-8 rounded-full bg-secondary grid place-items-center"
            aria-label={t("plant.askDoctor", { name: plant.name })}
            title={t("plant.askDoctorTitle")}
          >
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          </Link>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="ios-tap w-full h-12 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70 mb-5"
        >
          {uploading ? (
            <>
              <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              {t("plant.analyzingPhoto")}
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" strokeWidth={1.75} />
              <Plus className="h-3 w-3 -ml-1" strokeWidth={1.75} />
              {t("plant.addPhoto")}
            </>
          )}
        </button>

        {lastUploadedPhoto && !uploading && (
          <div className="leaf-card p-4 mb-5 -mt-1">
            <VisualSimilarityNote similarity={visualSimilarity} />
            <HealthChecks photo={lastUploadedPhoto} variant="standalone" />
          </div>
        )}

        <ol className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border" aria-hidden />
          {entries.map((e, i) => {
            const prev = entries[i - 1];
            const delta = prev ? e.health - prev.health : 0;
            const isOpen = expanded === e.id;
            const dotTone = e.change === "declined" ? "bg-[oklch(0.5_0.13_35)]" : "bg-primary";
            return (
              <li
                key={e.id}
                ref={(el) => {
                  entryRefs.current[e.id] = el;
                }}
                className={`relative mb-3 last:mb-0 scroll-mt-24 transition-all duration-700 rounded-2xl ${
                  flashId === e.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
              >
                <span
                  className={`absolute -left-[19px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${dotTone}`}
                  aria-hidden
                />
                <button
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  className="ios-tap w-full leaf-card p-3 flex items-center gap-3 text-left"
                >
                  <TimelineThumb
                    entry={e}
                    className="h-12 w-12 rounded-full text-2xl [&>span]:text-2xl shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {e.month}
                      </p>
                      {prev && (
                        <span
                          className={`text-[10px] font-medium ${
                            delta > 0
                              ? "text-primary"
                              : delta < 0
                                ? "text-[oklch(0.4_0.13_35)]"
                                : "text-muted-foreground"
                          }`}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-sm leading-tight truncate">{e.headline}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${e.health}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {e.health}
                      </span>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-1 mx-1 p-3 rounded-xl bg-secondary/60">
                    <p className="text-xs text-muted-foreground mb-1">{e.date}</p>
                    <p className="text-sm leading-relaxed">{e.detail}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        </section>
      )}

      {/* TAB: HEALTH */}
      {mainTab === "health" && (
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4 px-1">{t("plant.health")}</h2>

          <div className="leaf-card p-4 flex items-center gap-3 mb-4">
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
            ) : trend < 0 ? (
              <TrendingDown
                className="h-4 w-4 text-[oklch(0.4_0.13_35)] shrink-0"
                strokeWidth={1.75}
              />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
            )}
            <p className="flex-1 text-sm font-medium">
              {trend > 0
                ? t("plant.healthUp", { points: trend })
                : trend < 0
                  ? t("plant.healthDown", { points: Math.abs(trend) })
                  : t("plant.healthSteady")}
            </p>
            <Link
              to="/doctor"
              search={{
                focus: plant.id,
                ask:
                  trend < 0
                    ? t("plant.askDoctorDecline", { name: plant.name })
                    : t("plant.askDoctorChange", { name: plant.name }),
              }}
              className="ios-tap shrink-0 h-8 w-8 rounded-full bg-secondary grid place-items-center"
              aria-label={t("plant.askDoctor", { name: plant.name })}
              title={t("plant.askDoctorTitle")}
            >
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
            </Link>
          </div>

          {lastUploadedPhoto && !uploading && (
            <div className="leaf-card p-4 mb-4">
              <VisualSimilarityNote similarity={visualSimilarity} />
              <HealthChecks photo={lastUploadedPhoto} variant="standalone" />
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="ios-tap w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {uploading ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                {t("plant.analyzingPhoto")}
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" strokeWidth={1.75} />
                <Plus className="h-3 w-3 -ml-1" strokeWidth={1.75} />
                {t("plant.addPhoto")}
              </>
            )}
          </button>
        </section>
      )}

      {/* TAB: SCHEDULE */}
      {mainTab === "schedule" && (
        <section className="mb-8">
          <h2 className="font-display text-xl mb-3 px-1">{t("plant.schedule")}</h2>
        <div className="ios-group">
          {(
            [
              ["water", "plant.schedule.water", "plant.schedule.waterSub"],
              ["fertilizer", "plant.schedule.fertilizer", "plant.schedule.fertilizerSub"],
              ["repot", "plant.schedule.repot", "plant.schedule.repotSub"],
            ] satisfies [CareTask, TranslationKey, TranslationKey][]
          ).map(([k, labelKey, subKey]) => (
            <label key={k} className="flex items-center justify-between px-4 py-3.5 cursor-pointer">
              <div>
                <p className="font-medium text-sm">{t(labelKey)}</p>
                <p className="text-xs text-muted-foreground">{t(subKey)}</p>
              </div>
              <input
                type="checkbox"
                checked={reminders[k]}
                onChange={(e) => handleToggleReminder(k, e.target.checked)}
                className="sr-only peer"
              />
              <div
                onClick={() => handleToggleReminder(k, !reminders[k])}
                className={`h-[1.6rem] w-11 rounded-full relative transition-colors duration-200 ${reminders[k] ? "bg-primary" : "bg-muted"}`}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200 ${reminders[k] ? "left-[1.35rem]" : "left-0.5"}`}
                />
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={handleSyncCalendar}
          disabled={!Object.values(reminders).some(Boolean)}
          className="ios-tap mt-4 w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {syncedCalendar ? (
            <>
              <Check className="h-4 w-4" strokeWidth={1.75} /> {t("plant.calendarDownloaded")}
            </>
          ) : (
            <>
              <CalendarPlus className="h-4 w-4" strokeWidth={1.75} /> {t("plant.syncCalendar")}
            </>
          )}
        </button>
          {!Object.values(reminders).some(Boolean) && (
            <p className="mt-2 text-xs text-muted-foreground text-center">{t("plant.syncHint")}</p>
          )}
        </section>
      )}

      {/* Return-to-chat pill (only when arrived from Plant Doctor) */}
      {fromMsg && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 px-4 w-full max-w-md pointer-events-none">
          <Link
            to="/doctor"
            search={{ msg: fromMsg }}
            className="ios-tap pointer-events-auto flex items-center gap-2 h-11 px-4 rounded-full bg-foreground text-background text-sm font-medium mx-auto w-fit shadow-lg"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
            {t("plant.backToDoctor")}
            <ArrowLeft className="h-3.5 w-3.5 rotate-180 opacity-70" strokeWidth={1.75} />
          </Link>
        </div>
      )}

      {showSlideshow && (
        <Slideshow
          entries={entries}
          plantName={plant.name}
          onClose={() => setShowSlideshow(false)}
        />
      )}

      {showCompare && entries.length >= 2 && (
        <CompareSlider
          before={entries[0]}
          after={entries[entries.length - 1]}
          plantName={plant.name}
          onClose={() => setShowCompare(false)}
        />
      )}
    </AppShell>
  );
}
