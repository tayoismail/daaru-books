// NOTE: Server-only module (reads/writes settings via SQLite).

import { getDb } from "@/lib/sqlite-schema";
import type { StoreSettings } from "@/types";

/** Built-in defaults — used when the settings row is missing/corrupt. */
export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: { en: "Daaru Kutubul Athaariyyah", ar: "دار الكتب الأثرية" },
  contactEmail: "hello@daarubooks.com",
  contactPhone: "+234 800 000 0000",
  whatsappNumber: "2349059806656",
  address: "12 Ahmadu Bello Way, Lagos, Nigeria",
  updatedAt: 0,
};

/** Current store settings (missing row → defaults). */
export async function readSettings(): Promise<StoreSettings> {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM "settings" WHERE id = ?`).get("main") as { data: string } | undefined;
  if (!row) {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = JSON.parse(row.data) as Partial<StoreSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      storeName: { ...DEFAULT_SETTINGS.storeName, ...raw.storeName },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist store settings to SQLite. */
export async function writeSettings(settings: StoreSettings): Promise<void> {
  const db = getDb();
  db.prepare(`INSERT OR REPLACE INTO "settings" (id, data) VALUES (?, ?)`).run(
    "main",
    JSON.stringify(settings)
  );
}
