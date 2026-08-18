import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";

/**
 * Quick restock: add copies to a book without opening the full edit form.
 * The change is logged to inventory history (reason defaults to "Restock").
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return void res.status(400).json({ error: "Missing book id" });
  }

  const body = (req.body ?? {}) as { quantity?: unknown; reason?: unknown };
  const quantity = typeof body.quantity === "number" ? body.quantity : NaN;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return void res
      .status(400)
      .json({ error: "Quantity must be a positive whole number" });
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim() !== ""
      ? body.reason.trim()
      : "Restock";

  const existing = await db.books.getById(id);
  if (!existing) {
    return void res.status(404).json({ error: "Book not found" });
  }

  const book = await db.books.update(id, {
    quantity: existing.quantity + quantity,
  });
  if (!book) {
    return void res.status(404).json({ error: "Book not found" });
  }

  await db.inventoryLogs.create({
    bookId: id,
    change: quantity,
    reason,
  });

  return void res.status(200).json({ message: "Stock updated", book });
}

export default requireAuth(handler, "admin");
