import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expenseInput";

/** "Rent & Utilities" → "rent-utilities" (used as the category id). */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Unique id against the current category list (appends -2, -3, …). */
async function uniqueId(base: string): Promise<string> {
  const categories = await db.expenseCategories.getAll();
  const existing = new Set(categories.map((category) => category.id));
  let id = base;
  let counter = 2;
  while (existing.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  return id;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const categories = await db.expenseCategories.getAll();
    // Fresh deployments without the seed file still get a working list.
    const list =
      categories.length > 0 ? categories : DEFAULT_EXPENSE_CATEGORIES;
    return void res.status(200).json({ categories: list });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";
    const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
    if (!nameEn) {
      return void res.status(400).json({ error: "English name is required" });
    }
    if (!nameAr) {
      return void res.status(400).json({ error: "Arabic name is required" });
    }
    const id = await uniqueId(slugify(nameEn));
    const category = await db.expenseCategories.create({ id, nameEn, nameAr });
    return void res.status(201).json({ message: "Category added", category });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
