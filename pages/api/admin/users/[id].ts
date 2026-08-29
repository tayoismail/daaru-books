import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest, toSafeUser } from "@/lib/auth";
import type { Role } from "@/types";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (typeof id !== "string") {
    return void res.status(400).json({ error: "Invalid user id" });
  }

  const user = await db.users.getById(id);
  if (!user) {
    return void res.status(404).json({ error: "User not found" });
  }

  // ── PATCH: update name, email, role ──────────────────────────────────
  if (req.method === "PATCH") {
    const { name, email, role } = (req.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if (typeof name === "string" && name.trim()) {
      patch.name = name.trim();
    }

    if (typeof email === "string" && email.trim()) {
      const normalized = email.trim().toLowerCase();
      if (normalized !== user.email) {
        const existing = await db.users.getByEmail(normalized);
        if (existing) {
          return void res
            .status(409)
            .json({ error: "Email is already taken" });
        }
        patch.email = normalized;
      }
    }

    if (role === "admin" || role === "customer") {
      patch.role = role as Role;
    }

    if (Object.keys(patch).length === 0) {
      return void res.status(400).json({ error: "No fields to update" });
    }

    const updated = await db.users.update(id, patch);
    return void res.status(200).json({ user: toSafeUser(updated!) });
  }

  // ── PUT: change password ─────────────────────────────────────────────
  if (req.method === "PUT") {
    const { password } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof password !== "string" || password.length < 6) {
      return void res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const hash = await bcrypt.hash(password, 10);
    const updated = await db.users.update(id, { password: hash });
    return void res
      .status(200)
      .json({ message: "Password updated", user: toSafeUser(updated!) });
  }

  // ── DELETE: remove user ──────────────────────────────────────────────
  if (req.method === "DELETE") {
    // Prevent self-deletion
    if (user.id === req.user.id) {
      return void res
        .status(400)
        .json({ error: "You cannot delete your own account" });
    }

    await db.users.remove(id);
    return void res.status(200).json({ message: "User deleted" });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
