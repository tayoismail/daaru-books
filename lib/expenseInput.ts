// NOTE: Server-only module. Parses + validates the expense add/edit form
// (JSON body from the admin expenses page).

import type { ExpenseCategory, ExpenseCategoryDef } from "@/types";

/**
 * Default expense categories (bilingual). Shipped as seed data and returned
 * by the admin API when the collection is empty, so a fresh deployment always
 * has a working category list. Store owners can add/rename/delete categories
 * from the admin expenses page; existing expenses keep their category id.
 */
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  { id: "COGS", nameEn: "Cost of Goods", nameAr: "تكلفة البضاعة", createdAt: 0 },
  { id: "Utility", nameEn: "Utilities", nameAr: "المرافق", createdAt: 0 },
  { id: "Other", nameEn: "Other", nameAr: "أخرى", createdAt: 0 },
  { id: "Rent", nameEn: "Rent", nameAr: "إيجار", createdAt: 0 },
  { id: "Salaries", nameEn: "Salaries & Wages", nameAr: "الرواتب والأجور", createdAt: 0 },
  {
    id: "Shipping & Delivery",
    nameEn: "Shipping & Delivery",
    nameAr: "الشحن والتوصيل",
    createdAt: 0,
  },
  { id: "Packaging", nameEn: "Packaging", nameAr: "التغليف", createdAt: 0 },
  { id: "Marketing", nameEn: "Marketing & Ads", nameAr: "التسويق والإعلانات", createdAt: 0 },
  {
    id: "Bank & Payment Fees",
    nameEn: "Bank & Payment Fees",
    nameAr: "رسوم البنك والدفع",
    createdAt: 0,
  },
  { id: "Software", nameEn: "Software & Subscriptions", nameAr: "البرمجيات والاشتراكات", createdAt: 0 },
];

/** Default category ids (kept for callers that just need the list). */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = DEFAULT_EXPENSE_CATEGORIES.map(
  (category) => category.id
);

/** Localized name for a category id — falls back to the raw id. */
export function expenseCategoryName(
  categories: ExpenseCategoryDef[],
  id: string,
  locale: string
): string {
  const found = categories.find((category) => category.id === id);
  if (!found) return id;
  return locale === "ar" && found.nameAr ? found.nameAr : found.nameEn;
}

export interface ParsedExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  /** Epoch ms — day of the expense. */
  date: number;
}

export type ExpenseInputResult =
  | { ok: true; data: ParsedExpenseInput }
  | { ok: false; error: string };

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/** Parse + validate the shared expense form. Values arrive as JSON from the
 * admin page (numbers may be numbers or numeric strings). */
export function parseExpenseInput(raw: Record<string, unknown>): ExpenseInputResult {
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const category = str(raw.category) as ExpenseCategory;
  const description = str(raw.description);
  const amount = toNumber(raw.amount);

  // Categories are user-manageable now — any non-empty id is accepted here;
  // the admin UI only offers ids from the categories collection.
  if (!category) {
    return { ok: false, error: "Invalid expense category" };
  }
  if (!description) {
    return { ok: false, error: "Description is required" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Amount must be a positive number" };
  }

  // Date: epoch-ms number, or a YYYY-MM-DD string (from the date input).
  let date = toNumber(raw.date);
  if (typeof raw.date === "string" && raw.date.trim() !== "" && !Number.isFinite(date)) {
    const parsed = new Date(`${raw.date.trim()}T00:00:00`).getTime();
    date = Number.isFinite(parsed) ? parsed : NaN;
  }
  if (!Number.isFinite(date)) {
    return { ok: false, error: "A valid date is required" };
  }

  return { ok: true, data: { category, description, amount, date } };
}
