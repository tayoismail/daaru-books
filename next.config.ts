import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent MIME-type sniffing (e.g. an HTML file served as an image).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Keep referrers from leaking the full URL to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Block embedding the storefront in other sites (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Restrict browser features (camera/mic/geolocation are never needed).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  i18n: {
    locales: ["en", "ar"],
    defaultLocale: "en",
    localeDetection: false,
  },
  async headers() {
    return [
      {
        // Apply to every page + API route.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
