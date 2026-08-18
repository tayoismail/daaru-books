import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faChevronRight,
  faMinus,
  faPlus,
  faStar,
  faStarHalfStroke,
} from "@fortawesome/free-solid-svg-icons";
import BookCard, { coverInitials } from "@/components/BookCard";
import Seo, { OG_IMAGE, SITE_URL, type JsonLd } from "@/components/Seo";

// Modal renders only on user action — split it out of the main bundle.
const QuickViewModal = dynamic(() => import("@/components/QuickViewModal"), {
  ssr: false,
});
import { CATEGORIES, categoryName } from "@/lib/categories";
import { useCart, useLanguage } from "@/lib/contexts";
import { discountPercent } from "@/lib/format";
import type { Book } from "@/types";

export interface BookDetailPageProps {
  book: Book;
  /** 4 related titles — same category first, then backfilled. */
  related: Book[];
  seoTitle: string;
  seoDescription: string;
}

export async function getServerSideProps(context: {
  params?: { id?: string | string[] };
  locale?: string;
}) {
  // Dynamic imports keep the fs-based db module AND the locale JSONs out of
  // the client bundle (the JSONs are only needed for the server-side brand).
  const { db } = await import("@/lib/db");
  const [{ default: en }, { default: ar }] = await Promise.all([
    import("../../public/locales/en/common.json"),
    import("../../public/locales/ar/common.json"),
  ]);
  const BRAND = { en: en.appName, ar: ar.appName };

  const id = context.params?.id;
  if (!id || Array.isArray(id)) {
    return { notFound: true };
  }

  const book = await db.books.getById(id);
  if (!book) {
    return { notFound: true };
  }

  // Related books: prefer the same category, then backfill from the rest of
  // the catalog so the "You May Also Like" grid always has up to 4 titles.
  const all = await db.books.getAll();
  const sameCategory = all.filter(
    (b) => b.category === book.category && b.id !== book.id
  );
  const others = all.filter((b) => b.category !== book.category && b.id !== book.id);
  const related = [...sameCategory, ...others].slice(0, 4);

  // SEO strings are computed server-side with the route locale so the meta
  // tags are correct on first paint (title + description truncated to 160).
  const isAr = context.locale === "ar";
  const localizedTitle = isAr && book.titleAr ? book.titleAr : book.titleEn;
  const localizedDescription =
    isAr && book.descriptionAr ? book.descriptionAr : book.descriptionEn;
  const seoDescription =
    localizedDescription.length > 160
      ? `${localizedDescription.slice(0, 157).trimEnd()}...`
      : localizedDescription;

  return {
    props: {
      book,
      related,
      seoTitle: `${localizedTitle} | ${BRAND[context.locale === "ar" ? "ar" : "en"]}`,
      seoDescription,
    },
  };
}

/** 5 gold stars (supports halves), empty stars in light slate. */
function Stars({ rating, label }: { rating: number; label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={label}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const value = rating - i;
        if (value >= 0.75) {
          return (
            <FontAwesomeIcon key={i} icon={faStar} className="h-4 w-4 text-gold" />
          );
        }
        if (value >= 0.25) {
          return (
            <FontAwesomeIcon
              key={i}
              icon={faStarHalfStroke}
              className="h-4 w-4 text-gold"
            />
          );
        }
        return (
          <FontAwesomeIcon key={i} icon={faStar} className="h-4 w-4 text-slate-300" />
        );
      })}
    </span>
  );
}

export default function BookDetailPage({
  book,
  related,
  seoTitle,
  seoDescription,
}: BookDetailPageProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { addItem, items } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [quickViewBook, setQuickViewBook] = useState<Book | null>(null);

  // Pages Router reconciles the same component instance when navigating from
  // one /books/[id] to another (e.g. via a related-book card), so state would
  // otherwise leak across books. Reset on book change; the write is deferred
  // so setState never runs synchronously inside the effect.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQty(1);
      setQuickViewBook(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [book.id]);

  const localizedTitle = locale === "ar" && book.titleAr ? book.titleAr : book.titleEn;
  const localizedDescription =
    locale === "ar" && book.descriptionAr ? book.descriptionAr : book.descriptionEn;

  const outOfStock = book.quantity === 0;
  const inCart = items.some((item) => item.bookId === book.id);
  const rating = book.rating ?? 0;
  const reviews = book.reviews ?? 0;
  const discount = discountPercent(book.price, book.originalPrice);

  const clamp = (n: number) =>
    Math.min(Math.max(n, 1), Math.max(1, book.quantity));
  const decrement = () => setQty((q) => clamp(q - 1));
  const increment = () => setQty((q) => clamp(q + 1));

  const cartItem = {
    bookId: book.id,
    titleEn: book.titleEn,
    titleAr: book.titleAr,
    author: book.author,
    price: book.price,
    originalPrice: book.originalPrice,
    quantity: qty,
    imageUrl: book.imageUrl,
  };

  const addToCart = () => addItem(cartItem);

  const buyNow = () => {
    addItem(cartItem);
    void router.push("/cart");
  };

  const categorySlug = CATEGORIES.find((c) => c.en === book.category)?.slug;

  const productJsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: localizedTitle,
    description: localizedDescription,
    image: book.imageUrl ? `${SITE_URL}${book.imageUrl}` : OG_IMAGE,
    sku: book.sku || book.isbn || book.id,
    brand: { "@type": "Brand", name: t("appName") },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/books/${book.id}`,
      priceCurrency: "NGN",
      price: book.price,
      availability: book.quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        image={book.imageUrl ? `${SITE_URL}${book.imageUrl}` : OG_IMAGE}
        type="product"
        jsonLd={[productJsonLd]}
      />

      {/* Breadcrumb: Home > Books > [Title] */}
      <nav
        aria-label="Breadcrumb"
        className="container-daaru pt-6"
      >
        <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <li>
            <Link href="/" className="transition-colors hover:text-primary">
              {t("nav.home")}
            </Link>
          </li>
          <li aria-hidden="true" className="flex items-center">
            <FontAwesomeIcon
              icon={faChevronRight}
              className="h-3 w-3 text-slate-300 rtl:-scale-x-100"
            />
          </li>
          <li>
            <Link href="/books" className="transition-colors hover:text-primary">
              {t("nav.books")}
            </Link>
          </li>
          <li aria-hidden="true" className="flex items-center">
            <FontAwesomeIcon
              icon={faChevronRight}
              className="h-3 w-3 text-slate-300 rtl:-scale-x-100"
            />
          </li>
          <li aria-current="page" className="truncate font-medium text-slate-900">
            {localizedTitle}
          </li>
        </ol>
      </nav>

      <main className="container-daaru py-8 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Left: image (400x500) with zoom on hover */}
          <div className="group relative mx-auto w-full max-w-md">
            <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950 shadow-xl ring-1 ring-black/5">
              {book.imageUrl ? (
                <Image
                  src={book.imageUrl}
                  alt={localizedTitle}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <>
                  <svg
                    viewBox="0 0 44 44"
                    className="absolute h-40 w-40 text-gold opacity-20"
                    aria-hidden="true"
                  >
                    <path
                      d="M22 8.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z"
                      fill="currentColor"
                    />
                    <path
                      d="M22 2.5l1.4 4.9 4.9 1.4-4.9 1.4-1.4 4.9-1.4-4.9-4.9-1.4 4.9-1.4z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="text-7xl font-bold text-white/90">
                    {coverInitials(localizedTitle)}
                  </span>
                </>
              )}
              {/* Frame accent */}
              <div className="pointer-events-none absolute inset-4 rounded-xl border border-white/15" />
            </div>
          </div>

          {/* Right: details */}
          <div>
            <h1 className="text-3xl font-bold leading-tight text-slate-900">
              {localizedTitle}
            </h1>
            <p className="mt-2 text-lg text-slate-500">{book.author}</p>

            {/* Rating: stars + review count */}
            {rating > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Stars rating={rating} label={t("book.reviews", { count: reviews })} />
                <span className="text-sm text-slate-500">
                  {rating.toFixed(1)} · {t("book.reviews", { count: reviews })}
                </span>
              </div>
            )}

            {/* Price */}
            <p className="mt-4 flex flex-wrap items-baseline gap-3 text-2xl font-bold text-primary">
              ₦{book.price.toLocaleString()}
              {discount && book.originalPrice && (
                <span className="text-base font-normal text-slate-400 line-through">
                  ₦{book.originalPrice.toLocaleString()}
                </span>
              )}
              {discount && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">
                  -{discount}%
                </span>
              )}
            </p>

            {/* Stock status */}
            <div className="mt-3">
              {outOfStock ? (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                  {t("book.outOfStock")}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary">
                  {t("book.inStock")}
                </span>
              )}
            </div>

            {/* Quantity + actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white p-1">
                <button
                  type="button"
                  onClick={decrement}
                  disabled={outOfStock || qty <= 1}
                  aria-label={t("book.decreaseQty")}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faMinus} className="h-3.5 w-3.5" />
                </button>
                <span
                  className="min-w-8 text-center text-lg font-bold text-slate-900"
                  aria-live="polite"
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={increment}
                  disabled={outOfStock || qty >= book.quantity}
                  aria-label={t("book.increaseQty")}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-xs text-slate-400">
                {t("book.quantity")} · {t("books.inStock", { count: book.quantity })}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addToCart}
                disabled={inCart || outOfStock}
                className={`btn flex-1 px-8 py-3 text-base font-bold transition-all duration-200 sm:flex-none ${
                  inCart
                    ? "cursor-default bg-primary-50 text-primary"
                    : outOfStock
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-gold text-slate-900 hover:scale-[1.03] hover:bg-gold-600"
                }`}
              >
                {inCart ? `✓ ${t("books.addedToCart")}` : t("books.addToCart")}
              </button>
              <button
                type="button"
                onClick={buyNow}
                disabled={outOfStock}
                className="btn flex-1 gap-2 bg-primary px-8 py-3 text-base font-bold text-white transition-all duration-200 hover:bg-primary-800 hover:scale-[1.03] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:scale-100 sm:flex-none"
              >
                <FontAwesomeIcon icon={faBolt} className="h-4 w-4" />
                {t("book.buyNow")}
              </button>
            </div>

            {/* Description */}
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t("book.description")}
              </h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                {localizedDescription}
              </p>
            </div>

            {/* Categories badge */}
            <div className="mt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t("book.categories")}
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {categorySlug ? (
                  <Link
                    href={`/books?category=${categorySlug}`}
                    className="rounded-full bg-primary-50 px-4 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-100"
                  >
                    {categoryName(book.category, locale)}
                  </Link>
                ) : (
                  <span className="rounded-full bg-primary-50 px-4 py-1.5 text-sm font-semibold text-primary">
                    {categoryName(book.category, locale)}
                  </span>
                )}
              </div>
            </div>

            {/* ISBN / SKU */}
            <dl className="mt-6 space-y-1.5 border-t border-slate-200 pt-5 text-sm">
              {book.isbn && (
                <div className="flex items-center gap-2">
                  <dt className="w-16 shrink-0 font-semibold text-slate-500">
                    {t("book.isbn")}
                  </dt>
                  <dd className="text-slate-600">{book.isbn}</dd>
                </div>
              )}
              {book.sku && (
                <div className="flex items-center gap-2">
                  <dt className="w-16 shrink-0 font-semibold text-slate-500">
                    {t("book.sku")}
                  </dt>
                  <dd className="text-slate-600">{book.sku}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Related books */}
        {related.length > 0 && (
          <section className="mt-16 lg:mt-20">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  {t("book.related")}
                </h2>
                <div className="mt-2 h-1 w-14 rounded-full bg-gold" />
                <p className="mt-3 text-sm text-slate-500">
                  {t("book.relatedSubtitle")}
                </p>
              </div>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((b) => (
                <BookCard key={b.id} book={b} onQuickView={setQuickViewBook} />
              ))}
            </div>
          </section>
        )}
      </main>

      {quickViewBook && (
        <QuickViewModal book={quickViewBook} onClose={() => setQuickViewBook(null)} />
      )}
    </>
  );
}
