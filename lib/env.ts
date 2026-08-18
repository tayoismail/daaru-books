export const env = {
  // Auth (file-based backend)
  jwtSecret: process.env.JWT_SECRET ?? "",

  // Flutterwave payments (use test keys in development)
  flutterwavePublicKey: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "",
  flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? "",
  // Webhook secret hash (Settings > Webhooks on the Flutterwave dashboard).
  // Required in production: the webhook route fails closed (503) while unset,
  // so unverified webhooks can never mark an order as paid.
  flutterwaveWebhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH ?? "",

  // Email notifications (Resend API — free tier: 100 emails/day). Optional:
  // when unset, notifications are skipped with a warning so local dev works.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  // Verified sender address. Defaults to Resend's onboarding sandbox address
  // when unset (only delivers to your own inbox until a domain is verified).
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",

  // Appwrite — not used yet; needed after migrating from the file-based backend
  appwriteEndpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "",
  appwriteProjectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "",
  appwriteApiKey: process.env.APPWRITE_API_KEY ?? "",
};

// Fail fast on missing server-side secrets in production instead of surfacing
// opaque runtime errors later. Dev keeps working without a populated .env.
if (process.env.NODE_ENV === "production") {
  const missing = (
    [
      ["jwtSecret", env.jwtSecret],
      ["flutterwaveSecretKey", env.flutterwaveSecretKey],
    ] as const
  ).filter(([, value]) => value === "");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing
        .map(([name]) => name)
        .join(", ")}. See .env.example.`
    );
  }
}

export const isServer = typeof window === "undefined";
