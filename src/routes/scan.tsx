import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PlantThumb } from "@/components/AppShell";
import {
  ImagePlus,
  Zap,
  X,
  Heart,
  BookOpen,
  CameraOff,
  WifiOff,
  Sprout,
  Plus,
  Droplets,
  Sun,
  CircleAlert,
  Leaf,
  Flower2,
  Apple,
  TreeDeciduous,
  ExternalLink,
  ShieldAlert,
  BadgeCheck,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { plants as ownedPlants, type Plant } from "@/lib/plants";
import {
  classifyImage,
  matchPlant,
  matchPlantByScientificName,
  matchPlantByVisionGuess,
  matchVisionGuessToSpecies,
  matchPlantByClaudeGuess,
} from "@/lib/classify";
import {
  identifyPlant,
  getDailyQuota,
  getSpecies,
  type PlantNetResult,
  type ProjectSpeciesEntry,
} from "@/lib/plantnet.server";
import { identifyPlantViaVision, identifyPlantViaClaude } from "@/lib/image-recognition.server";
import { getSpeciesPhoto } from "@/lib/speciesPhoto.server";
import { savePhoto } from "@/lib/photoStore";
import {
  addToMyGarden,
  buildScannedPlant,
  buildPlantFromSpecies,
  buildUnidentifiedPlant,
  canAddPlant,
} from "@/lib/myGarden";
import { HealthChecks } from "@/components/HealthChecks";
import { RadialHealthMeter } from "@/components/RadialHealthMeter";
import { useT, useI18n, statusLabelKeys, type TranslationKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan a plant — Verdant" },
      {
        name: "description",
        content: "Identify any plant and get an instant AI health diagnosis.",
      },
      { property: "og:title", content: "Scan a plant — Verdant" },
      {
        property: "og:description",
        content: "Identify any plant and get an instant AI health diagnosis.",
      },
    ],
  }),
  component: Scan,
});

type State = "idle" | "preview" | "analyzing" | "result" | "quota-exceeded";

type Result =
  | {
      source: "plantnet";
      plant: Plant | null;
      caption: string;
      identifiedName?: string;
      top: PlantNetResult | null;
      alternatives: PlantNetResult[];
    }
  | {
      source: "vision";
      plant: Plant | null;
      caption: string;
      // Set when Vision's guess matched a real species in Pl@ntNet's flora
      // corpus even though it isn't one of our local care-guide plants —
      // mirrors "plantnet"'s identifiedName for the same uncataloged-but-
      // real-species UX. Carries the full entry (not just the name) so
      // "add to garden" can build a real Plant from it via buildPlantFromSpecies.
      identifiedName?: string;
      identifiedSpecies?: ProjectSpeciesEntry;
    }
  | {
      source: "claude";
      plant: Plant | null;
      caption: string;
      // Set when Claude named a real species with at least medium confidence
      // but it isn't one of our local care-guide plants — same "identified,
      // just not tracked" UX as the plantnet/vision variants above. Claude's
      // guess only ever names a species (no photo lookup path exists for
      // it), so there's no identifiedSpecies/ProjectSpeciesEntry to carry.
      identifiedName?: string;
    }
  | { source: "mobilenet"; plant: Plant | null; caption: string };

const MIN_ANALYZE_MS = 900;
const DISMISS_THRESHOLD = 120;
// Pl@ntNet scores are conservative — anything at/above this is a strong
// enough match to skip the extra "are you sure" step and add in one tap.
const HIGH_CONFIDENCE_SCORE = 0.4;
// Below this, Pl@ntNet's own top score is too weak to trust as a final
// answer — worth spending a Vision call to see if it can do better before
// giving up and falling all the way back to on-device MobileNet.
const PLANTNET_FALLBACK_THRESHOLD = 0.15;

// Pl@ntNet's /v2/identify `organs` param — picking the right one measurably
// improves match confidence over always sending "auto".
const ORGANS = [
  { id: "auto", labelKey: "scan.organ.auto" satisfies TranslationKey, icon: Zap },
  { id: "leaf", labelKey: "scan.organ.leaf" satisfies TranslationKey, icon: Leaf },
  { id: "flower", labelKey: "scan.organ.flower" satisfies TranslationKey, icon: Flower2 },
  { id: "fruit", labelKey: "scan.organ.fruit" satisfies TranslationKey, icon: Apple },
  { id: "bark", labelKey: "scan.organ.bark" satisfies TranslationKey, icon: TreeDeciduous },
] as const;
type Organ = (typeof ORGANS)[number]["id"];

function OrganPicker({ value, onChange }: { value: Organ; onChange: (o: Organ) => void }) {
  const t = useT();
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
      {ORGANS.map((o) => {
        const Icon = o.icon;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`ios-tap shrink-0 flex items-center gap-1.5 text-[13px] font-medium px-3 h-8 rounded-full transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t(o.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

// IUCN Red List category → translation key + tone. Only a few categories are
// meaningfully "at risk"; the rest render neutrally or not at all.
const IUCN_LABELS: Record<string, { labelKey: TranslationKey; urgent: boolean }> = {
  CR: { labelKey: "scan.iucn.CR", urgent: true },
  EN: { labelKey: "scan.iucn.EN", urgent: true },
  VU: { labelKey: "scan.iucn.VU", urgent: true },
  NT: { labelKey: "scan.iucn.NT", urgent: false },
  LC: { labelKey: "scan.iucn.LC", urgent: false },
  EW: { labelKey: "scan.iucn.EW", urgent: true },
  EX: { labelKey: "scan.iucn.EX", urgent: true },
};

function BottomSheet({
  onDismiss,
  children,
}: {
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);

  const onPointerDown = (e: ReactPointerEvent) => {
    startY.current = e.clientY;
    dragging.current = true;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current || startY.current === null) return;
    const delta = e.clientY - startY.current;
    setDragY(Math.max(delta, 0));
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    startY.current = null;
    if (dragY > DISMISS_THRESHOLD) {
      setClosing(true);
      setDragY(600);
      setTimeout(onDismiss, 200);
    } else {
      setDragY(0);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center">
      <div
        className="w-full max-w-md bg-card rounded-t-[1.75rem] pb-8 shadow-2xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          transform: `translateY(${dragY}px)`,
          transition:
            dragging.current || closing
              ? closing
                ? "transform 0.2s ease-in"
                : "none"
              : "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          touchAction: "none",
        }}
      >
        <div className="sheet-handle" />
        <div className="px-6 pt-2">{children}</div>
      </div>
    </div>
  );
}

// Short, scannable "what to do about it" list under the health ring — pulled
// straight from the plant's existing care fields rather than new content.
function NextSteps({ plant }: { plant: Plant }) {
  const t = useT();
  const steps: { icon: typeof Droplets; text: string }[] = [];

  if (plant.status !== "healthy") {
    steps.push({ icon: CircleAlert, text: t(statusLabelKeys[plant.status]) });
  }
  steps.push({ icon: Droplets, text: plant.water });
  steps.push({ icon: Sun, text: plant.sunlight });

  return (
    <ul className="mt-4 space-y-2">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" strokeWidth={1.75} />
            <span className="text-foreground/90 leading-snug">{s.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

// GBIF/POWO/IUCN enrichment + alternative candidate list — shown under the
// caption on both the "matched a catalog plant" and "identified but
// uncataloged" result sheets, since both come from the same identify call.
function IdentificationDetails({
  top,
  alternatives,
}: {
  top: PlantNetResult;
  alternatives: PlantNetResult[];
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const iucn = top.iucnCategory ? IUCN_LABELS[top.iucnCategory] : undefined;
  const hasLinks = top.gbifId || top.powoId;
  // Family/genus reads as plain plant info to anyone; IUCN conservation
  // codes, GBIF/POWO taxonomy links, and the raw alternate-match list are
  // the botany-nerd parts a casual owner doesn't need by default — those
  // three sit behind an optional expander instead of always-on clutter.
  const hasAdvanced = iucn || hasLinks || alternatives.length > 0;

  if (!hasAdvanced && !top.family) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      {(top.family || top.genus) && (
        <p className="text-xs text-muted-foreground">
          {top.family && (
            <>
              {t("scan.family")} <span className="text-foreground font-medium">{top.family}</span>
            </>
          )}
          {top.family && top.genus && " · "}
          {top.genus && (
            <>
              {t("scan.genus")} <span className="text-foreground font-medium">{top.genus}</span>
            </>
          )}
        </p>
      )}

      {hasAdvanced && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="ios-tap text-xs font-medium text-primary"
        >
          {t("scan.showMoreDetails")}
        </button>
      )}

      {hasAdvanced && expanded && (
        <>
          {iucn && (
            <div
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${
                iucn.urgent
                  ? "bg-[oklch(0.55_0.15_35)]/10 text-[oklch(0.4_0.13_35)]"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              {t("scan.iucnStatus", { status: t(iucn.labelKey) })}
            </div>
          )}

          {hasLinks && (
            <div className="flex gap-2">
              {top.gbifId && (
                <a
                  href={`https://www.gbif.org/species/${top.gbifId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ios-tap flex-1 h-9 rounded-full bg-secondary text-secondary-foreground text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  GBIF <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                </a>
              )}
              {top.powoId && (
                <a
                  href={`https://powo.science.kew.org/taxon/${top.powoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ios-tap flex-1 h-9 rounded-full bg-secondary text-secondary-foreground text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  POWO <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                </a>
              )}
            </div>
          )}

          {alternatives.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                {t("scan.otherMatches")}
              </p>
              <ul className="space-y-1">
                {alternatives.map((alt, i) => (
                  <li
                    key={`${alt.scientificName}-${i}`}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="italic text-foreground/90 truncate">
                      {alt.scientificName}
                    </span>
                    <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                      {Math.round(alt.score * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuotaBadge() {
  const t = useT();
  const [remaining, setRemaining] = useState<{ remaining: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDailyQuota().then((res) => {
      if (cancelled || res.status !== "ok") return;
      setRemaining({
        remaining: res.data.quota.identify.remaining,
        total: res.data.quota.identify.total,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!remaining) return null;

  return (
    <span className="text-[11px] text-muted-foreground tabular-nums">
      {t("scan.quota", { remaining: remaining.remaining, total: remaining.total })}
    </span>
  );
}

// Pl@ntNet's flora dump (~5500 real species) fetched once and cached for the
// life of the tab — used only as a last-resort text corpus to confirm a
// Vision guess names a real species, so it's not worth re-fetching per scan.
let speciesCorpusPromise: Promise<ProjectSpeciesEntry[]> | null = null;
function loadSpeciesCorpus(): Promise<ProjectSpeciesEntry[]> {
  if (!speciesCorpusPromise) {
    speciesCorpusPromise = getSpecies({ data: {} }).then((res) =>
      res.status === "ok" ? res.data : [],
    );
  }
  return speciesCorpusPromise;
}

function Scan() {
  const { t, locale } = useI18n();
  const [state, setState] = useState<State>("idle");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  // A frozen still shown between shutter-tap and "Use photo" — makes it
  // unambiguous that this is a single photo capture, not a live video
  // recording, since the viewfinder otherwise looks identical to one.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewSourceRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  const [organ, setOrgan] = useState<Organ>("auto");
  const [showOrganPicker, setShowOrganPicker] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelLoadedRef = useRef(false);

  // Start the camera once, client-side only.
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) setCameraError(true);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const toBlob = (
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ): Promise<Blob> => {
    let canvas: HTMLCanvasElement;
    if (source instanceof HTMLCanvasElement) {
      canvas = source;
    } else {
      canvas = document.createElement("canvas");
      const w = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
      const h = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(source, 0, 0, w, h);
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.9,
      );
    });
  };

  const runViaMobileNet = async (
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ): Promise<Result> => {
    const predictions = await classifyImage(source);
    modelLoadedRef.current = true;
    const { plant, prediction } = matchPlant(predictions);
    return {
      source: "mobilenet",
      plant,
      caption: t("scan.mobilenetSaw", {
        name: prediction.className.split(",")[0],
        score: Math.round(prediction.probability * 100),
      }),
    };
  };

  // Second opinion when Pl@ntNet errors out or comes back too unsure to
  // trust — Vision's web/label detection is a different signal (visually
  // similar web images) rather than a dedicated botanical classifier, so it
  // sometimes names a species Pl@ntNet couldn't place, before we give up and
  // fall all the way back to the much weaker on-device MobileNet.
  const runViaVision = async (blob: Blob): Promise<Result | null> => {
    try {
      const formData = new FormData();
      formData.append("image", blob);
      const response = await identifyPlantViaVision({ data: formData });
      if (response.status !== "ok" || response.data.length === 0) return null;

      const { plant, top } = matchPlantByVisionGuess(response.data);
      if (!top) return null;

      // No local catalog match — check Pl@ntNet's full flora corpus before
      // giving up, so a real (if uncataloged) species can still be named
      // instead of only ever showing Vision's raw, possibly-generic guess.
      let identifiedSpecies: ProjectSpeciesEntry | undefined;
      if (!plant) {
        const corpus = await loadSpeciesCorpus();
        identifiedSpecies = matchVisionGuessToSpecies(response.data, corpus) ?? undefined;
      }

      return {
        source: "vision",
        plant,
        caption: t("scan.visionSaw", {
          name: top.name,
          score: Math.round(top.score * 100),
        }),
        identifiedName: identifiedSpecies?.scientificNameWithoutAuthor,
        identifiedSpecies,
      };
    } catch {
      return null;
    }
  };

  // Last resort before falling all the way back to on-device MobileNet —
  // Claude's multimodal reasoning about visual traits (leaf shape, growth
  // habit, distinguishing features) is a different signal than Vision's
  // web-image-similarity search, so it sometimes succeeds where that can't
  // find a visually-similar match at all.
  const runViaClaude = async (blob: Blob): Promise<Result | null> => {
    try {
      const formData = new FormData();
      formData.append("image", blob);
      const response = await identifyPlantViaClaude({ data: formData });
      if (response.status !== "ok" || !response.data) return null;

      const guess = response.data;
      const { plant } = matchPlantByClaudeGuess(guess);

      return {
        source: "claude",
        plant,
        caption: t("scan.claudeSaw", { name: guess.scientificName }),
        identifiedName: !plant && guess.confidence !== "low" ? guess.scientificName : undefined,
      };
    } catch {
      return null;
    }
  };

  const runClassification = async (
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ) => {
    setState("analyzing");
    const start = Date.now();

    let result: Result | null = null;
    let photoBlob: Blob | null = null;
    try {
      const blob = await toBlob(source);
      photoBlob = blob;
      const formData = new FormData();
      formData.append("image", blob);
      formData.append("organs", organ);
      const response = await identifyPlant({ data: formData });

      if (response.status === "quota-exceeded") {
        setState("quota-exceeded");
        return;
      }
      if (response.status === "error") {
        // Hard failure (network/service down) — try Vision, then Claude.
        result = (await runViaVision(blob)) ?? (await runViaClaude(blob));
      } else {
        const { plant, top, identifiedButUncataloged } = matchPlantByScientificName(
          response.results,
        );
        // A present-but-weak top score means Pl@ntNet itself isn't
        // confident — worth trying Vision, then Claude, before settling for this.
        if (!top || top.score < PLANTNET_FALLBACK_THRESHOLD) {
          result = (await runViaVision(blob)) ?? (await runViaClaude(blob));
        }
        if (!result) {
          result = {
            source: "plantnet",
            plant,
            caption: top
              ? t("scan.plantnetSaw", {
                  name: top.scientificName,
                  score: Math.round(top.score * 100),
                })
              : t("scan.plantnetUnrecognized"),
            identifiedName: identifiedButUncataloged ? top!.scientificName : undefined,
            top,
            alternatives: response.results.slice(1, 4),
          };
        }
      }
    } catch {
      result = photoBlob
        ? (await runViaVision(photoBlob)) ?? (await runViaClaude(photoBlob))
        : null;
    }

    if (!result) {
      result = await runViaMobileNet(source);
    }

    const elapsed = Date.now() - start;
    if (elapsed < MIN_ANALYZE_MS) {
      await new Promise((r) => setTimeout(r, MIN_ANALYZE_MS - elapsed));
    }

    setResult(result);
    setCapturedPhoto(photoBlob);
    setState("result");
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    previewSourceRef.current = canvas;
    setPreviewUrl(canvas.toDataURL("image/jpeg", 0.9));
    setState("preview");
  };

  const handleFileChange = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      previewSourceRef.current = img;
      setPreviewUrl(img.src);
      setState("preview");
    };
    img.src = URL.createObjectURL(file);
  };

  const confirmPreview = () => {
    const source = previewSourceRef.current;
    if (!source) return;
    runClassification(source);
  };

  const retakePreview = () => {
    previewSourceRef.current = null;
    setPreviewUrl(null);
    setState("idle");
  };

  const reset = () => {
    previewSourceRef.current = null;
    setPreviewUrl(null);
    setResult(null);
    setCapturedPhoto(null);
    setState("idle");
  };

  // A high Pl@ntNet score means the extra "are you sure" tap can be
  // skipped — the primary action becomes a one-tap add straight to the
  // plant's care guide instead of add-then-navigate-separately.
  const isHighConfidence =
    result?.source === "plantnet" && (result.top?.score ?? 0) >= HIGH_CONFIDENCE_SCORE;

  const addCatalogPlantToGarden = async (plant: Plant) => {
    if (!(await canAddPlant(user?.uid))) {
      setLimitReached(true);
      return;
    }
    const savedId = addToMyGarden(plant);
    navigate({ to: "/plant/$id", params: { id: savedId } });
  };

  const addScannedPlantToGarden = async (top: PlantNetResult) => {
    if (!(await canAddPlant(user?.uid))) {
      setLimitReached(true);
      return;
    }
    // No user-uploaded photo is persisted anywhere at this point (the
    // captured frame is a transient Blob used only for the on-device
    // health check, see capturedPhoto) — fall back to a real reference
    // photo the same way Explore's "add to garden" does, instead of
    // leaving the plant on the generic emoji placeholder.
    const photoResult = await getSpeciesPhoto({ data: { scientificName: top.scientificName } });
    const photoUrl = photoResult.status === "ok" ? photoResult.url : undefined;
    const plant = buildScannedPlant(top, t, locale, photoUrl);
    const savedId = addToMyGarden(plant);
    navigate({ to: "/plant/$id", params: { id: savedId } });
  };

  const addSpeciesMatchToGarden = async (entry: ProjectSpeciesEntry) => {
    if (!(await canAddPlant(user?.uid))) {
      setLimitReached(true);
      return;
    }
    const photoResult = await getSpeciesPhoto({
      data: { scientificName: entry.scientificNameWithoutAuthor },
    });
    const photoUrl = photoResult.status === "ok" ? photoResult.url : undefined;
    const plant = buildPlantFromSpecies(entry, t, locale, photoUrl);
    const savedId = addToMyGarden(plant);
    navigate({ to: "/plant/$id", params: { id: savedId } });
  };

  // Neither Pl@ntNet nor the on-device fallback could name this one — still
  // let the user save it (using their own captured photo) rather than
  // forcing a re-scan, since they may just want to track it and identify it
  // later.
  const addUnidentifiedPlantToGarden = async () => {
    if (!(await canAddPlant(user?.uid))) {
      setLimitReached(true);
      return;
    }
    const plant = buildUnidentifiedPlant(t, locale);
    const savedId = addToMyGarden(plant);
    if (capturedPhoto) {
      await savePhoto(savedId, capturedPhoto);
    }
    navigate({ to: "/plant/$id", params: { id: savedId } });
  };

  if (limitReached) {
    return (
      <AppShell>
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center mb-4">
            <Sprout className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-2xl mb-2">Garden's full for your plan</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            You've reached your plan's plant limit. Upgrade to add more, or remove a plant to make room.
          </p>
          <div className="flex gap-2 w-full max-w-xs">
            <button
              onClick={() => setLimitReached(false)}
              className="ios-tap flex-1 h-11 rounded-full border border-border text-sm font-medium"
            >
              Back
            </button>
            <Link
              to="/premium"
              className="ios-tap flex-1 h-11 rounded-full bg-primary text-primary-foreground text-sm font-semibold grid place-items-center"
            >
              Upgrade
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-display">{t("scan.title")}</h1>
          <QuotaBadge />
        </div>
        <div className="flex items-center gap-2">
          {state === "idle" && (
            <button
              onClick={() => setShowOrganPicker((s) => !s)}
              className={`ios-tap h-9 w-9 rounded-full grid place-items-center ${
                showOrganPicker || organ !== "auto"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary"
              }`}
              aria-label={t("scan.organPickerToggle")}
              aria-pressed={showOrganPicker}
            >
              <Leaf className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          <button
            onClick={() => navigate({ to: "/" })}
            className="ios-tap h-9 w-9 rounded-full bg-secondary grid place-items-center"
            aria-label={t("scan.close")}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* Organ picker — tells Pl@ntNet what part of the plant is in frame,
          which measurably improves identification confidence over "auto".
          Optional and tucked behind a toggle since "auto" already works well
          for most photos — the default view is just the camera + shutter. */}
      {state === "idle" && showOrganPicker && (
        <div className="mb-4">
          <OrganPicker value={organ} onChange={setOrgan} />
        </div>
      )}

      {/* Viewfinder — a live preview while framing, or (once the shutter is
          tapped) a frozen still with Retake/Use photo, so it's unambiguous
          this is a single-photo capture rather than a video recording. */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-[1.75rem] bg-[oklch(0.22_0.02_45)]">
        {(state === "preview" || state === "analyzing") && previewUrl ? (
          <img
            src={previewUrl}
            alt={t("scan.previewAlt")}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            {!cameraError && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {cameraError && (
              <div className="absolute inset-0 grid place-items-center text-center px-8">
                <div>
                  <CameraOff className="h-8 w-8 mx-auto text-white/80" />
                  <p className="mt-3 text-sm text-white/90">{t("scan.cameraUnavailable")}</p>
                  <p className="text-xs text-white/60 mt-1">{t("scan.cameraUnavailableHint")}</p>
                </div>
              </div>
            )}

            {/* framing corners */}
            {[
              "top-6 left-6 border-t-2 border-l-2 rounded-tl-2xl",
              "top-6 right-6 border-t-2 border-r-2 rounded-tr-2xl",
              "bottom-6 left-6 border-b-2 border-l-2 rounded-bl-2xl",
              "bottom-6 right-6 border-b-2 border-r-2 rounded-br-2xl",
            ].map((c) => (
              <div
                key={c}
                className={`absolute h-10 w-10 border-white/70 pointer-events-none ${c}`}
              />
            ))}
            <p className="absolute top-6 left-1/2 -translate-x-1/2 text-xs text-white/90 bg-black/40 rounded-full px-3 py-1">
              {organ === "auto"
                ? t("scan.frameHint.default")
                : t("scan.frameHint.organ", {
                    organ: t(`scan.organ.${organ}` as TranslationKey).toLowerCase(),
                  })}
            </p>
          </>
        )}

        {state === "analyzing" && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <div className="text-center text-white">
              <div className="h-10 w-10 mx-auto rounded-full border-2 border-white/40 border-t-white animate-spin" />
              <p className="mt-4 font-display text-lg">{t("scan.analyzing")}</p>
              <p className="text-xs text-white/70 mt-1">{t("scan.analyzingHint")}</p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Controls */}
      {state === "preview" ? (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={retakePreview}
            className="ios-tap h-12 flex-1 max-w-[10rem] rounded-full bg-secondary text-secondary-foreground font-semibold"
          >
            {t("scan.retake")}
          </button>
          <button
            onClick={confirmPreview}
            className="ios-tap h-12 flex-1 max-w-[10rem] rounded-full bg-primary text-primary-foreground font-semibold"
          >
            {t("scan.usePhoto")}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-around mt-8">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={state === "analyzing"}
            className="ios-tap h-12 w-12 rounded-full bg-secondary grid place-items-center disabled:opacity-50"
            aria-label={t("scan.upload")}
          >
            <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={captureFromCamera}
            disabled={state !== "idle" || !cameraReady}
            className="ios-tap h-[4.75rem] w-[4.75rem] rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-70"
            aria-label={t("scan.takePhoto")}
          >
            <div className="h-16 w-16 rounded-full border-4 border-primary-foreground/60" />
          </button>
          <button
            className="ios-tap h-12 w-12 rounded-full bg-secondary grid place-items-center"
            aria-label={t("scan.flash")}
            disabled
          >
            <Zap className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Result bottom sheet */}
      {state === "result" &&
        result &&
        !(
          (result.source === "plantnet" || result.source === "vision" || result.source === "claude") &&
          result.identifiedName
        ) && (
        <BottomSheet onDismiss={reset}>
          {result.plant ? (
            <>
              <div className="flex items-start gap-4">
                <PlantThumb
                  emoji={result.plant.emoji}
                  photo={result.plant.photo}
                  gradient={result.plant.gradient}
                  className="h-[4.5rem] w-[4.5rem] rounded-2xl shrink-0"
                />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {t("scan.matchInGarden")}
                    {isHighConfidence && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        <BadgeCheck className="h-3 w-3" strokeWidth={2} />{" "}
                        {t("scan.confidentMatch")}
                      </span>
                    )}
                  </p>
                  <h2 className="font-display text-2xl leading-tight">{result.plant.name}</h2>
                  <p className="text-xs italic text-muted-foreground">{result.plant.scientific}</p>
                </div>
              </div>

              <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                {result.caption}
              </p>

              {result.source === "plantnet" && result.top && (
                <IdentificationDetails top={result.top} alternatives={result.alternatives} />
              )}

              {/* Health score */}
              <div className="mt-6 flex items-start gap-4">
                <RadialHealthMeter value={result.plant.health} />
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    {t("scan.recommendedSteps")}
                  </p>
                  <NextSteps plant={result.plant} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-6">
                {ownedPlants.some((p) => p.id === result.plant!.id) ? (
                  <>
                    <button
                      onClick={reset}
                      className="ios-tap h-12 rounded-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2"
                    >
                      <Heart className="h-4 w-4" strokeWidth={1.75} /> {t("scan.scanAgain")}
                    </button>
                    <Link
                      to="/plant/$id"
                      params={{ id: result.plant.id }}
                      className="ios-tap h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
                    >
                      <BookOpen className="h-4 w-4" strokeWidth={1.75} /> {t("scan.careGuide")}
                    </Link>
                  </>
                ) : isHighConfidence ? (
                  <button
                    onClick={() => addCatalogPlantToGarden(result.plant!)}
                    className="ios-tap col-span-2 h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
                  >
                    <BadgeCheck className="h-4 w-4" strokeWidth={1.75} /> {t("scan.addAndView")}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={reset}
                      className="ios-tap h-12 rounded-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2"
                    >
                      <Heart className="h-4 w-4" strokeWidth={1.75} /> {t("scan.scanAgain")}
                    </button>
                    <button
                      onClick={() => addCatalogPlantToGarden(result.plant!)}
                      className="ios-tap h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.75} /> {t("scan.addToGarden")}
                    </button>
                  </>
                )}
              </div>
              {isHighConfidence && !ownedPlants.some((p) => p.id === result.plant!.id) && (
                <button
                  onClick={reset}
                  className="ios-tap w-full mt-2 text-xs text-muted-foreground text-center"
                >
                  {t("scan.notRight")}
                </button>
              )}

              <HealthChecks photo={capturedPhoto} />
            </>
          ) : (
            <>
              <div className="flex items-start gap-4">
                <div className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl bg-secondary grid place-items-center">
                  <CameraOff className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{t("scan.lowConfidence")}</p>
                  <h2 className="font-display text-2xl leading-tight">
                    {t("scan.couldNotIdentify")}
                  </h2>
                </div>
              </div>

              <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                {result.caption}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">{t("scan.tryCloserPhoto")}</p>

              {result.source === "plantnet" && result.top && (
                <IdentificationDetails top={result.top} alternatives={result.alternatives} />
              )}

              <div className="grid grid-cols-2 gap-2 mt-6">
                <button
                  onClick={reset}
                  className="ios-tap h-12 rounded-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2"
                >
                  <Heart className="h-4 w-4" strokeWidth={1.75} /> {t("scan.tryAgain")}
                </button>
                <button
                  onClick={addUnidentifiedPlantToGarden}
                  className="ios-tap h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} /> {t("scan.addAnyway")}
                </button>
              </div>
              <Link
                to="/"
                className="ios-tap w-full mt-2 text-xs text-muted-foreground text-center block"
              >
                {t("scan.myGarden")}
              </Link>

              <HealthChecks photo={capturedPhoto} />
            </>
          )}
        </BottomSheet>
      )}

      {/* Recognized species, but not one of our tracked plants — either
          Pl@ntNet named it directly, Vision's guess was confirmed against
          Pl@ntNet's flora corpus (see runViaVision), or Claude named it
          directly as a last-resort fallback (see runViaClaude). */}
      {state === "result" &&
        result &&
        (result.source === "plantnet" || result.source === "vision" || result.source === "claude") &&
        result.identifiedName && (
          <BottomSheet onDismiss={reset}>
            <div className="flex items-start gap-4">
              <div className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl bg-secondary grid place-items-center">
                <Sprout className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{t("scan.identifiedNotTracked")}</p>
                <h2 className="font-display text-2xl leading-tight italic">
                  {result.identifiedName}
                </h2>
              </div>
            </div>

            <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
              {result.caption}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">{t("scan.noCareInfo")}</p>

            {result.source === "plantnet" && result.top && (
              <IdentificationDetails top={result.top} alternatives={result.alternatives} />
            )}

            <div className="grid grid-cols-2 gap-2 mt-6">
              <button
                onClick={reset}
                className="ios-tap h-12 rounded-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2"
              >
                <Heart className="h-4 w-4" strokeWidth={1.75} /> {t("scan.scanAgain")}
              </button>
              <button
                onClick={() => {
                  if (result.source === "plantnet" && result.top) {
                    addScannedPlantToGarden(result.top);
                  } else if (result.source === "vision" && result.identifiedSpecies) {
                    addSpeciesMatchToGarden(result.identifiedSpecies);
                  } else if (result.source === "claude" && result.identifiedName) {
                    addScannedPlantToGarden({
                      scientificName: result.identifiedName,
                      commonNames: [],
                      score: 0.5,
                    });
                  }
                }}
                className="ios-tap h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} /> {t("scan.addToGarden")}
              </button>
            </div>

            <HealthChecks photo={capturedPhoto} />
          </BottomSheet>
        )}

      {/* Daily identification limit reached */}
      {state === "quota-exceeded" && (
        <BottomSheet onDismiss={reset}>
          <div className="flex items-start gap-4">
            <div className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl bg-secondary grid place-items-center">
              <WifiOff className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{t("scan.quotaResets")}</p>
              <h2 className="font-display text-2xl leading-tight">{t("scan.quotaTitle")}</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-6">
            <button
              onClick={reset}
              className="ios-tap h-12 rounded-full bg-secondary text-secondary-foreground font-semibold flex items-center justify-center gap-2"
            >
              <Heart className="h-4 w-4" strokeWidth={1.75} /> {t("scan.quotaCloseCta")}
            </button>
            <Link
              to="/"
              className="ios-tap h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.75} /> {t("scan.myGarden")}
            </Link>
          </div>
        </BottomSheet>
      )}
    </AppShell>
  );
}
