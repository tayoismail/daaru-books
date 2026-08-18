import Image from "next/image";
import Head from "next/head";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown,
  faArrowUp,
  faCheck,
  faImages,
  faPlus,
  faSearch,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { coverInitials } from "@/components/BookCard";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { useLanguage } from "@/lib/contexts";
import type { Book, SlidesConfig, SlidesWelcome } from "@/types";

type WelcomeTextKey = Exclude<keyof SlidesWelcome, "enabled">;

const WELCOME_FIELDS: { key: WelcomeTextKey; labelKey: string }[] = [
  { key: "badge", labelKey: "fieldBadge" },
  { key: "title", labelKey: "fieldTitle" },
  { key: "subtitle", labelKey: "fieldSubtitle" },
  { key: "cta", labelKey: "fieldCta" },
  { key: "secondary", labelKey: "fieldSecondary" },
  { key: "searchPlaceholder", labelKey: "fieldSearchPlaceholder" },
  { key: "searchButton", labelKey: "fieldSearchButton" },
  { key: "newArrivalsBadge", labelKey: "fieldNewArrivalsBadge" },
  { key: "viewBook", labelKey: "fieldViewBook" },
];

interface SlidesAdminProps {
  user: AdminUser;
  initialSlides: SlidesConfig;
  books: Book[];
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;

  const [{ getSlidesConfig }, { db }] = await Promise.all([
    import("@/lib/slides"),
    import("@/lib/db"),
  ]);
  const [slides, books] = await Promise.all([
    getSlidesConfig(),
    db.books.getAll(),
  ]);
  // Drop pins that no longer exist (and duplicates) so the editor never
  // shows ghosts.
  const known = new Set(books.map((book) => book.id));
  const initialSlides: SlidesConfig = {
    ...slides,
    featuredBookIds: [...new Set(slides.featuredBookIds.filter((id) => known.has(id)))],
  };
  return { props: { user: guard.user, initialSlides, books } };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const LANG_TABS = [
  { lang: "en", tone: "bg-primary text-white border-primary" },
  { lang: "ar", tone: "bg-emerald-600 text-white border-emerald-600" },
] as const;

export default function AdminSlides({ user, initialSlides, books }: SlidesAdminProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();

  const [draft, setDraft] = useState<SlidesConfig>(initialSlides);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Book picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const localizedTitle = (book: Book) =>
    locale === "ar" && book.titleAr ? book.titleAr : book.titleEn;

  const setWelcome = (key: WelcomeTextKey, lang: "en" | "ar", value: string) =>
    setDraft((d) => ({
      ...d,
      welcome: {
        ...d.welcome,
        [key]: { ...d.welcome[key], [lang]: value },
      },
    }));

  const move = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      const ids = [...d.featuredBookIds];
      const from = ids.indexOf(id);
      const to = from + dir;
      if (from === -1 || to < 0 || to >= ids.length) return d;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      return { ...d, featuredBookIds: ids };
    });

  const removeFeatured = (id: string) =>
    setDraft((d) => ({
      ...d,
      featuredBookIds: d.featuredBookIds.filter((x) => x !== id),
    }));

  const addFeatured = (id: string) =>
    setDraft((d) => ({
      ...d,
      featuredBookIds: d.featuredBookIds.includes(id)
        ? d.featuredBookIds
        : [...d.featuredBookIds, id],
    }));

  // Pickable books: in stock, not already featured, matching the query.
  const pickable = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return books.filter(
      (book) =>
        book.quantity > 0 &&
        !draft.featuredBookIds.includes(book.id) &&
        (!q ||
          book.titleEn.toLowerCase().includes(q) ||
          book.titleAr.toLowerCase().includes(q) ||
          book.author.toLowerCase().includes(q))
    );
  }, [books, draft.featuredBookIds, pickerQuery]);

  const featuredBooks = useMemo(
    () =>
      draft.featuredBookIds
        .map((id) => books.find((book) => book.id === id))
        .filter((book): book is Book => Boolean(book)),
    [books, draft.featuredBookIds]
  );

  const submitSave = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/slides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as {
        slides?: SlidesConfig;
        error?: string;
      };
      if (!res.ok || !data.slides) {
        setError(data.error ?? t("admin.slides.error"));
        return;
      }
      setDraft(data.slides);
      setNotice(t("admin.slides.saved"));
    } catch {
      setError(t("admin.slides.error"));
    } finally {
      setSaving(false);
    }
  };

  const uploadBanner = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/admin/slides/banners", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        slides?: SlidesConfig;
        error?: string;
      };
      if (!res.ok || !data.slides) {
        setError(data.error ?? t("admin.slides.error"));
        return;
      }
      setDraft(data.slides);
      setNotice(t("admin.slides.bannerAdded"));
    } catch {
      setError(t("admin.slides.error"));
    } finally {
      setUploading(false);
    }
  };

  const removeBanner = async (url: string) => {
    setError("");
    setNotice("");
    try {
      const res = await fetch(
        `/api/admin/slides/banners?url=${encodeURIComponent(url)}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as {
        slides?: SlidesConfig;
        error?: string;
      };
      if (!res.ok || !data.slides) {
        setError(data.error ?? t("admin.slides.error"));
        return;
      }
      setDraft(data.slides);
      setNotice(t("admin.slides.bannerRemoved"));
    } catch {
      setError(t("admin.slides.error"));
    }
  };

  // Close on Escape + lock body scroll while the picker is open (matches the
  // books/expenses modal pattern).
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [pickerOpen]);

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.slides")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <form id="slides-form" onSubmit={submitSave} className="space-y-6 pb-20">
        {/* Intro */}
        <div className="card flex flex-col gap-4 bg-white p-6 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
            <FontAwesomeIcon icon={faImages} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">
              {t("admin.titles.slides")}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{t("admin.slides.intro")}</p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn gap-2 bg-primary px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
            {saving ? t("admin.slides.saving") : t("admin.slides.save")}
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}
        {notice && (
          <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
            {notice}
          </p>
        )}

        {/* Featured books */}
        <section className="card bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t("admin.slides.featuredTitle")}
              </h3>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                {t("admin.slides.featuredSubtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPickerQuery("");
                setPickerOpen(true);
              }}
              className="btn gap-2 bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-800"
            >
              <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
              {t("admin.slides.addBook")}
            </button>
          </div>

          {featuredBooks.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-400">
              {t("admin.slides.noFeatured")}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {featuredBooks.map((book, index) => (
                <li
                  key={book.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  {/* Position number */}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  {/* Thumbnail */}
                  <span className="relative flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950">
                    {book.imageUrl ? (
                      <Image
                        src={book.imageUrl}
                        alt={book.titleEn}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-white/90">
                        {coverInitials(book.titleEn)}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {localizedTitle(book)}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {book.author}
                      {book.quantity === 0 && (
                        <span className="ms-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                          {t("book.outOfStock")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(book.id, -1)}
                      aria-label={t("admin.slides.moveUp")}
                      title={t("admin.slides.moveUp")}
                      className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary disabled:opacity-30"
                    >
                      <FontAwesomeIcon icon={faArrowUp} className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === featuredBooks.length - 1}
                      onClick={() => move(book.id, 1)}
                      aria-label={t("admin.slides.moveDown")}
                      title={t("admin.slides.moveDown")}
                      className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary disabled:opacity-30"
                    >
                      <FontAwesomeIcon icon={faArrowDown} className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFeatured(book.id)}
                      aria-label={t("admin.slides.removeBook")}
                      title={t("admin.slides.removeBook")}
                      className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <FontAwesomeIcon icon={faTrashCan} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Banner images */}
        <section className="card bg-white p-6">
          <h3 className="text-base font-bold text-slate-900">
            {t("admin.slides.bannersTitle")}
          </h3>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-500">
            {t("admin.slides.bannersSubtitle")}
          </p>

          {draft.banners.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-400">
              {t("admin.slides.noBanners")}
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {draft.banners.map((url) => (
                <div
                  key={url}
                  className="group relative aspect-[16/7] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeBanner(url)}
                    aria-label={t("admin.slides.removeBanner")}
                    title={t("admin.slides.removeBanner")}
                    className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/60 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 focus:opacity-100"
                  >
                    <FontAwesomeIcon icon={faTrashCan} className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload tile */}
          <label
            className={`mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 px-4 py-5 text-sm font-medium text-slate-500 transition-colors hover:border-primary hover:text-primary ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <FontAwesomeIcon
              icon={uploading ? faImages : faPlus}
              className="h-4 w-4"
            />
            {uploading ? t("admin.slides.uploading") : t("admin.slides.uploadBanner")}
            <span className="text-xs font-normal text-slate-400">
              {t("admin.slides.bannerHint")}
            </span>
            <input
              type="file"
              name="banner"
              accept="image/*"
              className="sr-only"
              onChange={uploadBanner}
            />
          </label>
        </section>

        {/* Welcome slide */}
        <section className="card bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t("admin.slides.welcomeTitle")}
              </h3>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                {t("admin.slides.welcomeSubtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={draft.welcome.enabled}
                aria-label={t("admin.slides.showWelcome")}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    welcome: { ...d.welcome, enabled: !d.welcome.enabled },
                  }))
                }
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                  draft.welcome.enabled ? "bg-primary" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    draft.welcome.enabled ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-slate-700">
                {t("admin.slides.showWelcome")}
              </span>
            </div>
          </div>

          {draft.welcome.enabled && (
            <div className="mt-5 space-y-4">
              {WELCOME_FIELDS.map(({ key, labelKey }) => (
                <div key={key}>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t(`admin.slides.${labelKey}`)}
                  </span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {LANG_TABS.map(({ lang, tone }) => (
                      <div key={lang} className="relative">
                        <span
                          className={`pointer-events-none absolute start-0 top-0 flex h-full items-center rounded-s-xl border border-e-0 px-2.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}
                        >
                          {t(`admin.slides.${lang}`)}
                        </span>
                        {key === "subtitle" ? (
                          <textarea
                            rows={2}
                            dir={lang === "ar" ? "rtl" : "ltr"}
                            value={draft.welcome[key][lang]}
                            onChange={(e) => setWelcome(key, lang, e.target.value)}
                            placeholder={t(`hero.${key}`)}
                            className={`${inputClass} resize-none ps-12`}
                          />
                        ) : (
                          <input
                            type="text"
                            dir={lang === "ar" ? "rtl" : "ltr"}
                            value={draft.welcome[key][lang]}
                            onChange={(e) => setWelcome(key, lang, e.target.value)}
                            placeholder={t(`hero.${key}`)}
                            className={`${inputClass} ps-12`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Autoplay */}
        <section className="card bg-white p-6">
          <h3 className="text-base font-bold text-slate-900">
            {t("admin.slides.autoplayTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {t("admin.slides.autoplaySubtitle")}
          </p>
          <div className="mt-4 max-w-xs">
            <label htmlFor="autoplayMs" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.slides.autoplayMs")}
            </label>
            <input
              id="autoplayMs"
              type="number"
              min={0}
              max={60000}
              step={1000}
              value={draft.autoplayMs}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  autoplayMs: Number(e.target.value) || 0,
                }))
              }
              className={inputClass}
            />
          </div>
        </section>
      </form>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <p
            className={`min-w-0 truncate text-xs ${
              error ? "text-rose-600" : "text-slate-400"
            }`}
          >
            {error || notice || " "}
          </p>
          <button
            type="submit"
            form="slides-form"
            disabled={saving}
            className="btn shrink-0 gap-2 bg-primary px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
            {saving ? t("admin.slides.saving") : t("admin.slides.save")}
          </button>
        </div>
      </div>

      {/* Book picker modal */}
      {pickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("admin.slides.addBookTitle")}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label={t("books.close")}
            onClick={() => setPickerOpen(false)}
            className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
          />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {t("admin.slides.addBookTitle")}
                </h3>
                <p className="text-xs text-slate-400">
                  {t("admin.slides.addBookSubtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label={t("books.close")}
                className="btn h-9 w-9 shrink-0 p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-slate-100 px-6 py-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <FontAwesomeIcon icon={faSearch} className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="search"
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={t("admin.slides.searchBooks")}
                  aria-label={t("admin.slides.searchBooks")}
                  className="w-full min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {pickable.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-slate-400">
                  {pickerQuery.trim() ? t("admin.slides.noResults") : t("admin.slides.allAdded")}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {pickable.map((book) => (
                    <li key={book.id}>
                      <button
                        type="button"
                        onClick={() => addFeatured(book.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-primary-50/60 focus:outline-none focus-visible:bg-primary-50/60"
                      >
                        <span className="relative flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950">
                          {book.imageUrl ? (
                            <Image
                              src={book.imageUrl}
                              alt={book.titleEn}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-[9px] font-bold text-white/90">
                              {coverInitials(book.titleEn)}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {localizedTitle(book)}
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {book.author}
                          </span>
                        </span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-300">
                          <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
