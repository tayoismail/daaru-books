import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { recordRefund } from "@/lib/refunds";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const refunds = await db.refunds.getAll();
    // Optional ?orderId= filter (order-details modal shows one order's refunds).
    const orderId = Array.isArray(req.query.orderId)
      ? req.query.orderId[0]
      : req.query.orderId;
    const filtered =
      typeof orderId === "string" && orderId !== ""
        ? refunds.filter((refund) => refund.orderId === orderId)
        : refunds;
    return void res
      .status(200)
      .json({ refunds: filtered.sort((a, b) => b.date - a.date) });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const amount =
      typeof body.amount === "number"
        ? body.amount
        : typeof body.amount === "string" && body.amount.trim() !== ""
          ? Number(body.amount)
          : NaN;

    if (!orderId) {
      return void res.status(400).json({ error: "orderId is required" });
    }
    if (!reason) {
      return void res.status(400).json({ error: "Reason is required" });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return void res.status(400).json({ error: "Amount must be a positive number" });
    }

    // Date: optional; defaults to today. Accepts YYYY-MM-DD or epoch ms.
    let date: number;
    if (typeof body.date === "string" && body.date.trim() !== "") {
      const parsed = new Date(`${body.date.trim()}T00:00:00`).getTime();
      date = Number.isFinite(parsed) ? parsed : Date.now();
    } else if (typeof body.date === "number" && Number.isFinite(body.date)) {
      date = body.date;
    } else {
      date = Date.now();
    }

    const result = await recordRefund(orderId, { amount, reason, date });
    if (!result.ok) {
      return void res.status(400).json({ error: result.error });
    }
    return void res
      .status(201)
      .json({ message: "Refund recorded", refund: result.refund });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
