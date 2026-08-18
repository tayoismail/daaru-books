// NOTE: Server-only module (imports lib/db). Shared by the refunds API
// routes and the order update route (auto-refund on cancellation) so both
// paths enforce the same rules and keep stock in sync.

import { db } from "@/lib/db";
import { getDb } from "@/lib/sqlite-schema";
import type { Refund } from "@/types";

export interface RefundInput {
  amount: number;
  reason: string;
  /** Epoch ms — day the refund was issued. */
  date: number;
}

export interface RestockedItem {
  bookId: string;
  quantity: number;
}

export type RefundResult =
  | { ok: true; refund: Refund; restocked: boolean }
  | { ok: false; error: string };

/** Sum of all refunds recorded against an order. */
export async function refundedTotalFor(orderId: string): Promise<number> {
  const refunds = await db.refunds.getAll();
  return refunds
    .filter((refund) => refund.orderId === orderId)
    .reduce((sum, refund) => sum + refund.amount, 0);
}

/**
 * Record a refund against a paid order. The refunded fraction of each item is
 * returned to stock (with an inventory log) so inventory and P&L stay
 * consistent — the restocked quantities are stored on the refund record so a
 * later deletion can reverse them exactly.
 */
export async function recordRefund(
  orderId: string,
  input: RefundInput
): Promise<RefundResult> {
  const order = await db.orders.getById(orderId);
  if (!order) {
    return { ok: false, error: "Order not found" };
  }
  if (order.paymentStatus !== "paid") {
    return { ok: false, error: "Only paid orders can be refunded" };
  }
  const alreadyRefunded = await refundedTotalFor(orderId);
  if (input.amount > order.total - alreadyRefunded) {
    return {
      ok: false,
      error: "Refund amount cannot exceed the remaining refundable total",
    };
  }

  const restockedItems: RestockedItem[] = [];
  for (const item of order.items) {
    if (item.quantity <= 0) continue;
    const quantity = Math.min(
      item.quantity,
      Math.round((input.amount / order.total) * item.quantity)
    );
    if (quantity > 0) restockedItems.push({ bookId: item.bookId, quantity });
  }

  // The refunded fraction of the order's cost of goods is backed out of the
  // P&L (gross profit). Legacy items without a cost snapshot are filled with
  // the book's current cost, matching how the dashboard enriches them.
  const books = await db.books.getAll();
  const booksById = new Map(books.map((book) => [book.id, book]));
  const orderCost = order.items.reduce((sum, item) => {
    const bookCost = booksById.get(item.bookId)?.cost;
    const cost =
      typeof item.cost === "number"
        ? item.cost
        : typeof bookCost === "number"
          ? bookCost
          : 0;
    return sum + cost * item.quantity;
  }, 0);
  const costRefunded = Math.round((input.amount / order.total) * orderCost);

  const refund = await db.refunds.create({
    orderId,
    amount: input.amount,
    reason: input.reason,
    date: input.date,
    ...(restockedItems.length > 0 ? { restockedItems } : {}),
    ...(costRefunded > 0 ? { costRefunded } : {}),
  });

  if (restockedItems.length > 0) {
    for (const restocked of restockedItems) {
      const book = books.find((b) => b.id === restocked.bookId);
      if (!book) continue;
      await db.books.update(restocked.bookId, {
        quantity: book.quantity + restocked.quantity,
      });
      await db.inventoryLogs.create({
        bookId: restocked.bookId,
        change: restocked.quantity,
        reason: `Refund ${order.paymentReference || order.id}`,
      });
    }
  }

  return { ok: true, refund, restocked: restockedItems.length > 0 };
}

/**
 * Delete a refund record and reverse its stock effect (the quantities the
 * refund put back into inventory are removed again, with an inventory log).
 */
export async function reverseRefund(refund: Refund): Promise<boolean> {
  const restockedItems = refund.restockedItems ?? [];
  if (restockedItems.length > 0) {
    const order = await db.orders.getById(refund.orderId);
    const reference = order?.paymentReference || order?.id || refund.orderId;
    // Use atomic SQL decrement to avoid race conditions.
    const dbConn = getDb();
    for (const restocked of restockedItems) {
      dbConn
        .prepare(`UPDATE "books" SET quantity = MAX(0, quantity - ?), updatedAt = ? WHERE id = ?`)
        .run(restocked.quantity, Date.now(), restocked.bookId);
      await db.inventoryLogs.create({
        bookId: restocked.bookId,
        change: -restocked.quantity,
        reason: `Refund deleted (${reference})`,
      });
    }
  }
  return db.refunds.remove(refund.id);
}