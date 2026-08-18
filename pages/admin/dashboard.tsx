import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { type IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowTrendDown,
  faArrowTrendUp,
  faBook,
  faCartShopping,
  faChartLine,
  faCoins,
  faEye,
  faNairaSign,
  faTriangleExclamation,
  faWallet,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { useLanguage } from "@/lib/contexts";
import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  buildSeriesData,
  computeStats,
  deltaPct,
  expenseBreakdown,
  previousRange,
  resolveRange,
  type MonthlySeries,
  type DashboardStats,
} from "@/lib/finance";
import { DEFAULT_EXPENSE_CATEGORIES, expenseCategoryName } from "@/lib/expenseInput";
import type {
  Book,
  Expense,
  ExpenseCategoryDef,
  Order,
  Refund,
} from "@/types";

// Chart.js touches the DOM — render client-side only.
const MonthlyBarChart = dynamic(
  () =>
    import("@/components/admin/AdminCharts").then((m) => m.MonthlyBarChart),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-shimmer rounded-lg bg-slate-100" />,
  }
);
const CashFlowBarChart = dynamic(
  () =>
    import("@/components/admin/AdminCharts").then((m) => m.CashFlowBarChart),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-shimmer rounded-lg bg-slate-100" />,
  }
);
const ExpenseDoughnutChart = dynamic(
  () =>
    import("@/components/admin/AdminCharts").then((m) => m.ExpenseDoughnutChart),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-shimmer rounded-lg bg-slate-100" />,
  }
);

export interface DashboardRow extends Order {
  /** Preformatted server-side so SSR and hydration always agree. */
  dateLabel: string;
}

export interface DashboardProps {
  user: AdminUser;
  /** Enriched orders (legacy items filled with the book's current cost). */
  orders: Order[];
  expenses: Expense[];
  refunds: Refund[];
  expenseCategories: ExpenseCategoryDef[];
  books: Book[];
}

function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;

  const { db } = await import("@/lib/db");
  const [books, orders, expenses, refunds, categories] = await Promise.all([
    db.books.getAll(),
    db.orders.getAll(),
    db.expenses.getAll(),
    db.refunds.getAll(),
    db.expenseCategories.getAll(),
  ]);

  // Fill legacy order items (created before the cost snapshot) with the
  // book's current cost so COGS reports cover historical orders too.
  const booksById = new Map(books.map((book) => [book.id, book]));
  const enrichedOrders: Order[] = orders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({
      ...item,
      cost:
        typeof item.cost === "number"
          ? item.cost
          : typeof booksById.get(item.bookId)?.cost === "number"
            ? booksById.get(item.bookId)!.cost
            : null,
    })),
  }));

  return {
    props: {
      user: guard.user,
      orders: enrichedOrders,
      expenses,
      refunds,
      expenseCategories:
        categories.length > 0 ? categories : DEFAULT_EXPENSE_CATEGORIES,
      books,
    },
  };
}

const STATUS_TONES: Record<Order["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-primary-50 text-primary",
  cancelled: "bg-rose-50 text-rose-600",
};

const PAYMENT_TONES: Record<Order["paymentStatus"], string> = {
  unpaid: "bg-amber-50 text-amber-700",
  paid: "bg-primary-50 text-primary",
  failed: "bg-rose-50 text-rose-600",
};

const STAT_TONES = {
  green: "bg-primary-50 text-primary",
  blue: "bg-blue-50 text-blue-600",
  gold: "bg-gold-100 text-gold-700",
  red: "bg-rose-50 text-rose-600",
} as const;

function money(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

function StatCard({
  icon,
  label,
  value,
  tone,
  sub,
  delta,
}: {
  icon: IconDefinition;
  label: string;
  value: string;
  tone: keyof typeof STAT_TONES;
  sub?: string;
  /** % change vs the previous period (null hides the delta pill). */
  delta?: number | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="card flex items-center gap-4 bg-white p-5">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${STAT_TONES[tone]}`}
      >
        <FontAwesomeIcon icon={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
          {value}
        </p>
        {(sub || delta != null) && (
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
            {delta != null && (
              <span
                title={t("admin.period.vsPrevious")}
                className={`inline-flex shrink-0 items-center gap-0.5 font-semibold ${
                  delta >= 0 ? "text-green-600" : "text-rose-600"
                }`}
              >
                <FontAwesomeIcon
                  icon={delta >= 0 ? faArrowTrendUp : faArrowTrendDown}
                  className="h-3 w-3"
                />
                {Math.abs(delta).toFixed(0)}%
              </span>
            )}
            {sub && <span className="truncate text-slate-400">{sub}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

/** Full-order detail dialog opened from the recent orders table. */
function OrderDetailsModal({
  order,
  onClose,
}: {
  order: DashboardRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.orderDetails.title")}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label={t("books.close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {t("admin.orderDetails.title")}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-slate-400" dir="ltr">
              {order.paymentReference || order.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("books.close")}
            className="btn h-9 w-9 shrink-0 p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONES[order.status]}`}
          >
            {t(`admin.status.${order.status}`)}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${PAYMENT_TONES[order.paymentStatus]}`}
          >
            {t(`admin.payment.${order.paymentStatus}`)}
          </span>
          {order.paymentMethod && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600" dir="ltr">
              {order.paymentMethod.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Items */}
        <h4 className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">
          {t("admin.orderDetails.items")}
        </h4>
        <ul className="mt-2 divide-y divide-slate-100">
          {order.items.map((item) => (
            <li
              key={item.bookId}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">
                  {item.title}
                </span>
                <span className="text-xs text-slate-400">
                  {item.quantity} × ₦{item.price.toLocaleString()}
                </span>
              </span>
              <span className="shrink-0 font-semibold text-slate-700">
                ₦{(item.price * item.quantity).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>

        {/* Customer */}
        <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-500">{t("admin.table.customer")}</dt>
            <dd className="font-medium text-slate-900">{order.customerName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-500">{t("checkout.email")}</dt>
            <dd className="font-medium text-slate-900">{order.customerEmail}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-500">{t("checkout.phone")}</dt>
            <dd className="font-medium text-slate-900" dir="ltr">
              {order.customerPhone}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-500">{t("checkout.address")}</dt>
            <dd className="text-end font-medium text-slate-900">
              {order.shippingAddress}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-500">{t("admin.table.date")}</dt>
            <dd className="font-medium text-slate-900">{order.dateLabel}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="font-bold text-slate-900">{t("admin.table.total")}</span>
          <span className="text-xl font-bold text-primary">{money(order.total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard({
  user,
  orders,
  expenses,
  refunds,
  expenseCategories,
  books,
}: DashboardProps) {
  const { t } = useTranslation();
  const { locale: uiLocale } = useLanguage();
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<DashboardRow | null>(null);

  // The display locale (may differ from the SSR `locale` on client nav).
  const displayLocale = uiLocale === "ar" ? "ar" : "en";

  const range = useMemo(
    () => resolveRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const stats: DashboardStats = useMemo(() => {
    const computed = computeStats(orders, expenses, refunds, range);
    computed.totalBooks = books.length;
    return computed;
  }, [orders, expenses, refunds, range, books.length]);

  const series: MonthlySeries = useMemo(
    () => buildSeriesData(orders, expenses, refunds, range, displayLocale),
    [orders, expenses, refunds, range, displayLocale]
  );

  const breakdown = useMemo(
    () => expenseBreakdown(expenses, range),
    [expenses, range]
  );

  const previous = useMemo(
    () => computeStats(orders, expenses, refunds, previousRange(range)),
    [orders, expenses, refunds, range]
  );

  const lowStock = useMemo(
    () =>
      books
        .filter((book) => book.quantity <= 5)
        .sort((a, b) => a.quantity - b.quantity),
    [books]
  );

  const recentOrders: DashboardRow[] = useMemo(
    () =>
      [...orders]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5)
        .map((order) => ({
          ...order,
          dateLabel: formatDate(order.createdAt, displayLocale),
        })),
    [orders, displayLocale]
  );

  const statusLabel = (status: Order["status"]) => t(`admin.status.${status}`);
  const localizedTitle = (book: { titleEn: string; titleAr: string }) =>
    displayLocale === "ar" && book.titleAr ? book.titleAr : book.titleEn;

  const categoryName = (id: string) =>
    expenseCategoryName(expenseCategories, id, displayLocale);

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.dashboard")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-6">
        {/* Period selector */}
        <div className="card flex flex-wrap items-center gap-2 bg-white p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("admin.period.title")}
          </span>
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                period === option.key
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t(option.label)}
            </button>
          ))}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-500">
              {t("admin.period.from")}
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label={t("admin.period.from")}
                className="bg-transparent text-sm text-slate-900 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-500">
              {t("admin.period.to")}
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label={t("admin.period.to")}
                className="bg-transparent text-sm text-slate-900 focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setPeriod("custom")}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                period === "custom"
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t("admin.period.apply")}
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={faBook}
            label={t("admin.stats.totalBooks")}
            value={String(stats.totalBooks)}
            tone="green"
          />
          <StatCard
            icon={faCartShopping}
            label={t("admin.stats.totalOrders")}
            value={String(stats.totalOrders)}
            tone="blue"
          />
          <StatCard
            icon={faNairaSign}
            label={t("admin.stats.revenue")}
            value={money(stats.revenue)}
            tone="gold"
            delta={deltaPct(stats.revenue, previous.revenue)}
          />
          <StatCard
            icon={faWallet}
            label={t("admin.stats.received")}
            value={money(stats.received)}
            tone="blue"
            delta={deltaPct(stats.received, previous.received)}
          />
          <StatCard
            icon={faCoins}
            label={t("admin.stats.grossProfit")}
            value={money(stats.grossProfit)}
            tone="gold"
            sub={
              stats.marginPct === null
                ? undefined
                : `${t("admin.stats.margin")}: ${stats.marginPct.toFixed(1)}%`
            }
          />
          <StatCard
            icon={faChartLine}
            label={t("admin.stats.netProfit")}
            value={`${stats.netProfit < 0 ? "−" : ""}${money(Math.abs(stats.netProfit))}`}
            tone={stats.netProfit < 0 ? "red" : "gold"}
            delta={deltaPct(stats.netProfit, previous.netProfit)}
            sub={t("admin.stats.expensesLine", {
              expenses: money(stats.expenses),
              refunds: money(stats.refunds),
            })}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card bg-white p-6 lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">
              {t("admin.charts.monthly")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t("admin.charts.recognizedSales")}
            </p>
            <div className="mt-4">
              <MonthlyBarChart
                labels={series.labels}
                sales={series.sales}
                expenses={series.expenses}
                refunds={series.refunds}
                salesLabel={t("admin.charts.sales")}
                expensesLabel={t("admin.charts.expenses")}
                refundsLabel={t("admin.charts.refunds")}
              />
            </div>
          </div>
          <div className="card bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">
              {t("admin.charts.expenseBreakdown")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t("admin.charts.byCategory")}
            </p>
            <div className="mt-4">
              <ExpenseDoughnutChart
                labels={breakdown.map((item) => categoryName(item.id))}
                values={breakdown.map((item) => item.value)}
              />
            </div>
          </div>
        </div>

        {/* Cash flow + payments */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card bg-white p-6 lg:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">
              {t("admin.charts.cashFlow")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t("admin.charts.cashFlowSubtitle")}
            </p>
            <div className="mt-4">
              <CashFlowBarChart
                labels={series.labels}
                received={series.received}
                paidOut={series.paidOut}
                receivedLabel={t("admin.charts.received")}
                paidOutLabel={t("admin.charts.paidOut")}
              />
            </div>
          </div>

          {/* Payments & receivables */}
          <div className="card bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">
              {t("admin.payments.title")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t("admin.payments.subtitle")}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">{t("admin.payments.received")}</dt>
                <dd className="font-bold text-green-600">{money(stats.received)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">{t("admin.payments.cashOut")}</dt>
                <dd className="font-semibold text-slate-700">{money(stats.cashOut)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <dt className="text-slate-500">{t("admin.payments.netCash")}</dt>
                <dd
                  className={`font-bold ${stats.netCash < 0 ? "text-rose-600" : "text-primary"}`}
                >
                  {stats.netCash < 0 ? "−" : ""}
                  {money(Math.abs(stats.netCash))}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <dt className="text-slate-500">
                  {t("admin.payments.unpaid", { count: stats.unpaidCount })}
                </dt>
                <dd className="font-semibold text-amber-600">
                  {money(stats.unpaidTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">
                  {t("admin.payments.failed", { count: stats.failedCount })}
                </dt>
                <dd className="font-semibold text-rose-600">
                  {money(stats.failedTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">{t("admin.payments.refunded")}</dt>
                <dd className="font-semibold text-slate-700">
                  −{money(stats.refunds)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Recent orders + low stock */}
        <div className="grid items-start gap-6 xl:grid-cols-3">
          <div className="card overflow-hidden bg-white xl:col-span-2">
            <div className="flex items-center justify-between px-6 pt-6">
              <h2 className="text-lg font-bold text-slate-900">
                {t("admin.recentOrders.title")}
              </h2>
              <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {t("admin.recentOrders.latest", { count: recentOrders.length })}
              </span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-semibold">{t("admin.table.order")}</th>
                    <th className="px-4 py-3 font-semibold">{t("admin.table.customer")}</th>
                    <th className="px-4 py-3 font-semibold">{t("admin.table.total")}</th>
                    <th className="px-4 py-3 font-semibold">{t("admin.table.status")}</th>
                    <th className="px-4 py-3 font-semibold">{t("admin.table.date")}</th>
                    <th className="px-4 py-3" aria-label={t("admin.table.view")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">
                        {t("admin.recentOrders.empty")}
                      </td>
                    </tr>
                  )}
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedOrder(order);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${t("admin.table.view")}: ${
                        order.paymentReference || order.id
                      }`}
                      className="group cursor-pointer transition-colors hover:bg-primary-50/40 focus:outline-none focus-visible:bg-primary-50/40"
                    >
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-500" dir="ltr">
                        {order.paymentReference || order.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        {order.customerName}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {money(order.total)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONES[order.status]}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{order.dateLabel}</td>
                      <td className="px-4 py-3.5">
                        <FontAwesomeIcon
                          icon={faEye}
                          className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low stock alert */}
          <div className="card bg-white p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("admin.lowStock.title")}
                </h2>
                <p className="text-xs text-slate-400">{t("admin.lowStock.subtitle")}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-3">
              {lowStock.length === 0 && (
                <li className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
                  {t("admin.lowStock.empty")}
                </li>
              )}
              {lowStock.map((book) => (
                <li
                  key={book.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-slate-900">
                    {localizedTitle(book)}
                  </span>
                  <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600">
                    {book.quantity} {t("admin.lowStock.copies")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </AdminLayout>
  );
}
