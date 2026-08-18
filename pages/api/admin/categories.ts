import type { NextApiResponse } from "next";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { readCategoryList, writeCategoryList } from "@/lib/categoryStore";
import { generateSlug, parseCategoryInput } from "@/lib/categoryInput";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const categories = await readCategoryList();
    return void res.status(200).json({ categories });
  }

  if (req.method === "POST") {
    const parsed = parseCategoryInput(req.body);
    if (!parsed.ok) {
      return void res.status(400).json({ error: parsed.error });
    }
    const slug = generateSlug(parsed.data.en);
    const categories = await readCategoryList();
    if (categories.some((category) => category.slug === slug)) {
      return void res
        .status(400)
        .json({ error: "A category with this English name already exists" });
    }
    categories.push({ slug, ...parsed.data });
    await writeCategoryList(categories);
    return void res.status(201).json({
      message: "Category added",
      category: categories[categories.length - 1],
    });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
