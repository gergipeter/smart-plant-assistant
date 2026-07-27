import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { hideDemoCatalog, showDemoCatalog, useGardenPlants } from "@/lib/myGarden";
import { seedDemoData } from "@/lib/seedDemoData";
import { Wand2, Sprout, ChevronRight, Settings2, Languages, Check, User, Crown, MessageCircle, LogOut, LogIn, Users, Bell, Smartphone, Shield, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n, LOCALES } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications.server";
import {
  isPushConfigured,
  getPushPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushNotifications";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Verdant" },
      { name: "description", content: "App settings, notifications, and account preferences." },
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
  const { user, signOut } = useAuth();
  const [wateringReminders, setWateringReminders] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [pushPermission, setPushPermission] = useState<ReturnType<typeof getPushPermissionState>>("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getNotificationPreferences({ data: { userId: user.uid } }).then((res) => {
      if (res.status === "ok") setWateringReminders(res.data.wateringReminders);
      setPrefsLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    setPushPermission(getPushPermissionState());
  }, []);

  const handleToggleWateringReminders = async () => {
    if (!user) return;
    const next = !wateringReminders;
    setWateringReminders(next);
    await updateNotificationPreferences({ data: { userId: user.uid, wateringReminders: next } });
  };

  const handleTogglePush = async () => {
    if (!user) return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (pushPermission === "granted") {
        await unsubscribeFromPush(user.uid);
        // Browser permission itself can't be revoked by the page — only the
        // server-side token registration. Reflect that we stopped sending.
        setPushPermission("default");
      } else {
        const res = await subscribeToPush(user.uid);
        if (res.status === "ok") setPushPermission("granted");
        else if (res.status === "denied") setPushPermission("denied");
        else setPushError(res.status === "error" ? res.message : "Push notifications aren't supported in this browser.");
      }
    } finally {
      setPushBusy(false);
    }
  };

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
          Account
        </h2>
        <div className="ios-group">
          {user ? (
            <SettingsRow
              icon={<User className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
              label={user.displayName || "My Profile"}
              sub={user.email || "View your profile and activity"}
              to="/profile"
            />
          ) : (
            <SettingsRow
              icon={<LogIn className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
              label="Sign In"
              sub="Sign in to sync your garden and profile"
              to="/login"
            />
          )}
          <SettingsRow
            icon={<Crown className="h-4 w-4 text-primary" strokeWidth={1.75} />}
            label="Premium"
            sub="Upgrade to Premium Plus or Pro"
            to="/premium"
          />
          <SettingsRow
            icon={<Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
            label="Feed"
            sub="See what other plant parents are growing"
            to="/feed"
          />
          <SettingsRow
            icon={<MessageCircle className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
            label="Ask an Expert"
            sub="Get answers from plant experts"
            to="/ask-expert"
          />
          {user && (
            <SettingsRow
              icon={<LogOut className="h-4 w-4 text-destructive" strokeWidth={1.75} />}
              label="Sign Out"
              sub={`Signed in as ${user.email || user.displayName || "your account"}`}
              onClick={() => signOut()}
            />
          )}
        </div>
      </section>

      {user && (
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Notifications
          </h2>
          <div className="ios-group">
            <button
              onClick={handleToggleWateringReminders}
              disabled={!prefsLoaded}
              className="ios-tap flex items-center gap-3 px-4 py-3.5 w-full disabled:opacity-60"
            >
              <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
                <Bell className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">Watering reminders</p>
                <p className="text-xs text-muted-foreground">Email when a plant is due for water</p>
              </div>
              <div
                className={`shrink-0 h-6 w-10 rounded-full transition-colors relative ${
                  wateringReminders ? "bg-primary" : "bg-muted"
                }`}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    wateringReminders ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </button>
            {isPushConfigured && pushPermission !== "unsupported" && (
              <button
                onClick={handleTogglePush}
                disabled={pushBusy || pushPermission === "denied"}
                className="ios-tap flex items-center gap-3 px-4 py-3.5 w-full disabled:opacity-60"
              >
                <div className="h-9 w-9 shrink-0 rounded-full bg-secondary grid place-items-center">
                  <Smartphone className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium">{t("settings.pushNotifications")}</p>
                  <p className="text-xs text-muted-foreground">
                    {pushPermission === "denied"
                      ? t("settings.pushBlocked")
                      : pushError ?? t("settings.pushSub")}
                  </p>
                </div>
                <div
                  className={`shrink-0 h-6 w-10 rounded-full transition-colors relative ${
                    pushPermission === "granted" ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      pushPermission === "granted" ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
            )}
          </div>
        </section>
      )}

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
          Legal
        </h2>
        <div className="ios-group">
          <SettingsRow
            icon={<Shield className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
            label="Privacy Policy"
            sub="How we collect and use your data"
            to="/privacy"
          />
          <SettingsRow
            icon={<FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
            label="Terms of Service"
            sub="The terms that govern your use of Verdant"
            to="/terms"
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
