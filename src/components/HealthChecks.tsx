import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bug, Tag, Loader2 } from "lucide-react";
import {
  identifyDisease,
  identifyVarieties,
  type DiseaseMatch,
  type VarietyMatch,
} from "@/lib/plantnet.server";
import { useT } from "@/lib/i18n";

type CheckState<T> =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; matches: T[] }
  | { phase: "error"; message: string };

function fileFromBlob(blob: Blob): FormData {
  const formData = new FormData();
  formData.append("image", blob, "capture.jpg");
  return formData;
}

// Re-sends the already-captured photo to the disease and variety
// identification endpoints, shown as two inline check buttons that expand
// into a ranked-match list once run — used by both the Scan result sheet and
// the Plant Detail growth-timeline uploader.
export function HealthChecks({
  photo,
  variant = "inset",
  onDiseaseDetected,
}: {
  photo: Blob | null;
  // "inset" sits inside a sheet/card that already has its own container
  // (Scan result) and adds a top divider; "standalone" is its own card
  // (Plant Detail timeline) and skips the divider.
  variant?: "inset" | "standalone";
  // Called with the top match's confidence score when a disease check finds
  // one — used by Plant Detail to revise that entry's health score (see
  // healthScoring.ts). Omitted where there's no timeline entry to adjust
  // (e.g. the Scan result sheet, before anything's been saved).
  onDiseaseDetected?: (topScore: number) => void;
}) {
  const t = useT();
  const [disease, setDisease] = useState<CheckState<DiseaseMatch>>({ phase: "idle" });
  const [variety, setVariety] = useState<CheckState<VarietyMatch>>({ phase: "idle" });

  const runDisease = async () => {
    if (!photo) return;
    setDisease({ phase: "loading" });
    const res = await identifyDisease({ data: fileFromBlob(photo) });
    if (res.status === "ok") {
      setDisease({ phase: "done", matches: res.data });
      if (res.data.length > 0) onDiseaseDetected?.(res.data[0].score);
    } else if (res.status === "quota-exceeded")
      setDisease({ phase: "error", message: t("healthChecks.quotaReached") });
    else setDisease({ phase: "error", message: res.message });
  };

  const runVariety = async () => {
    if (!photo) return;
    setVariety({ phase: "loading" });
    const res = await identifyVarieties({ data: fileFromBlob(photo) });
    if (res.status === "ok") setVariety({ phase: "done", matches: res.data });
    else if (res.status === "quota-exceeded")
      setVariety({ phase: "error", message: t("healthChecks.quotaReached") });
    else setVariety({ phase: "error", message: res.message });
  };

  if (!photo) return null;

  return (
    <div className={variant === "inset" ? "mt-4 pt-4 border-t border-border" : ""}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
        {t("healthChecks.moreWithPhoto")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={runDisease}
          disabled={disease.phase === "loading"}
          className="ios-tap h-10 rounded-full bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-70"
        >
          {disease.phase === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bug className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          {t("healthChecks.checkDisease")}
        </button>
        <button
          onClick={runVariety}
          disabled={variety.phase === "loading"}
          className="ios-tap h-10 rounded-full bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-70"
        >
          {variety.phase === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Tag className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          {t("healthChecks.identifyVariety")}
        </button>
      </div>

      {disease.phase === "done" && (
        <MatchList
          icon={<Bug className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label={t("healthChecks.diseaseLabel")}
          matches={disease.matches}
          emptyText={t("healthChecks.noDisease")}
          askLabel={(name) => t("healthChecks.askAboutDisease", { name })}
        />
      )}
      {disease.phase === "error" && <ErrorNote message={disease.message} />}

      {variety.phase === "done" && (
        <MatchList
          icon={<Tag className="h-3.5 w-3.5" strokeWidth={1.75} />}
          label={t("healthChecks.varietyLabel")}
          matches={variety.matches}
          emptyText={t("healthChecks.noVariety")}
          askLabel={(name) => t("healthChecks.askAboutVariety", { name })}
        />
      )}
      {variety.phase === "error" && <ErrorNote message={variety.message} />}
    </div>
  );
}

function MatchList({
  icon,
  label,
  matches,
  emptyText,
  askLabel,
}: {
  icon: React.ReactNode;
  label: string;
  matches: { name: string; score: number }[];
  emptyText: string;
  // Pre-composed Doctor question for a given match name — tapping a row
  // deep-links to /doctor the same way Plant Detail's "Ask the doctor"
  // button does, since these matches (disease/variety names) have no
  // detail view of their own to open instead.
  askLabel: (name: string) => string;
}) {
  return (
    <div className="mt-3 rounded-xl bg-secondary/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {icon}
        {label}
      </p>
      {matches.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {matches.slice(0, 3).map((m, i) => (
            <li key={`${m.name}-${i}`}>
              <Link
                to="/doctor"
                search={{ ask: askLabel(m.name) }}
                className="ios-tap flex items-center justify-between text-xs w-full py-0.5"
              >
                <span className="text-foreground/90 truncate underline underline-offset-2">
                  {m.name}
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                  {Math.round(m.score * 100)}%
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return <p className="mt-3 text-xs text-muted-foreground">{message}</p>;
}
