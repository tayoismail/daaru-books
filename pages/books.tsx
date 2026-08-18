import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import BookCard from "@/components/BookCard";
import BookCarousel from "@/components/BookCarousel";
import Seo from "@/components/Seo";
import { CATEGORIES } from "@/lib/categories";
import { useLanguage } from "@/lib/contexts";
import type { Book } from "@/types";

// Modal renders only on user action — split it out of the main bundle.
const QuickViewModal = dynamic(() => import("@/components/QuickViewModal"), {
  ssr: false,
});

const PAGE_SIZE = 10;

export type SortKey = "relevance" | "price-asc" | "price-desc" | "newest";

export interface BooksPageProps {
  books: Book[];
  /** Distinct categories present in the catalog (slug + en name). */
  categories: { slug: string; en: string }[];
  /** Top-rated titles shown in the "Popular Now" row under the results. */
  popular: Book[];
  total: number;
  page: number;
  totalPages: number;
  query: { q: string; category: string; sort: SortKey };
  /** Serialized query this page was rendered for (compares against the live URL). */
  queryKey: string;
}

export async function getServerSideProps(context: {
  query: { q?: string; category?: string; sort?: string; page?: string };
}) {
  // Dynamic import keeps the fs-based db module out of the client bundle.
  const { db } = await import("@/lib/db");
  const all = await db.books.getAll();

  const q = (context.query.q ?? "").trim().toLowerCase();
  const categorySlug = (context.query.category ?? "").trim();
  const sort = (["price-asc", "price-desc", "newest"].includes(
    context.query.sort ?? ""
  )
    ? context.query.sort
    : "relevance") as SortKey;
  const rawPage = parseInt(context.query.page ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const categoryEn = CATEGORIES.find((c) => c.slug === categorySlug)?.en ?? "";

  // Server-side filtering
  let filtered = all;
  if (q) {
    filtered = filtered.filter(
      (book) =>
        book.titleEn.toLowerCase().includes(q) ||
        book.titleAr.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q)
    );
  }
  if (categoryEn) {
    filtered = filtered.filter((book) => book.category === categoryEn);
  }

  // Server-side sorting
  switch (sort) {
    case "price-asc":
      filtered = [...filtered].sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      filtered = [...filtered].sort((a, b) => b.price - a.price);
      break;
    case "newest":
      filtered = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
      break;
    default:
      // Relevance: catalog (seed) order, out-of-stock books pushed to the end.
      filtered = [...filtered].sort(
        (a, b) => Number(a.quantity === 0) - Number(b.quantity === 0)
      );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const books = filtered.slice(start, start + PAGE_SIZE);

  const distinct = new Map<string, { slug: string; en: string }>();
  for (const book of all) {
    const info = CATEGORIES.find((c) => c.en === book.category);
    if (info && !distinct.has(info.slug)) {
      distinct.set(info.slug, { slug: info.slug, en: info.en });
    }
  }

  // Top-rated titles for the "Popular Now" row below the results.
  const popular = [...all]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 8);

  return {
    props: {
      books,
      categories: Array.from(distinct.values()),
      popular,
      total,
      page: safePage,
      totalPages,
      query: { q: context.query.q ?? "", category: categorySlug, sort },
      queryKey: [
        q,
        categorySlug,
        sort,
        safePage === 1 ? "" : String(safePage),
      ].join("|"),
    },
  };
}

/** Skeleton card shown while the page data loads (shimmer animation). */
function SkeletonCard() {
  return (
    <div className="animate-shimmer overflow-hidden rounded-xl bg-white shadow-md">
      <div className="h-52 bg-slate-200" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-200" />
        <div className="h-5 w-1/3 rounded bg-slate-200" />
        <div className="h-9 w-full rounded-full bg-slate-200" />
      </div>
    </div>
  );
}

export default function BooksPage({
  books,
  categories,
  popular,
  total,
  page,
  totalPages,
  query,
  queryKey,
}: BooksPageProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(query.q);
  const [loading, setLoading] = useState(false);
  const [quickViewBook, setQuickViewBook] = useState<Book | null>(null);

  // The URL changes the moment a filter/pagination navigation starts, but the
  // new getServerSideProps data arrives later. Keep the skeleton visible until
  // this page's props match the live URL (handles back/forward too), and use
  // router.events only to trigger the loader on link clicks.
  useEffect(() => {
    if (!router.isReady) return;
    const start = () => setLoading(true);
    router.events.on("routeChangeStart", start);
    return () => {
      router.events.off("routeChangeStart", start);
    };
  }, [router.events, router.isReady]);

  // Reflect URL changes (e.g. browser back/forward) into the search input.
  // The write is deferred so setState never runs synchronously inside the
  // effect (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchInput((router.query.q as string) ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router.query.q]);

  const buildUrl = (patch: {
    q?: string;
    category?: string;
    sort?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const q = patch.q ?? query.q;
    const category = patch.category ?? query.category;
    const sort = patch.sort ?? query.sort;
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (sort && sort !== "relevance") params.set("sort", sort);
    if ((patch.page ?? 1) > 1) params.set("page", String(patch.page ?? 1));
    const qs = params.toString();
    return qs ? `/books?${qs}` : "/books";
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    router.push(buildUrl({ q: searchInput.trim(), page: 1 }));
  };

  const navigate = (patch: { category?: string; sort?: string; page?: number }) => {
    setLoading(true);
    router.push(buildUrl(patch));
  };

  const clearFilters = () => {
    setSearchInput("");
    setLoading(true);
    router.push("/books");
  };

  const hasFilters = Boolean(query.q || query.category || query.sort !== "relevance");

  // Skeleton while a navigation is in flight AND the rendered props are stale
  // (the current URL no longer matches the query this page was rendered for).
  const currentKey = [
    (router.query.q as string) ?? "",
    (router.query.category as string) ?? "",
    (router.query.sort as string) ?? "relevance",
    router.query.page ? String(router.query.page) : "",
  ].join("|");
  const showSkeleton = router.isReady && currentKey !== queryKey && loading;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const localizedCategory = (en: string) =>
    locale === "ar" ? (CATEGORIES.find((c) => c.en === en)?.ar ?? en) : en;

  return (
    <>
      <Seo title={`${t("books.title")} — ${t("appName")}`} description={t("books.subtitle")} />

      {/* Page header */}
      <section className="bg-primary-50 py-10">
        <div className="container-daaru text-center">
          <h1 className="text-3xl font-bold text-primary-800 sm:text-4xl">
            {t("books.title")}
          </h1>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-gold" />
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            {t("books.subtitle")}
          </p>
        </div>
      </section>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-40 border-y border-slate-200 bg-white/90 py-3 shadow-sm backdrop-blur">
        <div className="container-daaru flex flex-wrap items-center gap-3">
          <form
            onSubmit={submitSearch}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
          >
            <FontAwesomeIcon
              icon={faSearch}
              className="h-4 w-4 shrink-0 text-slate-400"
            />
            <input
              type="search"
              name="q"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("books.searchPlaceholder")}
              aria-label={t("books.searchPlaceholder")}
              className="w-full min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </form>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 sm:inline-flex sm:items-center sm:gap-1.5">
              <FontAwesomeIcon icon={faFilter} className="h-3 w-3" />
              {t("books.sort")}
            </span>
            <select
              value={query.category}
              onChange={(e) => navigate({ category: e.target.value, page: 1 })}
              aria-label={t("books.category")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{t("books.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {localizedCategory(category.en)}
                </option>
              ))}
            </select>

            <select
              value={query.sort}
              onChange={(e) => navigate({ sort: e.target.value, page: 1 })}
              aria-label={t("books.sort")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="relevance">{t("books.sortRelevance")}</option>
              <option value="price-asc">{t("books.sortPriceLow")}</option>
              <option value="price-desc">{t("books.sortPriceHigh")}</option>
              <option value="newest">{t("books.sortNewest")}</option>
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="btn border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
              >
                {t("books.clearFilters")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results meta */}
      <div className="container-daaru pt-6">
        <p className="text-sm text-slate-500">
          {t("books.results", { count: total })}
        </p>
      </div>

      <main className="container-daaru py-6">
        {showSkeleton ? (
          /* Skeleton loaders while a filter/pagination navigation resolves */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : !router.isReady || currentKey !== queryKey ? (
          /* Keep the grid hidden briefly while fresh props arrive. */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : books.length === 0 ? (
          /* Empty state */
          <div className="mx-auto max-w-md py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-50">
              <FontAwesomeIcon icon={faSearch} className="h-7 w-7 text-primary-400" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">
              {t("books.empty")}
            </h2>
            <button
              type="button"
              onClick={clearFilters}
              className="btn mt-6 bg-gold px-6 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-gold-600"
            >
              {t("books.clearFilters")}
            </button>
          </div>
        ) : (
          <>
            {/* Book grid: 1 / 2 / 3 / 4 columns responsive */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {books.map((book) => (
                <BookCard key={book.id} book={book} onQuickView={setQuickViewBook} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-12 flex flex-wrap items-center justify-center gap-2"
              >
                {page > 1 && (
                  <Link
                    href={buildUrl({ page: page - 1 })}
                    className="btn border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} className="me-1.5 h-3 w-3" />
                    {t("books.previous")}
                  </Link>
                )}

                {pageNumbers.map((number) => {
                  const isCurrent = number === page;
                  return isCurrent ? (
                    <span
                      key={number}
                      aria-current="page"
                      className="flex h-9 min-w-9 items-center justify-center rounded-full bg-primary px-3 text-sm font-bold text-white"
                    >
                      {number}
                    </span>
                  ) : (
                    <Link
                      key={number}
                      href={buildUrl({ page: number })}
                      className="flex h-9 min-w-9 items-center justify-center rounded-full border border-slate-300 px-3 text-sm font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary"
                    >
                      {number}
                    </Link>
                  );
                })}

                {page < totalPages && (
                  <Link
                    href={buildUrl({ page: page + 1 })}
                    className="btn border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary"
                  >
                    {t("books.next")}
                    <FontAwesomeIcon icon={faChevronRight} className="ms-1.5 h-3 w-3" />
                  </Link>
                )}
              </nav>
            )}

            <p className="mt-6 text-center text-xs text-slate-400">
              {t("books.page", { page, total: totalPages })}
            </p>
          </>
        )}
      </main>

      {/* Popular Now — rhbooks-style row under the listing */}
      {popular.length > 0 && (
        <BookCarousel
          title={t("books.popular")}
          subtitle={t("books.popularSubtitle")}
          viewAllHref="/books"
          viewAllLabel={t("bestsellers.viewAll")}
        >
          {popular.map((book) => (
            <BookCard key={book.id} book={book} onQuickView={setQuickViewBook} />
          ))}
        </BookCarousel>
      )}

      {quickViewBook && (
        <QuickViewModal book={quickViewBook} onClose={() => setQuickViewBook(null)} />
      )}
    </>
  );
}
