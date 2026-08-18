import Image from "next/image";
import Head from "next/head";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faChevronLeft,
  faChevronRight,
  faImage,
  faPencil,
  faPlus,
  faSearch,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { coverInitials } from "@/components/BookCard";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { CATEGORIES, categoryName } from "@/lib/categories";
import { useLanguage } from "@/lib/contexts";
import { discountPercent } from "@/lib/format";
import type { Book } from "@/types";

const PAGE_SIZE = 8;
const CATEGORY_OPTIONS = [...CATEGORIES.map((c) => c.en), "Other"];

interface BooksAdminProps {
  user: AdminUser;
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  return { props: { user: guard.user } };
}

/** Quantity pill colors: green > 20, yellow 5–20, red < 5. */
function quantityTone(quantity: number): string {
  if (quantity > 20) return "bg-primary-50 text-primary";
  if (quantity >= 5) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-600";
}

interface BookFormState {
  titleEn: string;
  titleAr: string;
  author: string;
  isbn: string;
  price: string;
  cost: string;
  originalPrice: string;
  quantity: string;
  category: string;
  descriptionEn: string;
  descriptionAr: string;
}

const EMPTY_FORM: BookFormState = {
  titleEn: "",
  titleAr: "",
  author: "",
  isbn: "",
  price: "",
  cost: "",
  originalPrice: "",
  quantity: "0",
  category: "",
  descriptionEn: "",
  descriptionAr: "",
};

function formFromBook(book: Book): BookFormState {
  return {
    titleEn: book.titleEn,
    titleAr: book.titleAr,
    author: book.author,
    isbn: book.isbn,
    price: String(book.price),
    cost: typeof book.cost === "number" ? String(book.cost) : "",
    originalPrice: book.originalPrice ? String(book.originalPrice) : "",
    quantity: String(book.quantity),
    category: book.category,
    descriptionEn: book.descriptionEn,
    descriptionAr: book.descriptionAr,
  };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function AdminBooks({ user }: BooksAdminProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState<
    { mode: "add"; book: null } | { mode: "edit"; book: Book } | null
  >(null);
  const [form, setForm] = useState<BookFormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [restockTarget, setRestockTarget] = useState<Book | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockReason, setRestockReason] = useState("");
  const [restocking, setRestocking] = useState(false);
  const [restockError, setRestockError] = useState("");

  const loadBooks = async () => {
    try {
      const res = await fetch("/api/admin/books");
      const data = (await res.json()) as { books?: Book[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? t("admin.books.error"));
        return false;
      }
      setBooks(data.books ?? []);
      return true;
    } catch {
      setError(t("admin.books.error"));
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/books");
        const data = (await res.json()) as { books?: Book[] };
        if (!cancelled && res.ok) setBooks(data.books ?? []);
        if (!cancelled && !res.ok) setError(t("admin.books.error"));
      } catch {
        if (!cancelled) setError(t("admin.books.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side search + pagination
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.titleEn.toLowerCase().includes(q) ||
        b.titleAr.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
    );
  }, [books, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageBooks = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const localizedCategory = (en: string) =>
    en === "Other" ? t("admin.books.other") : categoryName(en, locale);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setError("");
    setModal({ mode: "add", book: null });
  };

  const openEdit = (book: Book) => {
    setForm(formFromBook(book));
    setImageFile(null);
    setError("");
    setModal({ mode: "edit", book });
  };

  const openRestock = (book: Book) => {
    setRestockQty("");
    setRestockReason("");
    setRestockError("");
    setRestockTarget(book);
  };

  const submitRestock = async (e: FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    setRestockError("");
    setRestocking(true);
    try {
      const res = await fetch(`/api/admin/books/${restockTarget.id}/restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Number(restockQty),
          reason: restockReason,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setRestockError(data.error ?? t("admin.books.error"));
        return;
      }
      setRestockTarget(null);
      setNotice(t("admin.books.restocked"));
      await loadBooks();
    } catch {
      setRestockError(t("admin.books.error"));
    } finally {
      setRestocking(false);
    }
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!modal) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("titleEn", form.titleEn);
      fd.append("titleAr", form.titleAr);
      fd.append("author", form.author);
      fd.append("isbn", form.isbn);
      fd.append("price", form.price);
      fd.append("cost", form.cost);
      fd.append("originalPrice", form.originalPrice);
      fd.append("quantity", form.quantity);
      fd.append("category", form.category);
      fd.append("descriptionEn", form.descriptionEn);
      fd.append("descriptionAr", form.descriptionAr);
      if (imageFile) fd.append("image", imageFile);

      const res = await fetch(
        modal.mode === "edit" ? `/api/admin/books/${modal.book.id}` : "/api/admin/books",
        { method: modal.mode === "edit" ? "PUT" : "POST", body: fd }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("admin.books.error"));
        return;
      }
      setModal(null);
      setNotice(t("admin.books.saved"));
      await loadBooks();
    } catch {
      setError(t("admin.books.error"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/books/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(t("admin.books.error"));
        return;
      }
      setDeleteTarget(null);
      setNotice(t("admin.books.deleted"));
      await loadBooks();
    } catch {
      setError(t("admin.books.error"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.books")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <FontAwesomeIcon icon={faSearch} className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              name="q"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("admin.books.search")}
              aria-label={t("admin.books.search")}
              className="w-full min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="btn gap-2 bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            {t("admin.books.addBook")}
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

        {/* Table */}
        <div className="card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("admin.books.colImage")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.books.colTitle")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.books.colAuthor")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.books.colPrice")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.books.colQty")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.books.colCategory")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t("admin.books.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("books.loading")}…
                    </td>
                  </tr>
                )}
                {!loading && pageBooks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("admin.books.empty")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageBooks.map((book) => (
                    <tr key={book.id} className="transition-colors hover:bg-primary-50/40">
                      {/* Thumbnail */}
                      <td className="px-4 py-3">
                        <span className="relative flex h-14 w-11 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950">
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
                      </td>
                      {/* Title both languages */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{book.titleEn}</p>
                        <p className="mt-0.5 text-xs text-slate-400" dir="rtl">
                          {book.titleAr}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{book.author}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const d = discountPercent(
                            book.price,
                            book.originalPrice
                          );
                          return (
                            <>
                              <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                                ₦{book.price.toLocaleString()}
                                {d && (
                                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                                    -{d}%
                                  </span>
                                )}
                              </p>
                        {d && book.originalPrice && (
                          <p className="text-xs text-slate-400 line-through">
                            ₦{book.originalPrice.toLocaleString()}
                          </p>
                        )}
                        {typeof book.cost === "number" &&
                          (() => {
                            const margin = book.price - book.cost;
                            return (
                              <p
                                className={`mt-0.5 text-xs font-medium ${
                                  margin < 0
                                    ? "text-rose-500"
                                    : "text-emerald-600"
                                }`}
                              >
                                {t("admin.books.margin")}: ₦
                                {margin.toLocaleString()}
                              </p>
                            );
                          })()}
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${quantityTone(book.quantity)}`}
                        >
                          {book.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {localizedCategory(book.category)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openRestock(book)}
                            aria-label={`${t("admin.books.restock")}: ${book.titleEn}`}
                            className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <FontAwesomeIcon icon={faBoxOpen} className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(book)}
                            aria-label={`${t("admin.books.editBook")}: ${book.titleEn}`}
                            className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary"
                          >
                            <FontAwesomeIcon icon={faPencil} className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(book)}
                            aria-label={`${t("admin.books.deleteBook")}: ${book.titleEn}`}
                            className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 px-4 py-4">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="me-1 h-3 w-3" />
                {t("books.previous")}
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) =>
                n === safePage ? (
                  <span
                    key={n}
                    aria-current="page"
                    className="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2.5 text-sm font-bold text-white"
                  >
                    {n}
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className="flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-300 px-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary"
                  >
                    {n}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
              >
                {t("books.next")}
                <FontAwesomeIcon icon={faChevronRight} className="ms-1 h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <BookFormModal
          mode={modal.mode}
          form={form}
          setForm={setForm}
          imageFile={imageFile}
          setImageFile={setImageFile}
          currentImageUrl={modal.mode === "edit" ? modal.book.imageUrl : undefined}
          saving={saving}
          error={error}
          onSave={submitForm}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDeleteModal
          book={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* Restock modal */}
      {restockTarget && (
        <RestockModal
          book={restockTarget}
          quantity={restockQty}
          setQuantity={setRestockQty}
          reason={restockReason}
          setReason={setRestockReason}
          saving={restocking}
          error={restockError}
          onSave={submitRestock}
          onCancel={() => setRestockTarget(null)}
        />
      )}
    </AdminLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Add / Edit modal                                                    */
/* ------------------------------------------------------------------ */

interface BookFormModalProps {
  mode: "add" | "edit";
  form: BookFormState;
  setForm: Dispatch<SetStateAction<BookFormState>>;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  currentImageUrl?: string;
  saving: boolean;
  error: string;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
}

function BookFormModal({
  mode,
  form,
  setForm,
  imageFile,
  setImageFile,
  currentImageUrl,
  saving,
  error,
  onSave,
  onCancel,
}: BookFormModalProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);

  // Show a live preview of the picked image. Writes are deferred so setState
  // never runs synchronously inside the effect (react-hooks rule).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!imageFile) {
        setPreview(null);
      } else {
        const url = URL.createObjectURL(imageFile);
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [imageFile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel]);

  const set = (key: keyof BookFormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const displayImage = preview ?? currentImageUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.books.editBook")}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("books.close")}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">
            {mode === "add" ? t("admin.books.addBook") : t("admin.books.editBook")}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("books.close")}
            className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-5 p-6">
          {error && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}

          {/* Image upload */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.books.image")}
            </span>
            <div className="flex items-center gap-4">
              <span className="flex h-24 w-[5.5rem] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950">
                {displayImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayImage}
                    alt={t("admin.books.image")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <FontAwesomeIcon icon={faImage} className="h-6 w-6 text-white/40" />
                )}
              </span>
              <label className="cursor-pointer">
                <span className="btn border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary">
                  {displayImage ? t("admin.books.changeImage") : t("admin.books.chooseImage")}
                </span>
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-xs text-slate-400">{t("admin.books.uploadHint")}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="titleEn" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.titleEn")} *
              </label>
              <input
                id="titleEn"
                type="text"
                required
                value={form.titleEn}
                onChange={(e) => set("titleEn")(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="titleAr" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.titleAr")} *
              </label>
              <input
                id="titleAr"
                type="text"
                required
                dir="rtl"
                value={form.titleAr}
                onChange={(e) => set("titleAr")(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="author" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.author")} *
              </label>
              <input
                id="author"
                type="text"
                required
                value={form.author}
                onChange={(e) => set("author")(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="isbn" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.isbn")}
              </label>
              <input
                id="isbn"
                type="text"
                value={form.isbn}
                onChange={(e) => set("isbn")(e.target.value)}
                placeholder="978-…"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.price")} (₦) *
              </label>
              <input
                id="price"
                type="number"
                required
                min={1}
                step="any"
                value={form.price}
                onChange={(e) => set("price")(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="cost" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.cost")} (₦)
              </label>
              <input
                id="cost"
                type="number"
                min={0}
                step="any"
                value={form.cost}
                onChange={(e) => set("cost")(e.target.value)}
                placeholder={t("admin.books.costHint")}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="quantity" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.quantity")} *
              </label>
              <input
                id="quantity"
                type="number"
                required
                min={0}
                step={1}
                value={form.quantity}
                onChange={(e) => set("quantity")(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="originalPrice" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.originalPrice")} (₦)
              </label>
              <input
                id="originalPrice"
                type="number"
                min={1}
                step="any"
                value={form.originalPrice}
                onChange={(e) => set("originalPrice")(e.target.value)}
                placeholder={t("admin.books.originalPriceHint")}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.category")} *
              </label>
              <select
                id="category"
                required
                value={form.category}
                onChange={(e) => set("category")(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  {t("admin.books.selectCategory")}
                </option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "Other" ? t("admin.books.other") : categoryName(cat, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="descriptionEn" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.descriptionEn")}
              </label>
              <textarea
                id="descriptionEn"
                rows={3}
                value={form.descriptionEn}
                onChange={(e) => set("descriptionEn")(e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label htmlFor="descriptionAr" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.books.descriptionAr")}
              </label>
              <textarea
                id="descriptionAr"
                rows={3}
                dir="rtl"
                value={form.descriptionAr}
                onChange={(e) => set("descriptionAr")(e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onCancel}
              className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
            >
              {t("admin.books.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
            >
              {saving ? t("admin.books.saving") : t("admin.books.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Restock modal                                                       */
/* ------------------------------------------------------------------ */

function RestockModal({
  book,
  quantity,
  setQuantity,
  reason,
  setReason,
  saving,
  error,
  onSave,
  onCancel,
}: {
  book: Book;
  quantity: string;
  setQuantity: Dispatch<SetStateAction<string>>;
  reason: string;
  setReason: Dispatch<SetStateAction<string>>;
  saving: boolean;
  error: string;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const localizedTitle = locale === "ar" && book.titleAr ? book.titleAr : book.titleEn;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.books.restockTitle")}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("books.close")}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <FontAwesomeIcon icon={faBoxOpen} className="h-6 w-6 text-emerald-600" />
        </span>
        <h3 className="mt-4 text-center text-lg font-bold text-slate-900">
          {t("admin.books.restockTitle")}
        </h3>
        <p className="mt-1 text-center text-sm font-medium text-slate-700">
          {localizedTitle}
        </p>
        <p className="mt-0.5 text-center text-xs text-slate-400">
          {t("admin.books.restockCurrent", { count: book.quantity })}
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <form onSubmit={onSave} className="mt-5 space-y-4">
          <div>
            <label htmlFor="restock-qty" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.books.restockQty")} *
            </label>
            <input
              id="restock-qty"
              type="number"
              required
              min={1}
              step={1}
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="restock-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.books.restockReason")}
            </label>
            <input
              id="restock-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("admin.books.restockReasonPlaceholder")}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
            >
              {t("admin.books.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? t("admin.books.restocking") : t("admin.books.restockAdd")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delete confirmation modal                                           */
/* ------------------------------------------------------------------ */

function ConfirmDeleteModal({
  book,
  deleting,
  onCancel,
  onConfirm,
}: {
  book: Book;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const localizedTitle = locale === "ar" && book.titleAr ? book.titleAr : book.titleEn;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={t("admin.books.confirmDeleteTitle")}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("books.close")}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
          <FontAwesomeIcon icon={faTrashCan} className="h-6 w-6 text-rose-600" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-slate-900">
          {t("admin.books.confirmDeleteTitle")}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {t("admin.books.confirmDeleteText", { title: localizedTitle })}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
          >
            {t("admin.books.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="btn bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? t("admin.books.deleting") : t("admin.books.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
