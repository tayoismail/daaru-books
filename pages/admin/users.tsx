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
  faKey,
  faPencil,
  faPlus,
  faTrashCan,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import type { User } from "@/types";

/** The user shape the API sends (no password). */
type SafeUser = Omit<User, "password">;

interface UsersAdminProps {
  user: AdminUser;
  initialUsers: SafeUser[];
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  const { db } = await import("@/lib/db");
  const allUsers = await db.users.getAll();
  const safeUsers = allUsers.map(({ password: _, ...rest }) => rest);
  return { props: { user: guard.user, initialUsers: safeUsers } };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/* ------------------------------------------------------------------ */
/* Create user form state                                              */
/* ------------------------------------------------------------------ */

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: "admin" | "customer";
}

const EMPTY_CREATE: CreateUserForm = {
  name: "",
  email: "",
  password: "",
  role: "customer",
};

/* ------------------------------------------------------------------ */
/* Main page component                                                 */
/* ------------------------------------------------------------------ */

export default function AdminUsers({
  user,
  initialUsers,
}: UsersAdminProps) {
  const { t } = useTranslation();

  const [users, setUsers] = useState<SafeUser[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Add modal
  const [addModal, setAddModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>(EMPTY_CREATE);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState<SafeUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "customer">("customer");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Password modal
  const [pwTarget, setPwTarget] = useState<SafeUser | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SafeUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = async () => {
    const res = await fetch("/api/admin/users");
    const data = (await res.json()) as { users?: SafeUser[] };
    if (res.ok && data.users) setUsers(data.users);
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

  /* ── Create user ─────────────────────────────────────────────────── */
  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setCreateError(data.error ?? t("admin.users.error"));
        return;
      }
      setAddModal(false);
      setCreateForm(EMPTY_CREATE);
      setNotice(t("admin.users.created"));
      await reload();
    } catch {
      setCreateError(t("admin.users.error"));
    } finally {
      setCreating(false);
    }
  };

  /* ── Edit user ───────────────────────────────────────────────────── */
  const openEdit = (u: SafeUser) => {
    setEditTarget(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditError("");
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError("");
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditError(data.error ?? t("admin.users.error"));
        return;
      }
      setEditTarget(null);
      setNotice(t("admin.users.updated"));
      await reload();
    } catch {
      setEditError(t("admin.users.error"));
    } finally {
      setSavingEdit(false);
    }
  };

  /* ── Change password ─────────────────────────────────────────────── */
  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!pwTarget) return;
    setPwError("");
    setSavingPw(true);
    try {
      const res = await fetch(`/api/admin/users/${pwTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwValue }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPwError(data.error ?? t("admin.users.error"));
        return;
      }
      setPwTarget(null);
      setPwValue("");
      setNotice(t("admin.users.passwordChanged"));
    } catch {
      setPwError(t("admin.users.error"));
    } finally {
      setSavingPw(false);
    }
  };

  /* ── Delete user ─────────────────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("admin.users.error"));
        return;
      }
      setDeleteTarget(null);
      setNotice(t("admin.users.deleted"));
      await reload();
    } catch {
      setError(t("admin.users.error"));
    } finally {
      setDeleting(false);
    }
  };

  /* ── Helpers ──────────────────────────────────────────────────────── */
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const isSelf = (u: SafeUser) => u.id === user.id;

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.users")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">{t("admin.users.intro")}</p>
          <button
            type="button"
            onClick={() => {
              setCreateForm(EMPTY_CREATE);
              setCreateError("");
              setAddModal(true);
            }}
            className="btn gap-2 bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800"
          >
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
            {t("admin.users.add")}
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}
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
                  <th className="px-4 py-3 font-semibold">
                    {t("admin.users.colUser")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("admin.users.colEmail")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("admin.users.colRole")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("admin.users.colJoined")}
                  </th>
                  <th className="px-4 py-3 text-end font-semibold">
                    {t("admin.books.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-slate-400"
                    >
                      {t("books.loading")}…
                    </td>
                  </tr>
                )}
                {!loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-slate-400"
                    >
                      {t("admin.users.empty")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-primary-50/40"
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-700 text-xs font-bold text-white">
                            {initials(u.name)}
                          </span>
                          <span className="font-medium text-slate-900">
                            {u.name}
                            {isSelf(u) && (
                              <span className="ms-1.5 text-xs text-slate-400">
                                ({t("admin.users.you")})
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500" dir="ltr">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.role === "admin"
                              ? "bg-gold/20 text-gold-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {u.role === "admin"
                            ? t("admin.users.roleAdmin")
                            : t("admin.users.roleCustomer")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            aria-label={`${t("admin.users.edit")}: ${u.name}`}
                            title={t("admin.users.edit")}
                            className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary"
                          >
                            <FontAwesomeIcon icon={faPencil} className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPwTarget(u);
                              setPwValue("");
                              setPwError("");
                            }}
                            aria-label={`${t("admin.users.changePassword")}: ${u.name}`}
                            title={t("admin.users.changePassword")}
                            className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                          >
                            <FontAwesomeIcon icon={faKey} className="h-4 w-4" />
                          </button>
                          {!isSelf(u) && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(u)}
                              aria-label={`${t("admin.users.delete")}: ${u.name}`}
                              title={t("admin.users.delete")}
                              className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            >
                              <FontAwesomeIcon
                                icon={faTrashCan}
                                className="h-4 w-4"
                              />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Add user modal ──────────────────────────────────────────── */}
      {addModal && (
        <UserFormModal
          title={t("admin.users.addTitle")}
          form={createForm}
          setForm={setCreateForm}
          saving={creating}
          error={createError}
          onSave={submitCreate}
          onCancel={() => setAddModal(false)}
          showPassword
          showRole
        />
      )}

      {/* ── Edit user modal ─────────────────────────────────────────── */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("admin.users.editTitle")}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label={t("books.close")}
            onClick={() => setEditTarget(null)}
            className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">
                {t("admin.users.editTitle")}
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label={t("books.close")}
                className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
              </button>
            </div>

            {editError && (
              <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {editError}
              </p>
            )}

            <form onSubmit={submitEdit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="edit-name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.users.name")} *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.users.email")} *
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-role"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.users.role")}
                </label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) =>
                    setEditRole(e.target.value as "admin" | "customer")
                  }
                  className={inputClass}
                >
                  <option value="admin">{t("admin.users.roleAdmin")}</option>
                  <option value="customer">
                    {t("admin.users.roleCustomer")}
                  </option>
                </select>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
                >
                  {t("admin.users.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
                >
                  {savingEdit
                    ? t("admin.users.saving")
                    : t("admin.users.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Change password modal ────────────────────────────────────── */}
      {pwTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("admin.users.changePassword")}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label={t("books.close")}
            onClick={() => setPwTarget(null)}
            className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">
                {t("admin.users.changePasswordTitle", { name: pwTarget.name })}
              </h3>
              <button
                type="button"
                onClick={() => setPwTarget(null)}
                aria-label={t("books.close")}
                className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
              </button>
            </div>

            {pwError && (
              <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {pwError}
              </p>
            )}

            <form onSubmit={submitPassword} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="pw-value"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.users.newPassword")} *
                </label>
                <input
                  id="pw-value"
                  type="password"
                  required
                  minLength={6}
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setPwTarget(null)}
                  className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
                >
                  {t("admin.users.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={savingPw}
                  className="btn bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
                >
                  {savingPw
                    ? t("admin.users.saving")
                    : t("admin.users.updatePassword")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ──────────────────────────────────────── */}
      {deleteTarget && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={t("admin.users.confirmDeleteTitle")}
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
              <FontAwesomeIcon
                icon={faUsers}
                className="h-6 w-6 text-rose-600"
              />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {t("admin.users.confirmDeleteTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {t("admin.users.confirmDeleteText", { name: deleteTarget.name })}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
              >
                {t("admin.users.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting
                  ? t("admin.users.deleting")
                  : t("admin.users.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable form modal (Add user only — edit uses inline modal above)   */
/* ------------------------------------------------------------------ */

function UserFormModal({
  title,
  form,
  setForm,
  saving,
  error,
  onSave,
  onCancel,
  showPassword,
  showRole,
}: {
  title: string;
  form: CreateUserForm;
  setForm: Dispatch<SetStateAction<CreateUserForm>>;
  saving: boolean;
  error: string;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
  showPassword?: boolean;
  showRole?: boolean;
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
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("books.close")}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
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
            <label
              htmlFor="create-name"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {t("admin.users.name")} *
            </label>
            <input
              id="create-name"
              type="text"
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="create-email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              {t("admin.users.email")} *
            </label>
            <input
              id="create-email"
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              className={inputClass}
            />
          </div>
          {showPassword && (
            <div>
              <label
                htmlFor="create-password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                {t("admin.users.password")} * (min 6 chars)
              </label>
              <input
                id="create-password"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className={inputClass}
              />
            </div>
          )}
          {showRole && (
            <div>
              <label
                htmlFor="create-role"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                {t("admin.users.role")}
              </label>
              <select
                id="create-role"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as "admin" | "customer",
                  }))
                }
                className={inputClass}
              >
                <option value="customer">
                  {t("admin.users.roleCustomer")}
                </option>
                <option value="admin">{t("admin.users.roleAdmin")}</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onCancel}
              className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
            >
              {t("admin.users.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
            >
              {saving ? t("admin.users.saving") : t("admin.users.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
