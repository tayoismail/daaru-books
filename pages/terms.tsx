import { useTranslation } from "react-i18next";
import Seo from "@/components/Seo";

/** Terms of Service — static bilingual content. */
export default function Terms() {
  const { t } = useTranslation();
  // Contact section interpolates the admin-managed email/phone.
  const contactVars = { email: t("contact.email"), phone: t("contact.phone") };

  return (
    <>
      <Seo title={`${t("appName")} — ${t("terms.title")}`} description={t("terms.subtitle")} />

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="container-daaru py-16 text-center md:py-20">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {t("terms.title")}
          </h1>
          <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-gold" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            {t("terms.subtitle")}
          </p>
        </div>
      </section>

      <section className="container-daaru py-16">
        <div className="mx-auto max-w-3xl space-y-10">
          {(["intro", "orders", "pricing", "shipping", "returns", "liability", "changes", "contact"] as const).map(
            (key) => (
              <article key={key}>
                <h2 className="text-xl font-bold text-slate-900">
                  {t(`terms.sections.${key}.title`)}
                </h2>
                <div className="mt-3 h-0.5 w-10 rounded-full bg-gold" />
                <p className="mt-4 leading-relaxed text-slate-600">
                  {t(`terms.sections.${key}.text`, key === "contact" ? contactVars : undefined)}
                </p>
              </article>
            )
          )}
        </div>
      </section>
    </>
  );
}
