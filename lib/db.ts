// NOTE: Server-only module (imports Node builtins + better-sqlite3).
// Keep this out of client code — it fails the build if a client bundle
// imports it (Turbopack enforces this).
//
// Storage backend: SQLite via better-sqlite3.
// The public API is identical to the previous JSON-file version so every
// API route, admin page, and dashboard computation works unchanged.

import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  Book,
  Contact,
  Expense,
  ExpenseCategoryDef,
  InventoryLog,
  NewsletterSubscriber,
  Order,
  Refund,
  Testimonial,
  User,
} from "@/types";
import type { CategoryInfo } from "@/lib/categories";
import { getDb } from "@/lib/sqlite-schema";

// ─── Data directory (still used for non-collection JSON files) ──────────

const DATA_DIR =
  process.env.DATA_DIR && process.env.DATA_DIR.trim() !== ""
    ? process.env.DATA_DIR
    : path.join(process.cwd(), "data");

// ─── Exports needed by slides.ts and settingsStore.ts ──────────────────

export type CollectionName =
  | "books"
  | "orders"
  | "users"
  | "expenses"
  | "expenseCategories"
  | "refunds"
  | "inventoryLogs"
  | "contacts"
  | "newsletter"
  | "testimonials"
  | "categories";

/** Generate a unique id (uuid v4). */
export function generateId(): string {
  return uuidv4();
}

function resolvePath(file: string): string {
  return path.isAbsolute(file) ? file : path.join(DATA_DIR, file);
}

/** Read a JSON file (relative to `data/`, or absolute) and parse it as `T`.
 *  Used by slides.ts and settingsStore.ts for non-collection config files. */
export async function readJSON<T>(file: string): Promise<T> {
  const filePath = resolvePath(file);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

/**
 * Write `data` to a JSON file (relative to `data/`). Atomic temp-file rename.
 * Used by slides.ts and settingsStore.ts for non-collection config files.
 */
export async function writeJSON<T>(file: string, data: T): Promise<void> {
  const filePath = resolvePath(file);
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}

/**
 * Read a collection from SQLite. Kept for backward compatibility with
 * pages/index.tsx which calls `readCollection` directly in getServerSideProps.
 */
export async function readCollection<T>(name: string): Promise<T[]> {
  const db = getDb();
  const tableName = resolveTableName(name);
  const rows = db.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, unknown>[];
  return rows.map(deserializeRow) as T[];
}

// ─── SQLite helpers ────────────────────────────────────────────────────

/** Maps collection names to SQLite table names. */
function resolveTableName(name: string): string {
  const map: Record<string, string> = {
    books: "books",
    orders: "orders",
    users: "users",
    expenses: "expenses",
    expenseCategories: "expenseCategories",
    refunds: "refunds",
    inventoryLogs: "inventoryLogs",
    contacts: "contacts",
    newsletter: "newsletter",
    testimonials: "testimonials",
    categories: "categories",
  };
  return map[name] ?? name;
}

/** Columns that store JSON arrays/objects as TEXT and need parsing on read. */
const JSON_COLUMNS = new Set(["items", "restockedItems"]);

/** Columns that store JSON arrays and need stringification on write. */
function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value) || (typeof value === "object" && value !== null && !Buffer.isBuffer(value))) {
    return JSON.stringify(value);
  }
  return value;
}

/** Parse JSON columns back to native JS types when reading from SQLite. */
function deserializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (JSON_COLUMNS.has(key) && typeof value === "string") {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Build an INSERT statement for a record. */
function buildInsert(
  tableName: string,
  record: Record<string, unknown>
): { sql: string; params: unknown[] } {
  const keys = Object.keys(record);
  const columns = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map(() => "?").join(", ");
  const params = keys.map((k) => serializeValue(record[k]));
  return {
    sql: `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`,
    params,
  };
}

/** Build an UPDATE statement for a partial patch. */
function buildUpdate(
  tableName: string,
  patch: Record<string, unknown>,
  id: string
): { sql: string; params: unknown[] } {
  // Exclude `id` — it's always in the WHERE clause, never in SET.
  const keys = Object.keys(patch).filter((k) => k !== "id");
  const setClauses = keys.map((k) => `"${k}" = ?`);
  const params = [
    ...keys.map((k) => serializeValue(patch[k])),
    id,
  ];
  return {
    sql: `UPDATE "${tableName}" SET ${setClauses.join(", ")} WHERE id = ?`,
    params,
  };
}

// ─── Collection API ────────────────────────────────────────────────────

/** Bump `updatedAt` when the record shape has it (Book, Order). */
function touch<T>(record: T): T {
  const withUpdatedAt = record as T & { updatedAt?: number };
  if (typeof withUpdatedAt.updatedAt === "number") {
    withUpdatedAt.updatedAt = Date.now();
  }
  return record;
}

function collection<T extends { id: string; createdAt: number }>(
  name: CollectionName
) {
  const tableName = resolveTableName(name);

  return {
    getAll: (): T[] => {
      const db = getDb();
      const rows = db.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, unknown>[];
      return rows.map(deserializeRow) as T[];
    },

    getById: async (id: string): Promise<T | null> => {
      const db = getDb();
      const row = db
        .prepare(`SELECT * FROM "${tableName}" WHERE id = ?`)
        .get(id) as Record<string, unknown> | undefined;
      return row ? (deserializeRow(row) as T) : null;
    },

    create: (
      data: Omit<T, "id" | "createdAt"> & { id?: string }
    ): Promise<T> => {
      const db = getDb();
      const record = {
        ...data,
        id: (data as Record<string, unknown>).id ?? generateId(),
        createdAt: Date.now(),
      } as unknown as T;
      const touched = touch(record) as Record<string, unknown>;
      const { sql, params } = buildInsert(tableName, touched);
      db.prepare(sql).run(...params);
      return Promise.resolve(touched as unknown as T);
    },

    update: async (
      id: string,
      patch: Partial<Omit<T, "id" | "createdAt">>
    ): Promise<T | null> => {
      const db = getDb();
      const existing = db
        .prepare(`SELECT * FROM "${tableName}" WHERE id = ?`)
        .get(id) as Record<string, unknown> | undefined;
      if (!existing) return null;

      const merged = touch({ ...existing, ...patch }) as Record<string, unknown>;
      const { sql, params } = buildUpdate(tableName, merged, id);
      db.prepare(sql).run(...params);

      // Re-read to return the full updated record
      const updated = db
        .prepare(`SELECT * FROM "${tableName}" WHERE id = ?`)
        .get(id) as Record<string, unknown>;
      return deserializeRow(updated) as unknown as T;
    },

    remove: async (id: string): Promise<boolean> => {
      const db = getDb();
      const result = db
        .prepare(`DELETE FROM "${tableName}" WHERE id = ?`)
        .run(id);
      return result.changes > 0;
    },
  };
}

// ─── Typed per-collection API used by API routes ───────────────────────

export const db = {
  books: collection<Book>("books"),
  users: {
    ...collection<User>("users"),
    getByEmail: async (email: string): Promise<User | null> => {
      const dbConn = getDb();
      const normalized = email.trim().toLowerCase();
      const row = dbConn
        .prepare(`SELECT * FROM "users" WHERE LOWER(email) = ?`)
        .get(normalized) as Record<string, unknown> | undefined;
      return row ? (deserializeRow(row) as unknown as User) : null;
    },
  },
  orders: {
    ...collection<Order>("orders"),
    getByPaymentReference: async (ref: string): Promise<Order | null> => {
      const dbConn = getDb();
      const row = dbConn
        .prepare(`SELECT * FROM "orders" WHERE paymentReference = ?`)
        .get(ref) as Record<string, unknown> | undefined;
      return row ? (deserializeRow(row) as unknown as Order) : null;
    },
  },
  expenses: collection<Expense>("expenses"),
  expenseCategories: collection<ExpenseCategoryDef>("expenseCategories"),
  refunds: collection<Refund>("refunds"),
  inventoryLogs: collection<InventoryLog>("inventoryLogs"),
  contacts: collection<Contact>("contacts"),
  newsletter: {
    ...collection<NewsletterSubscriber>("newsletter"),
    getByEmail: async (email: string): Promise<NewsletterSubscriber | null> => {
      const dbConn = getDb();
      const row = dbConn
        .prepare(`SELECT * FROM "newsletter" WHERE email = ?`)
        .get(email) as Record<string, unknown> | undefined;
      return row ? (deserializeRow(row) as unknown as NewsletterSubscriber) : null;
    },
  },
  testimonials: collection<Testimonial>("testimonials"),

  /**
   * Book categories — uses `slug` as the primary key. The SQLite table has
   * extra `id` and `createdAt` columns that are managed internally.
   */
  categories: {
    getAll: (): CategoryInfo[] => {
      const dbConn = getDb();
      const rows = dbConn
        .prepare(`SELECT * FROM "categories" ORDER BY rowid`)
        .all() as Record<string, unknown>[];
      return rows.map((row) => ({
        slug: String(row.slug ?? ""),
        en: String(row.en ?? ""),
        ar: String(row.ar ?? ""),
      }));
    },

    /** Replace the entire category list atomically. */
    replaceAll: (list: CategoryInfo[]): void => {
      const dbConn = getDb();
      const tx = dbConn.transaction(() => {
        dbConn.prepare(`DELETE FROM "categories"`).run();
        const insert = dbConn.prepare(
          `INSERT INTO "categories" (id, slug, en, ar, createdAt) VALUES (?, ?, ?, ?, ?)`
        );
        for (const cat of list) {
          insert.run(cat.slug, cat.slug, cat.en, cat.ar, Date.now());
        }
      });
      tx();
    },
  },
};
