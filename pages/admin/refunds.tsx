import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateLeft,
  faMagnifyingGlass,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { useLanguage } from "@/lib/contexts";
import { formatDate } from "@/lib/format";
import type { Book, Refund } from "@/types";

export interface RefundRow extends Refund {
  /** Filled server-side from the order collection. */
  orderReference: string;
  customerName: string;
  /** Titles of the books this refund returned to stock. */
  restockedTitles: string[];
}

interface AdminRefundsProps {
  user: AdminUser;
  refunds: RefundRow[];
  /** Total refunded across all history. */
  totalRefunded: number;
  /** Books whose stock is affected by a refund this history (for titles). */
  books: Book[];
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;

  const { db } = await import("@/lib/db");
  const [refunds, orders, books] = await Promise.all([
    db.refunds.getAll(),
    db.orders.getAll(),
    db.books.getAll(),
  ]);

  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const bookTitles = new Map(
    books.map((book) => [book.id, book.titleEn || book.titleAr])
  );
  const rows: RefundRow[] = refunds.map((refund) => {
    const order = ordersById.get(refund.orderId);
    return {
      ...refund,
      orderReference: order?.paymentReference || order?.id.slice(0, 8) || "—",
      customerName: order?.customerName || "—",
      restockedTitles: (refund.restockedItems ?? [])
        .map((item) => {
          const title = bookTitles.get(item.bookId);
          return title ? `${title} ×${item.quantity}` : `${item.bookId} ×${item.quantity}`;
        }),
    };
  });

  return {
    props: {
      user: guard.user,
      refunds: rows.sort((a, b) => b.date - a.date),
      totalRefunded: refunds.reduce((sum, refund) => sum + refund.amount, 0),
      books,
    },
  };
}

function money(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export default function AdminRefunds({
  user,
  refunds: initialRefunds,
  totalRefunded,
}: AdminRefundsProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const [refunds, setRefunds] = useState<RefundRow[]>(initialRefunds);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RefundRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = refunds.filter((refund) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      refund.orderReference.toLowerCase().includes(q) ||
      refund.customerName.toLowerCase().includes(q) ||
      refund.reason.toLowerCase().includes(q)
    );
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/refunds/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? t("admin.refunds.error"));
        return;
      }
      setRefunds((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError(t("admin.refunds.error"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.refunds")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-5">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-4 bg-white p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <FontAwesomeIcon icon={faArrowRotateLeft} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("admin.refunds.total")}
              </p>
              <p className="mt-0.5 text-xl font-bold leading-tight text-slate-900">
                {money(totalRefunded)}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-4 bg-white p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <FontAwesomeIcon icon={faTrashCan} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("admin.refunds.count")}
              </p>
              <p className="mt-0.5 text-xl font-bold leading-tight text-slate-900">
                {refunds.length}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-4 bg-white p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
              <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("admin.refunds.restockedCount")}
              </p>
              <p className="mt-0.5 text-xl font-bold leading-tight text-slate-900">
                {refunds.reduce(
                  (sum, refund) =>
                    sum + (refund.restockedItems ?? []).reduce(
                      (items, item) => items + item.quantity,
                      0
                    ),
                  0
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="h-4 w-4 shrink-0 text-slate-400"
          />
          <input
            type="search"
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.refunds.search")}
            aria-label={t("admin.refunds.search")}
            className="w-full min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {/* Table */}
        <div className="card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.date")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.order")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.customer")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.refunds.reason")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.refunds.restocked")}</th>
                  <th className="px-4 py-3 text-end font-semibold">
                    {t("admin.refunds.amount")}
                  </th>
                  <th className="px-4 py-3 text-end font-semibold">
                    {t("admin.books.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("admin.refunds.emptyAll")}
                    </td>
                  </tr>
                )}
                {filtered.map((refund) => (
                  <tr key={refund.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(refund.date, locale)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500" dir="ltr">
                      {refund.orderReference}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3.5 font-medium text-slate-900">
                      {refund.customerName}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3.5 text-slate-600">
                      {refund.reason}
                    </td>
                    <td className="max-w-[220px] px-4 py-3.5">
                      {refund.restockedTitles.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <span className="block truncate text-xs text-slate-500">
                          {refund.restockedTitles.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-end font-semibold text-rose-600">
                      −{money(refund.amount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(refund)}
                          aria-label={`${t("admin.refunds.delete")}: ${refund.reason}`}
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

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={t("admin.refunds.deleteTitle")}
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
              {t("admin.refunds.deleteTitle")}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {t("admin.refunds.deleteText", {
                amount: money(deleteTarget.amount),
                reference: deleteTarget.orderReference,
              })}
            </p>
            {deleteTarget.restockedItems?.length ? (
              <p className="mt-2 text-xs text-slate-400">
                {t("admin.refunds.deleteRestockHint")}
              </p>
            ) : null}
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
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="btn bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? t("admin.refunds.deleting") : t("admin.refunds.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}