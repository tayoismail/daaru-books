import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../public/locales/en/common.json";
import ar from "../../public/locales/ar/common.json";

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Initial language for the client bundle. The SSR HTML carries the right
 * locale in <html lang=…> (set by _document from the /ar route), so we can
 * read it synchronously at module init — BEFORE React's first render. This
 * guarantees hydration renders Arabic with Arabic text; otherwise i18next
 * would start in English and the async changeLanguage() would only kick in
 * after hydration, causing a server/client text mismatch (React error #418).
 */
function detectInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    const lang = document.documentElement.lang;
    if (lang === "ar" || lang === "en") return lang;
  }
  return DEFAULT_LOCALE;
}

// NOTE: no browser language detector. The locale always comes from Next.js
// routing (`/ar` prefix + next.config i18n) via the <html lang> attribute and
// the LanguageProvider. A detector would briefly override the locale during
// hydration (e.g. navigator.language), causing React text-mismatch errors on
// Arabic pages. js-cookie still stores the choice for the cart/language state.
const initPromise = i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      ar: { common: ar },
    },
    lng: detectInitialLocale(),
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: LOCALES,
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });

/**
 * Await before calling changeLanguage. `init()` is async — on the client the
 * module-level init can otherwise finish AFTER the router locale has already
 * been applied, so a `/ar` request would briefly render English and cause a
 * React hydration text mismatch. Serializing init → changeLanguage removes
 * the race for both server and client.
 */
export async function setLocale(locale: Locale): Promise<void> {
  await initPromise;
  if (i18n.language !== locale) {
    await i18n.changeLanguage(locale);
  }
}

export const isRtl = (locale: Locale) => locale === "ar";

export default i18n;
