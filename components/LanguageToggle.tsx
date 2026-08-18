import { useTranslation } from "react-i18next";
import { useLanguage } from "@/lib/contexts";

export default function LanguageToggle() {
  const { t } = useTranslation();
  const { toggleLocale } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="btn border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary"
      aria-label={t("nav.language")}
      title={t("nav.language")}
    >
      {t("nav.language")}
    </button>
  );
}
