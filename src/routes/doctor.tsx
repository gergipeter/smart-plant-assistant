import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  Send,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Camera,
  X,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { plants, type Plant, type TimelineEntry } from "@/lib/plants";
import { savePhoto } from "@/lib/photoStore";
import { usePhotoUrl } from "@/lib/usePhotoUrl";
import { identifyDisease, identifyVarieties } from "@/lib/plantnet.server";
import { getAIDoctorAdvice } from "@/lib/ai-doctor.server";
import { useT, type TranslationKey } from "@/lib/i18n";

type DoctorSearch = { msg?: string; ask?: string; focus?: string };

export const Route = createFileRoute("/doctor")({
  validateSearch: (search: Record<string, unknown>): DoctorSearch => ({
    msg: typeof search.msg === "string" ? search.msg : undefined,
    // Deep link from Plant Detail — pre-fills and auto-sends a question
    // about a specific plant (e.g. "why did my Monstera decline?").
    ask: typeof search.ask === "string" ? search.ask : undefined,
    focus: typeof search.focus === "string" ? search.focus : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI Plant Doctor — Verdant" },
      {
        name: "description",
        content: "Ask an AI plant doctor anything — yellow leaves, pests, drooping, and more.",
      },
      { property: "og:title", content: "AI Plant Doctor — Verdant" },
      {
        property: "og:description",
        content: "Ask an AI plant doctor anything — yellow leaves, pests, drooping, and more.",
      },
    ],
  }),
  component: Doctor,
});

type TimelineCitation = {
  plantId: string;
  plantName: string;
  entries: TimelineEntry[];
  delta: number;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citation?: TimelineCitation;
  // True when a photo was attached and saved in IndexedDB under this
  // message's id (see photoStore.ts) — same pattern as timeline photos.
  hasPhoto?: boolean;
};

const suggestionKeys: TranslationKey[] = [
  "doctor.suggestion1",
  "doctor.suggestion2",
  "doctor.suggestion3",
  "doctor.suggestion4",
];

function detectPlant(text: string): Plant | undefined {
  const t = text.toLowerCase();
  return plants.find(
    (p) =>
      t.includes(p.name.toLowerCase()) ||
      t.includes(p.id) ||
      t.includes(p.scientific.toLowerCase()),
  );
}

function isTimelineQuestion(text: string) {
  const t = text.toLowerCase();
  return /\b(change|changed|changes|over time|trend|trending|progress|history|timeline|since|last month|declin|improv|recover|worse|better|summary|summarize)\b/.test(
    t,
  );
}

function buildTimelineAnswer(
  plant: Plant,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): { text: string; citation: TimelineCitation } {
  const timeline = plant.timeline;
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const delta = last.health - first.health;
  const dirKey: TranslationKey =
    delta > 0 ? "doctor.dir.up" : delta < 0 ? "doctor.dir.down" : "doctor.dir.steady";
  const declines = timeline.filter((e) => e.change === "declined");
  const improves = timeline.filter((e) => e.change === "improved");

  const lastLine = t("doctor.latestScan", {
    date: last.date,
    headline: last.headline.toLowerCase(),
    detail: last.detail,
  });
  const dipLine = declines.length
    ? t("doctor.mainDip", {
        month: declines[declines.length - 1].month.split(" ")[0],
        headline: declines[declines.length - 1].headline.toLowerCase(),
      })
    : t("doctor.noDeclines");
  const upLine = improves.length
    ? t("doctor.recovery", {
        month: improves[improves.length - 1].month.split(" ")[0],
        headline: improves[improves.length - 1].headline.toLowerCase(),
      })
    : "";

  const text =
    t("doctor.timelineIntro", {
      name: plant.name,
      count: timeline.length,
      first: first.month,
      last: last.month,
      direction: t(dirKey),
      points: Math.abs(delta),
      firstHealth: first.health,
      lastHealth: last.health,
    }) +
    dipLine +
    upLine +
    lastLine;

  return {
    text,
    citation: { plantId: plant.id, plantName: plant.name, entries: timeline, delta },
  };
}

const STORAGE_KEY = "verdant.doctor.messages.v1";
let msgCounter = 0;
const nextId = () => `msg-${Date.now().toString(36)}-${(msgCounter++).toString(36)}`;

function buildInitialMessages(t: (key: TranslationKey) => string): Msg[] {
  return [{ id: "msg-welcome", role: "assistant", content: t("doctor.welcome") }];
}

function loadMessages(t: (key: TranslationKey) => string): Msg[] {
  const fallback = buildInitialMessages(t);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Msg[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    // ignore
  }
  return fallback;
}

function Doctor() {
  const t = useT();
  const { msg: focusMsgId, ask, focus } = Route.useSearch();
  const [messages, setMessages] = useState<Msg[]>(() => buildInitialMessages(t));
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [focusPlantId, setFocusPlantId] = useState<string>(focus ?? "");
  const [flashMsgId, setFlashMsgId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  const focusPlant = useMemo(() => plants.find((p) => p.id === focusPlantId), [focusPlantId]);

  // Hydrate from sessionStorage on mount (client only, avoids SSR mismatch)
  useEffect(() => {
    setMessages(loadMessages(t));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist changes
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, hydrated]);

  // On return-from-plant, scroll to and flash the referenced message
  useEffect(() => {
    if (!hydrated || !focusMsgId) return;
    const node = msgRefs.current[focusMsgId];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashMsgId(focusMsgId);
      const t = setTimeout(() => setFlashMsgId(null), 1800);
      return () => clearTimeout(t);
    }
  }, [focusMsgId, hydrated]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsgId = nextId();
    setMessages((m) => [...m, { id: userMsgId, role: "user", content: text }]);
    setInput("");

    const mentioned = detectPlant(text) ?? focusPlant;
    const recentHistory = mentioned
      ? `Last entry: ${mentioned.timeline[mentioned.timeline.length - 1]?.headline}`
      : undefined;

    // Check if this is an issue-related question (not a timeline/history question)
    const isIssueQuestion =
      !isTimelineQuestion(text) &&
      /\b(yellowing|wilting|brown|pest|mold|spot|blight|disease|sick|dying|drooping|pale|bug|scale|mealybug|spider|fungal|rot|issue|problem|wrong|help)\b/i.test(
        text
      );

    if (mentioned && isIssueQuestion) {
      // Use AI Doctor for detailed issue diagnosis
      const adviceRes = await getAIDoctorAdvice({
        plantName: mentioned.name,
        issue: text,
        recentHistory,
      });

      if (adviceRes.status === "ok") {
        const advice = adviceRes.data;
        const urgencyEmoji =
          advice.urgency === "high" ? "🚨" : advice.urgency === "medium" ? "⚠️" : "ℹ️";
        const content = `${urgencyEmoji} ${advice.diagnosis}\n\n**Treatment:**\n${advice.treatment.map((t) => `• ${t}`).join("\n")}\n\n**Prevention:**\n${advice.preventionTips.map((p) => `• ${p}`).join("\n")}`;

        setMessages((m) => [
          ...m,
          { id: nextId(), role: "assistant", content },
        ]);
        return;
      }
    }

    // Original fallback logic
    setTimeout(() => {
      if (mentioned && isTimelineQuestion(text)) {
        const { text: reply, citation } = buildTimelineAnswer(mentioned, t);
        setMessages((m) => [...m, { id: nextId(), role: "assistant", content: reply, citation }]);
        return;
      }

      if (mentioned) {
        const last = mentioned.timeline[mentioned.timeline.length - 1];
        setMessages((m) => [
          ...m,
          {
            id: nextId(),
            role: "assistant",
            content: t("doctor.latestScanNote", {
              name: mentioned.name,
              date: last.date,
              headline: last.headline,
              detail: last.detail,
            }),
          },
        ]);
        return;
      }

      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: "assistant",
          content: t("doctor.tellMeWhichPlant"),
        },
      ]);
    }, 700);
  };

  // Deep link from Plant Detail's "Ask the doctor" button — auto-sends the
  // pre-composed question once hydration completes. Guarded by a ref (not
  // just clearing `ask`) since clearing it would require a navigate() call
  // that could race with the sessionStorage hydration above.
  const askSentRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !ask || askSentRef.current) return;
    askSentRef.current = true;
    send(ask);
  }, [hydrated, ask]);

  const handlePhotoPicked = () => {
    const file = photoInputRef.current?.files?.[0];
    if (!file) return;
    setPendingPhoto(file);
    setPendingPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearPendingPhoto = () => {
    setPendingPhoto(null);
    setPendingPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  // Sends the attached photo as a user message, then runs it through the
  // real disease + variety identification endpoints and replies with
  // whatever Pl@ntNet actually found — same checks as Scan/Plant Detail,
  // just reachable from the chat instead of a capture flow.
  const sendPhoto = async () => {
    const photo = pendingPhoto;
    if (!photo) return;
    const caption = input.trim();
    setInput("");
    clearPendingPhoto();
    setSendingPhoto(true);

    const userMsgId = nextId();
    await savePhoto(userMsgId, photo);
    setMessages((m) => [
      ...m,
      { id: userMsgId, role: "user", content: caption || t("doctor.sentPhoto"), hasPhoto: true },
    ]);

    const formData = () => {
      const fd = new FormData();
      fd.append("image", photo, "capture.jpg");
      return fd;
    };

    const [diseaseRes, varietyRes] = await Promise.all([
      identifyDisease({ data: formData() }),
      identifyVarieties({ data: formData() }),
    ]);

    const lines: string[] = [];
    if (diseaseRes.status === "ok" && diseaseRes.data.length > 0) {
      const top = diseaseRes.data[0];
      lines.push(t("doctor.possibleIssue", { name: top.name, score: Math.round(top.score * 100) }));
    } else if (diseaseRes.status === "ok") {
      lines.push(t("doctor.noDiseaseDetected"));
    } else if (diseaseRes.status === "quota-exceeded") {
      lines.push(t("doctor.quotaReached"));
    }

    if (varietyRes.status === "ok" && varietyRes.data.length > 0) {
      const top = varietyRes.data[0];
      lines.push(t("doctor.likelyVariety", { name: top.name, score: Math.round(top.score * 100) }));
    }

    setMessages((m) => [
      ...m,
      {
        id: nextId(),
        role: "assistant",
        content: lines.length ? lines.join(" ") : t("doctor.couldNotAnalyze"),
      },
    ]);
    setSendingPhoto(false);
  };

  return (
    <AppShell>
      <header className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
          <Stethoscope className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-display text-2xl leading-tight">{t("doctor.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("doctor.subtitle")}</p>
        </div>
      </header>

      {/* Plant focus selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-4">
        <button
          onClick={() => setFocusPlantId("")}
          className={`ios-tap shrink-0 text-[13px] font-medium px-3.5 h-8 rounded-full transition-colors ${
            focusPlantId === ""
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {t("doctor.anyPlant")}
        </button>
        {plants.map((p) => (
          <button
            key={p.id}
            onClick={() => setFocusPlantId(p.id)}
            className={`ios-tap shrink-0 text-[13px] font-medium px-3.5 h-8 rounded-full transition-colors flex items-center gap-1.5 ${
              focusPlantId === p.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            <span>{p.emoji}</span>
            {p.name}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-4">
        {messages.map((m) => (
          <div
            key={m.id}
            ref={(el) => {
              msgRefs.current[m.id] = el;
            }}
            className={`scroll-mt-24 ${m.role === "assistant" ? "" : "flex justify-end"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed transition-all duration-700 ${
                m.role === "assistant"
                  ? "bg-secondary text-secondary-foreground rounded-[1.25rem] rounded-bl-md"
                  : "bg-primary text-primary-foreground rounded-[1.25rem] rounded-br-md"
              } ${
                flashMsgId === m.id
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : ""
              }`}
            >
              {m.hasPhoto && <MsgPhoto messageId={m.id} />}
              {m.content}
              {m.citation && <TimelineCitationCard citation={m.citation} messageId={m.id} />}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pb-3">
        {suggestionKeys.map((key) => (
          <button
            key={key}
            onClick={() => send(t(key))}
            className="ios-tap shrink-0 text-[13px] px-3.5 h-9 rounded-full border border-border bg-card"
          >
            {t(key)}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="sticky bottom-20">
        {pendingPhotoUrl && (
          <div className="mb-2 mx-1 flex items-center gap-2 bg-card rounded-2xl p-2 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.12)]">
            <img
              src={pendingPhotoUrl}
              alt="Attached"
              className="h-12 w-12 rounded-xl object-cover shrink-0"
            />
            <p className="flex-1 text-xs text-muted-foreground">{t("doctor.photoAttachedHint")}</p>
            <button
              onClick={clearPendingPhoto}
              className="ios-tap h-7 w-7 rounded-full bg-secondary grid place-items-center shrink-0"
              aria-label={t("doctor.removePhoto")}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pendingPhoto) sendPhoto();
            else send(input);
          }}
          className="bg-card rounded-full shadow-[0_2px_12px_-2px_rgba(0,0,0,0.12)] flex items-center gap-1 pl-2 pr-1.5 py-1.5"
        >
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoPicked}
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={sendingPhoto}
            className="ios-tap h-9 w-9 rounded-full bg-secondary text-secondary-foreground grid place-items-center shrink-0 disabled:opacity-50"
            aria-label={t("doctor.attachPhoto")}
          >
            <Camera className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingPhoto
                ? t("doctor.addNote")
                : focusPlant
                  ? t("doctor.askAboutPlant", { name: focusPlant.name })
                  : t("doctor.askAboutGeneric")
            }
            className="flex-1 bg-transparent outline-none text-[15px] px-1"
          />
          <button
            type="submit"
            disabled={sendingPhoto || (!input.trim() && !pendingPhoto)}
            className="ios-tap h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0 disabled:opacity-50"
            aria-label={t("doctor.send")}
          >
            <Send className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}

function MsgPhoto({ messageId }: { messageId: string }) {
  const t = useT();
  const url = usePhotoUrl(messageId);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={t("doctor.attachedPhotoAlt")}
      className="w-full max-w-[14rem] rounded-xl mb-2 object-cover"
    />
  );
}

function TimelineCitationCard({
  citation,
  messageId,
}: {
  citation: TimelineCitation;
  messageId: string;
}) {
  const t = useT();
  const TrendIcon = citation.delta > 0 ? TrendingUp : citation.delta < 0 ? TrendingDown : Minus;
  const tone =
    citation.delta > 0
      ? "text-foreground"
      : citation.delta < 0
        ? "text-[oklch(0.4_0.13_35)]"
        : "text-muted-foreground";

  return (
    <div className="mt-3 rounded-2xl bg-card/70 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("doctor.referencing", { name: citation.plantName })}
        </p>
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
          <TrendIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {citation.delta > 0 ? "+" : ""}
          {citation.delta} {t("doctor.pts")}
        </span>
      </div>
      <ol className="space-y-1">
        {citation.entries.map((e) => (
          <li key={e.id}>
            <Link
              to="/plant/$id"
              params={{ id: citation.plantId }}
              search={{ highlight: e.id, fromMsg: messageId }}
              className="ios-tap group w-full flex items-center gap-2 text-xs px-2 py-1.5 -mx-2 rounded-lg"
            >
              <span className="w-16 text-muted-foreground shrink-0">{e.month}</span>
              <span className="font-medium tabular-nums w-8">{e.health}</span>
              <span className="truncate text-foreground/80 flex-1">{e.headline}</span>
              <ArrowRight className="h-3 w-3 text-foreground shrink-0" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("doctor.tapMonth")}</p>
    </div>
  );
}
