// NOTE: Server-only module. Reached through `lib/db.ts` (Node fs), so it must
// never be imported from client code — pages import it inside
// getServerSideProps with a dynamic import, exactly like `lib/db`.

import { getDb } from "@/lib/sqlite-schema";
import type { BilingualText, SlidesConfig, SlidesWelcome } from "@/types";

export const WELCOME_KEYS = [
  "badge",
  "title",
  "subtitle",
  "cta",
  "secondary",
  "searchPlaceholder",
  "searchButton",
  "newArrivalsBadge",
  "viewBook",
] as const;

const EMPTY_PAIR: BilingualText = { en: "", ar: "" };

/** Empty values everywhere = every part falls back to the built-in defaults
 * (newest-3 book slides, bundled banner images, locale JSON hero text). */
export const DEFAULT_SLIDES: SlidesConfig = {
  featuredBookIds: [],
  banners: [],
  autoplayMs: 6000,
  welcome: {
    enabled: true,
    badge: { ...EMPTY_PAIR },
    title: { ...EMPTY_PAIR },
    subtitle: { ...EMPTY_PAIR },
    cta: { ...EMPTY_PAIR },
    secondary: { ...EMPTY_PAIR },
    searchPlaceholder: { ...EMPTY_PAIR },
    searchButton: { ...EMPTY_PAIR },
    newArrivalsBadge: { ...EMPTY_PAIR },
    viewBook: { ...EMPTY_PAIR },
  },
};

function isPair(value: unknown): value is BilingualText {
  if (typeof value !== "object" || value === null) return false;
  const pair = value as Record<string, unknown>;
  return typeof pair.en === "string" && typeof pair.ar === "string";
}

/** Deep-merge a (possibly partial, older-format) stored config over the
 * defaults so missing keys never crash the storefront. */
function mergeSlides(raw: unknown): SlidesConfig {
  const source = (typeof raw === "object" && raw !== null
    ? raw
    : {}) as Partial<SlidesConfig>;
  const welcome: SlidesWelcome = {
    enabled:
      typeof source.welcome?.enabled === "boolean"
        ? source.welcome.enabled
        : true,
    badge: { ...EMPTY_PAIR },
    title: { ...EMPTY_PAIR },
    subtitle: { ...EMPTY_PAIR },
    cta: { ...EMPTY_PAIR },
    secondary: { ...EMPTY_PAIR },
    searchPlaceholder: { ...EMPTY_PAIR },
    searchButton: { ...EMPTY_PAIR },
    newArrivalsBadge: { ...EMPTY_PAIR },
    viewBook: { ...EMPTY_PAIR },
  };
  for (const key of WELCOME_KEYS) {
    if (isPair(source.welcome?.[key])) {
      welcome[key] = {
        en: source.welcome[key].en.trim(),
        ar: source.welcome[key].ar.trim(),
      };
    }
  }
  return {
    featuredBookIds: Array.isArray(source.featuredBookIds)
      ? source.featuredBookIds.filter((id) => typeof id === "string")
      : [],
    banners: Array.isArray(source.banners)
      ? source.banners.filter((url) => typeof url === "string")
      : [],
    autoplayMs:
      typeof source.autoplayMs === "number" && Number.isFinite(source.autoplayMs)
        ? Math.max(0, Math.min(60000, Math.round(source.autoplayMs)))
        : DEFAULT_SLIDES.autoplayMs,
    welcome,
  };
}

/** Current slides config — missing data (not seeded yet) yields defaults. */
export async function getSlidesConfig(): Promise<SlidesConfig> {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM "slides" WHERE id = ?`).get("main") as { data: string } | undefined;
  if (!row) {
    return mergeSlides(DEFAULT_SLIDES);
  }
  try {
    return mergeSlides(JSON.parse(row.data));
  } catch {
    return mergeSlides(DEFAULT_SLIDES);
  }
}

/** Persist the config to SQLite. */
export async function saveSlidesConfig(config: SlidesConfig): Promise<void> {
  const db = getDb();
  db.prepare(`INSERT OR REPLACE INTO "slides" (id, data) VALUES (?, ?)`).run(
    "main",
    JSON.stringify(config)
  );
}

// Serialize read-modify-write cycles on the config file, mirroring the
// per-collection write queues in lib/db.ts, so two concurrent banner
// uploads/removals cannot both read the same snapshot and drop an update.
let slidesWriteQueue: Promise<unknown> = Promise.resolve();

/**
 * Atomically read the config, apply `mutate`, and persist the result. The
 * returned config is the freshly-written value. Mutations are serialized. */
export function updateSlides(
  mutate: (config: SlidesConfig) => SlidesConfig
): Promise<SlidesConfig> {
  const run = async () => {
    const config = await getSlidesConfig();
    const next = mutate(config);
    await saveSlidesConfig(next);
    return next;
  };
  const result = slidesWriteQueue.then(run, run);
  slidesWriteQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export type SlidesInputResult =
  | { ok: true; data: SlidesConfig }
  | { ok: false; error: string };

const MAX_LEN = 500;

/** Validate + normalize a client-submitted slides config (PUT body). */
export function parseSlidesConfig(raw: unknown): SlidesInputResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid slides payload" };
  }
  const body = raw as Record<string, unknown>;

  const featuredBookIds = Array.isArray(body.featuredBookIds)
    ? [...new Set(
        body.featuredBookIds.filter(
          (id): id is string => typeof id === "string" && id.length <= 64
        )
      )]
    : [];

  const banners = Array.isArray(body.banners)
    ? body.banners.filter(
        (url): url is string =>
          typeof url === "string" &&
          url.startsWith("/") &&
          !url.includes("..") &&
          url.length <= 300
      )
    : [];

  let autoplayMs = 6000;
  if (typeof body.autoplayMs === "number" && Number.isFinite(body.autoplayMs)) {
    autoplayMs = Math.max(0, Math.min(60000, Math.round(body.autoplayMs)));
  }

  const welcomeRaw =
    typeof body.welcome === "object" && body.welcome !== null
      ? (body.welcome as Record<string, unknown>)
      : {};

  const welcome: SlidesWelcome = {
    enabled: typeof welcomeRaw.enabled === "boolean" ? welcomeRaw.enabled : true,
    badge: { en: "", ar: "" },
    title: { en: "", ar: "" },
    subtitle: { en: "", ar: "" },
    cta: { en: "", ar: "" },
    secondary: { en: "", ar: "" },
    searchPlaceholder: { en: "", ar: "" },
    searchButton: { en: "", ar: "" },
    newArrivalsBadge: { en: "", ar: "" },
    viewBook: { en: "", ar: "" },
  };
  const str = (value: unknown) =>
    typeof value === "string" ? value.trim().slice(0, MAX_LEN) : "";
  for (const key of WELCOME_KEYS) {
    const pair =
      typeof welcomeRaw[key] === "object" && welcomeRaw[key] !== null
        ? (welcomeRaw[key] as Record<string, unknown>)
        : {};
    welcome[key] = { en: str(pair.en), ar: str(pair.ar) };
  }

  return { ok: true, data: { featuredBookIds, banners, autoplayMs, welcome } };
}
