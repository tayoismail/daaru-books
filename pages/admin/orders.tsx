import dynamic from "next/dynamic";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faDownload,
  faEye,
  faFilter,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  STATUS_TONES,
  PAYMENT_TONES,
  type OrderRow,
} from "@/components/admin/OrderDetailsModal";

// Modal renders only on user action — split it out of the dashboard bundle.
const OrderDetailsModal = dynamic(
  () => import("@/components/admin/OrderDetailsModal"),
  { ssr: false }
);
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { useLanguage } from "@/lib/contexts";
import { csvDate, downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import type { OrderStatus, PaymentStatus } from "@/types";

const PAGE_SIZE = 10;
const ALL_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];
const ALL_PAYMENTS: PaymentStatus[] = ["unpaid", "paid", "failed"];

interface AdminOrdersProps {
  user: AdminUser;
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  return { props: { user: guard.user } };
}

/** Parse a YYYY-MM-DD date input. `endOfDay` makes the upper bound inclusive
 * (orders created during the `to` day are kept instead of being cut at midnight). */
function parseDateInput(value: string, endOfDay = false): number | null {
  if (!value) return null;
  const time = endOfDay ? "T23:59:59.999" : "T00:00:00";
  const parsed = new Date(`${value}${time}`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminOrders({ user }: AdminOrdersProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OrderRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/orders");
        const data = (await res.json()) as { orders?: OrderRow[] };
        if (!cancelled && res.ok) {
          setOrders(
            (data.orders ?? []).map((order) => ({
              ...order,
              dateLabel: formatDate(order.createdAt, locale),
            }))
          );
        }
        if (!cancelled && !res.ok) setError(t("admin.orders.error"));
      } catch {
        if (!cancelled) setError(t("admin.orders.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Client-side filtering (search, status, date range)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = parseDateInput(fromDate);
    const to = parseDateInput(toDate, true);
    return orders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (paymentFilter && order.paymentStatus !== paymentFilter) return false;
      if (q) {
        const name = order.customerName.toLowerCase();
        const email = order.customerEmail.toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      if (from && order.createdAt < from) return false;
      if (to && order.createdAt > to) return false;
      return true;
    });
  }, [orders, search, statusFilter, paymentFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageOrders = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPaymentFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasFilters =
    search !== "" ||
    statusFilter !== "" ||
    paymentFilter !== "" ||
    fromDate !== "" ||
    toDate !== "";

  // Export the currently filtered rows as CSV (for the accountant).
  const exportCsv = () => {
    downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Reference",
        "Date",
        "Customer",
        "Email",
        "Phone",
        "Address",
        "Items",
        "Total",
        "Status",
        "Payment",
      ],
      ...filtered.map((order) => [
        order.paymentReference || order.id,
        csvDate(order.createdAt),
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.shippingAddress,
        order.items.map((item) => `${item.title} x${item.quantity}`).join("; "),
        order.total,
        order.status,
        order.paymentStatus,
      ]),
    ]);
  };

  const handleUpdated = (updated: OrderRow) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.orders")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-5">
        {/* Filters */}
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
              placeholder={t("admin.orders.search")}
              aria-label={t("admin.orders.search")}
              className="w-full min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "");
              setPage(1);
            }}
            aria-label={t("admin.table.status")}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t("admin.orders.allStatuses")}</option>
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`admin.status.${status}`)}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value as PaymentStatus | "");
              setPage(1);
            }}
            aria-label={t("admin.orders.paymentStatus")}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t("admin.orders.allPayments")}</option>
            {ALL_PAYMENTS.map((payment) => (
              <option key={payment} value={payment}>
                {t(`admin.payment.${payment}`)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-500">
            {t("admin.orders.fromDate")}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              aria-label={t("admin.orders.fromDate")}
              className="bg-transparent text-sm text-slate-900 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-500">
            {t("admin.orders.toDate")}
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              aria-label={t("admin.orders.toDate")}
              className="bg-transparent text-sm text-slate-900 focus:outline-none"
            />
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn gap-1.5 border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-rose-300 hover:text-rose-600"
            >
              <FontAwesomeIcon icon={faFilter} className="h-3.5 w-3.5" />
              {t("admin.orders.clearFilters")}
            </button>
          )}
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="btn gap-1.5 bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faDownload} className="h-3.5 w-3.5" />
            {t("admin.orders.export")}
          </button>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {/* Table */}
        <div className="card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.order")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.customer")}</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    {t("admin.orders.colItems")}
                  </th>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.total")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.status")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.orders.colPayment")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.date")}</th>
                  <th className="px-4 py-3 text-end font-semibold">
                    {t("admin.books.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("books.loading")}…
                    </td>
                  </tr>
                )}
                {!loading && pageOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("admin.orders.empty")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelected(order)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(order);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${t("admin.table.view")}: ${
                        order.paymentReference || order.id
                      }`}
                      className="group cursor-pointer transition-colors hover:bg-primary-50/40 focus:outline-none focus-visible:bg-primary-50/40"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500" dir="ltr">
                        {order.paymentReference || order.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-slate-900">{order.customerName}</p>
                        <p className="text-xs text-slate-400">{order.customerEmail}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        ₦{order.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONES[order.status]}`}
                        >
                          {t(`admin.status.${order.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_TONES[order.paymentStatus]}`}
                        >
                          {t(`admin.payment.${order.paymentStatus}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{order.dateLabel}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(order);
                            }}
                            aria-label={`${t("admin.table.view")}: ${
                              order.paymentReference || order.id
                            }`}
                            className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary"
                          >
                            <FontAwesomeIcon icon={faEye} className="h-4 w-4" />
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4">
              <p className="text-sm text-slate-500">
                {t("admin.orders.results", { count: filtered.length })}
              </p>
              <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>
      </div>

      {selected && (
        <OrderDetailsModal
          order={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </AdminLayout>
  );
}
