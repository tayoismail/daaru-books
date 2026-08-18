import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import type { CustomerRow } from "@/types";

/**
 * Customers derived from orders — covers both registered accounts and guest
 * checkout, since every order carries the customer's name/email/phone.
 * Cancelled orders are excluded from counts and totals.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  const orders = await db.orders.getAll();
  const map = new Map<string, CustomerRow>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const email = order.customerEmail.trim().toLowerCase();
    if (!email) continue;
    // Only paid orders count toward "total spent" — pending/failed orders
    // haven't generated money yet (matches the dashboard's revenue scope).
    const paid = order.paymentStatus === "paid";
    const existing = map.get(email);
    if (existing) {
      existing.orderCount += 1;
      if (paid) existing.totalSpent += order.total;
      if (order.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = order.createdAt;
        existing.name = order.customerName;
        existing.phone = order.customerPhone;
      }
    } else {
      map.set(email, {
        email,
        name: order.customerName,
        phone: order.customerPhone,
        orderCount: 1,
        totalSpent: paid ? order.total : 0,
        lastOrderAt: order.createdAt,
      });
    }
  }

  const customers = [...map.values()].sort(
    (a, b) => b.totalSpent - a.totalSpent || b.lastOrderAt - a.lastOrderAt
  );

  const summary = {
    customerCount: customers.length,
    orderCount: customers.reduce((sum, c) => sum + c.orderCount, 0),
    totalSpent: customers.reduce((sum, c) => sum + c.totalSpent, 0),
  };

  return void res.status(200).json({ customers, summary });
}

export default requireAuth(handler, "admin");
