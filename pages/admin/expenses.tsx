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
import { type IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBox,
  faBoxesStacked,
  faBuilding,
  faBullhorn,
  faChevronLeft,
  faChevronRight,
  faCoins,
  faCreditCard,
  faDownload,
  faLaptopCode,
  faLightbulb,
  faPencil,
  faPlus,
  faSackDollar,
  faTrashCan,
  faTruckFast,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { useLanguage } from "@/lib/contexts";
import { csvDate, downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  expenseCategoryName,
} from "@/lib/expenseInput";
import {
  PERIOD_OPTIONS,
  resolveRange,
} from "@/lib/finance";
import type { Expense, ExpenseCategory, ExpenseCategoryDef } from "@/types";

const PAGE_SIZE = 8;

interface AdminExpensesProps {
  user: AdminUser;
  /** Live expense categories (fallback: the shipped defaults). */
  expenseCategories: ExpenseCategoryDef[];
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  const { db } = await import("@/lib/db");
  const categories = await db.expenseCategories.getAll();
  return {
    props: {
      user: guard.user,
      expenseCategories:
        categories.length > 0 ? categories : DEFAULT_EXPENSE_CATEGORIES,
    },
  };
}

const CATEGORY_TONES = [
  "bg-primary-50 text-primary",
  "bg-blue-50 text-blue-600",
  "bg-amber-50 text-amber-700",
  "bg-emerald-50 text-emerald-600",
  "bg-violet-50 text-violet-600",
  "bg-rose-50 text-rose-600",
  "bg-sky-50 text-sky-600",
  "bg-lime-50 text-lime-600",
  "bg-fuchsia-50 text-fuchsia-600",
  "bg-slate-100 text-slate-600",
] as const;

const CATEGORY_ICONS: Record<string, IconDefinition> = {
  COGS: faBoxesStacked,
  Utility: faLightbulb,
  Other: faCoins,
  Rent: faBuilding,
  Salaries: faUsers,
  "Shipping & Delivery": faTruckFast,
  Packaging: faBox,
  Marketing: faBullhorn,
  "Bank & Payment Fees": faCreditCard,
  Software: faLaptopCode,
};

function categoryTone(index: number): string {
  return CATEGORY_TONES[index % CATEGORY_TONES.length];
}

function categoryIcon(id: string): IconDefinition {
  return CATEGORY_ICONS[id] ?? faCoins;
}

function toDateInput(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export interface ExpenseRow extends Expense {
  /** Preformatted so SSR/hydration always agree. */
  dateLabel: string;
}

interface ExpenseFormState {
  category: ExpenseCategory;
  description: string;
  amount: string;
  date: string;
}

const EMPTY_FORM: ExpenseFormState = {
  category: "COGS",
  description: "",
  amount: "",
  date: "",
};

function formFromExpense(expense: Expense): ExpenseFormState {
  return {
    category: expense.category,
    description: expense.description,
    amount: String(expense.amount),
    date: toDateInput(expense.date),
  };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function AdminExpenses({
  user,
  expenseCategories,
}: AdminExpensesProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  // Period filter: "all" = no date restriction (default); presets use the
  // same start-of-month-aligned ranges as the dashboard.
  const [period, setPeriod] = useState("all");

  // Add form
  const [form, setForm] = useState<ExpenseFormState>({
    ...EMPTY_FORM,
    category: expenseCategories[0]?.id ?? EMPTY_FORM.category,
  });
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [editForm, setEditForm] = useState<ExpenseFormState>(EMPTY_FORM);
  const [editError, setEditError] = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const set = (
    key: keyof ExpenseFormState,
    setter: Dispatch<SetStateAction<ExpenseFormState>>
  ) => (value: string) => setter((f) => ({ ...f, [key]: value }));

  const loadExpenses = async (): Promise<ExpenseRow[] | null> => {
    try {
      const res = await fetch("/api/admin/expenses");
      const data = (await res.json()) as { expenses?: Expense[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? t("admin.expenses.error"));
        return null;
      }
      return (data.expenses ?? []).map((expense) => ({
        ...expense,
        dateLabel: formatDate(expense.date, locale),
      }));
    } catch {
      setError(t("admin.expenses.error"));
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const rows = await loadExpenses();
      if (!cancelled && rows) setExpenses(rows);
      if (!cancelled) setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    const rows = await loadExpenses();
    if (rows) setExpenses(rows);
  };

  // Lock body scroll + close on Escape while either modal is open (matches
  // the pattern used by the books and orders modals).
  useEffect(() => {
    const modalOpen = editing !== null || deleteTarget !== null;
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditing(null);
        setDeleteTarget(null);
      }
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [editing, deleteTarget]);

  // Period-scoped rows, sorted newest-first (by expense date), then paginated.
  const filtered = useMemo(() => {
    if (period === "all") return expenses;
    const range = resolveRange(period);
    return expenses.filter(
      (expense) => expense.date >= range.from && expense.date <= range.to
    );
  }, [expenses, period]);
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.date - a.date),
    [filtered]
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageExpenses = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totals = useMemo(() => {
    const byCategory = new Map<string, number>();
    let total = 0;
    for (const expense of filtered) {
      total += expense.amount;
      byCategory.set(
        expense.category,
        (byCategory.get(expense.category) ?? 0) + expense.amount
      );
    }
    const categories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount }));
    return { total, categories };
  }, [filtered]);

  const categoryLabel = (category: ExpenseCategory) =>
    expenseCategoryName(expenseCategories, category, locale);

  const categoryIndex = (category: ExpenseCategory) => {
    const index = expenseCategories.findIndex((entry) => entry.id === category);
    return index === -1 ? 0 : index;
  };

  // Export all expenses (newest first) as CSV for the accountant.
  const exportCsv = () => {
    downloadCsv(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Date", "Category", "Description", "Amount"],
      ...sorted.map((expense) => [
        csvDate(expense.date),
        expense.category,
        expense.description,
        expense.amount,
      ]),
    ]);
  };

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = (await res.json()) as { expense?: Expense; error?: string };
      if (!res.ok || !data.expense) {
        setError(data.error ?? t("admin.expenses.error"));
        return;
      }
      setForm(EMPTY_FORM);
      setNotice(t("admin.expenses.added"));
      await refresh();
      setPage(1);
    } catch {
      setError(t("admin.expenses.error"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (expense: ExpenseRow) => {
    setEditForm(formFromExpense(expense));
    setEditError("");
    setEditing(expense);
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/expenses/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, amount: Number(editForm.amount) }),
      });
      const data = (await res.json()) as { expense?: Expense; error?: string };
      if (!res.ok || !data.expense) {
        setEditError(data.error ?? t("admin.expenses.error"));
        return;
      }
      setEditing(null);
      setNotice(t("admin.expenses.updated"));
      await refresh();
    } catch {
      setEditError(t("admin.expenses.error"));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/expenses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(t("admin.expenses.error"));
        return;
      }
      setDeleteTarget(null);
      setNotice(t("admin.expenses.deleted"));
      await refresh();
    } catch {
      setError(t("admin.expenses.error"));
    } finally {
      setDeleting(false);
    }
  };

const summaryCards: { id: string; label: string; icon: IconDefinition; tone: string }[] = [
  {
    id: "total",
    label: t("admin.expenses.cards.total"),
    icon: faSackDollar,
    tone: "bg-primary-50 text-primary",
  },
  ...totals.categories.map(({ category, amount }, index) => ({
    id: category,
    label: `${categoryLabel(category)} (₦${amount.toLocaleString()})`,
    icon: categoryIcon(category),
    tone: categoryTone(index),
  })),
];

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.expenses")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.id} className="card flex items-center gap-4 bg-white p-5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.tone}`}
              >
                <FontAwesomeIcon icon={card.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {card.label}
                </p>
                <p className="mt-0.5 truncate text-xl font-bold text-slate-900">
                  {card.id === "total"
                    ? `₦${totals.total.toLocaleString()}`
                    : `₦${totals.categories
                        .find((entry) => entry.category === card.id)!
                        .amount.toLocaleString()}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="me-auto text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("admin.period.title")}
          </span>
          <button
            type="button"
            onClick={() => {
              setPeriod("all");
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              period === "all"
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t("admin.period.all")}
          </button>
          {PERIOD_OPTIONS.filter((option) => option.key !== "all").map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setPeriod(option.key);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                period === option.key
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t(option.label)}
            </button>
          ))}
          <button
            type="button"
            onClick={exportCsv}
            disabled={expenses.length === 0}
            className="btn gap-1.5 bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" />
            {t("admin.expenses.export")}
          </button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* Add form */}
          <form onSubmit={submitAdd} className="card bg-white p-6 lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FontAwesomeIcon icon={faPlus} className="h-4 w-4 text-primary" />
              {t("admin.expenses.addTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{t("admin.expenses.addSubtitle")}</p>

            {error && (
              <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="expense-category" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t("admin.expenses.category")} *
                </label>
                <select
                  id="expense-category"
                  required
                  value={form.category}
                  onChange={(e) => set("category", setForm)(e.target.value)}
                  className={inputClass}
                >
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="expense-description" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t("admin.expenses.description")} *
                </label>
                <input
                  id="expense-description"
                  type="text"
                  required
                  value={form.description}
                  onChange={(e) => set("description", setForm)(e.target.value)}
                  placeholder={t("admin.expenses.descriptionPlaceholder")}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expense-amount" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t("admin.expenses.amount")} (₦) *
                  </label>
                  <input
                    id="expense-amount"
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={form.amount}
                    onChange={(e) => set("amount", setForm)(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="expense-date" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t("admin.expenses.date")} *
                  </label>
                  <input
                    id="expense-date"
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => set("date", setForm)(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="btn w-full gap-2 bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
              >
                <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
                {saving ? t("admin.expenses.adding") : t("admin.expenses.add")}
              </button>
            </div>
          </form>

          {/* Table */}
          <div className="card overflow-hidden bg-white lg:col-span-2">
            {notice && (
              <p className="border-b border-primary-100 bg-primary-50 px-6 py-3 text-sm text-primary-800">
                {notice}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t("admin.expenses.colCategory")}</th>
                    <th className="px-4 py-3 font-semibold">{t("admin.expenses.colDescription")}</th>
                    <th className="px-4 py-3 font-semibold">{t("admin.expenses.colAmount")}</th>
                    <th className="px-4 py-3 font-semibold">{t("admin.table.date")}</th>
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
                  {!loading && pageExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                        {t("admin.expenses.empty")}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    pageExpenses.map((expense) => (
                      <tr key={expense.id} className="transition-colors hover:bg-primary-50/40">
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryTone(categoryIndex(expense.category))}`}
                          >
                            <FontAwesomeIcon
                              icon={categoryIcon(expense.category)}
                              className="h-3 w-3"
                            />
                            {categoryLabel(expense.category)}
                          </span>
                        </td>
                        <td className="max-w-[240px] truncate px-4 py-3.5 font-medium text-slate-900">
                          {expense.description}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          ₦{expense.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">{expense.dateLabel}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(expense)}
                              aria-label={`${t("admin.expenses.edit")}: ${expense.description}`}
                              className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary"
                            >
                              <FontAwesomeIcon icon={faPencil} className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(expense)}
                              aria-label={`${t("admin.expenses.delete")}: ${expense.description}`}
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
              <div className="flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-4">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="me-1 h-3 w-3" />
                  {t("books.previous")}
                </button>
                <span className="px-2 text-sm text-slate-500">
                  {t("books.page", { page: safePage, total: totalPages })}
                </span>
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
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("admin.expenses.editTitle")}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label={t("books.close")}
            onClick={() => setEditing(null)}
            className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">
                {t("admin.expenses.editTitle")}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
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
                <label htmlFor="edit-expense-category" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t("admin.expenses.category")} *
                </label>
                <select
                  id="edit-expense-category"
                  required
                  value={editForm.category}
                  onChange={(e) => set("category", setEditForm)(e.target.value)}
                  className={inputClass}
                >
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-expense-description" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t("admin.expenses.description")} *
                </label>
                <input
                  id="edit-expense-description"
                  type="text"
                  required
                  value={editForm.description}
                  onChange={(e) => set("description", setEditForm)(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-expense-amount" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t("admin.expenses.amount")} (₦) *
                  </label>
                  <input
                    id="edit-expense-amount"
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={editForm.amount}
                    onChange={(e) => set("amount", setEditForm)(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="edit-expense-date" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {t("admin.expenses.date")} *
                  </label>
                  <input
                    id="edit-expense-date"
                    type="date"
                    required
                    value={editForm.date}
                    onChange={(e) => set("date", setEditForm)(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
                >
                  {t("admin.expenses.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
                >
                  {saving ? t("admin.expenses.updating") : t("admin.expenses.update")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={t("admin.expenses.confirmDeleteTitle")}
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
              <FontAwesomeIcon icon={faTrashCan} className="h-6 w-6 text-rose-600" />
            </span>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              {t("admin.expenses.confirmDeleteTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {t("admin.expenses.confirmDeleteText", {
                description: deleteTarget.description,
              })}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
              >
                {t("admin.expenses.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? t("admin.expenses.deleting") : t("admin.expenses.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
