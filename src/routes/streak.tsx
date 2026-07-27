import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { getCompletedDates, getCurrentStreak, getLongestStreak, toDateKey } from "@/lib/streaks";
import { ArrowLeft, Flame, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/streak")({
  head: () => ({
    meta: [
      { title: "Care streak — Verdant" },
      { name: "description", content: "Your plant care streak history." },
    ],
  }),
  component: StreakPage,
});

const WEEKS_SHOWN = 8;

// Builds WEEKS_SHOWN full weeks (Sun-Sat) ending on the current week, so the
// grid always renders a clean rectangle regardless of what day `now` falls on.
function buildWeeks(now: Date): Date[][] {
  const endOfThisWeek = new Date(now);
  endOfThisWeek.setDate(now.getDate() + (6 - now.getDay()));

  const days: Date[] = [];
  for (let i = WEEKS_SHOWN * 7 - 1; i >= 0; i--) {
    const d = new Date(endOfThisWeek);
    d.setDate(endOfThisWeek.getDate() - i);
    days.push(d);
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function StreakPage() {
  const t = useT();
  const [hydrated, setHydrated] = useState(false);
  const [current, setCurrent] = useState(0);
  const [longest, setLongest] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrent(getCurrentStreak());
    setLongest(getLongestStreak());
    setCompleted(getCompletedDates());
    setHydrated(true);
  }, []);

  const now = new Date();
  const weeks = buildWeeks(now);
  const todayKey = toDateKey(now);

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/"
          className="ios-tap h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0"
          aria-label={t("streak.back")}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <h1 className="font-display text-2xl">{t("streak.title")}</h1>
      </div>

      {hydrated && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-7">
            <div className="leaf-card p-4 flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center mb-2">
                <Flame
                  className="h-4 w-4 text-primary"
                  strokeWidth={1.75}
                  fill="currentColor"
                  fillOpacity={0.2}
                />
              </div>
              <p className="text-2xl font-display tabular-nums">{current}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("streak.current")}</p>
            </div>
            <div className="leaf-card p-4 flex flex-col items-center text-center">
              <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center mb-2">
                <Trophy className="h-4 w-4 text-primary" strokeWidth={1.75} />
              </div>
              <p className="text-2xl font-display tabular-nums">{longest}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("streak.longest")}</p>
            </div>
          </div>

          <section>
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-3 px-1">
              {t("streak.history")}
            </h2>
            <div className="leaf-card p-4">
              <div className="flex flex-col gap-1.5">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex gap-1.5">
                    {week.map((day) => {
                      const key = toDateKey(day);
                      const isDone = completed.has(key);
                      const isFuture = key > todayKey;
                      const isToday = key === todayKey;
                      return (
                        <div
                          key={key}
                          title={day.toLocaleDateString()}
                          className={`h-6 flex-1 rounded-md ${
                            isFuture
                              ? "bg-transparent"
                              : isDone
                                ? "bg-primary"
                                : "bg-muted"
                          } ${isToday ? "ring-2 ring-primary/50 ring-offset-1 ring-offset-card" : ""}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                <div className="h-3 w-3 rounded-sm bg-muted" />
                {t("streak.legendMissed")}
                <div className="h-3 w-3 rounded-sm bg-primary ml-2" />
                {t("streak.legendDone")}
              </div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
