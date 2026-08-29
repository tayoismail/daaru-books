import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import LanguageToggle from "@/components/LanguageToggle";
import Logo from "@/components/Logo";
import { CATEGORIES, categoryName } from "@/lib/categories";
import { useAuth, useCart, useLanguage } from "@/lib/contexts";

const LINKS = [
  { href: "/", key: "home" },
  { href: "/books", key: "books" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export default function Navbar() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const router = useRouter();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const { count } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Books category dropdown (desktop) + mobile submenu.
  const [booksDropdownOpen, setBooksDropdownOpen] = useState(false);
  const [booksMobileOpen, setBooksMobileOpen] = useState(false);

  // Transparent at the top of the homepage, solid everywhere else / on scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu and books dropdowns when the route changes.
  useEffect(() => {
    const closeMenus = () => {
      setMenuOpen(false);
      setBooksDropdownOpen(false);
      setBooksMobileOpen(false);
    };
    router.events.on("routeChangeComplete", closeMenus);
    return () => router.events.off("routeChangeComplete", closeMenus);
  }, [router.events]);

  // Close the desktop dropdown on Escape (keyboard users).
  useEffect(() => {
    if (!booksDropdownOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setBooksDropdownOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [booksDropdownOpen]);

  const onHome = router.pathname === "/";
  const solid = scrolled || menuOpen || !onHome;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        solid
          ? "border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="container-daaru flex h-16 items-center justify-between gap-4 md:h-20">
        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          aria-label={t("appName")}
        >
          <Logo />
          <span className="text-lg font-bold tracking-tight text-primary md:text-xl">
            {t("appName")}
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) =>
            link.key === "books" ? (
              <li
                key={link.key}
                className="relative"
                onMouseEnter={() => setBooksDropdownOpen(true)}
                onMouseLeave={() => setBooksDropdownOpen(false)}
                onFocus={() => setBooksDropdownOpen(true)}
                onBlur={() => setBooksDropdownOpen(false)}
              >
                <Link
                  href={link.href}
                  id="nav-books-trigger"
                  aria-haspopup="true"
                  aria-expanded={booksDropdownOpen}
                  aria-controls="nav-books-menu"
                  onClick={(e) => {
                    // First tap (touch devices) opens the dropdown instead of
                    // navigating; a second tap follows the link.
                    if (!booksDropdownOpen) {
                      e.preventDefault();
                      setBooksDropdownOpen(true);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary ${
                    router.pathname === link.href
                      ? "text-primary"
                      : "text-slate-600"
                  }`}
                >
                  {t(`nav.${link.key}`)}
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-3 w-3 transition-transform duration-200 ${
                      booksDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </Link>
                {booksDropdownOpen && (
                  // The pt-3 wrapper bridges the gap between the trigger and
                  // the panel so the hover never breaks while moving between
                  // them (the padding is part of the li's hover area).
                  <div className="absolute start-0 top-full z-50 w-64 pt-3">
                    <div
                      id="nav-books-menu"
                      aria-label={t("nav.books")}
                      className="animate-dropdown-in rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                    >
                      <Link
                        href="/books"
                        className="block rounded-xl px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-50"
                      >
                        {t("books.title")}
                      </Link>
                      <div className="mx-3 my-1.5 h-px bg-slate-100" />
                      {CATEGORIES.map((category) => (
                        <Link
                          key={category.slug}
                          href={`/books?category=${category.slug}`}
                          className="block rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-primary-50 hover:text-primary"
                        >
                          {categoryName(category.en, locale)}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ) : (
              <li key={link.key}>
                <Link
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    router.pathname === link.href
                      ? "text-primary"
                      : "text-slate-600"
                  }`}
                >
                  {t(`nav.${link.key}`)}
                </Link>
              </li>
            )
          )}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className="text-sm font-semibold text-gold-700 transition-colors hover:text-gold-600"
              >
                {t("nav.admin")}
              </Link>
            </li>
          )}
          {isAuthenticated && !isAdmin && (
            <li>
              <Link
                href="/account/orders"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  router.pathname === "/account/orders"
                    ? "text-primary"
                    : "text-slate-600"
                }`}
              >
                {t("nav.myOrders")}
              </Link>
            </li>
          )}
        </ul>

        {/* Right side */}
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Cart with badge */}
          <Link
            href="/cart"
            className="relative rounded-full p-2 text-slate-600 transition-colors hover:bg-primary-50 hover:text-primary"
            aria-label={t("nav.cart")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
            {count > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>

          <LanguageToggle />

          {/* Auth (desktop) */}
          {isAuthenticated ? (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="max-w-28 truncate text-sm font-medium text-slate-600">
                {user?.name}
              </span>
              <button
                type="button"
                onClick={logout}
                className="btn border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary"
              >
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link
                href="/login"
                className="btn border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary"
              >
                {t("nav.login")}
              </Link>
              <Link
                href="/signup"
                className="btn bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-800"
              >
                {t("nav.register")}
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 transition-colors hover:bg-primary-50 hover:text-primary lg:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-6 w-6"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <div className="container-daaru flex flex-col gap-1 py-4">
            {LINKS.map((link) =>
              link.key === "books" ? (
                <div key={link.key} className="rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBooksMobileOpen((open) => !open)}
                    aria-expanded={booksMobileOpen}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary-50 hover:text-primary ${
                      router.pathname === link.href
                        ? "bg-primary-50 text-primary"
                        : "text-slate-700"
                    }`}
                  >
                    {t(`nav.${link.key}`)}
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`h-3 w-3 transition-transform duration-200 ${
                        booksMobileOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {booksMobileOpen && (
                    <div className="mt-1 space-y-0.5 border-s-2 border-primary-100 ps-3">
                      <Link
                        href="/books"
                        className="block rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-50"
                      >
                        {t("books.title")}
                      </Link>
                      {CATEGORIES.map((category) => (
                        <Link
                          key={category.slug}
                          href={`/books?category=${category.slug}`}
                          className="block rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-primary-50 hover:text-primary"
                        >
                          {categoryName(category.en, locale)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.key}
                  href={link.href}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary-50 hover:text-primary ${
                    router.pathname === link.href
                      ? "bg-primary-50 text-primary"
                      : "text-slate-700"
                  }`}
                >
                  {t(`nav.${link.key}`)}
                </Link>
              )
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-gold-700 hover:bg-primary-50"
              >
                {t("nav.admin")}
              </Link>
            )}
            {isAuthenticated && !isAdmin && (
              <Link
                href="/account/orders"
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-primary-50 hover:text-primary ${
                  router.pathname === "/account/orders"
                    ? "bg-primary-50 text-primary"
                    : "text-slate-700"
                }`}
              >
                {t("nav.myOrders")}
              </Link>
            )}
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={logout}
                  className="btn bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800"
                >
                  {t("nav.logout")}
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="btn border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary"
                  >
                    {t("nav.login")}
                  </Link>
                  <Link
                    href="/signup"
                    className="btn bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800"
                  >
                    {t("nav.register")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
