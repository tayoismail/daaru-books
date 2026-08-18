import Link from "next/link";
import Head from "next/head";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen } from "@fortawesome/free-solid-svg-icons";

/**
 * Localized 404 page — also rendered when a dynamic route (e.g. a book that
 * no longer exists) returns `notFound: true` from getServerSideProps.
 */
export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <>
      <Head>
        <title>
          {t("notFound.title")} — {t("appName")}
        </title>
        <meta name="description" content={t("notFound.subtitle")} />
      </Head>

      <section className="container-daaru flex flex-col items-center px-4 py-24 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-50">
          <FontAwesomeIcon icon={faBookOpen} className="h-10 w-10 text-primary" />
        </div>
        <p className="mt-6 text-6xl font-black tracking-tight text-gold sm:text-7xl">
          404
        </p>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
          {t("notFound.title")}
        </h1>
        <p className="mt-3 max-w-md text-slate-600">{t("notFound.subtitle")}</p>
        <Link
          href="/"
          className="btn mt-8 bg-primary px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-800"
        >
          {t("notFound.backHome")}
        </Link>
      </section>
    </>
  );
}
