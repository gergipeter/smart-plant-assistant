import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, Lock, TrendingUp, TrendingDown, Sprout, Droplets } from "lucide-react";
import type { Plant } from "@/lib/plants";
import { useAuth } from "@/lib/auth";
import { getSubscriptionAsync } from "@/lib/premium";
import { buildGardenDigest } from "@/lib/gardenDigest";
import { useT } from "@/lib/i18n";

// Pro-only panel: a monthly rollup of garden activity, built entirely from
// data already stored on each Plant's timeline (see gardenDigest.ts) — no
// new tracking, just a summary view. Presented as "customReports" in
// premium.ts's TIER_FEATURES ("Detailed plant care reports").
export function GardenDigest({ plants }: { plants: Plant[] }) {
  const t = useT();
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      return;
    }
    getSubscriptionAsync(user.uid).then((sub) => setHasAccess(sub.tier === "pro"));
  }, [user]);

  if (hasAccess === null || plants.length === 0) return null;

  if (!hasAccess) {
    return (
      <Link to="/premium" className="ios-tap leaf-card p-4 flex items-center gap-3 mb-7 block">
        <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0">
          <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{t("digest.lockedTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("digest.lockedSub")}</p>
        </div>
      </Link>
    );
  }

  const digest = buildGardenDigest(plants);

  return (
    <section className="mb-7">
      <div className="flex items-center gap-1.5 text-lg font-display mb-3">
        <FileText className="h-4 w-4 text-primary" strokeWidth={1.75} />
        {t("digest.title", { period: digest.periodLabel })}
      </div>

      <div className="leaf-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
            <Sprout className="h-4 w-4 text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm flex-1">
            {t("digest.summary", {
              plants: digest.plantCount,
              entries: digest.entriesThisMonth,
            })}
          </p>
        </div>

        {digest.newPlantsThisMonth.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("digest.newPlants", {
              names: digest.newPlantsThisMonth.map((p) => p.name).join(", "),
            })}
          </p>
        )}

        {digest.mostImproved && (
          <div className="flex items-center gap-2 text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.75} />
            <span>
              {t("digest.mostImproved", {
                name: digest.mostImproved.name,
                delta: digest.mostImproved.delta,
              })}
            </span>
          </div>
        )}

        {digest.mostDeclined && (
          <div className="flex items-center gap-2 text-xs">
            <TrendingDown className="h-3.5 w-3.5 text-[oklch(0.5_0.13_35)] shrink-0" strokeWidth={1.75} />
            <span>
              {t("digest.mostDeclined", {
                name: digest.mostDeclined.name,
                delta: Math.abs(digest.mostDeclined.delta),
              })}
            </span>
          </div>
        )}

        {digest.plantsNeedingAttention.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
            <Droplets className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            {t("digest.needsAttention", {
              names: digest.plantsNeedingAttention.map((p) => p.name).join(", "),
            })}
          </div>
        )}
      </div>
    </section>
  );
}
