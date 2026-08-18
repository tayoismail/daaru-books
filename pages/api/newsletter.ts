import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Spam deterrent: max 5 subscriptions per 10 minutes per IP.
const SUBSCRIBE_LIMIT = 5;
const SUBSCRIBE_WINDOW_MS = 10 * 60 * 1000;

/** Public newsletter subscribe — no auth needed. Dedupes by email. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  if (!rateLimit(clientIp(req), SUBSCRIBE_LIMIT, SUBSCRIBE_WINDOW_MS)) {
    return void res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(email)) {
    return void res.status(400).json({ error: "Please enter a valid email address" });
  }

  const existing = await db.newsletter.getByEmail(email);
  if (existing) {
    // Already subscribed — treat as success (idempotent).
    return void res.status(200).json({ message: "Already subscribed" });
  }

  await db.newsletter.create({ email });
  return void res.status(201).json({ message: "Subscribed" });
}
