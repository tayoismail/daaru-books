import type { NextPageContext } from "next";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

interface ErrorPageProps {
  statusCode?: number;
}

/**
 * Global error page — renders for 500s (and other unexpected statuses).
 * The dedicated /404 page takes precedence for 404s, but we still handle the
 * case here (e.g. a 404 status passed explicitly) for safety.
 */
function ErrorPage({ statusCode }: ErrorPageProps) {
  const { t } = useTranslation();
  const is404 = statusCode === 404;

  return (
    <section className="container-daaru flex flex-col items-center px-4 py-24 text-center">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full ${
          is404 ? "bg-primary-50" : "bg-rose-50"
        }`}
      >
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          className={`h-10 w-10 ${is404 ? "text-primary" : "text-rose-600"}`}
        />
      </div>
      <p className="mt-6 text-6xl font-black tracking-tight text-gold sm:text-7xl">
        {statusCode ?? 500}
      </p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
        {is404 ? t("notFound.title") : t("error.title")}
      </h1>
      <p className="mt-3 max-w-md text-slate-600">
        {is404 ? t("notFound.subtitle") : t("error.subtitle")}
      </p>
      <Link
        href="/"
        className="btn mt-8 bg-primary px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-800"
      >
        {t("notFound.backHome")}
      </Link>
    </section>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
