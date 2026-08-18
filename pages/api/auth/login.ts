import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setAuthCookie, signToken, toSafeUser } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

// Brute-force deterrent: max 10 login attempts per 15 minutes per IP.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  if (!rateLimit(clientIp(req), LOGIN_LIMIT, LOGIN_WINDOW_MS)) {
    return void res.status(429).json({ error: "Too many attempts. Please try again later." });
  }

  const { email, password } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return void res.status(400).json({ error: "Email and password are required" });
  }

  const user = await db.users.getByEmail(email.trim().toLowerCase());
  // Compare against a dummy hash even when the user is missing, to keep
  // response timing roughly uniform and avoid user-enumeration via timing.
  const DUMMY_HASH =
    "$2b$10$VYfwehFF/ZTsy2.oYHWK7e5IdBVF9M2Y8nBWg6p4.fiaRidLXvj8S";
  const hash = user?.password ?? DUMMY_HASH;
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) {
    return void res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user);
  setAuthCookie(req, res, token);

  return void res.status(200).json({
    message: "Signed in",
    user: toSafeUser(user),
  });
}
