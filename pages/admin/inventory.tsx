import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDownWideShort,
  faBoxesStacked,
  faChevronLeft,
  faChevronRight,
  faMagnifyingGlassMinus,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { useLanguage } from "@/lib/contexts";
import { formatDate } from "@/lib/format";
import type { InventoryBookOption, InventoryLogRow } from "@/types";

const PAGE_SIZE = 12;

interface AdminInventoryProps {
  user: AdminUser;
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  return { props: { user: guard.user } };
}

export default function AdminInventory({ user }: AdminInventoryProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();

  const [logs, setLogs] = useState<InventoryLogRow[]>([]);
  const [books, setBooks] = useState<InventoryBookOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [bookFilter, setBookFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/inventory");
        const data = (await res.json()) as {
          logs?: InventoryLogRow[];
          books?: InventoryBookOption[];
          error?: string;
        };
        if (!cancelled && res.ok) {
          setLogs(data.logs ?? []);
          setBooks(data.books ?? []);
        }
        if (!cancelled && !res.ok) setError(data.error ?? t("admin.inventory.error"));
      } catch {
        if (!cancelled) setError(t("admin.inventory.error"));
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

  const localizedBook = (log: InventoryLogRow) =>
    locale === "ar" && log.bookTitleAr ? log.bookTitleAr : log.bookTitleEn;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (bookFilter && log.bookId !== bookFilter) return false;
      if (q) {
        // Match against both languages so search works in either UI locale.
        const haystack =
          `${log.bookTitleEn} ${log.bookTitleAr} ${log.reason}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, bookFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageLogs = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const log of logs) {
      if (log.change > 0) added += log.change;
      else removed += Math.abs(log.change);
    }
    return { entries: logs.length, added, removed };
  }, [logs]);

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.inventory")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="space-y-5">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-4 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <FontAwesomeIcon icon={faBoxesStacked} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("admin.inventory.stats.entries")}
              </p>
              <p className="mt-0.5 truncate text-2xl font-bold text-slate-900">
                {stats.entries}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-4 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FontAwesomeIcon icon={faArrowDownWideShort} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("admin.inventory.stats.added")}
              </p>
              <p className="mt-0.5 truncate text-2xl font-bold text-slate-900">
                +{stats.added.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-4 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <FontAwesomeIcon icon={faMagnifyingGlassMinus} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("admin.inventory.stats.removed")}
              </p>
              <p className="mt-0.5 truncate text-2xl font-bold text-slate-900">
                −{stats.removed.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

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
              placeholder={t("admin.inventory.search")}
              aria-label={t("admin.inventory.search")}
              className="w-full min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <select
            value={bookFilter}
            onChange={(e) => {
              setBookFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t("admin.inventory.filterBook")}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t("admin.inventory.allBooks")}</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {locale === "ar" && book.titleAr ? book.titleAr : book.titleEn}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}

        {/* Table */}
        <div className="card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-start text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("admin.table.date")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.inventory.colBook")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.inventory.colChange")}</th>
                  <th className="px-4 py-3 font-semibold">{t("admin.inventory.colReason")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("books.loading")}…
                    </td>
                  </tr>
                )}
                {!loading && pageLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400">
                      {t("admin.inventory.empty")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageLogs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-primary-50/40">
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">
                        {formatDate(log.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        {log.bookTitleEn || log.bookTitleAr ? (
                          <span className="line-clamp-2">{localizedBook(log)}</span>
                        ) : (
                          <span className="text-slate-400">
                            {t("admin.inventory.deletedBook")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {log.change > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                            +{log.change}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600">
                            −{Math.abs(log.change)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{log.reason}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4">
              <p className="text-sm text-slate-500">
                {t("admin.inventory.results", { count: filtered.length })}
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
