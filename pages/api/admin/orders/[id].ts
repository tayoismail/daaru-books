import type { NextApiResponse } from "next";
import { db } from "@/lib/db";
import { requireAuth, type AuthenticatedRequest } from "@/lib/auth";
import { sendOrderShippedEmail } from "@/lib/email";
import { reduceStockForOrder } from "@/lib/orders";
import { recordRefund, refundedTotalFor } from "@/lib/refunds";
import type { OrderStatus, PaymentStatus } from "@/types";

const STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];
const PAYMENTS: PaymentStatus[] = ["unpaid", "paid", "failed"];

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!id) {
    return void res.status(400).json({ error: "Missing order id" });
  }

  if (req.method === "GET") {
    const order = await db.orders.getById(id);
    if (!order) {
      return void res.status(404).json({ error: "Order not found" });
    }
    return void res.status(200).json({ order });
  }

  if (req.method === "PUT") {
    const body = (req.body ?? {}) as {
      status?: unknown;
      paymentStatus?: unknown;
      trackingNumber?: unknown;
      deliveryFee?: unknown;
    };

    if (body.status !== undefined && !STATUSES.includes(body.status as OrderStatus)) {
      return void res.status(400).json({ error: "Invalid order status" });
    }
    if (
      body.paymentStatus !== undefined &&
      !PAYMENTS.includes(body.paymentStatus as PaymentStatus)
    ) {
      return void res.status(400).json({ error: "Invalid payment status" });
    }
    if (body.trackingNumber !== undefined && typeof body.trackingNumber !== "string") {
      return void res.status(400).json({ error: "Tracking number must be a string" });
    }
    if (
      body.deliveryFee !== undefined &&
      (typeof body.deliveryFee !== "number" ||
        !Number.isFinite(body.deliveryFee) ||
        body.deliveryFee < 0)
    ) {
      return void res
        .status(400)
        .json({ error: "Delivery fee must be a non-negative number" });
    }
    if (
      body.status === undefined &&
      body.paymentStatus === undefined &&
      body.trackingNumber === undefined &&
      body.deliveryFee === undefined
    ) {
      return void res.status(400).json({
        error: "Provide a status, paymentStatus, trackingNumber or deliveryFee to update",
      });
    }

    const existing = await db.orders.getById(id);
    if (!existing) {
      return void res.status(404).json({ error: "Order not found" });
    }

    // A cancelled order's stock was already returned on cancellation (paid
    // orders are auto-refunded + restocked), so marking one as paid would
    // reduce stock a second time for an order that is no longer in the
    // pipeline. The same check covers a single request that sets both
    // status: "cancelled" and paymentStatus: "paid" at once.
    if (
      body.paymentStatus === "paid" &&
      (existing.status === "cancelled" || body.status === "cancelled")
    ) {
      return void res
        .status(400)
        .json({ error: "A cancelled order cannot be marked as paid" });
    }

    // Trim empty tracking strings to undefined so the field is not stored as
    // "" (a cleared tracking number is treated as unset everywhere).
    const trackingNumber =
      body.trackingNumber === undefined
        ? undefined
        : String(body.trackingNumber).trim() || undefined;

    const order = await db.orders.update(id, {
      ...(body.status !== undefined ? { status: body.status as OrderStatus } : {}),
      ...(body.paymentStatus !== undefined
        ? { paymentStatus: body.paymentStatus as PaymentStatus }
        : {}),
      ...(body.trackingNumber !== undefined
        ? { trackingNumber }
        : {}),
      ...(body.deliveryFee !== undefined ? { deliveryFee: body.deliveryFee } : {}),
    });
    if (!order) {
      return void res.status(404).json({ error: "Order not found" });
    }

    // Notify the customer by email when the order is marked as shipped AND a
    // tracking number is available. Fired without awaiting so a slow email
    // provider never delays the admin's response; send failures are logged
    // inside lib/email and never affect the status update.
    if (order && order.status === "shipped" && order.trackingNumber) {
      void sendOrderShippedEmail(order);
    }

    // Marking an unpaid order as paid (e.g. a bank-transfer order settled
    // manually) must reduce stock exactly like the payment webhook does;
    // otherwise the paid order's books never leave inventory. This runs only
    // AFTER the order update has succeeded (so a failed update can never
    // leave stock reduced without a paid order), and only when the order was
    // actually unpaid before — orders already paid were settled earlier
    // (webhook, reconciliation, or a previous admin call), keeping the
    // action idempotent.
    if (body.paymentStatus === "paid" && existing.paymentStatus !== "paid") {
      await reduceStockForOrder(
        existing,
        `Paid order ${existing.paymentReference} (admin)`
      );
    }

    // Cancelling a paid order is a full refund: record the remaining amount
    // so the money-out shows in P&L, and recordRefund returns the books to
    // stock. Unpaid orders never had stock reduced or money collected, so no
    // refund is created for them.
    if (body.status === "cancelled" && existing.paymentStatus === "paid") {
      const alreadyRefunded = await refundedTotalFor(existing.id);
      const remaining = existing.total - alreadyRefunded;
      if (remaining > 0) {
        try {
          await recordRefund(existing.id, {
            amount: remaining,
            reason: "Order cancelled",
            date: Date.now(),
          });
        } catch (error) {
          console.error("[orders] failed to auto-refund cancelled order", error);
        }
      }
    }

    return void res.status(200).json({ message: "Order updated", order });
  }

  return void res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler, "admin");
