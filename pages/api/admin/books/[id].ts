import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { runUploadMiddleware, uploadUrl, deleteUpload, type UploadedFile } from "@/lib/upload";
import { parseBookInput } from "@/lib/bookInput";

export const config = { api: { bodyParser: false } };

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return void res.status(400).json({ error: "Missing book id" });
  }

  if (req.method === "PUT") {
    try {
      await runUploadMiddleware(req, res);
    } catch (error) {
      return void res
        .status(400)
        .json({ error: (error as Error).message || "Upload failed" });
    }

    const file = (req as NextApiRequest & { file?: UploadedFile }).file;
    const parsed = parseBookInput((req.body ?? {}) as Record<string, unknown>);
    if (!parsed.ok) {
      // A file may have been written before validation failed — remove it.
      if (file) deleteUpload(file.filename);
      return void res.status(400).json({ error: parsed.error });
    }

    const existing = await db.books.getById(id);
    if (!existing) {
      if (file) deleteUpload(file.filename);
      return void res.status(404).json({ error: "Book not found" });
    }
    const imageUrl = file ? uploadUrl(file.filename) : existing.imageUrl;
    const book = await db.books.update(id, {
      ...parsed.data,
      imageUrl,
    });
    if (!book) {
      return void res.status(404).json({ error: "Book not found" });
    }

    // A new upload replaced the previous cover — remove the old file.
    if (file && existing.imageUrl) {
      deleteUpload(existing.imageUrl);
    }

    // Inventory logging on quantity change (new - old), reason 'Admin update'.
    const change = parsed.data.quantity - existing.quantity;
    if (change !== 0) {
      await db.inventoryLogs.create({
        bookId: id,
        change,
        reason: "Admin update",
      });
    }

    return void res.status(200).json({ message: "Book updated", book });
  }

  if (req.method === "DELETE") {
    const existing = await db.books.getById(id);
    if (!existing) {
      return void res.status(404).json({ error: "Book not found" });
    }

    // Guard: refuse to delete a book that is part of pending/non-cancelled
    // orders — the order history would reference a ghost book.
    const orders = await db.orders.getAll();
    const hasActiveOrder = orders.some(
      (order) =>
        order.status !== "cancelled" &&
        order.items.some((item) => item.bookId === id)
    );
    if (hasActiveOrder) {
      return void res.status(409).json({
        error: "Cannot delete a book that has active orders. Cancel or complete its orders first.",
      });
    }

    const deleted = await db.books.remove(id);
    if (!deleted) {
      return void res.status(404).json({ error: "Book not found" });
    }
    // Remove the cover file so uploads don't accumulate orphaned files.
    if (existing.imageUrl) {
      deleteUpload(existing.imageUrl);
    }
    return void res.status(200).json({ message: "Book deleted" });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
