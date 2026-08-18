import Head from "next/head";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/contexts";

/** Public site URL used for canonical links + OG tags (override in .env). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

/**
 * Default social share image (branded PNG shipped in public/ — PNG, not SVG,
 * because Facebook/LinkedIn/WhatsApp refuse SVG og:image assets).
 */
export const OG_IMAGE = `${SITE_URL}/og-cover.png`;

export interface JsonLd {
  "@context": "https://schema.org";
  "@type": string;
  [key: string]: unknown;
}

interface SeoProps {
  /** Page title (brand is appended automatically). */
  title: string;
  description?: string;
  /** Open Graph image URL. Defaults to the branded OG cover. */
  image?: string;
  /** Extra JSON-LD blocks (e.g. Product on book pages). */
  jsonLd?: JsonLd[];
  /** og:type — "website" (default) or "product". */
  type?: "website" | "product";
}

/**
 * Centralized <head> helper: title, description, canonical, Open Graph,
 * Twitter card and JSON-LD structured data. Handles the locale automatically
 * (og:locale + localized title/description via t()).
 */
export default function Seo({
  title,
  description,
  image = OG_IMAGE,
  jsonLd = [],
  type = "website",
}: SeoProps) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const router = useRouter();

  const ogDescription =
    description ??
    t("tagline") +
      (router.pathname === "/"
        ? ""
        : ` — ${t(router.pathname.startsWith("/books/") ? "book" : "nav.home")}`);

  // Organization + WebSite are only emitted on the homepage (Google's
  // guidance: Organization markup belongs on the site root). Other pages emit
  // only the caller-supplied jsonLd (e.g. Product on book pages).
  const organization: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: t("appName"),
    url: SITE_URL,
    logo: OG_IMAGE,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: t("contact.phone"),
      contactType: "customer service",
      areaServed: "NG",
      availableLanguage: ["English", "Arabic"],
    },
  };

  const website: JsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: t("appName"),
    url: SITE_URL,
    inLanguage: locale,
    description: t("tagline"),
  };

  const blocks =
    router.pathname === "/" ? [organization, website, ...jsonLd] : jsonLd;

  return (
    <Head>
      <title>{title}</title>
      {ogDescription && <meta name="description" content={ogDescription} />}

      {/* Canonical */}
      <link
        rel="canonical"
        href={`${SITE_URL}${router.asPath === "/" ? "" : router.asPath}`}
      />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={t("appName")} />
      <meta property="og:title" content={title} />
      {ogDescription && <meta property="og:description" content={ogDescription} />}
      <meta property="og:url" content={`${SITE_URL}${router.asPath}`} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={locale === "ar" ? "ar_AR" : "en_NG"} />
      <meta property="og:locale:alternate" content={locale === "ar" ? "en_NG" : "ar_AR"} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {ogDescription && <meta name="twitter:description" content={ogDescription} />}
      <meta name="twitter:image" content={image} />

      {/* JSON-LD structured data */}
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </Head>
  );
}
