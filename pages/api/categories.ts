import type { NextApiRequest, NextApiResponse } from "next";
import { readCategoryList } from "@/lib/categoryStore";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const categories = await readCategoryList();
  return void res.status(200).json({ categories });
}
