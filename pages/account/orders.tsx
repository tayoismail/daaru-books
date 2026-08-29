import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBox,
  faCircleCheck,
  faClock,
  faShoppingBag,
  faTruck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth, useLanguage } from "@/lib/contexts";
import type { Order } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  shipped: "bg-indigo-50 text-indigo-700",
  delivered: "bg-primary-50 text-primary",
  cancelled: "bg-rose-50 text-rose-600",
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: "bg-amber-50 text-amber-700",
  paid: "bg-primary-50 text-primary",
  failed: "bg-rose-50 text-rose-600",
};

const STATUS_ICONS: Record<string, typeof faClock> = {
  pending: faClock,
  processing: faBox,
  shipped: faTruck,
  delivered: faCircleCheck,
  cancelled: faXmark,
};

export default function AccountOrdersPage() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Redirect to login if not authenticated.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      void router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch orders once authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/my/orders", { credentials: "include" });
        const data = (await res.json()) as { orders?: Order[] };
        if (!cancelled && res.ok && data.orders) {
          setOrders(data.orders);
        }
      } catch {
        if (!cancelled) setError(t("myOrders.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, t]);

  const localizedTitle = (item: { title: string; bookId: string }) => item.title;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(locale === "ar" ? "ar-NG" : "en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (authLoading || !isAuthenticated) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-400">{t("books.loading")}…</p>
      </section>
    );
  }

  return (
    <>
      <Head>
        <title>
          {t("appName")} — {t("myOrders.title")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <section className="bg-primary-50 py-10">
        <div className="container-daaru text-center">
          <h1 className="text-3xl font-bold text-primary-800 sm:text-4xl">
            {t("myOrders.title")}
          </h1>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-gold" />
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            {t("myOrders.subtitle")}
          </p>
        </div>
      </section>

      <main className="container-daaru py-8 lg:py-12">
        {error && (
          <p className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        {loading && (
          <div className="py-16 text-center text-sm text-slate-400">
            {t("books.loading")}…
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <FontAwesomeIcon
                icon={faShoppingBag}
                className="h-9 w-9 text-slate-300"
              />
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-900">
              {t("myOrders.empty")}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {t("myOrders.emptyHint")}
            </p>
            <Link
              href="/books"
              className="btn mt-8 bg-primary px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-800"
            >
              {t("cart.browseBooks")}
            </Link>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const expanded = expandedId === order.id;
              const StatusIcon = STATUS_ICONS[order.status] ?? faClock;
              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Order header — clickable row */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : order.id)
                    }
                    className="flex w-full items-center gap-4 px-5 py-4 text-start transition-colors hover:bg-slate-50 sm:px-6"
                  >
                    <FontAwesomeIcon
                      icon={StatusIcon}
                      className={`h-5 w-5 shrink-0 ${
                        order.status === "delivered"
                          ? "text-primary"
                          : order.status === "cancelled"
                            ? "text-rose-500"
                            : "text-amber-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {order.paymentReference}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_STYLES[order.status] ?? ""
                          }`}
                        >
                          {t(`admin.status.${order.status}`)}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            PAYMENT_STYLES[order.paymentStatus] ?? ""
                          }`}
                        >
                          {t(`admin.payment.${order.paymentStatus}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-bold text-primary">
                      ₦{order.total.toLocaleString()}
                    </span>
                  </button>

                  {/* Expanded details */}
                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-5 sm:px-6">
                      {/* Items */}
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {t("admin.orderDetails.items")}
                      </h4>
                      <ul className="mt-3 divide-y divide-slate-100">
                        {order.items.map((item) => (
                          <li
                            key={item.bookId}
                            className="flex items-center justify-between gap-4 py-2.5 text-sm"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-900">
                                {localizedTitle(item)}
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
                      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                        <span className="text-sm font-bold text-slate-900">
                          {t("checkout.total")}
                        </span>
                        <span className="text-lg font-bold text-primary">
                          ₦{order.total.toLocaleString()}
                        </span>
                      </div>

                      {/* Shipping info */}
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {t("checkout.name")}
                          </dt>
                          <dd className="mt-0.5 text-sm font-medium text-slate-900">
                            {order.customerName}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {t("checkout.phone")}
                          </dt>
                          <dd className="mt-0.5 text-sm font-medium text-slate-900" dir="ltr">
                            {order.customerPhone}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {t("checkout.address")}
                          </dt>
                          <dd className="mt-0.5 text-sm leading-relaxed text-slate-700">
                            {order.shippingAddress}
                          </dd>
                        </div>
                      </div>

                      {/* Tracking number */}
                      {order.trackingNumber && (
                        <div className="mt-4 rounded-lg bg-indigo-50 px-4 py-3">
                          <span className="text-xs font-semibold text-indigo-700">
                            {t("admin.orders.trackingNumber")}:
                          </span>{" "}
                          <span className="text-sm font-bold text-indigo-900" dir="ltr">
                            {order.trackingNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
