import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { parseExpenseInput } from "@/lib/expenseInput";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const expenses = await db.expenses.getAll();
    return void res.status(200).json({ expenses });
  }

  if (req.method === "POST") {
    const parsed = parseExpenseInput((req.body ?? {}) as Record<string, unknown>);
    if (!parsed.ok) {
      return void res.status(400).json({ error: parsed.error });
    }
    const expense = await db.expenses.create(parsed.data);
    return void res.status(201).json({ message: "Expense added", expense });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
