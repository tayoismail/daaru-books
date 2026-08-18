import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";
import { ensureAdmin } from "@/lib/ensureAdmin";
import { env } from "@/lib/env";
import type { User } from "@/types";

// Seed the default admin on the first server-side load of this module.
void ensureAdmin();

/** Name of the HttpOnly session cookie. */
export const AUTH_COOKIE = "daaru_token";
/** 7 days, in seconds. */
export const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export interface UserPayload {
  id: string;
  email: string;
  role: User["role"];
}

/** Strip the password hash — never send it to the client. */
export function toSafeUser(user: User): Omit<User, "password"> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function signToken(user: User): string {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not configured — add it to .env");
  }
  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): UserPayload {
  if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is not configured — add it to .env");
  }
  return jwt.verify(token, env.jwtSecret) as UserPayload;
}

/** Read and validate the session cookie, returning the full user or null. */
export async function getUserFromCookie(
  req: NextApiRequest
): Promise<User | null> {
  const token = req.cookies[AUTH_COOKIE];
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return await db.users.getById(payload.id);
  } catch {
    return null;
  }
}

export function setAuthCookie(
  req: NextApiRequest,
  res: NextApiResponse,
  token: string
): void {
  // Only mark Secure when the request actually arrived over HTTPS — browsers
  // silently reject Secure cookies set on plain http://localhost, which would
  // break local development and testing.
  const secure = req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}${
      secure ? "; Secure" : ""
    }`
  );
}

export function clearAuthCookie(res: NextApiResponse): void {
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export interface AuthenticatedRequest extends NextApiRequest {
  user: User;
}

type AuthedHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse
) => Promise<void> | void;

type ApiHandler = (
  req: NextApiRequest,
  res: NextApiResponse
) => Promise<void> | void;

/**
 * Wraps an API route to require a valid session. Pass `role` to restrict to
 * a specific role (e.g. "admin"). The resolved user is attached to `req.user`.
 */
export function requireAuth(handler: AuthedHandler, role?: User["role"]): ApiHandler {
  return async (req, res) => {
    const user = await getUserFromCookie(req);
    if (!user) {
      return void res.status(401).json({ error: "Unauthorized" });
    }
    if (role && user.role !== role) {
      return void res.status(403).json({ error: "Forbidden" });
    }
    (req as AuthenticatedRequest).user = user;
    return handler(req as AuthenticatedRequest, res);
  };
}
