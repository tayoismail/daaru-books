import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook,
  faTruck,
  faGift,
  faLanguage,
  faQuran,
  faScroll,
  faScaleBalanced,
  faChildren,
  faLandmark,
  faHeart,
  faSearch,
  faStar,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import BookCard, { coverInitials } from "@/components/BookCard";
import BookCarousel from "@/components/BookCarousel";
import HeroSlider from "@/components/HeroSlider";
import NewsletterForm from "@/components/NewsletterForm";
import Reveal from "@/components/Reveal";

// Modal renders only on user action — split it out of the main bundle.
const QuickViewModal = dynamic(() => import("@/components/QuickViewModal"), {
  ssr: false,
});
import Image from "next/image";

// Clean, attractive banner backdrops for the new-arrival hero slides
// (free-license photos from Wikimedia Commons, cropped to 1920x900).
// NOTE: only images WITHOUT people or animals — per Islamic design practice,
// the hero never depicts animate objects.
//
// bismillah_banner.jpg: "Bismillah in Calligraphy" by Laisurw2020,
// CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Bismillah_in_Calligraphy.jpg
// License: https://creativecommons.org/licenses/by-sa/4.0/ (cropped to 1920x900)
import heroMosque from "../public/hero/mosque_banner.jpg";
import heroShelf from "../public/hero/shelf_banner.jpg";
import heroInterior from "../public/hero/interior_banner.jpg";
import heroCalligraphy from "../public/hero/calligraphy_banner.jpg";
import heroFaisal from "../public/hero/faisal_banner.jpg";
import heroBismillah from "../public/hero/bismillah_banner.jpg";

const HERO_BANNERS = [
  heroMosque,
  heroBismillah,
  heroShelf,
  heroInterior,
  heroCalligraphy,
  heroFaisal,
];

type WelcomeTextKey = Exclude<keyof SlidesWelcome, "enabled">;
import Seo from "@/components/Seo";
import { categoryName } from "@/lib/categories";
import { useLanguage } from "@/lib/contexts";
import type { Book, SlidesConfig, SlidesWelcome, Testimonial } from "@/types";

/* ------------------------------------------------------------------ */
/* Data helpers                                                        */
/* ------------------------------------------------------------------ */

interface CategoryTile {
  slug: string;
  en: string;
  ar: string;
}

/** Icon + gradient for each category tile (by slug from data/categories.json). */
const CATEGORY_TILES: Record<
  string,
  { icon: typeof faBook; gradient: string }
> = {
  "quran-tafsir": {
    icon: faQuran,
    gradient: "from-primary-700 via-primary-800 to-primary-950",
  },
  hadith: {
    icon: faScroll,
    gradient: "from-gold-600 via-gold-700 to-gold-900",
  },
  fiqh: {
    icon: faScaleBalanced,
    gradient: "from-emerald-600 via-primary-800 to-primary-950",
  },
  "arabic-language": {
    icon: faLanguage,
    gradient: "from-slate-700 via-slate-800 to-slate-950",
  },
  "islamic-history": {
    icon: faLandmark,
    gradient: "from-teal-700 via-emerald-900 to-primary-950",
  },
  "children-books": {
    icon: faChildren,
    gradient: "from-amber-500 via-gold-600 to-gold-800",
  },
  spirituality: {
    icon: faHeart,
    gradient: "from-rose-500 via-primary-700 to-primary-900",
  },
};

const USP_KEYS = ["authentic", "delivery", "payments", "returns"] as const;

const USP_ICONS: Record<(typeof USP_KEYS)[number], typeof faBook> = {
  authentic: faBook,
  delivery: faTruck,
  payments: faGift,
  returns: faLanguage,
};

interface HomeProps {
  books: Book[];
  categories: CategoryTile[];
  testimonials: Testimonial[];
  slides: SlidesConfig;
}

export async function getServerSideProps() {
  // Dynamic import keeps the fs-based db + slides modules out of the client
  // bundle (they read from disk via Node fs).
  const [{ db }, { getSlidesConfig }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/slides"),
  ]);
  const [all, categories, testimonials, slides] = await Promise.all([
    db.books.getAll(),
    Promise.resolve(db.categories.getAll() as CategoryTile[]),
    db.testimonials.getAll(),
    getSlidesConfig(),
  ]);
  const books = all.filter((book) => book.quantity > 0);
  return { props: { books, categories, testimonials, slides } };
}

export default function Home({ books, categories, testimonials, slides }: HomeProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [quickViewBook, setQuickViewBook] = useState<Book | null>(null);

  const localizedReview = (testimonial: Testimonial) =>
    locale === "ar" && testimonial.reviewAr
      ? testimonial.reviewAr
      : testimonial.reviewEn;

  // Newest in-stock titles (by createdAt) — the row below the hero shows the
  // full newest-first run.
  const newestFirst = [...books].sort((a, b) => b.createdAt - a.createdAt);
  const newArrivalsRow = newestFirst.slice(0, 12);

  // Hero slides: admin-pinned books first (in their pinned order); when no
  // books are pinned, fall back to the 5 newest in-stock titles.
  const bookById = new Map(books.map((book) => [book.id, book]));
  const pinned = slides.featuredBookIds
    .map((id) => bookById.get(id))
    .filter((book): book is Book => Boolean(book));
  const featuredBooks = pinned.length > 0 ? pinned : newestFirst.slice(0, 5);

  // Keep the welcome slide unless the admin hid it — but never render an
  // empty slider (no books + hidden welcome would leave zero slides).
  const showWelcome = slides.welcome.enabled || featuredBooks.length === 0;

  // Banner cycle: admin-uploaded banners first, then the bundled set.
  const heroBanners =
    slides.banners.length > 0
      ? slides.banners
      : HERO_BANNERS.map((banner) => banner.src);

  // Welcome-slide copy: admin overrides win, otherwise the default
  // translation (empty override strings fall back too).
  const welcomeText = (key: WelcomeTextKey) => {
    const pair = slides.welcome[key];
    const fallback = t(`hero.${key}`);
    if (!pair) return fallback;
    if (locale === "ar" && pair.ar) return pair.ar;
    return pair.en || fallback;
  };

  // Bestsellers: highest-rated titles first.
  const bestsellersRow = [...books]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 12);

  const localizedTitle = (book: Book) =>
    locale === "ar" && book.titleAr ? book.titleAr : book.titleEn;

  const sliderLabels = {
    region: t("hero.sliderRegion"),
    goTo: (n: number) => t("hero.goToSlide", { n }),
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    router.push(`/books${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`);
  };

  return (
    <>
      <Seo title={`${t("appName")} — ${t("tagline")}`} />

      {/* Section 1 — Hero: dark green gradient + Islamic geometric pattern */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a5c3a] via-[#14462c] to-[#0d3b26]">
        {/* Islamic geometric pattern overlay */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full text-white opacity-[0.07]"
        >
          <defs>
            <pattern
              id="islamic-star"
              width="56"
              height="56"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M28 4l6.2 12.3L48 22.5l-13.8 6.2L28 41l-6.2-12.3L8 22.5l13.8-6.2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="28" cy="28" r="3" fill="currentColor" />
              <path
                d="M0 56l6.2-12.3L20 37.5l-13.8-6.2L0 19l-6.2 12.3L-20 37.5l13.8 6.2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <path
                d="M56 0l6.2-12.3L76-18.5l-13.8 6.2L56 0l-6.2-12.3L36-18.5l13.8 6.2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#islamic-star)" />
        </svg>

        <HeroSlider labels={sliderLabels} intervalMs={slides.autoplayMs}>
          {/* Slide 1 — Welcome */}
          {showWelcome && (
          <div className="relative container-daaru flex min-h-[30rem] flex-col items-center justify-start pb-16 pt-20 text-center md:min-h-[32rem] md:pb-20 md:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gold-200">
              {welcomeText("badge")}
            </span>
            <h1 className="mx-auto mt-5 max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {welcomeText("title")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
              {welcomeText("subtitle")}
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/books"
                className="btn bg-gold px-8 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-black/20 transition-transform duration-200 hover:scale-105 hover:bg-gold-600"
              >
                {welcomeText("cta")}
              </Link>
              <Link
                href="/about"
                className="btn border border-white/30 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-200 hover:border-gold hover:text-gold"
              >
                {welcomeText("secondary")}
              </Link>
            </div>

            {/* Search bar */}
            <form
              onSubmit={submitSearch}
              className="mx-auto mt-8 flex w-full max-w-xl items-center gap-2 rounded-full bg-white p-2 shadow-xl shadow-black/20"
            >
              <span className="ps-3 text-primary-400">
                <FontAwesomeIcon icon={faSearch} className="h-4 w-4" />
              </span>
              <input
                type="search"
                name="q"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={welcomeText("searchPlaceholder")}
                aria-label={welcomeText("searchPlaceholder")}
                className="w-full min-w-0 bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="btn shrink-0 bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
              >
                {welcomeText("searchButton")}
              </button>
            </form>
          </div>
          )}

          {/* Slides 2..N — Featured book highlights (clean banner image + text) */}
          {featuredBooks.map((book, index) => {
            const title = localizedTitle(book);
            // Cycle through the banner set so every slide gets a different
            // clean, attractive backdrop (no stretched cover photos).
            const banner = heroBanners[index % heroBanners.length];
            return (
              <Link
                key={book.id}
                href={`/books/${book.id}`}
                aria-label={title}
                className="relative block min-h-[30rem] overflow-hidden md:min-h-[32rem]"
              >
                {/* Full-bleed banner image */}
                <Image
                  src={banner}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  className="animate-ken-burns object-cover object-center"
                />
                {/* Soft green overlay — just enough tint to keep the text
                    readable while letting the photo show through vividly */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#0d3b26]/60 via-[#14462c]/40 to-[#1a5c3a]/15" />
                {/* Radial darkening behind the centered text keeps the title
                    legible even on bright banners (e.g. the calligraphy art) */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,28,17,0.55),transparent_62%)]" />
                {/* Bottom fade into the page background */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#f8f9fa] to-transparent" />

                {/* Text + floating book cover — the cover shows the actual
                    cover art (with an initials fallback when no image) so
                    visitors see the book, not just its name. */}
                <div className="relative container-daaru flex min-h-[30rem] flex-col items-center justify-center gap-6 pb-14 pt-12 text-center md:min-h-[32rem] md:flex-row md:justify-between md:gap-10 md:pb-20 md:pt-24 md:text-start">
                  {/* Text block */}
                  <div className="flex max-w-xl flex-col items-center md:items-start">
                    <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gold-200 backdrop-blur-sm">
                      <FontAwesomeIcon
                        icon={faWandMagicSparkles}
                        className="h-3.5 w-3.5"
                      />
                      {welcomeText("newArrivalsBadge")}
                    </span>
                    <h2 className="mt-5 max-w-2xl text-2xl font-bold tracking-tight text-white drop-shadow-lg sm:text-3xl">
                      {title}
                    </h2>
                    {book.author && (
                      <p className="mt-1.5 text-sm font-medium text-white/90 drop-shadow">
                        {book.author}
                      </p>
                    )}
                    <span className="btn mt-7 gap-2 bg-gold px-7 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-900 shadow-lg shadow-black/25 transition-all duration-200 hover:scale-105 hover:bg-gold-600">
                      <FontAwesomeIcon icon={faBook} className="h-3.5 w-3.5" />
                      {welcomeText("viewBook")}
                    </span>
                  </div>

                  {/* Book cover — gently floating, slightly tilted 3D card */}
                  <div className="animate-book-float relative shrink-0">
                    <div className="relative w-24 -rotate-2 sm:w-32 md:w-44 lg:w-52">
                      {/* Soft drop shadow behind the cover */}
                      <div className="absolute -inset-2 rounded-xl bg-slate-950/45 blur-lg" />
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md shadow-2xl shadow-slate-950/60 ring-1 ring-white/25">
                        {book.imageUrl ? (
                          <Image
                            src={book.imageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 24vw, (max-width: 1024px) 20vw, 15vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950">
                            <svg
                              viewBox="0 0 44 44"
                              className="h-9 w-9 text-gold opacity-30"
                              aria-hidden="true"
                            >
                              <path
                                d="M22 8.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z"
                                fill="currentColor"
                              />
                            </svg>
                            <span className="text-lg font-bold text-white/90">
                              {coverInitials(title)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </HeroSlider>

        {/* Bottom fade into the page background */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#f8f9fa] to-transparent" />
      </section>

      {/* Section 1.5 — Promo banner (free delivery strip) */}
      <section className="border-y border-gold/20 bg-gradient-to-r from-[#0d3b26] via-[#1a5c3a] to-[#0d3b26]">
        <div className="container-daaru flex flex-col items-center justify-between gap-4 py-5 text-center sm:flex-row sm:text-start">
          <p className="flex items-center justify-center gap-3 text-sm font-semibold text-white sm:text-base">
            <FontAwesomeIcon icon={faTruck} className="h-5 w-5 text-gold" />
            <span>{t("promo.text")}</span>
          </p>
          <Link
            href="/books"
            className="btn shrink-0 bg-gold px-6 py-2 text-xs font-bold uppercase tracking-wide text-slate-900 shadow-lg shadow-black/20 transition-all duration-200 hover:scale-105 hover:bg-gold-600"
          >
            {t("promo.cta")}
          </Link>
        </div>
      </section>

      {/* Section 2 — Book rows (rhbooks-style arrangement, directly under the hero) */}
      <section className="bg-white py-10 md:py-12">
        <Reveal>
          <BookCarousel
            kicker={t("promo.kicker")}
            title={t("newArrivals.title")}
            subtitle={t("newArrivals.subtitle")}
            viewAllHref="/books"
            viewAllLabel={t("bestsellers.viewAll")}
            autoplayMs={5000}
          >
            {newArrivalsRow.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onQuickView={setQuickViewBook}
              />
            ))}
          </BookCarousel>
        </Reveal>

        <Reveal>
          <BookCarousel
            title={t("bestsellers.title")}
            subtitle={t("bestsellers.subtitle")}
            viewAllHref="/books"
            viewAllLabel={t("bestsellers.viewAll")}
            autoplayMs={5000}
          >
            {bestsellersRow.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onQuickView={setQuickViewBook}
              />
            ))}
          </BookCarousel>
        </Reveal>

        {/* One row per category */}
        {categories.map((category) => {
          const categoryBooks = books.filter(
            (b) => b.category === category.en
          );
          if (categoryBooks.length === 0) return null;
          return (
            <Reveal key={category.slug}>
              <BookCarousel
                title={categoryName(category.en, locale)}
                viewAllHref={`/books?category=${category.slug}`}
                viewAllLabel={t("bestsellers.viewAll")}
                autoplayMs={5000}
              >
                {categoryBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onQuickView={setQuickViewBook}
                  />
                ))}
              </BookCarousel>
            </Reveal>
          );
        })}
      </section>

      {/* Section 3 — Categories (image-based tiles) */}
      <section className="container-daaru py-16">
        <Reveal>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-800 sm:text-3xl">
              {t("categories.title")}
            </h2>
            <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-gold" />
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              {t("categories.subtitle")}
            </p>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => {
            const tile = CATEGORY_TILES[category.slug];
            return (
              <Reveal key={category.slug} delay={index * 60}>
                <Link
                  href={`/books?category=${category.slug}`}
                  className={`group relative flex h-36 items-end overflow-hidden rounded-xl bg-gradient-to-br p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    tile?.gradient ??
                    "from-primary-700 via-primary-800 to-primary-950"
                  }`}
                >
                  {/* Dark overlay for contrast */}
                  <div className="absolute inset-0 bg-slate-950/25 transition-colors duration-300 group-hover:bg-slate-950/10" />
                  {/* Icon overlay */}
                  <div className="absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
                    <FontAwesomeIcon
                      icon={tile?.icon ?? faBook}
                      className="h-5 w-5 text-gold-200"
                    />
                  </div>
                  <div className="relative">
                    <p className="text-lg font-bold text-white">
                      {categoryName(category.en, locale)}
                    </p>
                    <p className="mt-1 text-xs text-white/75">
                      {t("categories.booksCount", {
                        count: books.filter((b) => b.category === category.en).length,
                      })}
                    </p>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Section 4 — Social proof / community reads */}
      <section className="bg-primary-50 py-16">
        <div className="container-daaru">
          <Reveal>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-primary-800 sm:text-3xl">
                {t("testimonials.title")}
              </h2>
              <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-gold" />
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                {t("testimonials.subtitle")}
              </p>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <Reveal key={testimonial.id} delay={index * 80}>
                <figure className="card flex h-full flex-col bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <div className="flex gap-0.5 text-gold" aria-label={`${testimonial.rating} / 5`}>
                    {Array.from({ length: 5 }).map((_, star) => (
                      <FontAwesomeIcon
                        key={star}
                        icon={faStar}
                        className={`h-4 w-4 ${
                          star < testimonial.rating ? "text-gold" : "text-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">
                    “{localizedReview(testimonial)}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-700 text-sm font-bold text-white">
                      {testimonial.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {testimonial.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {testimonial.handle}
                      </p>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5 — Newsletter (light green band) */}
      <section className="bg-[#e8f5e9] py-16">
        <div className="container-daaru">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold text-primary-800 sm:text-3xl">
                {t("newsletter.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-primary-700/80">
                {t("newsletter.subtitle")}
              </p>
              <NewsletterForm size="lg" variant="light" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Section 6 — Trust Badges / USPs (just before the footer, like RH Books) */}
      <section className="container-daaru py-14">
        <Reveal>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-primary-800 sm:text-3xl">
              {t("usps.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              {t("usps.subtitle")}
            </p>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {USP_KEYS.map((key, index) => (
            <Reveal key={key} delay={index * 80}>
              <div className="card h-full bg-white p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                  <FontAwesomeIcon
                    icon={USP_ICONS[key]}
                    className="h-6 w-6 text-gold"
                  />
                </div>
                <h3 className="mt-4 font-semibold text-primary-800">
                  {t(`usps.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t(`usps.${key}.description`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {quickViewBook && (
        <QuickViewModal book={quickViewBook} onClose={() => setQuickViewBook(null)} />
      )}
    </>
  );
}
