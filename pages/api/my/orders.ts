import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";

/**
 * GET /api/my/orders — returns all orders belonging to the logged-in user,
 * sorted newest first. The userId link was established at checkout when the
 * account was auto-created. Orders placed before the userId field existed
 * won't appear here (they were guest checkouts without an account).
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  const allOrders = await db.orders.getAll();
  const myOrders = allOrders
    .filter((o) => o.userId === req.user.id)
    .sort((a, b) => b.createdAt - a.createdAt);

  return void res.status(200).json({ orders: myOrders });
}

// Any authenticated user (customer or admin) can view their own orders.
export default requireAuth(handler);
