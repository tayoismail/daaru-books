import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { readCategoryList, writeCategoryList } from "@/lib/categoryStore";
import { parseCategoryInput } from "@/lib/categoryInput";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
  if (!slug) {
    return void res.status(400).json({ error: "Missing category slug" });
  }

  if (req.method === "PUT") {
    const parsed = parseCategoryInput(req.body);
    if (!parsed.ok) {
      return void res.status(400).json({ error: parsed.error });
    }
    const categories = await readCategoryList();
    const index = categories.findIndex((category) => category.slug === slug);
    if (index === -1) {
      return void res.status(404).json({ error: "Category not found" });
    }
    const previous = categories[index];
    categories[index] = { ...previous, ...parsed.data };
    await writeCategoryList(categories);

    // Renaming the English name would orphan every book using it — keep the
    // book-to-category mapping intact by cascading the rename.
    if (previous.en !== parsed.data.en) {
      const books = await db.books.getAll();
      for (const book of books) {
        if (book.category === previous.en) {
          await db.books.update(book.id, { category: parsed.data.en });
        }
      }
    }
    return void res
      .status(200)
      .json({ message: "Category updated", category: categories[index] });
  }

  if (req.method === "DELETE") {
    const categories = await readCategoryList();
    const target = categories.find((category) => category.slug === slug);
    if (!target) {
      return void res.status(404).json({ error: "Category not found" });
    }
    // Never allow deleting a category that still has books — the admin must
    // move or delete those books first.
    const books = await db.books.getAll();
    const count = books.filter((book) => book.category === target.en).length;
    if (count > 0) {
      return void res.status(400).json({
        error: `${count} book${count === 1 ? "" : "s"} still use this category. Move or delete them first.`,
      });
    }
    await writeCategoryList(
      categories.filter((category) => category.slug !== slug)
    );
    return void res.status(200).json({ message: "Category deleted" });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
