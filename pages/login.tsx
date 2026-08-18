import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/contexts";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const justRegistered = router.query.registered === "1";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      await router.push("/");
    } catch {
      setError(t("auth.loginError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>
          {t("appName")} — {t("auth.signIn")}
        </title>
      </Head>

      <section className="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4 py-16">
        <div className="w-full max-w-md">
          <div className="card bg-white p-8 md:p-10">
            <div className="flex flex-col items-center text-center">
              <Logo className="h-12 w-12" />
              <h1 className="mt-4 text-2xl font-bold text-slate-900">
                {t("auth.loginTitle")}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {t("auth.loginSubtitle")}
              </p>
            </div>

            {justRegistered && (
              <p className="mt-5 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
                {t("auth.registered")}
              </p>
            )}
            {error && (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <form onSubmit={submit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("auth.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("auth.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="btn w-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-primary-800 disabled:opacity-60"
              >
                {submitting ? "…" : t("auth.signIn")}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              {t("auth.noAccount")}{" "}
              <Link
                href="/signup"
                className="font-semibold text-primary hover:underline"
              >
                {t("auth.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
