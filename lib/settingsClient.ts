// Client-safe module: fetches /api/settings and overrides the i18n resource
// keys so the store name/contact details flow through every page. Called from
// _app.getInitialProps so the overrides are applied BEFORE first render on
// both the server (SSR HTML + SEO tags) and the client (hydration) — no flash
// of the default branding.

import type { NextPageContext } from "next";
import i18n, { LOCALES } from "@/lib/i18n";
import type { StoreSettings } from "@/types";

/**
 * Fetch the store settings. On the server the URL is absolute (built from the
 * incoming request); on the client a relative fetch works.
 */
export async function fetchSettings(ctx?: NextPageContext): Promise<StoreSettings | null> {
  try {
    const req = ctx?.req;
    let url = "/api/settings";
    if (req?.headers?.host) {
      const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
      url = `${proto}://${req.headers.host}/api/settings`;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { settings?: StoreSettings };
    return data.settings ?? null;
  } catch {
    return null;
  }
}

/**
 * Override the i18n resource keys that the storefront reads for branding +
 * contact details (`appName`, `contact.*`, `whatsapp.number`). react-i18next
 * re-renders all `useTranslation` consumers on the store's "added" event, so
 * a save in Admin → Settings is picked up site-wide.
 */
export function applySettingsToI18n(settings: StoreSettings) {
  for (const locale of LOCALES) {
    i18n.addResource(locale, "common", "appName", settings.storeName[locale]);
    i18n.addResource(locale, "common", "contact.email", settings.contactEmail);
    i18n.addResource(locale, "common", "contact.phone", settings.contactPhone);
    i18n.addResource(locale, "common", "contact.address", settings.address);
    i18n.addResource(locale, "common", "whatsapp.number", settings.whatsappNumber);
  }
}

/** Fetch + apply store settings before a page renders (server side + soft
 * navigations). Returns the settings so callers can pass them to the client
 * for the initial hydration render. */
export async function loadSettings(ctx?: NextPageContext): Promise<StoreSettings | null> {
  const settings = await fetchSettings(ctx);
  if (settings) applySettingsToI18n(settings);
  return settings;
}
