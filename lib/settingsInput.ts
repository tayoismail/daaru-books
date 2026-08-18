// Client-safe module: pure parse/validate helpers for the Admin → Settings
// form. File I/O lives in lib/settingsStore.ts (server-only).

import type { StoreSettings } from "@/types";

export type SettingsInputResult =
  | { ok: true; data: StoreSettings }
  | { ok: false; error: string };

const MAX_LEN = 120;

/**
 * Normalize a WhatsApp number into international digits (e.g. 09059806656 →
 * 2349059806656, +1 (555) 123-4567 → 15551234567). Accepts leading "+",
 * spaces, dashes and parens.
 *
 * Nigerian-local conventions:
 *  - Leading 0 → prefix 234 (e.g. 0905... → 234905...)
 *  - 10-digit mobile starting with 80/81/70/71/90/91 → prefix 234
 */
export function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Already has an international code (length > 10 and doesn't start with 0).
  if (digits.length > 10 && !digits.startsWith("0")) return digits;
  // Bare Nigerian number with leading 0.
  if (digits.startsWith("0") && digits.length >= 10) return `234${digits.slice(1)}`;
  // 10-digit Nigerian mobile entered without a leading 0.
  if (digits.length === 10 && /^(80|81|70|71|90|91)/.test(digits)) return `234${digits}`;
  // Fallback — return digits as-is (caller validates length).
  return digits;
}

/** Parse + validate the admin settings form (JSON body). */
export function parseSettingsInput(raw: unknown): SettingsInputResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid settings payload" };
  }
  const body = raw as Record<string, unknown>;
  const str = (value: unknown) =>
    typeof value === "string" ? value.trim().slice(0, MAX_LEN) : "";

  const storeNameEn = str(body.storeNameEn);
  const storeNameAr = str(body.storeNameAr);
  const contactEmail = str(body.contactEmail);
  const contactPhone = str(body.contactPhone);
  const whatsappRaw = str(body.whatsappNumber);
  const address = str(body.address);

  if (!storeNameEn) return { ok: false, error: "Store name (English) is required" };
  if (!storeNameAr) return { ok: false, error: "Store name (Arabic) is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Please enter a valid contact email" };
  }
  if (!contactPhone) return { ok: false, error: "Contact phone is required" };

  const whatsappNumber = normalizeWhatsapp(whatsappRaw);
  if (!whatsappNumber) {
    return { ok: false, error: "WhatsApp number is required" };
  }
  if (whatsappNumber.length < 10 || whatsappNumber.length > 15) {
    return { ok: false, error: "WhatsApp number looks invalid" };
  }

  if (!address) return { ok: false, error: "Address is required" };

  return {
    ok: true,
    data: {
      storeName: { en: storeNameEn, ar: storeNameAr },
      contactEmail,
      contactPhone,
      whatsappNumber,
      address,
      updatedAt: Date.now(),
    },
  };
}
