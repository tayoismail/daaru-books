import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { parseTestimonialInput } from "@/lib/testimonialInput";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return void res.status(400).json({ error: "Missing testimonial id" });
  }

  if (req.method === "PUT") {
    const parsed = parseTestimonialInput(req.body);
    if (!parsed.ok) {
      return void res.status(400).json({ error: parsed.error });
    }
    const testimonial = await db.testimonials.update(id, parsed.data);
    if (!testimonial) {
      return void res.status(404).json({ error: "Testimonial not found" });
    }
    return void res
      .status(200)
      .json({ message: "Testimonial updated", testimonial });
  }

  if (req.method === "DELETE") {
    const removed = await db.testimonials.remove(id);
    if (!removed) {
      return void res.status(404).json({ error: "Testimonial not found" });
    }
    return void res.status(200).json({ message: "Testimonial deleted" });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
