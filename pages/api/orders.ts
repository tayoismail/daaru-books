import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { generatePaymentReference } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import type { OrderItem } from "@/types";

// Spam deterrent: max 10 orders per hour per IP.
const ORDER_LIMIT = 10;
const ORDER_WINDOW_MS = 60 * 60 * 1000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  if (!rateLimit(clientIp(req), ORDER_LIMIT, ORDER_WINDOW_MS)) {
    return void res.status(429).json({ error: "Too many orders. Please try again later." });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const { name, email, phone, address, items } = body;

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof phone !== "string" ||
    typeof address !== "string" ||
    !name.trim() ||
    !email.trim() ||
    !phone.trim() ||
    !address.trim()
  ) {
    return void res
      .status(400)
      .json({ error: "Name, email, phone and shipping address are required" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return void res.status(400).json({ error: "Cart is empty" });
  }

  // Rebuild the line items server-side: prices are read from the catalog, never
  // trusted from the client, and availability is checked against live stock.
  const books = await db.books.getAll();
  const orderItems: OrderItem[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const item = (raw ?? {}) as { bookId?: unknown; quantity?: unknown };
    if (
      typeof item.bookId !== "string" ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      seen.has(item.bookId)
    ) {
      continue;
    }
    seen.add(item.bookId);

    const book = books.find((b) => b.id === item.bookId);
    if (!book) {
      return void res
        .status(400)
        .json({ error: "One or more items in your cart are no longer available" });
    }
    if (book.quantity < item.quantity) {
      return void res.status(409).json({
        error: `Only ${book.quantity} ${book.quantity === 1 ? "copy" : "copies"} of "${book.titleEn}" ${book.quantity === 1 ? "is" : "are"} available`,
      });
    }
    orderItems.push({
      bookId: book.id,
      title: book.titleEn,
      quantity: item.quantity,
      price: book.price,
      // Snapshot the cost price so COGS/gross-profit reports stay accurate
      // even if the book's cost changes after the sale. Absent when the book
      // has no cost set (reports fall back to 0 for those items).
      ...(typeof book.cost === "number" ? { cost: book.cost } : {}),
    });
  }

  if (orderItems.length === 0) {
    return void res.status(400).json({ error: "Cart contains no valid items" });
  }

  const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const paymentReference = generatePaymentReference();

  const order = await db.orders.create({
    customerName: name.trim(),
    customerEmail: email.trim().toLowerCase(),
    customerPhone: phone.trim(),
    shippingAddress: address.trim(),
    items: orderItems,
    total,
    status: "pending",
    paymentStatus: "unpaid",
    paymentReference,
    updatedAt: Date.now(),
  });

  return void res.status(201).json({
    message: "Order created",
    orderId: order.id,
    paymentReference,
    total,
  });
}
