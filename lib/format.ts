/**
 * Locale-aware date formatting shared across admin pages, modals and the
 * invoice. Preformatted values are also used server-side (in getServerSideProps)
 * so SSR and hydration always agree.
 */
export function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Whole-number discount percentage for a book on sale, or null when it is
 * not (no `originalPrice`, or the sale price is not lower).
 */
export function discountPercent(
  price: number,
  originalPrice?: number
): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 100);
}
