import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSubscriptionAsync, TIER_FEATURES, formatTierName, type PremiumTier } from "@/lib/premium";
import { countQuestionsThisMonth } from "@/lib/expertQuestions";
import { getDailyQuota } from "@/lib/plantnet.server";

type Status = {
  tier: PremiumTier;
  expertUsed: number;
  expertLimit: number;
  scanRemaining: number;
  scanTotal: number;
};

// Signed-in-only "what am I getting" summary — tier plus the two concrete
// per-period limits a user can actually run out of (Ask an Expert questions
// this month, Pl@ntNet scan IDs today). Shown for every signed-in tier,
// including free — free users still have a scan quota worth seeing, and
// showing "0 expert questions" with an upgrade link is more useful than
// hiding the card outright.
export function PremiumStatusCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([
      getSubscriptionAsync(user.uid),
      countQuestionsThisMonth(user.uid),
      getDailyQuota(),
    ]).then(([sub, expertUsed, quotaRes]) => {
      if (cancelled) return;
      setStatus({
        tier: sub.tier,
        expertUsed,
        expertLimit: TIER_FEATURES[sub.tier].expertQuestionsPerMonth,
        scanRemaining: quotaRes.status === "ok" ? quotaRes.data.quota.identify.remaining : 0,
        scanTotal: quotaRes.status === "ok" ? quotaRes.data.quota.identify.total : 0,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !status) return null;

  return (
    <div className="leaf-card p-4 flex items-start gap-3 mb-4">
      <div className="h-9 w-9 shrink-0 rounded-full bg-primary/15 grid place-items-center">
        <Crown className="h-4 w-4 text-primary" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{formatTierName(status.tier)}</p>
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <p>
            {status.expertLimit === 0
              ? "Expert questions — Plus/Pro only"
              : Number.isFinite(status.expertLimit)
                ? `${status.expertUsed}/${status.expertLimit} expert questions used this month`
                : "Unlimited expert questions"}
          </p>
          <p>
            {status.scanRemaining}/{status.scanTotal} scan IDs left today
          </p>
        </div>
        {status.tier === "free" && (
          <Link to="/premium" className="ios-tap text-xs font-medium text-primary mt-1.5 inline-block">
            Upgrade for more →
          </Link>
        )}
      </div>
    </div>
  );
}
