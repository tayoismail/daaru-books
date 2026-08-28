import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { adminTablesDB } from "@/lib/appwrite/server";
import type { Book, Order } from "@/types";

// NOTE: Server-only module (imports lib/env). Never import from client code.

/** Unique payment reference in the format ORDER-{timestamp}-{random}. */
export function generatePaymentReference(): string {
  return `ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// In-process lock so concurrent settleOrder calls for the same reference
// (e.g. a webhook arriving while the success page reconciles) cannot both
// read the pre-payment snapshot and double-reduce stock. Single-instance
// only — a multi-instance deployment needs an atomic compare-and-set on the
// order record instead.
const settling = new Map<string, Promise<Order | null>>();

/**
 * Reduce book stock for a paid order and record inventory logs. Used by the
 * payment webhook, the success-page reconciliation, and the admin
 * "Mark as Paid" action so all three paths stay in sync.
 */
export async function reduceStockForOrder(order: Order, reason: string): Promise<void> {
  for (const item of order.items) {
    if (item.quantity <= 0) continue;
    // Read current stock, compute new value, update
    const book = await db.books.getById(item.bookId);
    if (book) {
      const newQty = Math.max(0, book.quantity - item.quantity);
      await db.books.update(item.bookId, {
        quantity: newQty,
        updatedAt: Date.now(),
      } as Partial<Book>);
    }
    await db.inventoryLogs.create({
      bookId: item.bookId,
      change: -item.quantity,
      reason,
    });
  }
}

async function doSettle(
  paymentReference: string,
  expectedAmount?: number,
  paymentMethod?: string
): Promise<Order | null> {
  const orders = await db.orders.getAll();
  const order = orders.find((o) => o.paymentReference === paymentReference);
  if (!order) return null;
  if (order.paymentStatus === "paid") return order;

  // Amount-tampering defense: never settle an order whose charged amount does
  // not match its stored total.
  if (
    typeof expectedAmount === "number" &&
    order.total !== expectedAmount
  ) {
    console.warn(
      `[orders] amount mismatch for ${paymentReference}: expected ${expectedAmount}, order total ${order.total} — settlement skipped`
    );
    return order;
  }

  await reduceStockForOrder(order, `Paid order ${paymentReference}`);

  return db.orders.update(order.id, {
    status: "processing",
    paymentStatus: "paid",
    // Record the payment channel (card / bank_transfer / ussd / …) from the
    // webhook payload so settlement reports can break totals down by method.
    ...(typeof paymentMethod === "string" && paymentMethod.trim() !== ""
      ? { paymentMethod: paymentMethod.trim() }
      : {}),
  });
}

/**
 * Mark a paid order as processing, reduce book stock, and log inventory
 * changes. Idempotent: an order already `paid` is returned untouched, so a
 * replayed webhook (or a re-run reconciliation) cannot double-settle. Pass
 * `expectedAmount` (the charged amount) to refuse settling orders whose
 * total does not match the charge. `paymentMethod` (e.g. "card") is stored
 * on the order when provided.
 */
export function settleOrder(
  paymentReference: string,
  expectedAmount?: number,
  paymentMethod?: string
): Promise<Order | null> {
  const existing = settling.get(paymentReference);
  if (existing) return existing;
  const run = doSettle(paymentReference, expectedAmount, paymentMethod).finally(() =>
    settling.delete(paymentReference)
  );
  settling.set(paymentReference, run);
  return run;
}

/**
 * Server-side payment verification via the Flutterwave API. Returns true only
 * when Flutterwave confirms a successful charge for this transaction
 * reference. Returns false when the secret key is missing or the API is
 * unreachable — callers should treat that as "unconfirmed", never "paid".
 */
export async function verifyFlutterwaveTransaction(
  txRef: string
): Promise<boolean> {
  const secret = env.flutterwaveSecretKey;
  if (!secret) return false;
  try {
    // Abort after 8s so a hung Flutterwave API can never block a page render.
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) return false;
    const json = (await response.json()) as {
      status?: string;
      data?: { status?: string };
    };
    return json.status === "success" && json.data?.status === "successful";
  } catch {
    return false;
  }
}
