import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import { useCart, useLanguage } from "@/lib/contexts";
import { discountPercent } from "@/lib/format";
import type { Book } from "@/types";

/** Two-letter initials used for the default book cover when no image exists. */
export function coverInitials(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0]?.charAt(0) ?? "?";
  const second = words[1]?.charAt(0) ?? "";
  return (first + second).toUpperCase();
}

interface BookCardProps {
  book: Book;
  /** Opens the quick-view modal for this book. */
  onQuickView: (book: Book) => void;
}

/**
 * Shared book card used by the homepage and /books listing.
 * Localizes the title at render time via the active language context.
 */
export default function BookCard({ book, onQuickView }: BookCardProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { addItem, items } = useCart();

  const localizedTitle =
    locale === "ar" && book.titleAr ? book.titleAr : book.titleEn;
  const inCart = items.some((item) => item.bookId === book.id);

  // Whole-number discount percentage, shown as a "-X%" badge when on sale.
  const discount = discountPercent(book.price, book.originalPrice);

  return (
    <article className="book-card group flex h-full flex-col overflow-hidden bg-white">
      {/* Cover (150x200 style area; initials fallback when no image) */}
      <div className="relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950">
        {book.imageUrl ? (
          <Image
            src={book.imageUrl}
            alt={localizedTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <>
            <svg
              viewBox="0 0 44 44"
              className="absolute h-24 w-24 text-gold opacity-20"
              aria-hidden="true"
            >
              <path
                d="M22 8.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z"
                fill="currentColor"
              />
            </svg>
            <span className="text-3xl font-bold text-white/90">
              {coverInitials(localizedTitle)}
            </span>
          </>
        )}

        {/* Sale badge (top-start, over any cover) */}
        {discount && (
          <span className="absolute start-2 top-2 z-10 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-md">
            -{discount}%
          </span>
        )}

        {/* Quick View — eye icon. Slides up on hover (desktop); always
            visible on touch devices where there is no hover. */}
        <button
          type="button"
          onClick={() => onQuickView(book)}
          aria-label={t("books.quickView")}
          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-slate-950/70 py-2.5 text-xs font-semibold text-white backdrop-blur-sm transition-all duration-300 md:translate-y-full md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100"
        >
          <FontAwesomeIcon icon={faEye} className="h-3.5 w-3.5" />
          {t("books.quickView")}
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-bold text-slate-900">
          <Link
            href={`/books/${book.id}`}
            className="transition-colors hover:text-primary"
          >
            {localizedTitle}
          </Link>
        </h3>
        <p className="mt-1 truncate text-xs text-slate-500">{book.author}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-primary">
              ₦{book.price.toLocaleString()}
            </span>
            {discount && book.originalPrice && (
              <span className="text-xs text-slate-400 line-through">
                ₦{book.originalPrice.toLocaleString()}
              </span>
            )}
          </p>
          {book.quantity === 0 && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
              {t("books.outOfStock")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            addItem({
              bookId: book.id,
              titleEn: book.titleEn,
              titleAr: book.titleAr,
              author: book.author,
              price: book.price,
              originalPrice: book.originalPrice,
              quantity: 1,
              imageUrl: book.imageUrl,
            })
          }
          disabled={inCart || book.quantity === 0}
          className={`btn mt-4 w-full py-2 text-xs font-bold transition-all duration-200 ${
            inCart
              ? "cursor-default bg-primary-50 text-primary"
              : book.quantity === 0
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-gold text-slate-900 hover:scale-[1.03] hover:bg-gold-600"
          }`}
        >
          {inCart ? `✓ ${t("books.addedToCart")}` : t("books.addToCart")}
        </button>
      </div>
    </article>
  );
}
