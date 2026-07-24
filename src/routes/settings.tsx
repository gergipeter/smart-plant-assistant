import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { hideDemoCatalog, showDemoCatalog, useGardenPlants } from "@/lib/myGarden";
import { seedDemoData } from "@/lib/seedDemoData";
import { Terminal, Wand2, Sprout, ChevronRight, Settings2, Languages, Check } from "lucide-react";
import { useState } from "react";
import { useI18n, LOCALES } from "@/lib/i18n";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Verdant" },
      { name: "description", content: "App settings, demo data, and the Pl@ntNet API Explorer." },
    ],
  }),
  component: SettingsPage,
});

function SettingsRow({
  icon,
  label,
  sub,
  onClick,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick?: () => void;
  to?: string;
}) {
  const content = (
    <>
      <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
    </>
  );

  const className = "ios-tap flex items-center gap-3 px-4 py-3.5 w-full";

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function SettingsPage() {
  const gardenPlants = useGardenPlants();
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const { locale, setLocale, t } = useI18n();

  const handleSeedDemoData = async () => {
    setSeeding(true);
    try {
      showDemoCatalog();
      await seedDemoData();
    } finally {
      window.location.reload();
    }
  };

  const handleClearDemo = () => {
    setBusy(true);
    hideDemoCatalog();
    window.location.reload();
  };

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
          <Settings2 className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-display text-2xl leading-tight">{t("settings.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("settings.subtitle")}</p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-1">
          {t("settings.section.language")}
        </h2>
        <div className="ios-group">
          {LOCALES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLocale(l.id)}
              className="ios-tap flex items-center gap-3 px-4 py-3.5 w-full"
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
                <Languages className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">{l.nativeLabel}</p>
              </div>
              {locale === l.id && (
                <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-1">
          {t("settings.section.plantnet")}
        </h2>
        <div className="ios-group">
          <SettingsRow
            icon={<Terminal className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
            label={t("settings.apiExplorer")}
            sub={t("settings.apiExplorerSub")}
            to="/api-explorer"
          />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-1">
          {t("settings.section.demoData")}
        </h2>
        <div className="ios-group">
          <SettingsRow
            icon={<Wand2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
            label={t("settings.seedDemo")}
            sub={t("settings.seedDemoSub")}
            onClick={handleSeedDemoData}
          />
          {gardenPlants.length > 0 && (
            <SettingsRow
              icon={<Sprout className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
              label={t("settings.startFresh")}
              sub={t("settings.startFreshSub")}
              onClick={handleClearDemo}
            />
          )}
        </div>
        {(seeding || busy) && (
          <p className="text-xs text-muted-foreground text-center mt-3">{t("settings.working")}</p>
        )}
      </section>
    </AppShell>
  );
}
