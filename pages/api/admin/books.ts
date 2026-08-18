import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { runUploadMiddleware, uploadUrl, deleteUpload, type UploadedFile } from "@/lib/upload";
import { parseBookInput } from "@/lib/bookInput";

export const config = { api: { bodyParser: false } };

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const books = await db.books.getAll();
    return void res.status(200).json({ books });
  }

  if (req.method === "POST") {
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
    const book = await db.books.create({
      ...parsed.data,
      imageUrl: file ? uploadUrl(file.filename) : "",
      updatedAt: Date.now(),
    });

    // Record the initial stock so inventory history starts from day one.
    if (parsed.data.quantity > 0) {
      await db.inventoryLogs.create({
        bookId: book.id,
        change: parsed.data.quantity,
        reason: "Admin update",
      });
    }

    return void res.status(201).json({ message: "Book created", book });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
