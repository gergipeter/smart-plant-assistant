import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { X, GripVertical } from "lucide-react";
import { PlantThumb } from "@/components/AppShell";
import { getPhoto } from "@/lib/photoStore";
import type { TimelineEntry } from "@/lib/plants";
import { useT } from "@/lib/i18n";

function useEntryPhotoUrl(entry: TimelineEntry): string | undefined {
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

  return url;
}

function CompareImage({ entry, clipRight }: { entry: TimelineEntry; clipRight?: number }) {
  const url = useEntryPhotoUrl(entry);
  const style = clipRight != null ? { clipPath: `inset(0 ${clipRight}% 0 0)` } : undefined;

  return (
    <div className="absolute inset-0" style={style}>
      {url ? (
        <img
          src={url}
          alt={entry.headline}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <PlantThumb
          emoji={entry.emoji}
          gradient={entry.gradient}
          className="absolute inset-0 h-full w-full text-8xl [&>span]:text-8xl"
        />
      )}
    </div>
  );
}

export function CompareSlider({
  before,
  after,
  plantName,
  onClose,
}: {
  before: TimelineEntry;
  after: TimelineEntry;
  plantName: string;
  onClose: () => void;
}) {
  const t = useT();
  const [position, setPosition] = useState(50); // % from left where the "after" reveal starts
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    dragging.current = true;
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return;
    updateFromClientX(e.clientX);
  };
  const endDrag = () => {
    dragging.current = false;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
        <div>
          <p className="text-white text-sm font-medium">{plantName}</p>
          <p className="text-white/60 text-xs">
            {t("compare.vs", { before: before.month, after: after.month })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ios-tap h-9 w-9 rounded-full bg-white/10 grid place-items-center"
          aria-label={t("compare.close")}
        >
          <X className="h-4 w-4 text-white" strokeWidth={1.75} />
        </button>
      </div>

      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative flex-1 mx-5 mb-3 rounded-[1.75rem] overflow-hidden bg-white/5 select-none touch-none"
      >
        <CompareImage entry={before} />
        <CompareImage entry={after} clipRight={100 - position} />

        {/* handle */}
        <div className="absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${position}%` }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white grid place-items-center shadow-lg">
            <GripVertical className="h-4 w-4 text-black" strokeWidth={2} />
          </div>
        </div>

        <div className="absolute top-3 left-3 text-[11px] font-medium text-white bg-black/50 rounded-full px-2 py-1">
          {before.date} · {before.health}%
        </div>
        <div className="absolute top-3 right-3 text-[11px] font-medium text-white bg-black/50 rounded-full px-2 py-1">
          {after.date} · {after.health}%
        </div>
      </div>

      <p className="text-center text-white/60 text-xs pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {t("compare.dragHint")}
      </p>
    </div>
  );
}
