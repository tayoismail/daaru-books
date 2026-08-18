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
  faCommentDots,
  faPencil,
  faPlus,
  faStar,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import type { Testimonial } from "@/types";

interface TestimonialsAdminProps {
  user: AdminUser;
  initialTestimonials: Testimonial[];
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  const { db } = await import("@/lib/db");
  const initialTestimonials = await db.testimonials.getAll();
  return { props: { user: guard.user, initialTestimonials } };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

interface TestimonialFormState {
  name: string;
  handle: string;
  reviewEn: string;
  reviewAr: string;
  rating: string;
}

const EMPTY_FORM: TestimonialFormState = {
  name: "",
  handle: "",
  reviewEn: "",
  reviewAr: "",
  rating: "5",
};

function formFromTestimonial(t: Testimonial): TestimonialFormState {
  return {
    name: t.name,
    handle: t.handle,
    reviewEn: t.reviewEn,
    reviewAr: t.reviewAr,
    rating: String(t.rating),
  };
}

/** Inline gold star row (filled for 1..rating). */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <FontAwesomeIcon
          key={i}
          icon={faStar}
          className={`h-3.5 w-3.5 ${i < rating ? "text-gold" : "text-slate-200"}`}
        />
      ))}
    </span>
  );
}

export default function AdminTestimonials({
  user,
  initialTestimonials,
}: TestimonialsAdminProps) {
  const { t } = useTranslation();

  const [testimonials, setTestimonials] = useState<Testimonial[]>(
    initialTestimonials
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modal, setModal] = useState<
    { mode: "add"; testimonial: null } | { mode: "edit"; testimonial: Testimonial } | null
  >(null);
  const [form, setForm] = useState<TestimonialFormState>(EMPTY_FORM);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = async () => {
    const res = await fetch("/api/admin/testimonials");
    const data = (await res.json()) as { testimonials?: Testimonial[] };
    if (res.ok && data.testimonials) setTestimonials(data.testimonials);
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

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModalError("");
    setModal({ mode: "add", testimonial: null });
  };

  const openEdit = (testimonial: Testimonial) => {
    setForm(formFromTestimonial(testimonial));
    setModalError("");
    setModal({ mode: "edit", testimonial });
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    setModalError("");
    setSaving(true);
    try {
      const res = await fetch(
        modal.mode === "edit"
          ? `/api/admin/testimonials/${modal.testimonial.id}`
          : "/api/admin/testimonials",
        {
          method: modal.mode === "edit" ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setModalError(data.error ?? t("admin.testimonials.error"));
        return;
      }
      setModal(null);
      setNotice(
        modal.mode === "edit"
          ? t("admin.testimonials.updated")
          : t("admin.testimonials.added")
      );
      await reload();
    } catch {
      setModalError(t("admin.testimonials.error"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/testimonials/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(t("admin.testimonials.error"));
        return;
      }
      setDeleteTarget(null);
      setNotice(t("admin.testimonials.deleted"));
      await reload();
    } catch {
      setError(t("admin.testimonials.error"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.testimonials")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{t("admin.testimonials.intro")}</p>
          <button
            type="button"
            onClick={openAdd}
            className="btn gap-2 bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            {t("admin.testimonials.add")}
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
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("admin.testimonials.colName")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.testimonials.colHandle")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.testimonials.colReview")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.testimonials.colRating")}</th>
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
                {!loading && testimonials.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("admin.testimonials.empty")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  testimonials.map((testimonial) => (
                    <tr
                      key={testimonial.id}
                      className="transition-colors hover:bg-primary-50/40"
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-700 text-xs font-bold text-white">
                            {testimonial.name.charAt(0)}
                          </span>
                          <span className="font-medium text-slate-900">
                            {testimonial.name}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400" dir="ltr">
                        {testimonial.handle || "—"}
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        <p className="truncate text-slate-600">{testimonial.reviewEn}</p>
                        {testimonial.reviewAr && (
                          <p className="truncate text-xs text-slate-400" dir="rtl">
                            {testimonial.reviewAr}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Stars rating={testimonial.rating} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(testimonial)}
                            aria-label={`${t("admin.testimonials.edit")}: ${testimonial.name}`}
                            className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary"
                          >
                            <FontAwesomeIcon icon={faPencil} className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(testimonial)}
                            aria-label={`${t("admin.testimonials.delete")}: ${testimonial.name}`}
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
        </div>
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <TestimonialFormModal
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
          aria-label={t("admin.testimonials.confirmDeleteTitle")}
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
              <FontAwesomeIcon icon={faCommentDots} className="h-6 w-6 text-rose-600" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {t("admin.testimonials.confirmDeleteTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {t("admin.testimonials.confirmDeleteText", { name: deleteTarget.name })}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
              >
                {t("admin.testimonials.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting
                  ? t("admin.testimonials.deleting")
                  : t("admin.testimonials.delete")}
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

function TestimonialFormModal({
  mode,
  form,
  setForm,
  saving,
  error,
  onSave,
  onCancel,
}: {
  mode: "add" | "edit";
  form: TestimonialFormState;
  setForm: Dispatch<SetStateAction<TestimonialFormState>>;
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "add"
          ? t("admin.testimonials.addTitle")
          : t("admin.testimonials.editTitle")
      }
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("books.close")}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-900">
            {mode === "add"
              ? t("admin.testimonials.addTitle")
              : t("admin.testimonials.editTitle")}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="testimonial-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.testimonials.name")} *
              </label>
              <input
                id="testimonial-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="testimonial-handle" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("admin.testimonials.handle")}
              </label>
              <input
                id="testimonial-handle"
                type="text"
                value={form.handle}
                onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                placeholder="@username"
                dir="ltr"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="testimonial-review-en" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.testimonials.reviewEn")} *
            </label>
            <textarea
              id="testimonial-review-en"
              rows={3}
              required
              value={form.reviewEn}
              onChange={(e) => setForm((f) => ({ ...f, reviewEn: e.target.value }))}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div>
            <label htmlFor="testimonial-review-ar" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.testimonials.reviewAr")}
            </label>
            <textarea
              id="testimonial-review-ar"
              rows={3}
              dir="rtl"
              value={form.reviewAr}
              onChange={(e) => setForm((f) => ({ ...f, reviewAr: e.target.value }))}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="max-w-xs">
            <label htmlFor="testimonial-rating" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("admin.testimonials.rating")} *
            </label>
            <select
              id="testimonial-rating"
              value={form.rating}
              onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              className={inputClass}
            >
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} / 5
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onCancel}
              className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
            >
              {t("admin.testimonials.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
            >
              {saving ? t("admin.testimonials.saving") : t("admin.testimonials.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
