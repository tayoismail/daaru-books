import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { toSafeUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

// Spam deterrent: max 5 signups per hour per IP.
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  if (!rateLimit(clientIp(req), SIGNUP_LIMIT, SIGNUP_WINDOW_MS)) {
    return void res.status(429).json({ error: "Too many accounts. Please try again later." });
  }

  const { name, email, password } = (req.body ?? {}) as Record<string, unknown>;

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !name.trim() ||
    !email.trim()
  ) {
    return void res.status(400).json({ error: "Name, email and password are required" });
  }
  if (password.length < 6) {
    return void res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return void res
      .status(400)
      .json({ error: "Please enter a valid email address" });
  }

  const existing = await db.users.getByEmail(normalizedEmail);
  if (existing) {
    return void res
      .status(409)
      .json({ error: "An account with this email already exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await db.users.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hash,
    role: "customer",
  });

  return void res.status(201).json({
    message: "Account created",
    user: toSafeUser(user),
  });
}
