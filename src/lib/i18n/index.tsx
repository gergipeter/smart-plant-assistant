import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "./en";
import { hu } from "./hu";
import type { PlantStatus } from "@/lib/plants";

export type Locale = "en" | "hu";
// Every translatable string lives under one of these dotted keys, e.g.
// t("nav.garden") — keeps call sites short while still being greppable.
// Keys come from en.ts (the canonical set); values are plain `string` (not
// literal types) so hu.ts can supply different text for the same keys.
export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;

const dictionaries: Record<Locale, Dictionary> = { en, hu };

export const LOCALES: { id: Locale; label: string; nativeLabel: string }[] = [
  { id: "en", label: "English", nativeLabel: "English" },
  { id: "hu", label: "Hungarian", nativeLabel: "Magyar" },
];

// BCP-47 tags for Date#toLocaleString, so month/day names (e.g. timeline
// entries, digest periods) follow the active locale instead of always
// rendering in English.
const BCP47: Record<Locale, string> = { en: "en-US", hu: "hu-HU" };
export function dateLocale(locale: Locale): string {
  return BCP47[locale];
}

// Maps plants.ts's PlantStatus (data) to a translation key — kept here
// rather than in plants.ts so that file stays free of an i18n dependency.
export const statusLabelKeys: Record<PlantStatus, TranslationKey> = {
  "needs-water": "plant.status.needsWater",
  healthy: "plant.status.healthy",
  quarantined: "plant.status.quarantined",
  "needs-mist": "plant.status.needsMist",
};

const STORAGE_KEY = "verdant.locale.v1";

function loadStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "hu") return raw;
  } catch {
    // ignore
  }
  return "en";
}

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Starts "en" during SSR/first paint (matches the server-rendered HTML),
  // then syncs to the stored preference client-side to avoid a hydration
  // mismatch — same pattern as this app's other localStorage-backed state.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(loadStoredLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[locale];
    const fallback = dictionaries.en;
    return {
      locale,
      setLocale,
      t: (key, vars) => interpolate(dict[key] ?? fallback[key] ?? key, vars),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

// Shorthand for the common case of just needing the translate function.
export function useT() {
  return useI18n().t;
}
