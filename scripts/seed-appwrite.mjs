#!/usr/bin/env node
/**
 * Seed Appwrite with existing JSON data from data/.
 *
 * Usage:
 *   node scripts/seed-appwrite.mjs
 *
 * Run AFTER scripts/setup-appwrite.mjs.
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
        if (!process.env[key]) process.env[key] = val;
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
  console.error("❌ Missing env vars. Run setup-appwrite.mjs first or check .env.local");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Key": API_KEY,
  "X-Appwrite-Project": PROJECT_ID,
};

const DATA_DIR = join(process.cwd(), "data");

// ─── Helpers ───────────────────────────────────────────────────────────
function loadJson(filename) {
  try {
    const raw = readFileSync(join(DATA_DIR, filename), "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function createDoc(collectionId, doc) {
  // Strip 'id' from data — Appwrite uses $id internally, not a regular attribute
  const { id: docId, ...data } = doc;
  const res = await fetch(`${ENDPOINT}/databases/${DB_ID}/collections/${collectionId}/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      documentId: docId || "unique()",
      data,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`    ⚠️  Failed to create doc in ${collectionId}:`, err.message || res.status);
    return null;
  }
  return res.json();
}

async function seedCollection(collectionId, filename, transform) {
  const items = loadJson(filename);
  if (!items || items.length === 0) {
    console.log(`⏭️  ${filename} — empty, skipping`);
    return 0;
  }
  console.log(`📥 Seeding ${collectionId} from ${filename} (${items.length} records)`);
  let count = 0;
  for (const item of items) {
    const doc = transform ? transform(item) : item;
    const result = await createDoc(collectionId, doc);
    if (result) count++;
    // small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log(`   ✓ ${count}/${items.length} seeded\n`);
  return count;
}

// ─── Transforms ────────────────────────────────────────────────────────
// Appwrite stores all data as strings/numbers. Arrays and objects need
// to be JSON-stringified.

function transformOrder(order) {
  return {
    ...order,
    items: JSON.stringify(order.items || []),
  };
}

function transformBook(book) {
  // Combine descriptionEn + descriptionAr into a single 'descriptions' JSON
  // field because the Appwrite free tier limits attributes to 16 per collection.
  const { descriptionEn, descriptionAr, ...rest } = book;
  return {
    ...rest,
    descriptionEn: JSON.stringify({
      en: descriptionEn || "",
      ar: descriptionAr || "",
    }),
  };
}

function transformRefund(refund) {
  return {
    ...refund,
    restockedItems: refund.restockedItems ? JSON.stringify(refund.restockedItems) : null,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding Appwrite database\n");
  console.log(`   Endpoint:  ${ENDPOINT}`);
  console.log(`   Project:   ${PROJECT_ID}`);
  console.log(`   Database:  ${DB_ID}\n`);

  let total = 0;

  total += await seedCollection("books", "books.json", transformBook);
  total += await seedCollection("users", "users.json");
  total += await seedCollection("orders", "orders.json", transformOrder);
  total += await seedCollection("expenses", "expenses.json");
  total += await seedCollection("expenseCategories", "expenseCategories.json");
  total += await seedCollection("refunds", "refunds.json", transformRefund);
  total += await seedCollection("inventoryLogs", "inventoryLogs.json");
  total += await seedCollection("contacts", "contacts.json");
  total += await seedCollection("newsletter", "newsletter.json");
  total += await seedCollection("testimonials", "testimonials.json");
  total += await seedCollection("categories", "categories.json");

  // Seed config (slides + settings) as single documents
  console.log("📥 Seeding config (slides + settings)");
  const slides = loadJson("slides.json");
  if (slides && Object.keys(slides).length > 0) {
    await createDoc("config", { id: "slides-config", data: JSON.stringify(slides) });
    console.log("   ✓ slides config seeded");
  }
  const settings = loadJson("settings.json");
  if (settings && Object.keys(settings).length > 0) {
    await createDoc("config", { id: "settings-config", data: JSON.stringify(settings) });
    console.log("   ✓ settings config seeded");
  }
  console.log("");

  console.log(`✅ Seeding complete! ${total} documents created.\n`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
