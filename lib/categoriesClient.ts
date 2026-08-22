// Client-safe module: fetches /api/categories and returns the live list.
// Modeled after settingsClient.ts — keeps lib/db out of the client bundle.

import type { NextPageContext } from "next";
import type { CategoryInfo } from "@/lib/categories";

/**
 * Fetch the current category list. On the server the URL is absolute; on the
 * client a relative fetch works.
 */
export async function fetchCategories(
  ctx?: NextPageContext
): Promise<CategoryInfo[]> {
  try {
    const req = ctx?.req;
    let url = "/api/categories";
    if (req?.headers?.host) {
      const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
      url = `${proto}://${req.headers.host}/api/categories`;
    }
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { categories?: CategoryInfo[] };
    return data.categories ?? [];
  } catch {
    return [];
  }
}
