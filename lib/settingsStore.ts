// NOTE: Server-only module (reads/writes data/settings.json via lib/db).

import { readJSON, writeJSON } from "@/lib/db";
import type { StoreSettings } from "@/types";

const FILE = "settings.json";

/** Built-in defaults — used when the settings file is missing/corrupt. */
export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: { en: "Daaru Kutubul Athaariyyah", ar: "دار الكتب الأثرية" },
  contactEmail: "hello@daarubooks.com",
  contactPhone: "+234 800 000 0000",
  whatsappNumber: "2349059806656",
  address: "12 Ahmadu Bello Way, Lagos, Nigeria",
  updatedAt: 0,
};

/** Current store settings (missing file → defaults). */
export async function readSettings(): Promise<StoreSettings> {
  try {
    const raw = await readJSON<Partial<StoreSettings>>(FILE);
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      storeName: { ...DEFAULT_SETTINGS.storeName, ...raw.storeName },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist store settings (atomic temp-file rename). */
export async function writeSettings(settings: StoreSettings): Promise<void> {
  await writeJSON(FILE, settings);
}
