import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateLeft,
  faChartPie,
  faNairaSign,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { useLanguage } from "@/lib/contexts";
import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  computeStats,
  expenseBreakdown,
  resolveRange,
  type DashboardStats,
} from "@/lib/finance";
import { DEFAULT_EXPENSE_CATEGORIES, expenseCategoryName } from "@/lib/expenseInput";
import { formatDate } from "@/lib/format";
import type {
  Book,
  Expense,
  ExpenseCategoryDef,
  Order,
  Refund,
} from "@/types";

const ExpenseDoughnutChart = dynamic(
  () =>
    import("@/components/admin/AdminCharts").then((m) => m.ExpenseDoughnutChart),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-shimmer rounded-lg bg-slate-100" />,
  }
);

export interface ReportProps {
  user: AdminUser;
  /** Enriched orders (legacy items filled with the book's current cost). */
  orders: Order[];
  expenses: Expense[];
  refunds: Refund[];
  expenseCategories: ExpenseCategoryDef[];
  books: Book[];
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

function money(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export default function AdminReport({
  user,
  orders,
  expenses,
  refunds,
  expenseCategories,
}: ReportProps) {
  const { t } = useTranslation();
  const { locale: uiLocale } = useLanguage();
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const displayLocale = uiLocale === "ar" ? "ar" : "en";

  const range = useMemo(
    () => resolveRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const stats: DashboardStats = useMemo(
    () => computeStats(orders, expenses, refunds, range),
    [orders, expenses, refunds, range]
  );

  const breakdown = useMemo(
    () => expenseBreakdown(expenses, range),
    [expenses, range]
  );

  const categoryName = (id: string) =>
    expenseCategoryName(expenseCategories, id, displayLocale);

  const refundsInPeriod = useMemo(
    () =>
      refunds
        .filter((refund) => refund.date >= range.from && refund.date <= range.to)
        .sort((a, b) => b.date - a.date)
        .slice(0, 8),
    [refunds, range]
  );

  const ordersById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders]
  );

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.report")} — {t("appName")}
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

        <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* P&L statement */}
          <div className="card bg-white p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FontAwesomeIcon icon={faChartPie} className="h-4 w-4 text-primary" />
              {t("admin.report.title")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t("admin.report.subtitle")}
            </p>

            <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100 text-sm">
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="flex items-center gap-2 text-slate-600">
                  <FontAwesomeIcon
                    icon={faNairaSign}
                    className="h-3.5 w-3.5 text-slate-400"
                  />
                  {t("admin.report.revenue")}
                </dt>
                <dd className="font-bold text-slate-900">{money(stats.revenue)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="text-slate-600">
                  {t("admin.report.costOfGoods")}{" "}
                  {stats.refundedCost > 0 && (
                    <span className="text-xs text-slate-400">
                      ({t("admin.report.returns")}: {money(stats.refundedCost)})
                    </span>
                  )}
                </dt>
                <dd className="font-semibold text-slate-700">−{money(stats.cogs)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 bg-primary-50/60 px-3 py-3.5">
                <dt className="font-semibold text-primary-900">
                  {t("admin.report.grossProfit")}
                </dt>
                <dd className="font-bold text-primary">
                  {money(stats.grossProfit)}
                  {stats.marginPct !== null && (
                    <span className="ms-2 text-xs font-semibold text-primary-700">
                      {stats.marginPct.toFixed(1)}%
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="text-slate-600">
                  {t("admin.report.refundsOther")}{" "}
                  <span className="text-xs text-slate-400">
                    ({t("admin.report.cancelledRefunds")})
                  </span>
                </dt>
                <dd className="font-semibold text-rose-600">
                  −{money(stats.refundsOther)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="text-slate-600">{t("admin.report.expenses")}</dt>
                <dd className="font-semibold text-rose-600">
                  −{money(stats.expenses)}
                </dd>
              </div>
              <div
                className={`flex items-center justify-between gap-4 px-3 py-4 ${
                  stats.netProfit < 0 ? "bg-rose-50" : "bg-primary-50/60"
                }`}
              >
                <dt
                  className={`text-base font-bold ${
                    stats.netProfit < 0 ? "text-rose-700" : "text-primary-900"
                  }`}
                >
                  {t("admin.report.netProfit")}
                </dt>
                <dd
                  className={`text-xl font-bold ${
                    stats.netProfit < 0 ? "text-rose-600" : "text-primary"
                  }`}
                >
                  {stats.netProfit < 0 ? "−" : ""}
                  {money(Math.abs(stats.netProfit))}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              {t("admin.report.footnote", {
                recognized: money(stats.revenue + stats.refundsOfDelivered),
                refunded: money(stats.refundsOfDelivered),
              })}
            </p>
          </div>

          {/* Receivables */}
          <div className="card bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FontAwesomeIcon icon={faWallet} className="h-4 w-4 text-primary" />
              {t("admin.report.receivables")}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t("admin.report.receivablesSubtitle")}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">
                  {t("admin.payments.unpaid", { count: stats.unpaidCount })}
                </dt>
                <dd className="font-bold text-amber-600">
                  {money(stats.unpaidTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">
                  {t("admin.payments.failed", { count: stats.failedCount })}
                </dt>
                <dd className="font-bold text-rose-600">
                  {money(stats.failedTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <dt className="font-medium text-slate-600">{t("admin.payments.cashOut")}</dt>
                <dd className="font-semibold text-slate-700">{money(stats.cashOut)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-slate-600">{t("admin.payments.received")}</dt>
                <dd className="font-semibold text-green-600">{money(stats.received)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <dt className="font-medium text-slate-600">{t("admin.payments.netCash")}</dt>
                <dd
                  className={`font-bold ${stats.netCash < 0 ? "text-rose-600" : "text-primary"}`}
                >
                  {stats.netCash < 0 ? "−" : ""}
                  {money(Math.abs(stats.netCash))}
                </dd>
              </div>
            </dl>

            <h3 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">
              {t("admin.report.expenseBreakdown")}
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              {breakdown.length === 0 && (
                <li className="text-slate-400">{t("admin.report.noExpenses")}</li>
              )}
              {breakdown.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate text-slate-600">
                    {categoryName(item.id)}
                  </span>
                  <span className="shrink-0 font-semibold text-slate-900">
                    {money(item.value)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <ExpenseDoughnutChart
                labels={breakdown.map((item) => categoryName(item.id))}
                values={breakdown.map((item) => item.value)}
              />
            </div>
          </div>
        </div>

        {/* Refunds in the period */}
        <div className="card overflow-hidden bg-white">
          <div className="flex items-center gap-2 px-6 pt-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <FontAwesomeIcon icon={faArrowRotateLeft} className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {t("admin.report.refundsInPeriod")}
              </h2>
              <p className="text-xs text-slate-400">
                {t("admin.report.refundsInPeriodSubtitle")}
              </p>
            </div>
            <span className="ms-auto rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600">
              {t("admin.report.total", { amount: money(stats.refunds) })}
            </span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">{t("admin.table.date")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.order")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.refunds.reason")}</th>
                  <th className="px-4 py-3 text-end font-semibold">
                    {t("admin.refunds.amount")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refundsInPeriod.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400">
                      {t("admin.report.noRefunds")}
                    </td>
                  </tr>
                )}
                {refundsInPeriod.map((refund) => {
                  const order = ordersById.get(refund.orderId);
                  return (
                    <tr key={refund.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-6 py-3.5 text-slate-500">
                        {formatDate(refund.date, displayLocale)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500" dir="ltr">
                        {order?.paymentReference || order?.id.slice(0, 8) || "—"}
                      </td>
                      <td className="max-w-[280px] truncate px-4 py-3.5 font-medium text-slate-900">
                        {refund.reason}
                      </td>
                      <td className="px-4 py-3.5 text-end font-semibold text-rose-600">
                        −{money(refund.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}