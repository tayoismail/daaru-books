import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAddressBook,
  faBars,
  faBook,
  faCartShopping,
  faChartPie,
  faClockRotateLeft,
  faCoins,
  faCommentDots,
  faGauge,
  faGear,
  faImages,
  faRightFromBracket,
  faRotateLeft,
  faTags,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/contexts";
import type { AdminUser } from "@/lib/admin";

const NAV = [
  { href: "/admin/dashboard", key: "dashboard", icon: faGauge },
  { href: "/admin/report", key: "report", icon: faChartPie },
  { href: "/admin/refunds", key: "refunds", icon: faRotateLeft },
  { href: "/admin/books", key: "books", icon: faBook },
  { href: "/admin/inventory", key: "inventory", icon: faClockRotateLeft },
  { href: "/admin/categories", key: "categories", icon: faTags },
  { href: "/admin/testimonials", key: "testimonials", icon: faCommentDots },
  { href: "/admin/orders", key: "orders", icon: faCartShopping },
  { href: "/admin/customers", key: "customers", icon: faAddressBook },
  { href: "/admin/expenses", key: "expenses", icon: faCoins },
  { href: "/admin/slides", key: "slides", icon: faImages },
  { href: "/admin/settings", key: "settings", icon: faGear },
  { href: "/admin/users", key: "users", icon: faUsers },
] as const;

const TITLES: Record<string, string> = {
  "/admin/dashboard": "admin.titles.dashboard",
  "/admin/report": "admin.titles.report",
  "/admin/refunds": "admin.titles.refunds",
  "/admin/books": "admin.titles.books",
  "/admin/inventory": "admin.titles.inventory",
  "/admin/categories": "admin.titles.categories",
  "/admin/testimonials": "admin.titles.testimonials",
  "/admin/orders": "admin.titles.orders",
  "/admin/customers": "admin.titles.customers",
  "/admin/expenses": "admin.titles.expenses",
  "/admin/slides": "admin.titles.slides",
  "/admin/settings": "admin.titles.settings",
  "/admin/users": "admin.titles.users",
};

/** Initials shown in the header avatar. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface AdminLayoutProps extends PropsWithChildren {
  /** Admin user resolved by the page's getServerSideProps guard. */
  user: AdminUser;
}

/**
 * Admin shell — dark-green sidebar (collapsible drawer on mobile) with gold
 * active-item border, plus a sticky header with the page title, avatar, name
 * and logout.
 */
export default function AdminLayout({ user, children }: AdminLayoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Match by prefix so future nested admin routes (e.g. /admin/orders/[id])
  // still resolve to their section title.
  const titleKey =
    Object.entries(TITLES).find(([path]) => router.pathname.startsWith(path))?.[1] ??
    "admin.titles.dashboard";

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    void router.push("/login");
  };

  return (
    <div className="flex min-h-[80vh] bg-slate-50">
      {/* Mobile backdrop */}
      {menuOpen && (
        <button
          type="button"
          aria-label={t("admin.closeMenu")}
          onClick={closeMenu}
          className="fixed inset-0 z-40 cursor-default bg-black/50 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-64 flex-col bg-primary text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
          <Logo className="h-8 w-8" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">
              {t("appName")}
            </p>
            <p className="text-[11px] text-white/60">{t("admin.panel")}</p>
          </div>
          <button
            type="button"
            onClick={closeMenu}
            aria-label={t("admin.closeMenu")}
            className="ms-auto rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            const active = router.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className={`flex items-center gap-3 rounded-lg border-s-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-gold bg-white/10 text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className="h-4 w-4 shrink-0" />
                {t(`admin.nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        {/* Footer: user + logout */}
        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-slate-900">
              {initialsOf(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-[11px] text-white/60">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t("nav.logout")}
              title={t("nav.logout")}
              className="rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("admin.openMenu")}
            className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <FontAwesomeIcon icon={faBars} className="h-5 w-5" />
          </button>
          <h1 className="truncate text-lg font-bold text-slate-900">
            {t(titleKey)}
          </h1>
          <div className="ms-auto flex items-center gap-3">
            <span className="hidden text-sm font-medium text-slate-600 sm:block">
              {user.name}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
              {initialsOf(user.name)}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="btn border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary"
            >
              {t("nav.logout")}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
