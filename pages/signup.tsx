import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import Logo from "@/components/Logo";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        // Map failures to translated messages instead of leaking English API
        // errors into the bilingual UI.
        if (res.status === 409) {
          setError(t("auth.emailExists"));
        } else if (res.status === 400) {
          setError(t("auth.passwordMin"));
        } else {
          setError(t("auth.signupError"));
        }
        return;
      }
      await router.push("/login?registered=1");
    } catch {
      setError(t("auth.signupError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>
          {t("appName")} — {t("auth.signUp")}
        </title>
      </Head>

      <section className="flex min-h-[70vh] items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4 py-16">
        <div className="w-full max-w-md">
          <div className="card bg-white p-8 md:p-10">
            <div className="flex flex-col items-center text-center">
              <Logo className="h-12 w-12" />
              <h1 className="mt-4 text-2xl font-bold text-slate-900">
                {t("auth.signupTitle")}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {t("auth.signupSubtitle")}
              </p>
            </div>

            {error && (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <form onSubmit={submit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {t("auth.name")}
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
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
                  minLength={6}
                  autoComplete="new-password"
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
                {submitting ? "…" : t("auth.createAccount")}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              {t("auth.haveAccount")}{" "}
              <Link
                href="/login"
                className="font-semibold text-primary hover:underline"
              >
                {t("auth.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
