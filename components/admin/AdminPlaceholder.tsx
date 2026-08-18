import { type IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";

interface AdminPlaceholderProps {
  icon: IconDefinition;
  title: string;
}

/**
 * Friendly "under construction" state for admin modules that are built in a
 * later batch (Books, Orders, Expenses, Users management).
 */
export default function AdminPlaceholder({ icon, title }: AdminPlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white/60 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
        <FontAwesomeIcon icon={icon} className="h-9 w-9 text-primary-400" />
      </div>
      <h2 className="mt-6 text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {t("admin.comingSoon")}
      </p>
    </div>
  );
}
