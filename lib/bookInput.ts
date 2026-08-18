// NOTE: Server-only module. Parses + validates the book add/edit form fields
// (values arrive as strings because the form is submitted as multipart data).

export interface ParsedBookInput {
  titleEn: string;
  titleAr: string;
  author: string;
  isbn: string;
  price: number;
  originalPrice?: number;
  cost?: number;
  quantity: number;
  category: string;
  descriptionEn: string;
  descriptionAr: string;
}

export type BookInputResult =
  | { ok: true; data: ParsedBookInput }
  | { ok: false; error: string };

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/** Parse + validate the shared book form. Prices/quantities must be numbers;
 * bilingual titles, author and category are required. */
export function parseBookInput(raw: Record<string, unknown>): BookInputResult {
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const titleEn = str(raw.titleEn);
  const titleAr = str(raw.titleAr);
  const author = str(raw.author);
  const isbn = str(raw.isbn);
  const category = str(raw.category);
  const descriptionEn = str(raw.descriptionEn);
  const descriptionAr = str(raw.descriptionAr);
  const price = toNumber(raw.price);
  const quantity = toNumber(raw.quantity);

  // Optional sale price: must be a positive number greater than the sale
  // price. Left empty when the book is not on discount.
  let originalPrice: number | undefined;
  if (raw.originalPrice !== undefined && str(raw.originalPrice) !== "") {
    const original = toNumber(raw.originalPrice);
    if (!Number.isFinite(original) || original <= 0) {
      return { ok: false, error: "Original price must be a positive number" };
    }
    if (original <= price) {
      return {
        ok: false,
        error: "Original price must be greater than the sale price",
      };
    }
    originalPrice = original;
  }

  // Optional cost price: a non-negative number. Empty means "not tracked".
  let cost: number | undefined;
  if (raw.cost !== undefined && str(raw.cost) !== "") {
    const parsed = toNumber(raw.cost);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, error: "Cost price must be a non-negative number" };
    }
    cost = parsed;
  }

  if (!titleEn || !titleAr || !author || !category) {
    return {
      ok: false,
      error: "Title (English & Arabic), author and category are required",
    };
  }
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Price must be a positive number" };
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, error: "Quantity must be a non-negative whole number" };
  }

  return {
    ok: true,
    data: {
      titleEn,
      titleAr,
      author,
      isbn,
      price,
      originalPrice,
      cost,
      quantity,
      category,
      descriptionEn,
      descriptionAr,
    },
  };
}
