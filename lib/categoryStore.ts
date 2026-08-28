// NOTE: Server-only module (reads/writes the categories via Appwrite).
// Kept separate from lib/categoryInput.ts so the pure validation helpers can
// be imported safely by client code.

import { db } from "@/lib/db";
import type { CategoryInfo } from "@/lib/categories";

/** Current category list (in display order). */
export async function readCategoryList(): Promise<CategoryInfo[]> {
  return db.categories.getAll();
}

/** Persist the category list (atomic delete-all + re-insert). */
export async function writeCategoryList(list: CategoryInfo[]): Promise<void> {
  await db.categories.replaceAll(list);
}
