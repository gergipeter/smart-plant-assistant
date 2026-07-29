import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PlantThumb } from "@/components/AppShell";
import { getPlant, type Plant, type TimelineEntry } from "@/lib/plants";
import { useGardenPlant, updatePlantInGarden, propagatePlant, getFromMyGarden } from "@/lib/myGarden";
import { useAuth } from "@/lib/auth";
import { savePhoto } from "@/lib/photoStore";
import { saveEmbedding, getEmbedding, cosineSimilarity } from "@/lib/embeddingStore";
import { scoreFromSimilarity, adjustEntryForDisease } from "@/lib/healthScoring";
import { usePhotoUrl } from "@/lib/usePhotoUrl";
import { getReminderStatus, recordPhotoTaken } from "@/lib/reminders";
import { getCareToggles, setCareToggle, type CareTask } from "@/lib/careSchedule";
import {
  isDueForFertilizing,
  isDueForRepotting,
  markFertilized,
  markRepotted,
  markWatered,
} from "@/lib/careDueStatus";
import { downloadPlantCareIcs } from "@/lib/calendarExport";
import { printCareHistory } from "@/lib/careHistoryExport";
import { getPhotoEmbedding } from "@/lib/plantnet.server";
import { Slideshow } from "@/components/Slideshow";
import { CompareSlider } from "@/components/CompareSlider";
import { HealthChecks } from "@/components/HealthChecks";
import { PlantEnrichment, ImageHealthAnalysis } from "@/components/PlantEnrichment";
import { CommunityPhotos } from "@/components/CommunityPhotos";
import { SensorReadingCard } from "@/components/SensorReadingCard";
import { useT, useI18n, dateLocale, type TranslationKey } from "@/lib/i18n";
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
  Printer,
  GitBranch,
  Scissors,
  Leaf,
  CircleDot,
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
  // A saved garden copy (e.g. one the user has added a timeline photo to —
  // see updatePlantInGarden in myGarden.ts) reflects real edits and must
  // win over the pristine static catalog entry, not just plants that only
  // exist in the garden (scanned/added, not in the static catalog at all).
  const plant = gardenPlant ?? staticPlant;

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

// A single extra-angle photo thumbnail within an expanded entry's gallery —
// resolves its own blob: URL from photoStore.ts, same pattern as
// TimelineThumb/usePhotoUrl but for a synthetic extra-photo id rather than
// the entry's primary id.
function ExtraPhotoThumb({
  photoId,
  onClick,
  square,
}: {
  photoId: string;
  onClick: () => void;
  square?: boolean;
}) {
  const url = usePhotoUrl(photoId);
  const sizeClass = square ? "aspect-square w-full" : "h-16 w-16 shrink-0";
  // The always-visible grid (square=true) uses the app's leaf-card treatment
  // (continuous corner radius + soft ambient shadow) so it reads as part of
  // the designed page rather than a bare utility grid; the horizontal strip
  // inside an expanded timeline entry stays a plain flat thumbnail, since
  // that's a compact inline affordance, not its own gallery section.
  if (!url) {
    return (
      <div
        className={`bg-muted animate-pulse ${sizeClass} ${square ? "rounded-xl" : "rounded-lg"}`}
      />
    );
  }
  return (
    <button
      onClick={onClick}
      className={`ios-tap overflow-hidden ${square ? "leaf-card" : "rounded-lg shrink-0"}`}
    >
      <img
        src={url}
        alt=""
        className={`object-cover ${sizeClass} ${square ? "" : "rounded-lg"}`}
      />
    </button>
  );
}

// Extra angle photos (e.g. a close-up of a problem area) attached to a
// timeline entry alongside its primary photo — viewing only, never scored by
// the embedding/disease-check pipeline (see TimelineEntry.extraPhotoIds).
function EntryGallery({
  entry,
  onAddPhoto,
  adding,
}: {
  entry: TimelineEntry;
  onAddPhoto: (file: File) => void;
  adding: boolean;
}) {
  const t = useT();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const viewerUrl = usePhotoUrl(viewerId ?? undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const extraIds = entry.extraPhotoIds ?? [];

  const handlePick = () => fileRef.current?.click();
  const handleFile = () => {
    const file = fileRef.current?.files?.[0];
    if (file) onAddPhoto(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {extraIds.map((id) => (
          <ExtraPhotoThumb key={id} photoId={id} onClick={() => setViewerId(id)} />
        ))}
        {entry.hasPhoto && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={handlePick}
              disabled={adding}
              className="ios-tap h-16 w-16 rounded-lg border border-dashed border-muted-foreground/40 grid place-items-center shrink-0 text-muted-foreground disabled:opacity-60"
              aria-label={t("plant.addAnglePhoto")}
              title={t("plant.addAnglePhoto")}
            >
              {adding ? (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          </>
        )}
      </div>

      {viewerId && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          onClick={() => setViewerId(null)}
        >
          {viewerUrl && <img src={viewerUrl} alt="" className="max-h-full max-w-full rounded-xl" />}
        </div>
      )}
    </div>
  );
}

// All photos across every timeline entry (primary + any extra angles),
// newest first — a single always-visible place to see everything you've
// uploaded for this plant, instead of having to expand each entry one at a
// time. Reuses ExtraPhotoThumb's per-id blob: URL resolution and the same
// full-screen viewer overlay pattern as EntryGallery.
function PhotoGrid({ entries }: { entries: TimelineEntry[] }) {
  const t = useT();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const viewerUrl = usePhotoUrl(viewerId ?? undefined);

  const photoIds = useMemo(() => {
    const ids: string[] = [];
    for (const entry of [...entries].reverse()) {
      if (entry.hasPhoto) ids.push(entry.id);
      for (const extraId of entry.extraPhotoIds ?? []) ids.push(extraId);
    }
    return ids;
  }, [entries]);

  if (photoIds.length === 0) return null;

  return (
    <section className="mb-5">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground px-1 mb-2">
        {t("plant.allPhotos", { count: photoIds.length })}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {photoIds.map((id) => (
          <ExtraPhotoThumb key={id} photoId={id} onClick={() => setViewerId(id)} square />
        ))}
      </div>

      {viewerId && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          onClick={() => setViewerId(null)}
        >
          {viewerUrl && <img src={viewerUrl} alt="" className="max-h-full max-w-full rounded-2xl" />}
        </div>
      )}
    </section>
  );
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
  const { t, locale } = useI18n();
  const { highlight, fromMsg } = Route.useSearch();
  const [mainTab, setMainTab] = useState<(typeof mainTabs)[number]["id"]>("care");
  const [careTab, setCareTab] = useState<(typeof careTabs)[number]["id"]>("water");
  const [reminders, setReminders] = useState(() => getCareToggles(plant.id));
  const [entries, setEntries] = useState<TimelineEntry[]>(plant.timeline);
  // `plant` starts as the static catalog copy on first render and can later
  // swap to the hydrated, possibly-newer garden copy (see PlantDetail above)
  // without this component remounting — useState's initializer only runs
  // once, so without this sync `entries` would stay pinned to whichever
  // `plant.timeline` existed at first render, silently hiding a real saved
  // update (e.g. a photo added in a previous session) after a fresh load.
  // Fires once, when useGardenPlant's hydration swaps the prop reference —
  // handleUpload's own setEntries calls happen after that and aren't
  // clobbered by this, since `plant.timeline` doesn't change again on its
  // own afterward.
  useEffect(() => {
    setEntries(plant.timeline);
  }, [plant.timeline]);
  // In-session patch for care actions (water/fertilize/repot) taken on this
  // page — same pattern the home dashboard uses for its own quick actions,
  // since useGardenPlant only reads from storage once per mount and won't
  // otherwise reflect a just-logged action without a full reload.
  const [careOverride, setCareOverride] = useState<Partial<Plant>>({});
  const livePlant = { ...plant, ...careOverride };
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
  const [addingPhotoTo, setAddingPhotoTo] = useState<string | null>(null);
  const [propagating, setPropagating] = useState(false);
  const [propagatedId, setPropagatedId] = useState<string | null>(null);
  // Unidentified scans (see scan.tsx's addUnidentifiedPlantToGarden) have no
  // reference photo URL to set on `plant.photo` — their captured photo is
  // saved to photoStore under the plant's own id instead, same mechanism as
  // timeline entries below.
  const ownPhotoUrl = usePhotoUrl(plant.photo ? undefined : plant.id);
  const heroPhoto = plant.photo ?? ownPhotoUrl;
  const { user } = useAuth();
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
      const now = new Date();

      // Compute the real signal FIRST: embed this photo via Pl@ntNet and
      // compare against the previous photo's stored embedding. The health
      // score below is derived from this, not a random number — see
      // healthScoring.ts for why similarity can only ever support
      // "stable"/"changed", never "improved" on its own.
      let similarity: number | null = null;
      let embeddingVector: number[] | undefined;
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
          embeddingVector = embedRes.data;
          similarity = prevVector ? cosineSimilarity(prevVector, embedRes.data) : null;
        }
      }
      setVisualSimilarity(similarity);

      const { health: nextHealth, change } = scoreFromSimilarity(last.health, similarity);
      const monthShort = now.toLocaleString(dateLocale(locale), { month: "short", year: "numeric" });
      const dateLong = now.toLocaleString(dateLocale(locale), { month: "long", day: "numeric" });
      const newEntry: TimelineEntry = {
        id: `u-${now.getTime()}`,
        month: monthShort,
        date: dateLong,
        emoji: plant.emoji,
        gradient: plant.gradient,
        health: nextHealth,
        change,
        headline:
          change === "changed"
            ? t("plant.visibleChange")
            : t("plant.holdingSteady"),
        detail:
          change === "changed"
            ? t("plant.detail.changed")
            : t("plant.detail.stable"),
        hasPhoto: !!blob,
      };
      if (blob) {
        await savePhoto(newEntry.id, blob);
        if (embeddingVector) await saveEmbedding(newEntry.id, embeddingVector);
      }
      const next = [...entries, newEntry];
      setEntries(next);
      updatePlantInGarden({ ...plant, timeline: next });
      setExpanded(newEntry.id);
      setUploading(false);
      setLastUploadedPhoto(blob);
      setReminderStatus(getReminderStatus(plant.id));
      recordPhotoTaken(plant.id, now);
    }, 1600);
  };

  // Creates a new "cutting" plant linked back to this one via
  // propagatePlant() in myGarden.ts, then shows a quick confirmation with a
  // link to the new plant rather than navigating away immediately — the
  // user is often mid-way through looking at the parent's care info.
  const handlePropagate = () => {
    setPropagating(true);
    try {
      const newId = propagatePlant(plant, t, locale);
      setPropagatedId(newId);
    } finally {
      setPropagating(false);
    }
  };

  // Adds an extra angle photo (e.g. a close-up of a problem area) to an
  // existing entry, alongside its primary photo. Stored under a synthetic id
  // in the same photoStore.ts used for primary photos, but never fed into
  // the embedding/disease-check pipeline — viewing only.
  const handleAddExtraPhoto = async (entryId: string, file: File) => {
    setAddingPhotoTo(entryId);
    try {
      const target = entries.find((e) => e.id === entryId);
      const nextIndex = (target?.extraPhotoIds?.length ?? 0) + 1;
      const photoId = `${entryId}-extra-${nextIndex}`;
      await savePhoto(photoId, file);
      const next = entries.map((e) =>
        e.id === entryId ? { ...e, extraPhotoIds: [...(e.extraPhotoIds ?? []), photoId] } : e,
      );
      setEntries(next);
      updatePlantInGarden({ ...plant, timeline: next });
    } finally {
      setAddingPhotoTo(null);
    }
  };

  // Called by HealthChecks after a manual disease check finds a confident
  // match on the most recent entry's photo — the one signal with real
  // directional meaning, so it's allowed to revise that entry's score/label
  // (see healthScoring.ts). No-ops if there's no entry to adjust.
  const handleDiseaseDetected = (topDiseaseScore: number) => {
    setEntries((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const adjusted = adjustEntryForDisease(
        { health: last.health, change: last.change },
        topDiseaseScore,
      );
      if (adjusted.change === last.change && adjusted.health === last.health) return prev;
      const updatedEntry: TimelineEntry = {
        ...last,
        health: adjusted.health,
        change: adjusted.change,
        headline: t("plant.minorStress"),
        detail: t("plant.detail.declined"),
      };
      const next = [...prev.slice(0, -1), updatedEntry];
      updatePlantInGarden({ ...plant, timeline: next });
      return next;
    });
  };

  const handleMarkWatered = () => {
    const watered = markWatered(livePlant);
    updatePlantInGarden(watered);
    setCareOverride((prev) => ({ ...prev, ...watered }));
  };

  const handleMarkFertilized = () => {
    const fertilized = markFertilized(livePlant);
    updatePlantInGarden(fertilized);
    setCareOverride((prev) => ({ ...prev, ...fertilized }));
  };

  const handleMarkRepotted = () => {
    const repotted = markRepotted(livePlant);
    updatePlantInGarden(repotted);
    setCareOverride((prev) => ({ ...prev, ...repotted }));
  };

  const needsWaterOrMist =
    livePlant.status === "needs-water" || livePlant.status === "needs-mist";
  const dueFertilize = isDueForFertilizing(livePlant);
  const dueRepot = isDueForRepotting(livePlant);

  return (
    <AppShell>
      {/* Header */}
      <div className="-mx-5 -mt-8 relative">
        <div
          className={`h-64 ${heroPhoto ? "" : plant.gradient} relative grid place-items-center rounded-b-[2.5rem] overflow-hidden`}
        >
          {heroPhoto ? (
            <img
              src={heroPhoto}
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

        {(needsWaterOrMist || dueFertilize || dueRepot) && (
          <div className="flex gap-2 mt-3">
            {needsWaterOrMist && (
              <button
                onClick={handleMarkWatered}
                className="ios-tap flex-1 h-11 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Droplets className="h-4 w-4" strokeWidth={1.75} />
                {t("plant.quickAction.water")}
              </button>
            )}
            {dueFertilize && (
              <button
                onClick={handleMarkFertilized}
                className="ios-tap flex-1 h-11 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Leaf className="h-4 w-4" strokeWidth={1.75} />
                {t("plant.quickAction.fertilize")}
              </button>
            )}
            {dueRepot && (
              <button
                onClick={handleMarkRepotted}
                className="ios-tap flex-1 h-11 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <CircleDot className="h-4 w-4" strokeWidth={1.75} />
                {t("plant.quickAction.repot")}
              </button>
            )}
          </div>
        )}
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

          {careTab === "water" && <SensorReadingCard plantId={plant.id} />}

          {/* Supplemental data from Trefle, keyed off scientific name — fills
              in bloom months/hardy range/care level/mature size even when
              our own curated water/sunlight/soil text is thin or missing. */}
          <div className="mb-4">
            <PlantEnrichment plant={plant} />
          </div>

          {plant.scientific !== "Unidentified" && (
            <div className="mb-4">
              <CommunityPhotos scientificName={plant.scientific} />
            </div>
          )}

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

          {/* Propagation: lineage + take-a-cutting action */}
          <div className="leaf-card p-4 mt-4">
            {plant.propagatedFromId &&
              (() => {
                const parent = getFromMyGarden(plant.propagatedFromId!);
                return parent ? (
                  <Link
                    to="/plant/$id"
                    params={{ id: parent.id }}
                    className="ios-tap flex items-center gap-2 text-xs text-muted-foreground mb-3"
                  >
                    <GitBranch className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    {t("plant.propagatedFrom", { name: parent.name })}
                  </Link>
                ) : null;
              })()}
            {(plant.childPlantIds?.length ?? 0) > 0 && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Scissors className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                {t("plant.cuttingsTaken", { count: plant.childPlantIds!.length })}
              </p>
            )}
            {propagatedId ? (
              <Link
                to="/plant/$id"
                params={{ id: propagatedId }}
                className="ios-tap w-full h-11 rounded-full bg-primary/15 text-primary text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" strokeWidth={1.75} /> {t("plant.viewCutting")}
              </Link>
            ) : (
              <button
                onClick={handlePropagate}
                disabled={propagating}
                className="ios-tap w-full h-11 rounded-full bg-secondary text-secondary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
              >
                <Scissors className="h-4 w-4" strokeWidth={1.75} />
                {t("plant.propagate")}
              </button>
            )}
          </div>
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

        <PhotoGrid entries={entries} />

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
            <HealthChecks
              photo={lastUploadedPhoto}
              variant="standalone"
              onDiseaseDetected={handleDiseaseDetected}
            />
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
                    <EntryGallery
                      entry={e}
                      adding={addingPhotoTo === e.id}
                      onAddPhoto={(file) => handleAddExtraPhoto(e.id, file)}
                    />
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
            <div className="mb-4">
              <ImageHealthAnalysis photo={lastUploadedPhoto} />
            </div>
          )}

          {lastUploadedPhoto && !uploading && (
            <div className="leaf-card p-4 mb-4">
              <VisualSimilarityNote similarity={visualSimilarity} />
              <HealthChecks
              photo={lastUploadedPhoto}
              variant="standalone"
              onDiseaseDetected={handleDiseaseDetected}
            />
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

          <button
            onClick={() => printCareHistory(plant)}
            className="ios-tap mt-3 w-full h-12 rounded-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4" strokeWidth={1.75} /> {t("plant.printHistory")}
          </button>
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
