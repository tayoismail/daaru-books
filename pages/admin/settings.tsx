import Head from "next/head";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faSave } from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import { requireAdmin, type AdminUser } from "@/lib/admin";
import { normalizeWhatsapp } from "@/lib/settingsInput";
import type { StoreSettings } from "@/types";

interface SettingsAdminProps {
  user: AdminUser;
  initialSettings: StoreSettings;
}

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  const { readSettings } = await import("@/lib/settingsStore");
  const initialSettings = await readSettings();
  return { props: { user: guard.user, initialSettings } };
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function AdminSettings({
  user,
  initialSettings,
}: SettingsAdminProps) {
  const { t } = useTranslation();

  const [form, setForm] = useState({
    storeNameEn: initialSettings.storeName.en,
    storeNameAr: initialSettings.storeName.ar,
    contactEmail: initialSettings.contactEmail,
    contactPhone: initialSettings.contactPhone,
    whatsappNumber: initialSettings.whatsappNumber,
    address: initialSettings.address,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? t("admin.settings.error"));
        return;
      }
      setNotice(data.message ?? t("admin.settings.saved"));
    } catch {
      setError(t("admin.settings.error"));
    } finally {
      setSaving(false);
    }
  };

  const whatsappPreview = `https://wa.me/${normalizeWhatsapp(form.whatsappNumber)}`;

  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.settings")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="max-w-3xl space-y-5">
        <p className="text-sm text-slate-500">{t("admin.settings.intro")}</p>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
            {notice}
          </p>
        )}

        <form onSubmit={submit} className="card space-y-6 bg-white p-6">
          {/* Store name */}
          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary">
                <FontAwesomeIcon icon={faGear} className="h-3.5 w-3.5" />
              </span>
              {t("admin.settings.branding")}
            </legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="settings-name-en"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.settings.storeNameEn")} *
                </label>
                <input
                  id="settings-name-en"
                  type="text"
                  required
                  value={form.storeNameEn}
                  onChange={(e) => update("storeNameEn", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="settings-name-ar"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.settings.storeNameAr")} *
                </label>
                <input
                  id="settings-name-ar"
                  type="text"
                  required
                  dir="rtl"
                  value={form.storeNameAr}
                  onChange={(e) => update("storeNameAr", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>

          {/* Contact */}
          <fieldset>
            <legend className="text-sm font-bold text-slate-900">
              {t("admin.settings.contact")}
            </legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="settings-email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.settings.contactEmail")} *
                </label>
                <input
                  id="settings-email"
                  type="email"
                  required
                  value={form.contactEmail}
                  onChange={(e) => update("contactEmail", e.target.value)}
                  className={inputClass}
                  dir="ltr"
                />
              </div>
              <div>
                <label
                  htmlFor="settings-phone"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.settings.contactPhone")} *
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  required
                  value={form.contactPhone}
                  onChange={(e) => update("contactPhone", e.target.value)}
                  className={inputClass}
                  dir="ltr"
                />
              </div>
              <div>
                <label
                  htmlFor="settings-whatsapp"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.settings.whatsappNumber")} *
                </label>
                <input
                  id="settings-whatsapp"
                  type="tel"
                  required
                  value={form.whatsappNumber}
                  onChange={(e) => update("whatsappNumber", e.target.value)}
                  className={inputClass}
                  dir="ltr"
                  placeholder="09059806656"
                />
                <p className="mt-1.5 text-xs text-slate-400" dir="ltr">
                  {t("admin.settings.whatsappHint")}: {whatsappPreview}
                </p>
              </div>
              <div>
                <label
                  htmlFor="settings-address"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("admin.settings.address")} *
                </label>
                <input
                  id="settings-address"
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={saving}
              className="btn gap-2 bg-primary px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
            >
              <FontAwesomeIcon icon={faSave} className="h-4 w-4" />
              {saving ? t("admin.settings.saving") : t("admin.settings.save")}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
