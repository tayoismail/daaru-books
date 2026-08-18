import { useTranslation } from "react-i18next";
import Seo from "@/components/Seo";

/** Privacy Policy — static bilingual content. */
export default function Privacy() {
  const { t } = useTranslation();
  // Contact section interpolates the admin-managed email/phone.
  const contactVars = { email: t("contact.email"), phone: t("contact.phone") };

  return (
    <>
      <Seo title={`${t("appName")} — ${t("privacy.title")}`} description={t("privacy.subtitle")} />

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="container-daaru py-16 text-center md:py-20">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {t("privacy.title")}
          </h1>
          <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-gold" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            {t("privacy.subtitle")}
          </p>
        </div>
      </section>

      <section className="container-daaru py-16">
        <div className="mx-auto max-w-3xl space-y-10">
          {(["intro", "collection", "usage", "sharing", "cookies", "rights", "contact"] as const).map(
            (key) => (
              <article key={key}>
                <h2 className="text-xl font-bold text-slate-900">
                  {t(`privacy.sections.${key}.title`)}
                </h2>
                <div className="mt-3 h-0.5 w-10 rounded-full bg-gold" />
                <p className="mt-4 leading-relaxed text-slate-600">
                  {t(`privacy.sections.${key}.text`, key === "contact" ? contactVars : undefined)}
                </p>
              </article>
            )
          )}
        </div>
      </section>
    </>
  );
}
