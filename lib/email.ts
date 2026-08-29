import { env } from "@/lib/env";
import type { Order } from "@/types";

// NOTE: Server-only module (imports lib/env). Never import from client code.
// Uses Resend's plain REST API (https://resend.com/docs) via fetch — no SDK
// dependency needed.

const RESEND_API = "https://api.resend.com/emails";

/** Escape HTML special characters in user-provided text. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Round a kobo amount to whole naira (amounts are stored as whole naira). */
function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send a transactional email via Resend. Returns false (never throws) when
 * the API key is missing or the API call fails, so callers can log and
 * continue — a notification must never break an order update.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailInput): Promise<boolean> {
  const apiKey = env.resendApiKey;
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY is not set — skipping email to " +
        `${to} ("${subject}"). Add it to .env to enable notifications.`
    );
    return false;
  }
  const from = env.resendFromEmail || "Daaru Kutubul Athaariyyah <onboarding@resend.dev>";
  try {
    const response = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[email] Resend returned ${response.status}: ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] send failed:", error);
    return false;
  }
}

/**
 * Notify a customer that their order has been shipped, including the courier
 * tracking number. HTML body is self-contained (inline styles) so it renders
 * correctly across email clients.
 */
export async function sendOrderShippedEmail(order: Order): Promise<boolean> {
  const items = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;">${escapeHtml(item.title)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;text-align:end;">${formatNaira(item.price * item.quantity)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#1a5c3a;padding:24px 28px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">Your order has been shipped 🚚</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
          Assalamu alaikum ${escapeHtml(order.customerName)},<br/>
          Great news — your order <strong style="color:#0f172a;">${escapeHtml(order.paymentReference)}</strong> is on its way!
        </p>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
          <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#166534;">Tracking number</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:#14532d;font-family:Consolas,monospace;">${escapeHtml(order.trackingNumber ?? "")}</p>
        </div>

        <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Items</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:start;color:#64748b;font-size:12px;padding-bottom:6px;">Title</th>
              <th style="text-align:center;color:#64748b;font-size:12px;padding-bottom:6px;">Qty</th>
              <th style="text-align:end;color:#64748b;font-size:12px;padding-bottom:6px;">Total</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>

        <p style="margin:0 0 20px;text-align:end;font-size:16px;font-weight:700;color:#0f172a;">
          Total: ${formatNaira(order.total)}
        </p>

        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">
          <strong>Shipping to:</strong><br/>
          ${escapeHtml(order.shippingAddress)}
        </p>

        <p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.6;">
          You can track your delivery using the tracking number above. If you have any
          questions, just reply to this email or reach us on WhatsApp.
        </p>
        <p style="margin:0;color:#64748b;font-size:13px;">— Daaru Kutubul Athaariyyah</p>
      </div>
    </div>`;

  return sendEmail({
    to: order.customerEmail,
    subject: `Your order ${order.paymentReference} has shipped`,
    html,
  });
}

/**
 * Notify a customer that their order is now being processed (e.g. confirmed
 * and being prepared for shipment).
 */
export async function sendOrderProcessingEmail(order: Order): Promise<boolean> {
  const items = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;">${escapeHtml(item.title)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;text-align:end;">${formatNaira(item.price * item.quantity)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#1a5c3a;padding:24px 28px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">Your order is being processed 📦</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
          Assalamu alaikum ${escapeHtml(order.customerName)},<br/>
          Your order <strong style="color:#0f172a;">${escapeHtml(order.paymentReference)}</strong> has been confirmed and is now being prepared.
        </p>

        <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Items</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:start;color:#64748b;font-size:12px;padding-bottom:6px;">Title</th>
              <th style="text-align:center;color:#64748b;font-size:12px;padding-bottom:6px;">Qty</th>
              <th style="text-align:end;color:#64748b;font-size:12px;padding-bottom:6px;">Total</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>

        <p style="margin:0 0 20px;text-align:end;font-size:16px;font-weight:700;color:#0f172a;">
          Total: ${formatNaira(order.total)}
        </p>

        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">
          We'll notify you again once your order has been shipped. If you have any
          questions, just reply to this email or reach us on WhatsApp.
        </p>
        <p style="margin:0;color:#64748b;font-size:13px;">— Daaru Kutubul Athaariyyah</p>
      </div>
    </div>`;

  return sendEmail({
    to: order.customerEmail,
    subject: `Your order ${order.paymentReference} is being processed`,
    html,
  });
}

/**
 * Notify a customer that their order has been delivered.
 */
export async function sendOrderDeliveredEmail(order: Order): Promise<boolean> {
  const items = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;">${escapeHtml(item.title)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#334155;text-align:end;">${formatNaira(item.price * item.quantity)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#1a5c3a;padding:24px 28px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">Your order has been delivered ✅</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
          Assalamu alaikum ${escapeHtml(order.customerName)},<br/>
          Great news — your order <strong style="color:#0f172a;">${escapeHtml(order.paymentReference)}</strong> has been delivered!
        </p>

        <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Items</p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:start;color:#64748b;font-size:12px;padding-bottom:6px;">Title</th>
              <th style="text-align:center;color:#64748b;font-size:12px;padding-bottom:6px;">Qty</th>
              <th style="text-align:end;color:#64748b;font-size:12px;padding-bottom:6px;">Total</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>

        <p style="margin:0 0 20px;text-align:end;font-size:16px;font-weight:700;color:#0f172a;">
          Total: ${formatNaira(order.total)}
        </p>

        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">
          We hope you enjoy your books! If there's any issue with your order,
          please don't hesitate to reach out — we're happy to help.
        </p>
        <p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.6;">
          We'd love to hear your feedback — a review on our site would mean a lot to us.
        </p>
        <p style="margin:0;color:#64748b;font-size:13px;">— Daaru Kutubul Athaariyyah</p>
      </div>
    </div>`;

  return sendEmail({
    to: order.customerEmail,
    subject: `Your order ${order.paymentReference} has been delivered`,
    html,
  });
}

/**
 * Notify a customer that their order has been cancelled.
 */
export async function sendOrderCancelledEmail(order: Order): Promise<boolean> {
  const wasPaid = order.paymentStatus === "paid";

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#9f1239;padding:24px 28px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">Your order has been cancelled</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
          Assalamu alaikum ${escapeHtml(order.customerName)},<br/>
          Your order <strong style="color:#0f172a;">${escapeHtml(order.paymentReference)}</strong> has been cancelled.
        </p>

        ${wasPaid ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
          <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.6;">
            A refund of <strong>${formatNaira(order.total)}</strong> will be processed to your original payment method.
          </p>
        </div>
        ` : `
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
          <p style="margin:0;color:#854d0e;font-size:14px;line-height:1.6;">
            No payment was collected for this order, so no refund is required.
          </p>
        </div>
        `}

        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">
          If you have any questions about this cancellation, please reply to this email or reach us on WhatsApp.
        </p>
        <p style="margin:0;color:#64748b;font-size:13px;">— Daaru Kutubul Athaariyyah</p>
      </div>
    </div>`;

  return sendEmail({
    to: order.customerEmail,
    subject: `Your order ${order.paymentReference} has been cancelled`,
    html,
  });
}
