import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import Reveal from "@/components/Reveal";
import Seo from "@/components/Seo";

interface ContactFormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const EMPTY_FORM: ContactFormState = { name: "", email: "", subject: "", message: "" };

export default function Contact() {
  const { t } = useTranslation();
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("contact.error"));
        setStatus("error");
        return;
      }
      setForm(EMPTY_FORM);
      setStatus("sent");
    } catch {
      setError(t("contact.error"));
      setStatus("error");
    }
  };

  const update = (field: keyof ContactFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <>
      <Seo title={`${t("appName")} — ${t("contact.title")}`} description={t("contact.subtitle")} />

      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="container-daaru py-16 text-center md:py-24">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {t("contact.title")}
          </h1>
          <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-gold" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            {t("contact.subtitle")}
          </p>
        </div>
      </section>

      <section className="container-daaru py-16">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Info */}
          <Reveal className="lg:col-span-2">
            <div className="space-y-4">
              <div className="card flex items-center gap-4 bg-white p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {t("contact.phoneLabel")}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600" dir="ltr">
                    {t("contact.phone")}
                  </p>
                </div>
              </div>

              <div className="card flex items-center gap-4 bg-white p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {t("contact.emailLabel")}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {t("contact.email")}
                  </p>
                </div>
              </div>

              <div className="card flex items-center gap-4 bg-white p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {t("contact.addressLabel")}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {t("contact.address")}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Form */}
          <Reveal className="lg:col-span-3">
            <div className="card bg-white p-6 md:p-8">
              {status === "sent" ? (
                <div className="flex flex-col items-center py-12 text-center" role="status">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </span>
                  <p className="mt-5 max-w-sm text-slate-600">
                    {t("contact.success")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="btn mt-6 border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary"
                  >
                    {t("contact.sendAnother")}
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  {status === "error" && (
                    <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
                        {t("contact.name")} *
                      </label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                        {t("contact.email")} *
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-slate-700">
                      {t("contact.subject")}
                    </label>
                    <input
                      id="subject"
                      type="text"
                      value={form.subject}
                      onChange={(e) => update("subject", e.target.value)}
                      placeholder={t("contact.subjectPlaceholder")}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-700">
                      {t("contact.message")} *
                    </label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={(e) => update("message", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="btn bg-primary px-7 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-800 disabled:opacity-60"
                  >
                    {status === "sending" ? t("contact.sending") : t("contact.send")}
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
