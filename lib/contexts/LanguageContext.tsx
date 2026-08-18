import { useRouter } from "next/router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from "react";
import i18n, {
  DEFAULT_LOCALE,
  isRtl,
  LOCALES,
  type Locale,
} from "@/lib/i18n";

interface LanguageContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export function LanguageProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const locale = (router.locale ?? DEFAULT_LOCALE) as Locale;

  // Keep <html dir> and i18next in sync with the router locale.
  useEffect(() => {
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      void router.push(router.pathname, router.asPath, { locale: next });
    },
    [locale, router]
  );

  const toggleLocale = useCallback(() => {
    const next = LOCALES.find((l) => l !== locale) ?? DEFAULT_LOCALE;
    setLocale(next);
  }, [locale, setLocale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      dir: isRtl(locale) ? "rtl" : "ltr",
      setLocale,
      toggleLocale,
    }),
    [locale, setLocale, toggleLocale]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
