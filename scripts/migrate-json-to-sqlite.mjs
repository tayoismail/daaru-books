#!/usr/bin/env node

/**
 * One-time migration: reads every *.json file in data/ and inserts the
 * records into data/daaru.db (SQLite).
 *
 * Usage:
 *   node scripts/migrate-json-to-sqlite.mjs
 *
 * Safe to run multiple times — existing records (matched by id) are
 * skipped so the script is idempotent.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "daaru.db");

// ─── Schema (mirrors lib/sqlite-schema.ts) ────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    titleEn TEXT NOT NULL DEFAULT '',
    titleAr TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    isbn TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    originalPrice REAL,
    cost REAL,
    quantity INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT '',
    descriptionEn TEXT NOT NULL DEFAULT '',
    descriptionAr TEXT NOT NULL DEFAULT '',
    imageUrl TEXT NOT NULL DEFAULT '',
    rating REAL,
    reviews INTEGER,
    sku TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customerName TEXT NOT NULL DEFAULT '',
    customerEmail TEXT NOT NULL DEFAULT '',
    customerPhone TEXT NOT NULL DEFAULT '',
    shippingAddress TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL DEFAULT '[]',
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    paymentStatus TEXT NOT NULL DEFAULT 'unpaid',
    paymentReference TEXT NOT NULL DEFAULT '',
    paymentMethod TEXT,
    deliveryFee REAL,
    trackingNumber TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'customer',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    date INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenseCategories (
    id TEXT PRIMARY KEY,
    nameEn TEXT NOT NULL DEFAULT '',
    nameAr TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    date INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    restockedItems TEXT,
    costRefunded REAL
  );

  CREATE TABLE IF NOT EXISTS inventoryLogs (
    id TEXT PRIMARY KEY,
    bookId TEXT NOT NULL DEFAULT '',
    change INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    subject TEXT,
    message TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS newsletter (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    handle TEXT NOT NULL DEFAULT '',
    reviewEn TEXT NOT NULL DEFAULT '',
    reviewAr TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 5,
    avatarUrl TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL DEFAULT '',
    en TEXT NOT NULL DEFAULT '',
    ar TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_orders_paymentRef ON orders(paymentReference);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_paymentStatus ON orders(paymentStatus);
  CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  CREATE INDEX IF NOT EXISTS idx_refunds_orderId ON refunds(orderId);
  CREATE INDEX IF NOT EXISTS idx_refunds_date ON refunds(date);
  CREATE INDEX IF NOT EXISTS idx_inventoryLogs_bookId ON inventoryLogs(bookId);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

// ─── JSON columns that need stringification ────────────────────────────

const JSON_COLUMNS = {
  orders: ["items"],
  refunds: ["restockedItems"],
};

// ─── Tables to migrate (JSON filename → table name) ────────────────────

const TABLES = [
  { file: "books.json", table: "books" },
  { file: "orders.json", table: "orders" },
  { file: "users.json", table: "users" },
  { file: "expenses.json", table: "expenses" },
  { file: "expenseCategories.json", table: "expenseCategories" },
  { file: "refunds.json", table: "refunds" },
  { file: "inventoryLogs.json", table: "inventoryLogs" },
  { file: "contacts.json", table: "contacts" },
  { file: "newsletter.json", table: "newsletter" },
  { file: "testimonials.json", table: "testimonials" },
  { file: "categories.json", table: "categories" },
];

// ─── Migration ─────────────────────────────────────────────────────────

function loadJsonFile(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`  ⚠ Failed to parse ${filePath}: ${error.message}`);
    return [];
  }
}

function serializeValue(value) {
  if (
    Array.isArray(value) ||
    (typeof value === "object" && value !== null && !Buffer.isBuffer(value))
  ) {
    return JSON.stringify(value);
  }
  return value;
}

function main() {
  console.log("🔄 Daaru Books: JSON → SQLite Migration\n");
  console.log(`  Data dir:  ${DATA_DIR}`);
  console.log(`  Database:  ${DB_PATH}\n`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(SCHEMA);
  console.log("✅ Tables created/verified\n");

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const { file, table } of TABLES) {
    const filePath = join(DATA_DIR, file);
    const records = loadJsonFile(filePath);

    if (records.length === 0) {
      console.log(`  ⏭  ${table}: no data (skipped)`);
      continue;
    }

    // Get existing ids to avoid duplicates
    const existingIds = new Set();
    try {
      const rows = db.prepare(`SELECT id FROM "${table}"`).all();
      for (const row of rows) {
        existingIds.add(row.id);
      }
    } catch {
      // Table might not exist yet, that's fine
    }

    const jsonCols = JSON_COLUMNS[table] || [];
    let inserted = 0;
    let skipped = 0;

    const insert = db.transaction((records) => {
      for (const record of records) {
        if (existingIds.has(record.id)) {
          skipped++;
          continue;
        }

        // Serialize JSON columns
        const serialized = { ...record };
        for (const col of jsonCols) {
          if (serialized[col] !== undefined) {
            serialized[col] = serializeValue(serialized[col]);
          }
        }

        const keys = Object.keys(serialized);
        const columns = keys.map((k) => `"${k}"`).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const params = keys.map((k) => serializeValue(serialized[k]));

        db.prepare(`INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`).run(...params);
        inserted++;
      }
    });

    insert(records);

    totalInserted += inserted;
    totalSkipped += skipped;
    console.log(`  ✅ ${table}: ${inserted} inserted, ${skipped} skipped (already exists)`);
  }

  console.log(`\n🎉 Migration complete! ${totalInserted} records inserted, ${totalSkipped} skipped.\n`);
  console.log(`   Database: ${DB_PATH}`);

  db.close();
}

main();
