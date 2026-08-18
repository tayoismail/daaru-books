// SQLite schema and database initialization.
// This module creates the database file and all tables if they don't exist.
// It is imported once by lib/db.ts at startup.

import Database from "better-sqlite3";
import path from "path";
import { promises as fs } from "fs";

const DB_DIR =
  process.env.DATA_DIR && process.env.DATA_DIR.trim() !== ""
    ? process.env.DATA_DIR
    : path.join(process.cwd(), "data");

const DB_PATH = path.join(DB_DIR, "daaru.db");

let _db: Database.Database | null = null;

/**
 * Get (or create) the SQLite database instance.
 * WAL mode is enabled for better concurrent read performance.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);

  // Performance pragmas
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");

  createTables(_db);
  seedCategoriesFromJson(_db);
  return _db;
}

/** Close the database connection (for graceful shutdown). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * One-time seed: if the SQLite categories table is empty but a
 * data/categories.json file exists (pre-migration data), import its rows
 * so the admin panel and homepage have categories from day one.
 */
function seedCategoriesFromJson(db: Database.Database): void {
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM "categories"`).get() as { n: number }).n;
  if (count > 0) return; // already seeded

  const DATA_DIR =
    process.env.DATA_DIR && process.env.DATA_DIR.trim() !== ""
      ? process.env.DATA_DIR
      : path.join(process.cwd(), "data");
  const filePath = path.join(DATA_DIR, "categories.json");

  let raw: unknown;
  try {
    // Synchronous read is fine here — this runs once at startup.
    const fsSync = require("fs") as typeof import("fs");
    raw = JSON.parse(fsSync.readFileSync(filePath, "utf8"));
  } catch {
    return; // file missing or corrupt — skip seeding
  }

  if (!Array.isArray(raw)) return;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO "categories" (id, slug, en, ar, createdAt) VALUES (?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const item of raw as Record<string, unknown>[]) {
      const slug = String(item.slug ?? "");
      const en = String(item.en ?? "");
      const ar = String(item.ar ?? "");
      if (!slug || !en) continue;
      insert.run(slug, slug, en, ar, Date.now());
    }
  });
  tx();
  console.log(`[seed] Imported categories from ${filePath} into SQLite`);
}

function createTables(db: Database.Database): void {
  db.exec(`
    -- Books catalog
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

    -- Orders
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

    -- Users (admin / customer)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'customer',
      createdAt INTEGER NOT NULL
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      date INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    -- Expense categories
    CREATE TABLE IF NOT EXISTS expenseCategories (
      id TEXT PRIMARY KEY,
      nameEn TEXT NOT NULL DEFAULT '',
      nameAr TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL
    );

    -- Refunds
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

    -- Inventory logs
    CREATE TABLE IF NOT EXISTS inventoryLogs (
      id TEXT PRIMARY KEY,
      bookId TEXT NOT NULL DEFAULT '',
      change INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL
    );

    -- Contacts
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      subject TEXT,
      message TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL
    );

    -- Newsletter subscribers
    CREATE TABLE IF NOT EXISTS newsletter (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL
    );

    -- Testimonials
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

    -- Categories (book categories, separate from expense categories)
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL DEFAULT '',
      en TEXT NOT NULL DEFAULT '',
      ar TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL DEFAULT 0
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_orders_paymentRef ON orders(paymentReference);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_paymentStatus ON orders(paymentStatus);
    CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_refunds_orderId ON refunds(orderId);
    CREATE INDEX IF NOT EXISTS idx_refunds_date ON refunds(date);
    CREATE INDEX IF NOT EXISTS idx_inventoryLogs_bookId ON inventoryLogs(bookId);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}
