// NOTE: Pure, client-safe module — no Node builtins. Shared by the admin
// dashboard's getServerSideProps (initial SSR render) and the client-side
// period switching, so both sides compute identical numbers.

import type { Expense, Order, Refund } from "@/types";

/** Inclusive epoch-ms window every dashboard computation is scoped to. */
export interface FinanceRange {
  from: number;
  to: number;
}

export interface PeriodOption {
  key: string;
  /** Number of months back from the current month (start-aligned), or null
   * for all time. `thisMonth` is handled specially. */
  months: number | null;
  /** i18n key for the preset label. */
  label: string;
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { key: "thisMonth", months: 0, label: "admin.period.thisMonth" },
  { key: "3m", months: 3, label: "admin.period.3m" },
  { key: "6m", months: 6, label: "admin.period.6m" },
  { key: "12m", months: 12, label: "admin.period.12m" },
  { key: "all", months: null, label: "admin.period.all" },
];

/** Preset the dashboard renders with (also used by SSR for hydration parity). */
export const DEFAULT_PERIOD = "6m";

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/**
 * Resolve a period key (+ optional custom date inputs) into an inclusive
 * range. Presets are start-of-month aligned so the monthly chart never shows
 * a partial leading bucket.
 */
export function resolveRange(
  key: string,
  fromInput?: string,
  toInput?: string
): FinanceRange {
  const now = new Date();
  if (key === "custom") {
    const from = fromInput ? new Date(`${fromInput}T00:00:00`).getTime() : 0;
    const to = toInput
      ? new Date(`${toInput}T23:59:59.999`).getTime()
      : Number.MAX_SAFE_INTEGER;
    return {
      from: Number.isFinite(from) ? from : 0,
      to: Number.isFinite(to) ? to : Number.MAX_SAFE_INTEGER,
    };
  }
  if (key === "thisMonth") {
    return { from: startOfMonth(now.getTime()), to: now.getTime() };
  }
  const months = PERIOD_OPTIONS.find((option) => option.key === key)?.months ?? null;
  if (months === null) {
    return { from: 0, to: Number.MAX_SAFE_INTEGER };
  }
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).getTime();
  return { from, to: now.getTime() };
}

export function inRange(ts: number, range: FinanceRange): boolean {
  return ts >= range.from && ts <= range.to;
}

/** The window of equal length immediately before `range` (for deltas). */
export function previousRange(range: FinanceRange): FinanceRange {
  const length = range.to - range.from;
  return { from: range.from - length, to: range.from - 1 };
}

/** Percentage change vs the previous period, or null when not meaningful. */
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Total cost of goods for an order (cost per copy × quantity). Legacy items
 * created before the cost snapshot existed count as 0 — callers may enrich
 * them with the book's current cost before computing.
 */
export function orderCost(order: Order): number {
  return order.items.reduce(
    (sum, item) =>
      sum + (typeof item.cost === "number" ? item.cost : 0) * item.quantity,
    0
  );
}

export interface DashboardStats {
  /** Catalog size (not period-scoped). */
  totalBooks: number;
  /** Orders created in the period. */
  totalOrders: number;
  /** Recognized revenue — total of delivered orders in the period, net of
   * refunds recorded against those delivered orders. */
  revenue: number;
  /** Cash received — total of paid orders in the period. */
  received: number;
  /** COGS of delivered orders in the period, net of the cost backed out by
   * refunds of those delivered orders (sales returns). */
  cogs: number;
  grossProfit: number;
  /** Gross profit as a % of revenue, or null when there is no revenue. */
  marginPct: number | null;
  /** Expenses dated in the period. */
  expenses: number;
  /** Refunds dated in the period (all orders, delivered or not). */
  refunds: number;
  /** Refunds dated in the period against delivered orders (sales returns —
   * already netted out of revenue and cogs). */
  refundsOfDelivered: number;
  /** Refunds dated in the period against orders that were never delivered
   * (e.g. cancelled) — a direct charge against net profit. */
  refundsOther: number;
  /** COGS backed out of the P&L by refunds of delivered orders. */
  refundedCost: number;
  /** Gross profit − expenses − refunds of orders that were never delivered. */
  netProfit: number;
  /** Cash out — expenses + refunds in the period. */
  cashOut: number;
  /** Cash in − cash out. */
  netCash: number;
  unpaidCount: number;
  unpaidTotal: number;
  failedCount: number;
  failedTotal: number;
}

/** Compute every dashboard number from one period-scoped snapshot. */
export function computeStats(
  orders: Order[],
  expenses: Expense[],
  refunds: Refund[],
  range: FinanceRange
): DashboardStats {
  const inOrders = orders.filter((order) => inRange(order.createdAt, range));
  const delivered = inOrders.filter((order) => order.status === "delivered");
  const paid = inOrders.filter((order) => order.paymentStatus === "paid");
  const unpaid = inOrders.filter((order) => order.paymentStatus === "unpaid");
  const failed = inOrders.filter((order) => order.paymentStatus === "failed");

  const expensesTotal = expenses
    .filter((expense) => inRange(expense.date, range))
    .reduce((sum, expense) => sum + expense.amount, 0);
  const inPeriod = (refund: Refund) => inRange(refund.date, range);
  const refundsTotal = refunds
    .filter(inPeriod)
    .reduce((sum, refund) => sum + refund.amount, 0);
  // Refunds of delivered orders reduce recognized revenue (sales returns);
  // refunds of other orders (e.g. cancelled) are a direct charge against net
  // profit, since their revenue was never recognized.
  // A refund belongs to the "sales returns" bucket whenever its order was
  // EVER delivered (checked against all orders, not just this period's) —
  // otherwise a refund of an order delivered last month would be mis-booked
  // as a direct charge in this month's P&L.
  const deliveredIds = new Set(
    orders.filter((order) => order.status === "delivered").map((order) => order.id)
  );
  const refundsOfDelivered = refunds
    .filter((refund) => inPeriod(refund) && deliveredIds.has(refund.orderId))
    .reduce((sum, refund) => sum + refund.amount, 0);
  const refundedCost = refunds
    .filter((refund) => inPeriod(refund) && deliveredIds.has(refund.orderId))
    .reduce((sum, refund) => sum + (refund.costRefunded ?? 0), 0);

  const revenue =
    delivered.reduce((sum, order) => sum + order.total, 0) - refundsOfDelivered;
  const cogs =
    delivered.reduce((sum, order) => sum + orderCost(order), 0) - refundedCost;
  const grossProfit = revenue - cogs;
  const received = paid.reduce((sum, order) => sum + order.total, 0);

  const unpaidTotal = unpaid.reduce((sum, order) => sum + order.total, 0);
  const failedTotal = failed.reduce((sum, order) => sum + order.total, 0);

  return {
    totalBooks: 0, // filled by the caller (catalog count, not period-scoped)
    totalOrders: inOrders.length,
    revenue,
    received,
    cogs,
    grossProfit,
    marginPct: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    expenses: expensesTotal,
    refunds: refundsTotal,
    refundsOfDelivered,
    refundsOther: refundsTotal - refundsOfDelivered,
    refundedCost,
    netProfit:
      grossProfit - expensesTotal - (refundsTotal - refundsOfDelivered),
    cashOut: expensesTotal + refundsTotal,
    netCash: received - (expensesTotal + refundsTotal),
    unpaidCount: unpaid.length,
    unpaidTotal,
    failedCount: failed.length,
    failedTotal,
  };
}

/** One bucket of the time-series chart (monthly, or yearly for long ranges). */
export interface SeriesBucket {
  key: string;
  label: string;
  from: number;
  to: number;
}

/**
 * Build the chart's time buckets. Monthly for ranges up to ~24 months;
 * yearly beyond that so an "all time" view never renders hundreds of bars.
 */
export function buildSeries(range: FinanceRange, locale: string): SeriesBucket[] {
  const spanMs = range.to - range.from;
  const approxMonths = spanMs / (1000 * 60 * 60 * 24 * 30.44);
  const yearly = approxMonths > 24;
  const buckets: SeriesBucket[] = [];
  const start = new Date(range.from);
  const end = new Date(range.to);

  if (yearly) {
    for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
      buckets.push({
        key: String(year),
        label: String(year),
        from: new Date(year, 0, 1).getTime(),
        to: new Date(year + 1, 0, 1).getTime() - 1,
      });
    }
    return buckets;
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    const from = cursor.getTime();
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    buckets.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
        month: "short",
      }),
      from,
      to: next.getTime() - 1,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

export function bucketOf(
  ts: number,
  buckets: SeriesBucket[]
): SeriesBucket | undefined {
  return buckets.find((bucket) => ts >= bucket.from && ts <= bucket.to);
}

export interface MonthlySeries {
  labels: string[];
  /** Recognized (delivered) revenue per bucket. */
  sales: number[];
  expenses: number[];
  /** Cash received (paid orders) per bucket. */
  received: number[];
  /** Refunds dated per bucket. */
  refunds: number[];
  /** Cash out (expenses + refunds) per bucket. */
  paidOut: number[];
}

/** Aggregate sales/expenses/cash into the chart buckets for a period. */
export function buildSeriesData(
  orders: Order[],
  expenses: Expense[],
  refunds: Refund[],
  range: FinanceRange,
  locale: string
): MonthlySeries {
  const buckets = buildSeries(range, locale);
  const indexOf = (ts: number) => {
    const bucket = bucketOf(ts, buckets);
    return bucket ? buckets.indexOf(bucket) : -1;
  };
  const sales = new Array(buckets.length).fill(0) as number[];
  const received = new Array(buckets.length).fill(0) as number[];
  const expenseSeries = new Array(buckets.length).fill(0) as number[];
  const refundSeries = new Array(buckets.length).fill(0) as number[];
  const paidOut = new Array(buckets.length).fill(0) as number[];

  for (const order of orders) {
    const index = indexOf(order.createdAt);
    if (index === -1) continue;
    if (order.paymentStatus === "paid") received[index] += order.total;
    if (order.status === "delivered") sales[index] += order.total;
  }
  for (const expense of expenses) {
    const index = indexOf(expense.date);
    if (index === -1) continue;
    expenseSeries[index] += expense.amount;
    paidOut[index] += expense.amount;
  }
  for (const refund of refunds) {
    const index = indexOf(refund.date);
    if (index === -1) continue;
    refundSeries[index] += refund.amount;
    paidOut[index] += refund.amount;
  }

  return {
    labels: buckets.map((bucket) => bucket.label),
    sales,
    expenses: expenseSeries,
    received,
    refunds: refundSeries,
    paidOut,
  };
}

/** Expense totals by category id, ordered by amount (desc). */
export function expenseBreakdown(
  expenses: Expense[],
  range: FinanceRange
): { id: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    if (!inRange(expense.date, range)) continue;
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }
  return [...totals.entries()]
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);
}
