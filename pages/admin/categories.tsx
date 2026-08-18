import Head from "next/head";
import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook,
  faPencil,
  faPlus,
  faTags,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { generateSlug } from "@/lib/categoryInput";
import type { CategoryInfo } from "@/lib/categories";
import type { Book } from "@/types";

interface CategoriesAdminProps {
  user: AdminUser;
  initialCategories: CategoryInfo[];
  initialBooks: Book[];
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  const [{ readCategoryList }, { db }] = await Promise.all([
    import("@/lib/categoryStore"),
    import("@/lib/db"),
  ]);
  const [initialCategories, initialBooks] = await Promise.all([
    readCategoryList(),
    db.books.getAll(),
  ]);
  return { props: { user: guard.user, initialCategories, initialBooks } };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

interface CategoryFormState {
  en: string;
  ar: string;
}

const EMPTY_FORM: CategoryFormState = { en: "", ar: "" };

export default function AdminCategories({
  user,
  initialCategories,
  initialBooks,
}: CategoriesAdminProps) {
  const { t } = useTranslation();

  const [categories, setCategories] = useState<CategoryInfo[]>(initialCategories);
  const [books, setBooks] = useState<Book[]>(initialBooks);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState<
    { mode: "add"; category: null } | { mode: "edit"; category: CategoryInfo } | null
  >(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CategoryInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const reload = async () => {
    const [catRes, bookRes] = await Promise.all([
      fetch("/api/admin/categories"),
      fetch("/api/admin/books"),
    ]);
    const catData = (await catRes.json()) as { categories?: CategoryInfo[] };
    const bookData = (await bookRes.json()) as { books?: Book[] };
    if (catRes.ok && catData.categories) setCategories(catData.categories);
    if (bookRes.ok && bookData.books) setBooks(bookData.books);
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      await reload();
      if (!cancelled) setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const bookCount = (category: string) =>
    books.filter((book) => book.category === category).length;

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModalError("");
    setModal({ mode: "add", category: null });
  };

  const openEdit = (category: CategoryInfo) => {
    setForm({ en: category.en, ar: category.ar });
    setModalError("");
    setModal({ mode: "edit", category });
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    setModalError("");
    setSaving(true);
    try {
      const res = await fetch(
        modal.mode === "edit"
          ? `/api/admin/categories/${modal.category.slug}`
          : "/api/admin/categories",
        {
          method: modal.mode === "edit" ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setModalError(data.error ?? t("admin.categories.error"));
        return;
      }
      setModal(null);
      setNotice(
        modal.mode === "edit"
          ? t("admin.categories.updated")
          : t("admin.categories.added")
      );
      await reload();
    } catch {
      setModalError(t("admin.categories.error"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/admin/categories/${deleteTarget.slug}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        // A category with books cannot be deleted — explain why in the dialog.
        setDeleteError(data.error ?? t("admin.categories.error"));
        return;
      }
      setDeleteTarget(null);
      setNotice(t("admin.categories.deleted"));
      await reload();
    } catch {
      setDeleteError(t("admin.categories.error"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.categories")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{t("admin.categories.intro")}</p>
          <button
            type="button"
            onClick={openAdd}
            className="btn gap-2 bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            {t("admin.categories.add")}
          </button>
        </div>

        {notice && (
          <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
            {notice}
          </p>
        )}

        {/* Table */}
        <div className="card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("admin.categories.colEnglish")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.categories.colArabic")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.categories.colSlug")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.categories.colBooks")}</th>
                  <th className="px-4 py-3 text-end font-semibold">
                    {t("admin.books.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("books.loading")}…
                    </td>
                  </tr>
                )}
                {!loading && categories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("admin.categories.empty")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  categories.map((category) => {
                    const count = bookCount(category.en);
                    return (
                      <tr
                        key={category.slug}
                        className="transition-colors hover:bg-primary-50/40"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {category.en}
                        </td>
                        <td className="px-4 py-3 text-slate-600" dir="rtl">
                          {category.ar}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400" dir="ltr">
                          {category.slug}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              count > 0
                                ? "bg-primary-50 text-primary"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            <FontAwesomeIcon icon={faBook} className="h-3 w-3" />
                            {count}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(category)}
                              aria-label={`${t("admin.categories.edit")}: ${category.en}`}
                              className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary"
                            >
                              <FontAwesomeIcon icon={faPencil} className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget(category);
                              }}
                              aria-label={`${t("admin.categories.delete")}: ${category.en}`}
                              className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            >
                              <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <CategoryFormModal
          mode={modal.mode}
          form={form}
          setForm={setForm}
          saving={saving}
          error={modalError}
          onSave={submitForm}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={t("admin.categories.confirmDeleteTitle")}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label={t("books.close")}
            onClick={() => setDeleteTarget(null)}
            className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <FontAwesomeIcon icon={faTags} className="h-6 w-6 text-rose-600" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {t("admin.categories.confirmDeleteTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {t("admin.categories.confirmDeleteText", { name: deleteTarget.en })}
            </p>
            {deleteError && (
              <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
              >
                {t("admin.categories.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? t("admin.categories.deleting") : t("admin.categories.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Add / Edit modal                                                    */
/* ------------------------------------------------------------------ */

function CategoryFormModal({
  mode,
  form,
  setForm,
  saving,
  error,
  onSave,
  onCancel,
}: {
  mode: "add" | "edit";
  form: CategoryFormState;
  setForm: Dispatch<SetStateAction<CategoryFormState>>;
  saving: boolean;
  error: string;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

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

  const slug = generateSlug(form.en);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "add" ? t("admin.categories.addTitle") : t("admin.categories.editTitle")
      }
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("books.close")}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-900">
            {mode === "add" ? t("admin.categories.addTitle") : t("admin.categories.editTitle")}
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

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <form onSubmit={onSave} className="mt-5 space-y-4">
          <div>
            <label htmlFor="category-en" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.categories.en")} *
            </label>
            <input
              id="category-en"
              type="text"
              required
              value={form.en}
              onChange={(e) => setForm((f) => ({ ...f, en: e.target.value }))}
              placeholder="e.g. Biography"
              className={inputClass}
            />
            {mode === "add" && (
              <p className="mt-1.5 text-xs text-slate-400">
                {t("admin.categories.slugPreview")}:{" "}
                <span className="font-mono" dir="ltr">
                  {slug || "—"}
                </span>
              </p>
            )}
          </div>
          <div>
            <label htmlFor="category-ar" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.categories.ar")} *
            </label>
            <input
              id="category-ar"
              type="text"
              required
              dir="rtl"
              value={form.ar}
              onChange={(e) => setForm((f) => ({ ...f, ar: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onCancel}
              className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
            >
              {t("admin.categories.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
            >
              {saving ? t("admin.categories.saving") : t("admin.categories.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
