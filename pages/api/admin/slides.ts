import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { getSlidesConfig, parseSlidesConfig, saveSlidesConfig } from "@/lib/slides";
import type { SlidesConfig } from "@/types";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const slides = await getSlidesConfig();
    return void res.status(200).json({ slides });
  }

  if (req.method === "PUT") {
    const parsed = parseSlidesConfig(req.body);
    if (!parsed.ok) {
      return void res.status(400).json({ error: parsed.error });
    }
    // Drop ids that no longer exist so the config never points at ghosts.
    const books = await db.books.getAll();
    const existingIds = new Set(books.map((book) => book.id));
    const data: SlidesConfig = {
      ...parsed.data,
      featuredBookIds: parsed.data.featuredBookIds.filter((id) =>
        existingIds.has(id)
      ),
    };
    await saveSlidesConfig(data);
    return void res.status(200).json({ message: "Slides saved", slides: data });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
