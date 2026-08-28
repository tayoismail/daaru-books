import type { Locale } from "@/lib/i18n";

export interface CategoryInfo {
  /** URL-safe slug used in links and filters. */
  slug: string;
  /** English display name — this is what data/books.json stores in `category`. */
  en: string;
  /** Arabic display name. */
  ar: string;
}

/**
 * Default category catalog — used as a fallback when Appwrite hasn't been
 * seeded yet. Overwritten at runtime via `updateCategories()` (called from
 * `_app.getInitialProps` with live data from Appwrite).
 */
export const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { slug: "quran-tafsir", en: "Quran & Tafsir", ar: "القرآن والتفسير" },
  { slug: "hadith", en: "Hadith", ar: "الحديث" },
  { slug: "fiqh", en: "Fiqh", ar: "الفقه" },
  { slug: "arabic-language", en: "Arabic Language", ar: "اللغة العربية" },
  { slug: "islamic-history", en: "Islamic History", ar: "التاريخ الإسلامي" },
  { slug: "aqeedah", en: "Aqeedah", ar: "العقيدة" },
  { slug: "spirituality", en: "Spirituality", ar: "الروحانيات" },
  { slug: "children-books", en: "Children's Books", ar: "كتب الأطفال" },
];

/**
 * Category catalog — defaults to `DEFAULT_CATEGORIES`, then refreshed from
 * Appwrite on every server-side render via `updateCategories()`.
 * This keeps the navbar, footer, and book pages in sync with admin-managed
 * categories.
 */
export let CATEGORIES: CategoryInfo[] = DEFAULT_CATEGORIES;

/** Replace the in-memory category list (called from getServerSideProps). */
export function updateCategories(list: CategoryInfo[]): void {
  CATEGORIES = list;
}

/** Display name for a book category in the active locale (falls back to en). */
export function categoryName(category: string, locale: Locale): string {
  if (locale === "ar") {
    return CATEGORIES.find((c) => c.en === category)?.ar ?? category;
  }
  return category;
}
