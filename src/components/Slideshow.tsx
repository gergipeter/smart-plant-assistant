import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { PlantThumb } from "@/components/AppShell";
import { getPhoto } from "@/lib/photoStore";
import type { TimelineEntry } from "@/lib/plants";
import { useT } from "@/lib/i18n";

const AUTO_ADVANCE_MS = 2200;

function SlideImage({ entry }: { entry: TimelineEntry }) {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!entry.hasPhoto) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    getPhoto(entry.id).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry.id, entry.hasPhoto]);

  if (url) {
    return (
      <img src={url} alt={entry.headline} className="absolute inset-0 h-full w-full object-cover" />
    );
  }
  return (
    <PlantThumb
      emoji={entry.emoji}
      gradient={entry.gradient}
      className="absolute inset-0 h-full w-full text-8xl [&>span]:text-8xl"
    />
  );
}

export function Slideshow({
  entries,
  plantName,
  onClose,
}: {
  entries: TimelineEntry[];
  plantName: string;
  onClose: () => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || entries.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % entries.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [playing, entries.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % entries.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + entries.length) % entries.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entries.length, onClose]);

  const entry = entries[index];
  if (!entry) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
        <div>
          <p className="text-white text-sm font-medium">{plantName}</p>
          <p className="text-white/60 text-xs">{entry.month}</p>
        </div>
        <button
          onClick={onClose}
          className="ios-tap h-9 w-9 rounded-full bg-white/10 grid place-items-center"
          aria-label={t("slideshow.close")}
        >
          <X className="h-4 w-4 text-white" strokeWidth={1.75} />
        </button>
      </div>

      <div className="relative flex-1 mx-5 mb-3 rounded-[1.75rem] overflow-hidden bg-white/5">
        <div key={entry.id} className="absolute inset-0 animate-[fadeIn_0.4s_ease]">
          <SlideImage entry={entry} />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-white text-sm font-medium">{entry.headline}</p>
          <p className="text-white/70 text-xs mt-0.5">
            {entry.date} · {t("plant.health")} {entry.health}
          </p>
        </div>
      </div>

      {/* progress dots */}
      <div className="flex items-center justify-center gap-1.5 pb-2">
        {entries.map((e, i) => (
          <button
            key={e.id}
            onClick={() => setIndex(i)}
            aria-label={t("slideshow.goTo", { month: e.month })}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 bg-white" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-1">
        <button
          onClick={() => setIndex((i) => (i - 1 + entries.length) % entries.length)}
          className="ios-tap h-11 w-11 rounded-full bg-white/10 grid place-items-center"
          aria-label={t("slideshow.previous")}
        >
          <ChevronLeft className="h-5 w-5 text-white" strokeWidth={1.75} />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="ios-tap h-14 w-14 rounded-full bg-white text-black grid place-items-center"
          aria-label={playing ? t("slideshow.pause") : t("slideshow.play")}
        >
          {playing ? (
            <Pause className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <Play className="h-5 w-5 ml-0.5" strokeWidth={1.75} />
          )}
        </button>
        <button
          onClick={() => setIndex((i) => (i + 1) % entries.length)}
          className="ios-tap h-11 w-11 rounded-full bg-white/10 grid place-items-center"
          aria-label={t("slideshow.next")}
        >
          <ChevronRight className="h-5 w-5 text-white" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
