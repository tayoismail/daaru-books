// NOTE: Server-only module (reads/writes settings via Appwrite).

import { adminTablesDB } from "@/lib/appwrite/server";
import { env } from "@/lib/env";
import type { StoreSettings } from "@/types";

const DB_ID = env.appwriteDatabaseId;
const CONFIG_COL = "config";

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
  try {
    const doc = await adminTablesDB.getRow(DB_ID, CONFIG_COL, "settings-config");
    const data = (doc as Record<string, unknown>).data;
    if (typeof data === "string") {
      const raw = JSON.parse(data) as Partial<StoreSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...raw,
        storeName: { ...DEFAULT_SETTINGS.storeName, ...raw.storeName },
      };
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Persist store settings to Appwrite. */
export async function writeSettings(settings: StoreSettings): Promise<void> {
  try {
    await adminTablesDB.updateRow(DB_ID, CONFIG_COL, "settings-config", {
      data: JSON.stringify(settings),
    });
  } catch {
    // Document doesn't exist yet — create it
    await adminTablesDB.createRow(DB_ID, CONFIG_COL, "settings-config", {
      data: JSON.stringify(settings),
    });
  }
}
