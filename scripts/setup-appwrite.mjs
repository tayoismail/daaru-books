#!/usr/bin/env node
/**
 * Setup Appwrite collections and attributes for Daaru Books.
 *
 * Usage:
 *   node scripts/setup-appwrite.mjs
 *
 * Requires env vars (from .env.local or passed via shell):
 *   NEXT_PUBLIC_APPWRITE_ENDPOINT
 *   NEXT_PUBLIC_APPWRITE_PROJECT_ID
 *   APPWRITE_DATABASE_ID
 *   APPWRITE_API_KEY
 */

import { readFileSync } from "fs";
import { join } from "path";

// ─── Load env ──────────────────────────────────────────────────────────
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(join(process.cwd(), file), "utf8");
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        process.env[key] = val;
      }
      return;
    } catch {
      // try next file
    }
  }
}
loadEnv();

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const DB_ID = process.env.APPWRITE_DATABASE_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !DB_ID || !API_KEY) {
  console.error(
    "❌ Missing env vars. Ensure NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID, and APPWRITE_API_KEY are set."
  );
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Key": API_KEY,
  "X-Appwrite-Project": PROJECT_ID,
};

// ─── Helpers ───────────────────────────────────────────────────────────
async function api(method, path, body) {
  const url = `${ENDPOINT}${path}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 409) {
    // already exists — skip silently
    return null;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`  ⚠️  ${method} ${path} → ${res.status}`, json?.message || json);
    return null;
  }
  return json;
}

async function createCollection(id, name) {
  console.log(`📁 Creating collection: ${name} (${id})`);
  const result = await api("POST", `/databases/${DB_ID}/collections`, {
    collectionId: id,
    name,
    permissions: [
      'read("any")',
      'create("users")',
      'update("users")',
      'delete("users")',
    ],
    documentSecurity: false,
  });
  return result;
}

async function createAttr(collectionId, attr) {
  const { type, key, required, ...params } = attr;
  // All attributes are optional (not required) — Appwrite doesn't allow
  // defaults on required attributes. Our code provides defaults on create.
  const body = { key, required: false, ...params };
  const result = await api(
    "POST",
    `/databases/${DB_ID}/collections/${collectionId}/attributes/${type}`,
    body
  );
  if (result) {
    console.log(`    ✓ ${key} (${type})`);
  }
  return result;
}

// ─── Collection Schemas ────────────────────────────────────────────────
// Note: `required` is always false because Appwrite disallows defaults on
// required attributes. Our app code enforces required fields at creation time.

const COLLECTIONS = [
  {
    id: "books",
    name: "Books",
    attrs: [
      { type: "string", key: "titleEn", size: 500 },
      { type: "string", key: "titleAr", size: 500 },
      { type: "string", key: "author", size: 500 },
      { type: "string", key: "isbn", size: 100 },
      { type: "float", key: "price" },
      { type: "float", key: "originalPrice" },
      { type: "float", key: "cost" },
      { type: "integer", key: "quantity" },
      { type: "string", key: "category", size: 200 },
      { type: "string", key: "descriptionEn", size: 10000 },
      { type: "string", key: "descriptionAr", size: 10000 },
      { type: "string", key: "imageUrl", size: 1000 },
      { type: "float", key: "rating" },
      { type: "integer", key: "reviews" },
      { type: "string", key: "sku", size: 100 },
      { type: "integer", key: "createdAt" },
      { type: "integer", key: "updatedAt" },
    ],
  },
  {
    id: "orders",
    name: "Orders",
    attrs: [
      { type: "string", key: "customerName", size: 500 },
      { type: "string", key: "customerEmail", size: 500 },
      { type: "string", key: "customerPhone", size: 100 },
      { type: "string", key: "shippingAddress", size: 2000 },
      { type: "string", key: "items", size: 50000 },
      { type: "float", key: "total" },
      { type: "string", key: "status", size: 50 },
      { type: "string", key: "paymentStatus", size: 50 },
      { type: "string", key: "paymentReference", size: 200 },
      { type: "string", key: "paymentMethod", size: 50 },
      { type: "float", key: "deliveryFee" },
      { type: "string", key: "trackingNumber", size: 200 },
      { type: "integer", key: "createdAt" },
      { type: "integer", key: "updatedAt" },
    ],
  },
  {
    id: "users",
    name: "Users",
    attrs: [
      { type: "string", key: "name", size: 500 },
      { type: "string", key: "email", size: 500 },
      { type: "string", key: "password", size: 500 },
      { type: "string", key: "role", size: 50 },
      { type: "integer", key: "createdAt" },
    ],
  },
  {
    id: "expenses",
    name: "Expenses",
    attrs: [
      { type: "string", key: "category", size: 200 },
      { type: "string", key: "description", size: 2000 },
      { type: "float", key: "amount" },
      { type: "integer", key: "date" },
      { type: "integer", key: "createdAt" },
    ],
  },
  {
    id: "expenseCategories",
    name: "Expense Categories",
    attrs: [
      { type: "string", key: "nameEn", size: 500 },
      { type: "string", key: "nameAr", size: 500 },
      { type: "integer", key: "createdAt" },
    ],
  },
  {
    id: "refunds",
    name: "Refunds",
    attrs: [
      { type: "string", key: "orderId", size: 200 },
      { type: "float", key: "amount" },
      { type: "string", key: "reason", size: 2000 },
      { type: "integer", key: "date" },
      { type: "integer", key: "createdAt" },
      { type: "string", key: "restockedItems", size: 5000 },
      { type: "float", key: "costRefunded" },
    ],
  },
  {
    id: "inventoryLogs",
    name: "Inventory Logs",
    attrs: [
      { type: "string", key: "bookId", size: 200 },
      { type: "integer", key: "change" },
      { type: "string", key: "reason", size: 2000 },
      { type: "integer", key: "createdAt" },
    ],
  },
  {
    id: "contacts",
    name: "Contacts",
    attrs: [
      { type: "string", key: "name", size: 500 },
      { type: "string", key: "email", size: 500 },
      { type: "string", key: "subject", size: 1000 },
      { type: "string", key: "message", size: 10000 },
      { type: "integer", key: "createdAt" },
    ],
  },
  {
    id: "newsletter",
    name: "Newsletter",
    attrs: [
      { type: "string", key: "email", size: 500 },
      { type: "integer", key: "createdAt" },
    ],
  },
  {
    id: "testimonials",
    name: "Testimonials",
    attrs: [
      { type: "string", key: "name", size: 500 },
      { type: "string", key: "handle", size: 500 },
      { type: "string", key: "reviewEn", size: 5000 },
      { type: "string", key: "reviewAr", size: 5000 },
      { type: "integer", key: "rating" },
      { type: "string", key: "avatarUrl", size: 1000 },
      { type: "integer", key: "createdAt" },
    ],
  },
  {
    id: "categories",
    name: "Categories",
    attrs: [
      { type: "string", key: "slug", size: 200 },
      { type: "string", key: "en", size: 500 },
      { type: "string", key: "ar", size: 500 },
      { type: "integer", key: "createdAt" },
    ],
  },
  {
    id: "config",
    name: "Config",
    attrs: [
      { type: "string", key: "data", size: 100000 },
    ],
  },
];

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Setting up Appwrite collections for Daaru Books\n");
  console.log(`   Endpoint:  ${ENDPOINT}`);
  console.log(`   Project:   ${PROJECT_ID}`);
  console.log(`   Database:  ${DB_ID}\n`);

  for (const col of COLLECTIONS) {
    await createCollection(col.id, col.name);
    // small delay to let Appwrite propagate
    await new Promise((r) => setTimeout(r, 300));

    for (const attr of col.attrs) {
      await createAttr(col.id, attr);
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log("");
  }

  console.log("✅ All collections created!\n");
  console.log("Now run: node scripts/seed-appwrite.mjs");
}

main().catch((err) => {
  console.error("❌ Setup failed:", err);
  process.exit(1);
});
