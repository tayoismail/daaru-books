import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest, toSafeUser } from "@/lib/auth";
import type { Role } from "@/types";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const users = await db.users.getAll();
    return void res.status(200).json({ users: users.map(toSafeUser) });
  }

  if (req.method === "POST") {
    const { name, email, password, role } = (req.body ?? {}) as Record<
      string,
      unknown
    >;

    if (typeof name !== "string" || !name.trim()) {
      return void res.status(400).json({ error: "Name is required" });
    }
    if (typeof email !== "string" || !email.trim()) {
      return void res.status(400).json({ error: "Email is required" });
    }
    if (typeof password !== "string" || password.length < 6) {
      return void res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.users.getByEmail(normalizedEmail);
    if (existing) {
      return void res
        .status(409)
        .json({ error: "A user with this email already exists" });
    }

    const validRole: Role = role === "admin" ? "admin" : "customer";
    const hash = await bcrypt.hash(password, 10);
    const user = await db.users.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hash,
      role: validRole,
    });

    return void res.status(201).json({ message: "User created", user: toSafeUser(user) });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
