import Link from "next/link";
import Head from "next/head";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faClock, faShoppingBag } from "@fortawesome/free-solid-svg-icons";
import type { Order } from "@/types";

export interface OrderSuccessPageProps {
  order: Order;
  /** True when the payment was verified but settlement failed (amount mismatch). */
  settlementFailed?: boolean;
}

export async function getServerSideProps(context: { query: { reference?: string } }) {
  const reference = context.query.reference;
  if (typeof reference !== "string" || !reference) {
    return { notFound: true };
  }

  const { db } = await import("@/lib/db");
  const { settleOrder, verifyFlutterwaveTransaction } = await import("@/lib/orders");

  let order: Order | null = await db.orders.getByPaymentReference(reference);
  if (!order) {
    return { notFound: true };
  }

  let settlementFailed = false;

  // Payment reconciliation: Flutterwave webhooks cannot reach a local dev
  // server, so when the order is still unpaid we double-check the charge
  // server-side and settle it here. Idempotent — once paid, settleOrder is a
  // no-op, so page reloads never double-settle or double-reduce stock.
  if (order.paymentStatus !== "paid") {
    const verified = await verifyFlutterwaveTransaction(reference);
    if (verified) {
      // Amount check: settlement only proceeds when the verified charge
      // matches the order total.
      const settled = await settleOrder(reference, order.total);
      if (settled) {
        order = settled;
      } else {
        // Verified but not settled — likely an amount mismatch.
        settlementFailed = true;
      }
    }
  }

  return { props: { order, settlementFailed } };
}

export default function OrderSuccessPage({ order, settlementFailed }: OrderSuccessPageProps) {
  const { t } = useTranslation();
  const paid = order.paymentStatus === "paid";

  return (
    <>
      <Head>
        <title>
          {t("appName")} — {t("orderSuccess.title")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <section className="bg-primary-50 py-12">
        <div className="container-daaru flex flex-col items-center text-center">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full ${
              paid ? "bg-primary-100" : "bg-amber-100"
            }`}
          >
            <FontAwesomeIcon
              icon={paid ? faCircleCheck : faClock}
              className={`h-10 w-10 ${paid ? "text-primary" : "text-amber-600"}`}
            />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-slate-900 sm:text-4xl">
            {t("orderSuccess.title")}
          </h1>
          <div className="mt-3 h-1 w-14 rounded-full bg-gold" />
          <p className="mt-3 max-w-xl text-slate-600">{t("orderSuccess.subtitle")}</p>
          <p className="mt-4 rounded-full bg-white px-5 py-2 text-sm shadow-sm">
            <span className="text-slate-500">{t("orderSuccess.orderNumber")}: </span>
            <span className="font-bold text-primary" dir="ltr">
              {order.paymentReference}
            </span>
          </p>
          {paid ? (
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 text-sm font-semibold text-primary">
              <FontAwesomeIcon icon={faCircleCheck} className="h-4 w-4" />
              {t("orderSuccess.confirmed")}
            </span>
          ) : settlementFailed ? (
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-1.5 text-sm font-semibold text-rose-600">
              {t("orderSuccess.settlementFailed")}
            </span>
          ) : (
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700">
              <FontAwesomeIcon icon={faClock} className="h-4 w-4" />
              {t("orderSuccess.awaiting")}
            </span>
          )}
        </div>
      </section>

      <main className="container-daaru grid items-start gap-8 py-10 lg:grid-cols-[1fr_22rem]">
        {/* Order details */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-bold text-slate-900">{t("orderSuccess.summary")}</h2>
          <ul className="mt-5 divide-y divide-slate-100">
            {order.items.map((item) => (
              <li key={item.bookId} className="flex items-center justify-between gap-4 py-3 text-sm">
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
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="font-bold text-slate-900">{t("orderSuccess.total")}</span>
            <span className="text-2xl font-bold text-primary">
              ₦{order.total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Shipping */}
        <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">{t("orderSuccess.shippingTo")}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("checkout.name")}
              </dt>
              <dd className="mt-0.5 font-medium text-slate-900">{order.customerName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("checkout.email")}
              </dt>
              <dd className="mt-0.5 font-medium text-slate-900">{order.customerEmail}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("checkout.phone")}
              </dt>
              <dd className="mt-0.5 font-medium text-slate-900" dir="ltr">
                {order.customerPhone}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("checkout.address")}
              </dt>
              <dd className="mt-0.5 leading-relaxed text-slate-700">
                {order.shippingAddress}
              </dd>
            </div>
          </dl>
          <p className="mt-5 rounded-xl bg-primary-50 px-4 py-3 text-xs leading-relaxed text-primary-800">
            {t("orderSuccess.note")}
          </p>
        </aside>
      </main>

      <div className="container-daaru pb-16 text-center">
        <Link
          href="/books"
          className="btn gap-2 bg-primary px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-800"
        >
          <FontAwesomeIcon icon={faShoppingBag} className="h-4 w-4" />
          {t("orderSuccess.continueShopping")}
        </Link>
      </div>
    </>
  );
}
