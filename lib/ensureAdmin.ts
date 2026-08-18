import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123";

let checked = false;

/**
 * Ensure the default admin exists. Idempotent — runs once per server process
 * (guarded by `checked`) and is a no-op when users.json already contains the
 * admin account. Wired into `lib/auth.ts` module load.
 */
export async function ensureAdmin(): Promise<void> {
  if (checked) return;
  checked = true;
  try {
    const existing = await db.users.getByEmail(ADMIN_EMAIL);
    if (existing) return;
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.users.create({
      name: "Store Admin",
      email: ADMIN_EMAIL,
      password: hash,
      role: "admin",
    });
    console.log(`[seed] Created default admin (${ADMIN_EMAIL})`);
  } catch (error) {
    console.error("[seed] Failed to ensure admin user:", error);
  }
}
