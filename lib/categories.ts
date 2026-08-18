import categories from "../data/categories.json";
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
 * Category catalog — seeded from `data/categories.json` at import time, then
 * refreshed from SQLite on every server-side render via `updateCategories()`.
 * This keeps the navbar, footer, and book pages in sync with admin-managed
 * categories.
 */
export let CATEGORIES: CategoryInfo[] = categories as CategoryInfo[];

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
