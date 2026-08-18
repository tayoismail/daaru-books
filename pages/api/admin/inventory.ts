import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import type { InventoryBookOption, InventoryLogRow } from "@/types";

/** Inventory history with joined book titles, newest first. */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  const [logs, books] = await Promise.all([
    db.inventoryLogs.getAll(),
    db.books.getAll(),
  ]);
  const bookMap = new Map(books.map((book) => [book.id, book]));

  const rows: InventoryLogRow[] = logs
    .map((log) => {
      const book = bookMap.get(log.bookId);
      return {
        ...log,
        bookTitleEn: book?.titleEn ?? "",
        bookTitleAr: book?.titleAr ?? "",
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const options: InventoryBookOption[] = books
    .map((book) => ({
      id: book.id,
      titleEn: book.titleEn,
      titleAr: book.titleAr,
    }))
    .sort((a, b) => a.titleEn.localeCompare(b.titleEn));

  return void res.status(200).json({ logs: rows, books: options });
}

export default requireAuth(handler, "admin");
