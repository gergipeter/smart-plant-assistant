import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Camera, MessageCircleHeart, Search, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useT, type TranslationKey } from "@/lib/i18n";

// Left section: My Garden (primary entry point)
const primaryNav = [
  { to: "/", labelKey: "nav.garden" satisfies TranslationKey, icon: Home }
] as const;

// Right section: Secondary navigation organized by user need
// Discover plants → Get health advice → Configure app
const secondaryNav = [
  { to: "/explore", labelKey: "nav.explore" satisfies TranslationKey, icon: Search, group: "discover" },
  { to: "/doctor", labelKey: "nav.doctor" satisfies TranslationKey, icon: MessageCircleHeart, group: "health" },
  { to: "/settings", labelKey: "nav.settings" satisfies TranslationKey, icon: Settings2, group: "settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onScan = pathname === "/scan";
  const t = useT();

  return (
    <div className="min-h-screen pb-[calc(4.75rem+env(safe-area-inset-bottom))] max-w-md mx-auto relative">
      <div className="px-5 pt-8 mb-12">{children}</div>

      {/* iOS-style tab bar: frosted, filled icon on active state, camera as raised focal action.
          Five equal columns so every item sits on a fixed grid; the middle column is an
          empty slot the raised camera is centered over — this keeps all four labels evenly
          spaced and the camera perfectly aligned above its own slot.

          Organization:
          - Garden (primary entry point)
          - Explore → [Scan] → Doctor → Settings (secondary journey around the focal action)
      */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-20 w-full max-w-md ios-tabbar pb-[env(safe-area-inset-bottom)]">
        <div className="h-[4.75rem] relative">
          {/* Actual nav bar background: 5 equal columns, camera occupies the middle one */}
          <div className="absolute inset-0 grid grid-cols-5 items-center px-2">
            {/* Cols 1–2: Garden, Explore */}
            {[...primaryNav, secondaryNav[0]].map((n) => {
              const Icon = n.icon;
              const active = n.to === "/" ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`ios-tap flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className="h-6 w-6"
                    strokeWidth={1.5}
                    fill={active ? "currentColor" : "none"}
                    fillOpacity={active ? 0.16 : 0}
                  />
                  <span>{t(n.labelKey)}</span>
                </Link>
              );
            })}

            {/* Col 3: empty slot reserved for the raised camera button */}
            <div aria-hidden />

            {/* Cols 4–5: Doctor, Settings */}
            {secondaryNav.slice(1).map((n) => {
              const Icon = n.icon;
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`ios-tap flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className="h-6 w-6"
                    strokeWidth={1.5}
                    fill={active ? "currentColor" : "none"}
                    fillOpacity={active ? 0.16 : 0}
                  />
                  <span>{t(n.labelKey)}</span>
                </Link>
              );
            })}
          </div>

          {/* Center: Camera (focal action, raised above everything, centered over col 3) */}
          <Link
            to="/scan"
            aria-current={onScan ? "page" : undefined}
            className={`ios-tap absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[4.5rem] w-[4.5rem] rounded-full grid place-items-center ring-[5px] ring-background transition-opacity z-10 ${
              onScan
                ? "bg-secondary text-muted-foreground opacity-70"
                : "bg-primary text-primary-foreground shadow-[0_10px_28px_-6px_var(--primary)]"
            }`}
            aria-label={onScan ? t("nav.scanCurrentPage") : t("nav.scan")}
          >
            <Camera className="h-7 w-7" strokeWidth={1.75} />
          </Link>
        </div>
      </nav>
    </div>
  );
}

export function PlantThumb({
  emoji,
  photo,
  gradient,
  className = "",
}: {
  emoji: string;
  photo?: string;
  gradient: string;
  className?: string;
}) {
  if (photo) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <img src={photo} alt="" aria-hidden className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`grid place-items-center ${gradient} ${className}`}>
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
    </div>
  );
}
