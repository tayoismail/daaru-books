import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

interface NewsletterFormProps {
  /** "sm" = compact footer row; "lg" = centered homepage band. */
  size?: "sm" | "lg";
  /** "dark" = on dark backgrounds; "light" = on light backgrounds. */
  variant?: "dark" | "light";
}

/** Newsletter subscribe form, usable on both dark (footer) and light sections. */
export default function NewsletterForm({
  size = "sm",
  variant = "dark",
}: NewsletterFormProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");

  const subscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("newsletter.error"));
        return;
      }
      setSubscribed(true);
    } catch {
      setError(t("newsletter.error"));
    }
  };

  if (error) {
    return (
      <p
        className={
          variant === "dark"
            ? "mt-3 text-sm text-rose-300"
            : "mt-3 text-sm text-rose-600"
        }
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (subscribed) {
    return (
      <p
        className={
          size === "lg"
            ? variant === "dark"
              ? "mx-auto mt-8 max-w-md rounded-full bg-gold/15 px-6 py-3 text-center text-sm font-medium text-gold"
              : "mx-auto mt-8 max-w-md rounded-full bg-primary/10 px-6 py-3 text-center text-sm font-medium text-primary-800"
            : variant === "dark"
              ? "mt-3 text-sm text-gold"
              : "mt-3 text-sm text-primary-800"
        }
      >
        {t("newsletter.success")}
      </p>
    );
  }

  const darkInput =
    size === "lg"
      ? "w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm text-white placeholder:text-primary-100 focus:border-gold focus:outline-none"
      : "w-full min-w-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-gold focus:outline-none";

  const lightInput =
    size === "lg"
      ? "w-full rounded-full border border-slate-300 bg-white px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      : "w-full min-w-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <form
      onSubmit={subscribe}
      className={
        size === "lg"
          ? "mt-8 flex flex-col gap-3 sm:mx-auto sm:max-w-xl sm:flex-row"
          : "mt-3 flex gap-2"
      }
    >
      <input
        type="email"
        name="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("newsletter.placeholder")}
        aria-label={t("newsletter.placeholder")}
        className={variant === "dark" ? darkInput : lightInput}
      />
      <button
        type="submit"
        className={`btn shrink-0 bg-gold font-semibold text-slate-900 hover:bg-gold-600 ${
          size === "lg" ? "px-7 py-3 text-sm" : "px-4 py-2 text-sm"
        }`}
      >
        {t("newsletter.button")}
      </button>
    </form>
  );
}
