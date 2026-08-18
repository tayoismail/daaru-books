import Image from "next/image";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useCart, useLanguage } from "@/lib/contexts";
import { coverInitials } from "@/components/BookCard";
import { discountPercent } from "@/lib/format";
import type { Book } from "@/types";

interface QuickViewModalProps {
  book: Book;
  onClose: () => void;
}

/**
 * Full book details dialog: bilingual description, stock status, price and an
 * Add to Cart button. Closes on backdrop click or Escape.
 */
export default function QuickViewModal({ book, onClose }: QuickViewModalProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { addItem, items } = useCart();

  const localizedTitle =
    locale === "ar" && book.titleAr ? book.titleAr : book.titleEn;
  const localizedDescription =
    locale === "ar" && book.descriptionAr ? book.descriptionAr : book.descriptionEn;

  const inCart = items.some((item) => item.bookId === book.id);
  const outOfStock = book.quantity === 0;
  const discount = discountPercent(book.price, book.originalPrice);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={localizedTitle}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("books.close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative flex h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950">
          {book.imageUrl ? (
            <Image
              src={book.imageUrl}
              alt={localizedTitle}
              fill
              sizes="(max-width: 640px) 100vw, 32rem"
              className="object-cover"
            />
          ) : (
            <span className="text-5xl font-bold text-white/90">
              {coverInitials(localizedTitle)}
            </span>
          )}
          {discount && (
            <span className="absolute start-3 top-3 z-10 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-md">
              -{discount}%
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("books.close")}
            className="btn absolute end-3 top-3 h-9 w-9 bg-white/15 p-0 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[45vh] overflow-y-auto p-6">
          <h3 className="pe-8 text-xl font-bold text-slate-900">
            {localizedTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {book.author}
            {book.isbn ? ` · ISBN ${book.isbn}` : ""}
          </p>

          {/* Stock status */}
          <div className="mt-4">
            {outOfStock ? (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                {t("books.outOfStock")}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary">
                {t("books.inStock", { count: book.quantity })}
              </span>
            )}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            {localizedDescription}
          </p>

          <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <p className="flex items-baseline gap-2 text-2xl font-bold text-primary">
              ₦{book.price.toLocaleString()}
              {discount && book.originalPrice && (
                <span className="text-sm font-normal text-slate-400 line-through">
                  ₦{book.originalPrice.toLocaleString()}
                </span>
              )}
            </p>
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
              disabled={inCart || outOfStock}
              className={`btn px-6 py-2.5 text-sm font-bold transition-all duration-200 ${
                inCart
                  ? "cursor-default bg-primary-50 text-primary"
                  : outOfStock
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-gold text-slate-900 hover:scale-[1.03] hover:bg-gold-600"
              }`}
            >
              {inCart ? `✓ ${t("books.addedToCart")}` : t("books.addToCart")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
