import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Droplets, X } from "lucide-react";
import type { Plant } from "@/lib/plants";
import { buildWaterCalendar, type WaterEvent } from "@/lib/waterCalendar";
import { useT, useI18n, type TranslationKey } from "@/lib/i18n";

const WEEKDAY_KEYS: TranslationKey[] = [
  "calendar.weekday.sun",
  "calendar.weekday.mon",
  "calendar.weekday.tue",
  "calendar.weekday.wed",
  "calendar.weekday.thu",
  "calendar.weekday.fri",
  "calendar.weekday.sat",
];

const DAYS_AHEAD = 42; // enough to cover a full 6-week month grid

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function WaterCalendar({ plants }: { plants: Plant[] }) {
  const t = useT();
  const { locale } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<{ label: string; events: WaterEvent[] } | null>(
    null,
  );

  const calendar = useMemo(() => buildWaterCalendar(plants, DAYS_AHEAD, today), [plants, today]);

  const grid = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

    const cells: Array<{ date: Date; key: string } | null> = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      cells.push({ date, key: date.toLocaleDateString("en-CA") });
    }
    return cells;
  }, [viewMonth]);

  const todayKey = today.toLocaleDateString("en-CA");
  const monthLabel = viewMonth.toLocaleDateString(locale === "hu" ? "hu-HU" : "en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="leaf-card p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => {
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
            setSelectedDay(null);
          }}
          className="ios-tap h-8 w-8 rounded-full bg-secondary grid place-items-center"
          aria-label={t("calendar.prevMonth")}
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <p className="text-sm font-medium">{monthLabel}</p>
        <button
          onClick={() => {
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
            setSelectedDay(null);
          }}
          className="ios-tap h-8 w-8 rounded-full bg-secondary grid place-items-center"
          aria-label={t("calendar.nextMonth")}
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_KEYS.map((key, i) => (
          <span key={i} className="text-[10px] text-muted-foreground py-1">
            {t(key)}
          </span>
        ))}
        {grid.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const events = calendar.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const dayLabel = cell.date.toLocaleDateString(locale === "hu" ? "hu-HU" : "en-US", {
            month: "short",
            day: "numeric",
          });
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() =>
                events.length > 0 ? setSelectedDay({ label: dayLabel, events }) : undefined
              }
              disabled={events.length === 0}
              className={`ios-tap aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 ${
                isToday ? "bg-primary/15" : ""
              }`}
              title={events.map((e) => e.plantName).join(", ")}
            >
              <span
                className={`text-[11px] tabular-nums ${isToday ? "font-semibold text-primary" : "text-foreground"}`}
              >
                {cell.date.getDate()}
              </span>
              {events.length > 0 && (
                <div className="flex items-center gap-0.5">
                  {events.slice(0, 3).map((e, idx) => (
                    <Droplets
                      key={idx}
                      className="h-2 w-2 text-primary"
                      strokeWidth={2}
                      fill="currentColor"
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">{selectedDay.label}</p>
            <button
              onClick={() => setSelectedDay(null)}
              className="ios-tap h-6 w-6 rounded-full bg-secondary grid place-items-center"
              aria-label={t("calendar.closeDay")}
            >
              <X className="h-3 w-3" strokeWidth={1.75} />
            </button>
          </div>
          <div className="space-y-1">
            {selectedDay.events.map((e) => (
              <Link
                key={e.plantId}
                to="/plant/$id"
                params={{ id: e.plantId }}
                className="ios-tap flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-secondary"
              >
                <Droplets className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.75} />
                {e.plantName}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
