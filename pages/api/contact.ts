import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Spam deterrent: max 5 messages per 15 minutes per IP.
const MESSAGE_LIMIT = 5;
const MESSAGE_WINDOW_MS = 15 * 60 * 1000;

/** Public contact form — no auth needed. Stores the message in contacts.json. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  if (!rateLimit(clientIp(req), MESSAGE_LIMIT, MESSAGE_WINDOW_MS)) {
    return void res.status(429).json({ error: "Too many messages. Please try again later." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return void res
      .status(400)
      .json({ error: "Name, email and message are required" });
  }
  if (!EMAIL_RE.test(email)) {
    return void res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (message.length < 10) {
    return void res
      .status(400)
      .json({ error: "Your message must be at least 10 characters" });
  }

  await db.contacts.create({
    name,
    email,
    subject: subject || undefined,
    message,
  });

  return void res.status(201).json({ message: "Message sent" });
}
