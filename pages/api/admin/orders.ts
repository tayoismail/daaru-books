import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import type { OrderStatus } from "@/types";

const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

/** Parse a query value into an epoch-ms timestamp, or null when absent/garbage. */
function parseTime(value: string | string[] | undefined): number | null {
  if (Array.isArray(value)) value = value[0];
  if (!value) return null;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { query } = req;
    const status =
      typeof query.status === "string" && VALID_STATUSES.includes(query.status as OrderStatus)
        ? (query.status as OrderStatus)
        : null;
    const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
    const from = parseTime(query.from);
    const to = parseTime(query.to);

    const orders = await db.orders.getAll();
    const filtered = orders
      .filter((order) => {
        if (status && order.status !== status) return false;
        if (search) {
          const name = order.customerName.toLowerCase();
          const email = order.customerEmail.toLowerCase();
          if (!name.includes(search) && !email.includes(search)) return false;
        }
        if (from && order.createdAt < from) return false;
        if (to && order.createdAt > to) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    return void res.status(200).json({ orders: filtered });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
