import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "@/lib/env";
import { settleOrder } from "@/lib/orders";

/**
 * Flutterwave webhook endpoint.
 *
 * Security: Flutterwave sends the webhook secret hash in the `verif-hash`
 * header (set on the dashboard under Settings > Webhooks). We compare it
 * against FLUTTERWAVE_WEBHOOK_HASH and reject mismatches with 401. Fail
 * closed: when the env var is unset we reject with 503 and never process an
 * unverified webhook — production must always configure the hash.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return void res.status(405).json({ error: "Method not allowed" });
  }

  const verifHash = req.headers["verif-hash"];
  // Fail closed: never process an unverified webhook. Configure
  // FLUTTERWAVE_WEBHOOK_HASH (dashboard > Settings > Webhooks) even in dev —
  // for local testing pass it on the command line, e.g.
  //   FLUTTERWAVE_WEBHOOK_HASH=my-hash npm run dev
  if (!env.flutterwaveWebhookHash) {
    console.error(
      "[webhook] FLUTTERWAVE_WEBHOOK_HASH is not configured — rejecting request."
    );
    return void res.status(503).json({ error: "Webhook not configured" });
  }
  if (typeof verifHash !== "string" || verifHash !== env.flutterwaveWebhookHash) {
    return void res.status(401).json({ error: "Invalid webhook signature" });
  }

  const payload = (req.body ?? {}) as {
    event?: string;
    data?: {
      status?: string;
      tx_ref?: string;
      amount?: number;
      payment_type?: string;
      card?: { type?: string };
    };
  };
  const { event, data } = payload;

  // Acknowledge every Flutterwave event with 200; only act on completed
  // successful charges. Unmatched references are logged, not errored —
  // Flutterwave retries non-2xx responses, and retrying a settled order is
  // already a no-op thanks to settleOrder's idempotency guard.
  if (event === "charge.completed" && data?.status === "successful" && data.tx_ref) {
    try {
      // The charged amount is passed along so settlement refuses to mark an
      // order paid when the amount does not match its total. The payment
      // channel (card / bank_transfer / ussd / …) is stored for settlement
      // reports.
      const paymentMethod = data.payment_type || data.card?.type;
      const order = await settleOrder(data.tx_ref, data.amount, paymentMethod);
      if (!order) {
        console.warn(
          `[webhook] charge.completed for unknown reference "${data.tx_ref}"`
        );
      }
    } catch (error) {
      console.error("[webhook] failed to settle order", error);
      return void res.status(500).json({ error: "Failed to process webhook" });
    }
  }

  return void res.status(200).json({ received: true });
}
