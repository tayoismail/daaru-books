import Link from "next/link";
import { useRouter } from "next/router";
import Head from "next/head";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faKey, faLock, faShoppingBag } from "@fortawesome/free-solid-svg-icons";
import {
  loadFlutterwaveScript,
  openFlutterwaveCheckout,
} from "@/lib/flutterwave";
import { useCart, useLanguage } from "@/lib/contexts";
import { discountPercent } from "@/lib/format";

// Inlined at build time; only the public key is ever exposed to the client.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const LOGO_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="#1a5c3a"/><path d="M32 12l2.7 9.3L44 24l-9.3 2.7L32 36l-2.7-9.3L20 24l9.3-2.7z" fill="#c9a84c"/></svg>'
  );

export default function CheckoutPage() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const router = useRouter();
  const { items, total, count, clear } = useCart();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  // Order already created for this checkout session — reused on retry so we
  // never create duplicate orders when the user retries payment. The cart
  // fingerprint guards against charging a stale order if the cart changed.
  const [pending, setPending] = useState<{
    reference: string;
    total: number;
    cartFingerprint: string;
    accountCreated?: boolean;
  } | null>(null);
  const paidRef = useRef(false);

  const localizedTitle = (item: { titleEn: string; titleAr: string }) =>
    locale === "ar" && item.titleAr ? item.titleAr : item.titleEn;

  const launchPayment = async (reference: string, amount: number) => {
    if (!PUBLIC_KEY) {
      setError(t("checkout.noPaymentKey", { reference }));
      return;
    }
    try {
      await loadFlutterwaveScript();
    } catch {
      setError(t("checkout.paymentInitError", { reference }));
      return;
    }
    paidRef.current = false;
    const opened = openFlutterwaveCheckout({
      public_key: PUBLIC_KEY,
      tx_ref: reference,
      amount,
      currency: "NGN",
      payment_options: "card, banktransfer, ussd",
      customer: { email, name, phone_number: phone },
      customizations: {
        title: "Daaru Kutubul Athaariyyah",
        description: t("checkout.paymentDescription"),
        logo: LOGO_DATA_URI,
      },
      callback: (response) => {
        if (response.status === "successful") {
          paidRef.current = true;
          clear();
          void router.push(`/order-success?reference=${reference}`);
        } else {
          setError(t("checkout.paymentFailed"));
        }
      },
      onclose: () => {
        // Closed without paying — the order is saved, so the user can retry.
        if (!paidRef.current) {
          setError(t("checkout.paymentClosed"));
        }
      },
    });
    if (!opened) {
      setError(t("checkout.paymentInitError", { reference }));
    }
  };

  // Snapshot of the current cart contents used to validate retries.
  const cartFingerprint = items
    .map((item) => `${item.bookId}:${item.quantity}`)
    .sort()
    .join("|");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    // An order already exists for this session AND the cart is unchanged —
    // just reopen the modal. If the cart changed, fall through and create a
    // fresh order so a retry never charges the old contents.
    if (pending && pending.cartFingerprint === cartFingerprint) {
      setPlacing(true);
      try {
        await launchPayment(pending.reference, pending.total);
      } finally {
        setPlacing(false);
      }
      return;
    }
    setPlacing(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          password,
          items: items.map((item) => ({
            bookId: item.bookId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        paymentReference?: string;
        total?: number;
        accountCreated?: boolean;
      };
      if (!response.ok) {
        setError(data.error ?? t("checkout.error"));
        return;
      }
      const next = {
        reference: data.paymentReference as string,
        total: data.total as number,
        cartFingerprint,
        accountCreated: data.accountCreated,
      };
      setPending(next);
      await launchPayment(next.reference, next.total);
    } catch {
      setError(t("checkout.error"));
    } finally {
      setPlacing(false);
    }
  };

  // Empty cart — nothing to check out.
  if (items.length === 0) {
    return (
      <>
        <Head>
          <title>
            {t("appName")} — {t("checkout.title")}
          </title>
        </Head>
        <section className="container-daaru flex flex-col items-center py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
            <FontAwesomeIcon icon={faShoppingBag} className="h-9 w-9 text-primary-400" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">
            {t("cart.empty")}
          </h1>
          <Link
            href="/books"
            className="btn mt-8 bg-primary px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-800"
          >
            {t("cart.browseBooks")}
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>
          {t("appName")} — {t("checkout.title")}
        </title>
        <meta name="description" content={t("checkout.subtitle")} />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <section className="bg-primary-50 py-10">
        <div className="container-daaru text-center">
          <h1 className="text-3xl font-bold text-primary-800 sm:text-4xl">
            {t("checkout.title")}
          </h1>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-gold" />
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            {t("checkout.subtitle")}
          </p>
        </div>
      </section>

      <main className="container-daaru grid items-start gap-8 py-8 lg:grid-cols-[1fr_22rem] lg:py-12">
        {/* Customer details */}
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-bold text-slate-900">{t("checkout.details")}</h2>

          {error && (
            <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          {pending && !error && (
            <p className="mt-5 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
              {t("checkout.orderCreatedNote", { reference: pending.reference })}
            </p>
          )}
          {pending?.accountCreated && !error && (
            <p className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
              {t("checkout.accountCreated")}
            </p>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("checkout.name")}
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("checkout.email")}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("checkout.phone")}
              </label>
              <input
                id="phone"
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234..."
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("checkout.address")}
              </label>
              <textarea
                id="address"
                required
                autoComplete="street-address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FontAwesomeIcon icon={faKey} className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary-800">
                  {t("checkout.createAccount")}
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                {t("checkout.createAccountHint")}
              </p>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t("checkout.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={placing}
            className="btn mt-8 w-full bg-gold px-6 py-3.5 text-base font-bold text-slate-900 transition-all duration-200 hover:scale-[1.02] hover:bg-gold-600 disabled:opacity-60"
          >
            {placing ? t("checkout.placing") : t("checkout.placeOrder")}
          </button>

          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
            <FontAwesomeIcon icon={faLock} className="h-3 w-3" />
            {t("checkout.secure")}
          </p>
        </form>

        {/* Order summary */}
        <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-slate-900">{t("checkout.orderSummary")}</h2>
          <ul className="mt-5 space-y-4">
            {items.map((item) => (
              <li key={item.bookId} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">
                    {localizedTitle(item)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {item.quantity} × ₦{item.price.toLocaleString()}
                    {discountPercent(item.price, item.originalPrice) !== null &&
                      item.originalPrice && (
                        <span className="ms-1 line-through">
                          ₦{item.originalPrice.toLocaleString()}
                        </span>
                      )}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-slate-700">
                  ₦{(item.price * item.quantity).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-sm font-bold text-slate-900">
              {t("checkout.total")}{" "}
              <span className="font-normal text-slate-400">({count} {t("cart.items")})</span>
            </span>
            <span className="text-xl font-bold text-primary">
              ₦{total.toLocaleString()}
            </span>
          </div>
        </aside>
      </main>
    </>
  );
}
