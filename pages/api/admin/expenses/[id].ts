import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { parseExpenseInput } from "@/lib/expenseInput";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return void res.status(400).json({ error: "Missing expense id" });
  }

  if (req.method === "PUT") {
    const parsed = parseExpenseInput((req.body ?? {}) as Record<string, unknown>);
    if (!parsed.ok) {
      return void res.status(400).json({ error: parsed.error });
    }
    const expense = await db.expenses.update(id, parsed.data);
    if (!expense) {
      return void res.status(404).json({ error: "Expense not found" });
    }
    return void res.status(200).json({ message: "Expense updated", expense });
  }

  if (req.method === "DELETE") {
    const deleted = await db.expenses.remove(id);
    if (!deleted) {
      return void res.status(404).json({ error: "Expense not found" });
    }
    return void res.status(200).json({ message: "Expense deleted" });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
