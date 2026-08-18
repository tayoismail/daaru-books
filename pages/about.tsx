import { useTranslation } from "react-i18next";
import Reveal from "@/components/Reveal";
import Seo from "@/components/Seo";

const VALUE_KEYS = ["authenticity", "community", "service"] as const;

export default function About() {
  const { t } = useTranslation();

  return (
    <>
      <Seo title={`${t("appName")} — ${t("about.title")}`} description={t("about.subtitle")} />

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="container-daaru py-16 text-center md:py-24">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {t("about.title")}
          </h1>
          <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-gold" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            {t("about.subtitle")}
          </p>
        </div>
      </section>

      <section className="container-daaru py-16">
        {/* Story */}
        <Reveal>
          <h2 className="text-2xl font-bold text-slate-900">
            {t("about.storyTitle")}
          </h2>
          <div className="mt-3 h-0.5 w-10 rounded-full bg-gold" />
          <p className="mt-4 max-w-3xl leading-relaxed text-slate-600">
            {t("about.story")}
          </p>
        </Reveal>

        <Reveal>
          <h2 className="mt-16 text-2xl font-bold text-slate-900">
            {t("about.missionTitle")}
          </h2>
          <div className="mt-3 h-0.5 w-10 rounded-full bg-gold" />
          <p className="mt-4 max-w-3xl leading-relaxed text-slate-600">
            {t("about.mission")}
          </p>
        </Reveal>

        {/* Team */}
        <Reveal>
          <h2 className="mt-16 text-2xl font-bold text-slate-900">
            {t("about.teamTitle")}
          </h2>
          <p className="mt-3 text-slate-600">{t("about.teamSubtitle")}</p>
        </Reveal>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {(["founder", "operations", "community"] as const).map((key, index) => (
            <Reveal key={key} delay={index * 80}>
              <div className="card h-full bg-white p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-700 to-primary-950 text-lg font-bold text-gold">
                  {t(`about.team.${key}.name`)
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word.charAt(0))
                    .join("")}
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">
                  {t(`about.team.${key}.name`)}
                </h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gold-700">
                  {t(`about.team.${key}.role`)}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {t(`about.team.${key}.bio`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <h2 className="mt-16 text-2xl font-bold text-slate-900">
            {t("about.valuesTitle")}
          </h2>
        </Reveal>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {VALUE_KEYS.map((key, index) => (
            <Reveal key={key} delay={index * 80}>
              <div className="card h-full bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="h-1.5 w-12 rounded-full bg-gold" />
                <h3 className="mt-4 font-semibold text-slate-900">
                  {t(`about.values.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t(`about.values.${key}.text`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
