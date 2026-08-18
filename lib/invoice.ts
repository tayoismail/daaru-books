// NOTE: Pure function — safe for client use (no Node builtins). Builds the
// self-contained HTML for the admin "Print Invoice" view.

import type { Order } from "@/types";

export interface InvoiceLabels {
  appName: string;
  storeTagline: string;
  invoice: string;
  orderNumber: string;
  date: string;
  billedTo: string;
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  items: string;
  title: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  thankYou: string;
  storeAddress: string;
  storePhone: string;
}

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function money(amount: number): string {
  return `\u20A6${amount.toLocaleString("en-GB")}`;
}

/** Build a complete, standalone invoice document ready for `window.print()`. */
export function buildInvoiceHtml(order: Order, labels: InvoiceLabels, locale: string): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const font =
    locale === "ar"
      ? "'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif"
      : "'Inter', 'Segoe UI', Arial, sans-serif";
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td class="title">${esc(item.title)}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${money(item.price)}</td>
          <td class="num">${money(item.price * item.quantity)}</td>
        </tr>`
    )
    .join("");

  // The delivery fee is collected from the customer but stored separately
  // from order.total, so the printed total must add it back on.
  const invoiceTotal =
    order.total + (typeof order.deliveryFee === "number" ? order.deliveryFee : 0);

  return `<!doctype html>
<html lang="${locale === "ar" ? "ar" : "en"}">
<head>
  <meta charset="utf-8" />
  <title>${esc(labels.appName)} — ${esc(labels.invoice)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${font};
      color: #1e293b;
      background: #f1f5f9;
      direction: ${dir};
    }
    .sheet {
      max-width: 760px;
      margin: 24px auto;
      background: #fff;
      border-radius: 12px;
      padding: 40px 44px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
    }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo {
      width: 46px; height: 46px; border-radius: 10px;
      background: linear-gradient(135deg, #1a5c3a, #0d3b26);
      color: #c9a84c; display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 800; flex-shrink: 0;
    }
    .brand h1 { font-size: 20px; font-weight: 800; color: #1a5c3a; }
    .brand p { font-size: 12px; color: #64748b; margin-top: 2px; }
    .meta { text-align: ${dir === "rtl" ? "start" : "end"}; }
    .meta h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
    .meta .ref { font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .meta .date { font-size: 12px; color: #64748b; margin-top: 2px; }
    .divider { height: 1px; background: #e2e8f0; margin: 22px 0; }
    section { margin-bottom: 18px; }
    section h3 {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
      color: #94a3b8; margin-bottom: 8px;
    }
    .customer { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; }
    .customer b { display: block; color: #0f172a; }
    .customer span { color: #64748b; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th {
      text-align: ${dir === "rtl" ? "right" : "left"};
      background: #f8fafc; color: #64748b; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.5px;
      padding: 8px 10px; border-bottom: 1px solid #e2e8f0;
    }
    thead th.num, td.num { text-align: ${dir === "rtl" ? "left" : "right"}; }
    tbody td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    tbody td.title { font-weight: 600; color: #0f172a; }
    .delivery-fee {
      display: flex; justify-content: ${dir === "rtl" ? "flex-start" : "flex-end"};
      gap: 24px; align-items: center; font-size: 13px; color: #334155;
      padding: 8px 18px;
    }
    .total-row { display: flex; justify-content: ${dir === "rtl" ? "flex-start" : "flex-end"}; }
    .total-box {
      background: #1a5c3a; color: #fff; border-radius: 10px;
      padding: 10px 18px; display: flex; gap: 24px; align-items: center;
    }
    .total-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b8e0c8; }
    .total-box .amount { font-size: 18px; font-weight: 800; }
    .thanks { text-align: center; margin-top: 26px; padding-top: 18px; border-top: 1px solid #e2e8f0; }
    .thanks p { font-size: 14px; font-weight: 700; color: #1a5c3a; }
    .thanks small { color: #94a3b8; font-size: 11px; }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none; border-radius: 0; margin: 0; max-width: 100%; padding: 24px; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header>
      <div class="brand">
        <div class="logo">📖</div>
        <div>
          <h1>${esc(labels.appName)}</h1>
          <p>${esc(labels.storeTagline)}</p>
          <p>${esc(labels.storeAddress)}</p>
          <p>${esc(labels.storePhone)}</p>
        </div>
      </div>
      <div class="meta">
        <h2>${esc(labels.invoice)}</h2>
        <div class="ref" dir="ltr">${esc(order.paymentReference || order.id)}</div>
        <div class="date">${esc(formatDate(order.createdAt, locale))}</div>
      </div>
    </header>

    <div class="divider"></div>

    <section>
      <h3>${esc(labels.billedTo)}</h3>
      <div class="customer">
        <div>
          <b>${esc(order.customerName)}</b>
          <span>${esc(labels.email)}: ${esc(order.customerEmail)}</span>
        </div>
        <div>
          <span>${esc(labels.phone)}: <b dir="ltr">${esc(order.customerPhone)}</b></span>
          <span>${esc(labels.shippingAddress)}: ${esc(order.shippingAddress)}</span>
        </div>
      </div>
    </section>

    <section>
      <h3>${esc(labels.items)}</h3>
      <table>
        <thead>
          <tr>
            <th>${esc(labels.title)}</th>
            <th class="num">${esc(labels.quantity)}</th>
            <th class="num">${esc(labels.unitPrice)}</th>
            <th class="num">${esc(labels.subtotal)}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>

    ${
      typeof order.deliveryFee === "number" && order.deliveryFee > 0
        ? `<div class="delivery-fee">
            <span>${esc(labels.deliveryFee)}</span>
            <span>${money(order.deliveryFee)}</span>
          </div>`
        : ""
    }

    <div class="total-row">
      <div class="total-box">
        <span class="label">${esc(labels.total)}</span>
        <span class="amount">${money(invoiceTotal)}</span>
      </div>
    </div>

    <div class="thanks">
      <p>${esc(labels.thankYou)}</p>
      <small>${esc(labels.appName)} — ${esc(labels.invoice)} ${esc(order.paymentReference || order.id)}</small>
    </div>
  </div>
</body>
</html>`;
}
