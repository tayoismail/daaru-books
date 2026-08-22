import "@/styles/globals.css";
import App, { AppContext, AppProps } from "next/app";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import { I18nextProvider } from "react-i18next";
import { useState } from "react";
import Layout from "@/components/Layout";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { CartProvider } from "@/lib/contexts/CartContext";
import { LanguageProvider } from "@/lib/contexts/LanguageContext";
import i18n, { DEFAULT_LOCALE, setLocale, type Locale } from "@/lib/i18n";
import {
  applySettingsToI18n,
  loadSettings,
} from "@/lib/settingsClient";
import { fetchCategories } from "@/lib/categoriesClient";
import { updateCategories, type CategoryInfo } from "@/lib/categories";
import type { StoreSettings } from "@/types";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
});

interface MyAppProps extends AppProps {
  /** Admin-managed store settings, serialized from the server render. */
  settings?: StoreSettings | null;
  /** Live book categories from SQLite (keeps navbar/footer in sync). */
  categories?: CategoryInfo[];
}

function MyApp({ Component, pageProps, router, settings, categories }: MyAppProps) {
  // Apply admin-managed settings (name, contact, whatsapp) and live
  // categories before the first render. getInitialProps applies them on the
  // server (so SSR HTML + SEO tags carry them) and returns the same object;
  // on the client the initial hydration render applies them here so it
  // matches the SSR HTML exactly — no flash of default branding and no
  // React text-mismatch error.
  useState(() => {
    if (settings) applySettingsToI18n(settings);
    if (categories) updateCategories(categories);
    return true;
  });

  // Admin pages bring their own chrome (sidebar + header via AdminLayout), so
  // the public storefront navbar/footer are skipped there.
  const isAdminRoute = router.pathname.startsWith("/admin");

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <CartProvider>
          <LanguageProvider>
            <div className={`${inter.variable} ${notoArabic.variable}`}>
              {isAdminRoute ? (
                <Component {...pageProps} />
              ) : (
                <Layout>
                  <Component {...pageProps} />
                </Layout>
              )}
            </div>
          </LanguageProvider>
        </CartProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}

MyApp.getInitialProps = async (ctx: AppContext) => {
  const locale = (ctx.router.locale as Locale | undefined) ?? DEFAULT_LOCALE;
  await setLocale(locale);
  // Fetch + apply admin-managed store settings (name, contact, whatsapp) on
  // the server so SSR HTML and SEO tags carry them, then hand the object to
  // the client so its initial hydration render applies the same overrides.
  const settings = await loadSettings(ctx.ctx);
  // Fetch live book categories from SQLite so the navbar, footer, and book
  // pages always show admin-managed categories (not the stale JSON seed).
  const categories = await fetchCategories(ctx.ctx);
  updateCategories(categories);
  const appProps = await App.getInitialProps(ctx);
  return { ...appProps, settings, categories };
};

export default MyApp;
