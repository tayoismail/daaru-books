import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import type { ExpenseCategoryDef } from "@/types";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return void res.status(400).json({ error: "Missing category id" });
  }

  if (req.method === "PUT") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const nameEn = typeof body.nameEn === "string" ? body.nameEn.trim() : "";
    const nameAr = typeof body.nameAr === "string" ? body.nameAr.trim() : "";
    if (!nameEn) {
      return void res.status(400).json({ error: "English name is required" });
    }
    if (!nameAr) {
      return void res.status(400).json({ error: "Arabic name is required" });
    }
    const category = await db.expenseCategories.update(id, {
      nameEn,
      nameAr,
    } as Partial<Omit<ExpenseCategoryDef, "id" | "createdAt">>);
    if (!category) {
      return void res.status(404).json({ error: "Category not found" });
    }
    return void res.status(200).json({ message: "Category updated", category });
  }

  if (req.method === "DELETE") {
    const expenses = await db.expenses.getAll();
    if (expenses.some((expense) => expense.category === id)) {
      return void res.status(409).json({
        error: "This category is used by existing expenses. Reassign those expenses first.",
      });
    }
    const deleted = await db.expenseCategories.remove(id);
    if (!deleted) {
      return void res.status(404).json({ error: "Category not found" });
    }
    return void res.status(200).json({ message: "Category deleted" });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
