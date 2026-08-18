import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { parseTestimonialInput } from "@/lib/testimonialInput";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const testimonials = await db.testimonials.getAll();
    return void res.status(200).json({ testimonials });
  }

  if (req.method === "POST") {
    const parsed = parseTestimonialInput(req.body);
    if (!parsed.ok) {
      return void res.status(400).json({ error: parsed.error });
    }
    const testimonial = await db.testimonials.create(parsed.data);
    return void res
      .status(201)
      .json({ message: "Testimonial added", testimonial });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
