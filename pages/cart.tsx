import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faMinus,
  faPlus,
  faShoppingBag,
  faTrashCan,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";
import { coverInitials } from "@/components/BookCard";
import Seo from "@/components/Seo";
import { useCart, useLanguage } from "@/lib/contexts";
import { discountPercent } from "@/lib/format";

export default function CartPage() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { items, total, count, updateQuantity, removeItem } = useCart();

  const localizedTitle = (item: { titleEn: string; titleAr: string }) =>
    locale === "ar" && item.titleAr ? item.titleAr : item.titleEn;

  return (
    <>
      <Seo title={`${t("appName")} — ${t("cart.title")}`} description={t("cart.subtitle")} />

      <section className="bg-primary-50 py-10">
        <div className="container-daaru text-center">
          <h1 className="text-3xl font-bold text-primary-800 sm:text-4xl">
            {t("cart.title")}
          </h1>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-gold" />
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            {t("cart.subtitle")}
          </p>
        </div>
      </section>

      <main className="container-daaru py-8 lg:py-12">
        {items.length === 0 ? (
          /* Empty state */
          <div className="mx-auto max-w-md py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
              <FontAwesomeIcon
                icon={faShoppingBag}
                className="h-9 w-9 text-primary-400"
              />
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-900">
              {t("cart.empty")}
            </h2>
            <p className="mt-2 text-sm text-slate-500">{t("cart.emptySubtitle")}</p>
            <Link
              href="/books"
              className="btn mt-8 bg-primary px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-800"
            >
              {t("cart.browseBooks")}
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
            {/* Line items */}
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.bookId}
                  className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Thumbnail */}
                  <Link
                    href={`/books/${item.bookId}`}
                    className="relative flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950"
                  >
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={localizedTitle(item)}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-base font-bold text-white/90">
                        {coverInitials(localizedTitle(item))}
                      </span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/books/${item.bookId}`}
                          className="block truncate font-bold text-slate-900 transition-colors hover:text-primary"
                        >
                          {localizedTitle(item)}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {item.author}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {t("cart.unitPrice")}:{" "}
                          <span className="font-semibold text-slate-600">
                            ₦{item.price.toLocaleString()}
                          </span>
                          {discountPercent(item.price, item.originalPrice) !==
                            null &&
                            item.originalPrice && (
                              <span className="ms-1.5 text-xs line-through">
                                ₦{item.originalPrice.toLocaleString()}
                              </span>
                            )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.bookId)}
                        aria-label={t("cart.remove")}
                        className="btn h-9 w-9 shrink-0 p-0 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.bookId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label={t("cart.decreaseQty")}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <FontAwesomeIcon icon={faMinus} className="h-3 w-3" />
                        </button>
                        <span
                          className="min-w-7 text-center text-sm font-bold text-slate-900"
                          aria-live="polite"
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.bookId, item.quantity + 1)}
                          aria-label={t("cart.increaseQty")}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          <FontAwesomeIcon icon={faPlus} className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-primary">
                        {t("cart.subtotal")}: ₦
                        {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Summary */}
            <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
              <h2 className="text-lg font-bold text-slate-900">
                {t("cart.summary")}
              </h2>
              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">
                    {t("cart.subtotal")}{" "}
                    <span className="text-slate-400">({count} {t("cart.items")})</span>
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    ₦{total.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-500">
                    <FontAwesomeIcon icon={faTruck} className="h-3.5 w-3.5" />
                    {t("cart.shipping")}
                  </dt>
                  <dd className="font-semibold text-primary">{t("cart.free")}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-base">
                  <dt className="font-bold text-slate-900">{t("cart.total")}</dt>
                  <dd className="text-xl font-bold text-primary">
                    ₦{total.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <Link
                href="/checkout"
                className="btn mt-6 w-full gap-2 bg-gold px-6 py-3 text-sm font-bold text-slate-900 transition-all duration-200 hover:scale-[1.02] hover:bg-gold-600"
              >
                {t("cart.proceed")}
                <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4 rtl:-scale-x-100" />
              </Link>
              <Link
                href="/books"
                className="mt-3 block text-center text-sm font-medium text-slate-500 transition-colors hover:text-primary"
              >
                {t("cart.continueShopping")}
              </Link>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
