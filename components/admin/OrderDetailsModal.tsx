import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faPrint,
  faRotateLeft,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { buildInvoiceHtml } from "@/lib/invoice";
import { useLanguage } from "@/lib/contexts";
import { formatDate } from "@/lib/format";
import type { Order, OrderStatus, PaymentStatus, Refund } from "@/types";

export const STATUS_TONES: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-primary-50 text-primary",
  cancelled: "bg-rose-50 text-rose-600",
};

export const PAYMENT_TONES: Record<PaymentStatus, string> = {
  unpaid: "bg-amber-50 text-amber-700",
  paid: "bg-primary-50 text-primary",
  failed: "bg-rose-50 text-rose-600",
};

const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export interface OrderRow extends Order {
  /** Preformatted server-side (or client-side) so SSR/hydration agree. */
  dateLabel: string;
}

interface OrderDetailsModalProps {
  order: OrderRow;
  onClose: () => void;
  /** Called after a successful status/payment update so the parent refreshes. */
  onUpdated: (order: OrderRow) => void;
}

export default function OrderDetailsModal({
  order: initialOrder,
  onClose,
  onUpdated,
}: OrderDetailsModalProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const [order, setOrder] = useState<OrderRow>(initialOrder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Refunds recorded against this order.
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [refundForm, setRefundForm] = useState({ amount: "", reason: "", date: "" });
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundError, setRefundError] = useState("");

  const refundedTotal = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  const remainingRefundable = Math.max(0, order.total - refundedTotal);

  // Tracking input differs from the saved value (empty included, so a saved
  // number can be cleared) -> the Save button becomes enabled.
  const trackingChanged =
    (order.trackingNumber ?? "").trim() !== (initialOrder.trackingNumber ?? "").trim();
  const deliveryFeeChanged =
    (order.deliveryFee ?? 0) !== (initialOrder.deliveryFee ?? 0);

  const loadRefunds = async () => {
    try {
      const res = await fetch(`/api/admin/refunds?orderId=${initialOrder.id}`);
      const data = (await res.json()) as { refunds?: Refund[] };
      if (res.ok) setRefunds(data.refunds ?? []);
    } catch {
      // Non-fatal: refunds section just stays empty.
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRefunds(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrder.id]);

  const updateOrder = async (patch: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    trackingNumber?: string;
    deliveryFee?: number;
  }) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { order?: Order; error?: string };
      if (!res.ok || !data.order) {
        setError(data.error ?? t("admin.orders.error"));
        return;
      }
      const updated: OrderRow = {
        ...data.order,
        dateLabel: formatDate(data.order.createdAt, locale),
      };
      setOrder(updated);
      onUpdated(updated);
    } catch {
      setError(t("admin.orders.error"));
    } finally {
      setSaving(false);
    }
  };

  const recordRefund = async (e: FormEvent) => {
    e.preventDefault();
    if (refundSaving) return;
    setRefundSaving(true);
    setRefundError("");
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          amount: Number(refundForm.amount),
          reason: refundForm.reason,
          date: refundForm.date,
        }),
      });
      const data = (await res.json()) as { refund?: Refund; error?: string };
      if (!res.ok || !data.refund) {
        setRefundError(data.error ?? t("admin.refunds.error"));
        return;
      }
      setRefundForm({ amount: "", reason: "", date: "" });
      setRefunds((prev) => [data.refund!, ...prev]);
    } catch {
      setRefundError(t("admin.refunds.error"));
    } finally {
      setRefundSaving(false);
    }
  };

  const deleteRefund = async (refundId: string) => {
    try {
      const res = await fetch(`/api/admin/refunds/${refundId}`, {
        method: "DELETE",
      });
      if (res.ok) setRefunds((prev) => prev.filter((r) => r.id !== refundId));
    } catch {
      setRefundError(t("admin.refunds.error"));
    }
  };

  const printInvoice = () => {
    const labels = {
      appName: t("appName"),
      storeTagline: t("tagline"),
      invoice: t("admin.orders.invoice"),
      orderNumber: t("orderSuccess.orderNumber"),
      date: t("admin.table.date"),
      billedTo: t("admin.orders.billedTo"),
      customerName: t("admin.table.customer"),
      email: t("checkout.email"),
      phone: t("checkout.phone"),
      shippingAddress: t("checkout.address"),
      items: t("admin.orderDetails.items"),
      title: t("admin.books.colTitle"),
      quantity: t("admin.orders.colQty"),
      unitPrice: t("admin.orders.unitPrice"),
      subtotal: t("admin.orders.subtotal"),
      deliveryFee: t("admin.orders.deliveryFee"),
      total: t("admin.table.total"),
      thankYou: t("admin.orders.thankYou"),
      storeAddress: t("contact.address"),
      storePhone: t("contact.phone"),
    };
    const html = buildInvoiceHtml(order, labels, locale);
    // NOTE: no `noopener` feature — per the HTML spec, window.open() returns
    // null when noopener is set, which would silently break printing. We write
    // the about:blank document ourselves, so an opener reference is harmless.
    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

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
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {t("admin.orderDetails.title")}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-slate-400" dir="ltr">
              {order.paymentReference || order.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printInvoice}
              className="btn gap-2 border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary"
            >
              <FontAwesomeIcon icon={faPrint} className="h-4 w-4" />
              {t("admin.orders.printInvoice")}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("books.close")}
              className="btn h-9 w-9 p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {/* Status + payment controls */}
          <div className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="order-status"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400"
              >
                {t("admin.table.status")}
              </label>
              <select
                id="order-status"
                value={order.status}
                disabled={saving}
                onChange={(e) =>
                  void updateOrder({ status: e.target.value as OrderStatus })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`admin.status.${status}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("admin.orders.paymentStatus")}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || order.paymentStatus === "paid"}
                  onClick={() => void updateOrder({ paymentStatus: "paid" })}
                  className="btn gap-1.5 bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />
                  {t("admin.orders.markPaid")}
                </button>
                <button
                  type="button"
                  disabled={saving || order.paymentStatus === "unpaid"}
                  onClick={() => void updateOrder({ paymentStatus: "unpaid" })}
                  className="btn gap-1.5 border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
                  {t("admin.orders.markUnpaid")}
                </button>
              </div>
              {order.paymentMethod && (
                <p className="mt-2 text-xs text-slate-400">
                  {t("admin.orders.paymentMethod")}:{" "}
                  <span className="font-semibold capitalize text-slate-600" dir="ltr">
                    {order.paymentMethod.replace(/_/g, " ")}
                  </span>
                </p>
              )}
            </div>

            {/* Tracking number — filled in when the order is shipped */}
            <div className="sm:col-span-2">
              <label
                htmlFor="order-tracking"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400"
              >
                {t("admin.orders.trackingNumber")}
              </label>
              <div className="flex gap-2">
                <input
                  id="order-tracking"
                  type="text"
                  value={order.trackingNumber ?? ""}
                  disabled={saving}
                  onChange={(e) =>
                    setOrder((prev) => ({ ...prev, trackingNumber: e.target.value }))
                  }
                  placeholder={t("admin.orders.trackingPlaceholder")}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  disabled={saving || !trackingChanged}
                  onClick={() =>
                    void updateOrder({ trackingNumber: order.trackingNumber ?? "" })
                  }
                  className="btn shrink-0 gap-1.5 bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />
                  {t("admin.orders.saveTracking")}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {t("admin.orders.trackingHint")}
              </p>
            </div>

            {/* Delivery fee — recorded by the admin so per-order margin reports
                and the invoice include the shipping charge. */}
            <div className="sm:col-span-2">
              <label
                htmlFor="order-delivery-fee"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400"
              >
                {t("admin.orders.deliveryFee")} (₦)
              </label>
              <div className="flex gap-2">
                <input
                  id="order-delivery-fee"
                  type="number"
                  min={0}
                  step="any"
                  value={order.deliveryFee ?? 0}
                  disabled={saving}
                  onChange={(e) =>
                    setOrder((prev) => ({
                      ...prev,
                      deliveryFee:
                        e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  disabled={saving || !deliveryFeeChanged}
                  onClick={() =>
                    void updateOrder({ deliveryFee: order.deliveryFee ?? 0 })
                  }
                  className="btn shrink-0 gap-1.5 bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FontAwesomeIcon icon={faCheck} className="h-3.5 w-3.5" />
                  {t("admin.orders.saveDelivery")}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {t("admin.orders.deliveryFeeHint")}
              </p>
            </div>
          </div>

          {/* Customer info */}
          <h4 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">
            {t("admin.orders.customerInfo")}
          </h4>
          <dl className="mt-2 grid gap-x-6 gap-y-2 rounded-xl border border-slate-100 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">{t("admin.table.customer")}</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{order.customerName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">{t("checkout.email")}</dt>
              <dd className="mt-0.5 break-all font-medium text-slate-900">
                {order.customerEmail}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">{t("checkout.phone")}</dt>
              <dd className="mt-0.5 font-medium text-slate-900" dir="ltr">
                {order.customerPhone}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">{t("checkout.address")}</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{order.shippingAddress}</dd>
            </div>
          </dl>

          {/* Items */}
          <h4 className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-400">
            {t("admin.orderDetails.items")}
          </h4>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{t("admin.books.colTitle")}</th>
                  <th className="px-4 py-2.5 text-center font-semibold">
                    {t("admin.orders.colQty")}
                  </th>
                  <th className="px-4 py-2.5 text-end font-semibold">
                    {t("admin.orders.unitPrice")}
                  </th>
                  <th className="px-4 py-2.5 text-end font-semibold">
                    {t("admin.orders.subtotal")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.bookId}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-end text-slate-600">
                      ₦{item.price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-end font-semibold text-slate-900">
                      ₦{(item.price * item.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="mt-5 flex items-center justify-between rounded-xl bg-primary px-5 py-4 text-white">
            <span className="text-sm font-semibold">{t("admin.table.total")}</span>
            <span className="text-xl font-bold">₦{order.total.toLocaleString()}</span>
          </div>

          {/* Refunds */}
          <div className="mt-6">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
              {t("admin.refunds.title")}
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              {t("admin.refunds.refundedOf", {
                refunded: `₦${refundedTotal.toLocaleString()}`,
                total: `₦${order.total.toLocaleString()}`,
              })}
              {remainingRefundable > 0 &&
                ` · ${t("admin.refunds.remaining", {
                  amount: `₦${remainingRefundable.toLocaleString()}`,
                })}`}
            </p>

            {refundError && (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {refundError}
              </p>
            )}

            {order.paymentStatus !== "paid" ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t("admin.refunds.onlyPaid")}
              </p>
            ) : remainingRefundable <= 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                {t("admin.refunds.fullyRefunded")}
              </p>
            ) : (
              <form
                onSubmit={recordRefund}
                className="mt-3 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2"
              >
                <div>
                  <label
                    htmlFor="refund-amount"
                    className="mb-1 block text-xs font-medium text-slate-500"
                  >
                    {t("admin.refunds.amount")} (₦) *
                  </label>
                  <input
                    id="refund-amount"
                    type="number"
                    required
                    min={1}
                    max={remainingRefundable}
                    step="any"
                    value={refundForm.amount}
                    onChange={(e) =>
                      setRefundForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder={String(remainingRefundable)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="refund-date"
                    className="mb-1 block text-xs font-medium text-slate-500"
                  >
                    {t("admin.refunds.date")} *
                  </label>
                  <input
                    id="refund-date"
                    type="date"
                    required
                    value={refundForm.date}
                    onChange={(e) =>
                      setRefundForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="refund-reason"
                    className="mb-1 block text-xs font-medium text-slate-500"
                  >
                    {t("admin.refunds.reason")} *
                  </label>
                  <input
                    id="refund-reason"
                    type="text"
                    required
                    value={refundForm.reason}
                    onChange={(e) =>
                      setRefundForm((f) => ({ ...f, reason: e.target.value }))
                    }
                    placeholder={t("admin.refunds.reasonPlaceholder")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={refundSaving}
                  className="btn sm:col-span-2 gap-1.5 bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" />
                  {refundSaving
                    ? t("admin.refunds.recording")
                    : t("admin.refunds.record")}
                </button>
              </form>
            )}

            {refunds.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">{t("admin.refunds.empty")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {refunds.map((refund) => (
                  <li
                    key={refund.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {refund.reason}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDate(refund.date, locale)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold text-rose-600">
                        −₦{refund.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => void deleteRefund(refund.id)}
                        aria-label={`${t("admin.refunds.delete")}: ${refund.reason}`}
                        className="btn h-8 w-8 p-0 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <FontAwesomeIcon icon={faTrashCan} className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
