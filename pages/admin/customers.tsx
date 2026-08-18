import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCartShopping,
  faChevronLeft,
  faChevronRight,
  faNairaSign,
  faSearch,
  faUserGroup,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { useLanguage } from "@/lib/contexts";
import { formatDate } from "@/lib/format";
import type { CustomerRow } from "@/types";

const PAGE_SIZE = 12;

interface AdminCustomersProps {
  user: AdminUser;
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  return { props: { user: guard.user } };
}

interface CustomersSummary {
  customerCount: number;
  orderCount: number;
  totalSpent: number;
}

export default function AdminCustomers({ user }: AdminCustomersProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [summary, setSummary] = useState<CustomersSummary>({
    customerCount: 0,
    orderCount: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/customers");
        const data = (await res.json()) as {
          customers?: CustomerRow[];
          summary?: CustomersSummary;
          error?: string;
        };
        if (!cancelled && res.ok) {
          setCustomers(data.customers ?? []);
          setSummary(
            data.summary ?? { customerCount: 0, orderCount: 0, totalSpent: 0 }
          );
        }
        if (!cancelled && !res.ok) setError(data.error ?? t("admin.customers.error"));
      } catch {
        if (!cancelled) setError(t("admin.customers.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageCustomers = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const summaryCards = [
    {
      icon: faUserGroup,
      tone: "bg-primary-50 text-primary",
      label: t("admin.customers.stats.customers"),
      value: String(summary.customerCount),
    },
    {
      icon: faCartShopping,
      tone: "bg-blue-50 text-blue-600",
      label: t("admin.customers.stats.orders"),
      value: String(summary.orderCount),
    },
    {
      icon: faNairaSign,
      tone: "bg-gold-100 text-gold-700",
      label: t("admin.customers.stats.total"),
      value: `₦${summary.totalSpent.toLocaleString()}`,
    },
  ] as const;

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.customers")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-5">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="card flex items-center gap-4 bg-white p-5">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.tone}`}
              >
                <FontAwesomeIcon icon={card.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {card.label}
                </p>
                <p className="mt-0.5 truncate text-2xl font-bold text-slate-900">
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:max-w-md">
          <FontAwesomeIcon icon={faSearch} className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="search"
            name="q"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("admin.customers.search")}
            aria-label={t("admin.customers.search")}
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
                  <th className="px-4 py-3 font-semibold">{t("admin.customers.colCustomer")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.customers.colEmail")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.customers.colOrders")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.customers.colSpent")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.customers.colLastOrder")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("books.loading")}…
                    </td>
                  </tr>
                )}
                {!loading && pageCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("admin.customers.empty")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageCustomers.map((customer) => (
                    <tr key={customer.email} className="transition-colors hover:bg-primary-50/40">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                            {customer.name
                              .split(/\s+/)
                              .filter(Boolean)
                              .map((w) => w.charAt(0))
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {customer.name}
                            </p>
                            <p className="text-xs text-slate-400" dir="ltr">
                              {customer.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600" dir="ltr">
                        {customer.email}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">
                          {customer.orderCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        ₦{customer.totalSpent.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">
                        {formatDate(customer.lastOrderAt, locale)}
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
                {t("admin.customers.results", { count: filtered.length })}
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
    </AdminLayout>
  );
}
