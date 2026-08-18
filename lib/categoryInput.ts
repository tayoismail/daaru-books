// Client-safe module: pure slug/validation helpers only. The file read/write
// helpers live in lib/categoryStore.ts (server-only) so this module can be
// imported by admin UI code for live slug previews.

import type { CategoryInfo } from "@/lib/categories";

/** URL-safe slug from an English category name (e.g. "Quran & Tafsir" →
 * "quran-tafsir"). Ampersands and other non-alphanumerics become hyphens. */
export function generateSlug(en: string): string {
  return en
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type CategoryInputResult =
  | { ok: true; data: { en: string; ar: string } }
  | { ok: false; error: string };

const MAX_LEN = 60;

/** Parse + validate the category add/edit form (JSON body). */
export function parseCategoryInput(raw: unknown): CategoryInputResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid category payload" };
  }
  const body = raw as Record<string, unknown>;
  const en = typeof body.en === "string" ? body.en.trim().slice(0, MAX_LEN) : "";
  const ar = typeof body.ar === "string" ? body.ar.trim().slice(0, MAX_LEN) : "";

  if (!en) {
    return { ok: false, error: "English name is required" };
  }
  if (!generateSlug(en)) {
    return { ok: false, error: "English name must contain at least one letter" };
  }
  if (!ar) {
    return { ok: false, error: "Arabic name is required" };
  }
  return { ok: true, data: { en, ar } };
}

export type { CategoryInfo };
