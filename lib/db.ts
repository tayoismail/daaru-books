// NOTE: Server-only module (imports Node builtins + Appwrite admin SDK).
// Keep this out of client code — it fails the build if a client bundle
// imports it.
//
// Storage backend: Appwrite Cloud Database.
// The public API is identical to the previous SQLite version so every
// API route, admin page, and dashboard computation works unchanged.

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
import { adminTablesDB } from "@/lib/appwrite/server";
import { env } from "@/lib/env";

// ─── Appwrite IDs ─────────────────────────────────────────────────────

const DB_ID = env.appwriteDatabaseId;

/** Collection IDs — match the ids used in scripts/setup-appwrite.mjs */
const COLLECTIONS = {
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
  config: "config",
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────

export type CollectionName = keyof typeof COLLECTIONS;

/** Generate a unique id (uuid v4). */
export function generateId(): string {
  return uuidv4();
}

/**
 * Strip Appwrite metadata fields ($id, $collectionId, etc.) from a document
 * and map $id → id so our types work unchanged.
 */
function stripMeta(doc: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key.startsWith("$")) {
      if (key === "$id") result.id = value;
      // skip other $-prefixed metadata
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Columns that store JSON arrays/objects as TEXT and need parsing on read. */
const JSON_COLUMNS = new Set(["items", "restockedItems"]);

/**
 * Parse JSON columns back to native JS types when reading from Appwrite.
 * Also handles the books collection where descriptionEn stores both
 * descriptions as JSON {en, ar} due to the 16-attribute limit on free tier.
 */
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
  // Books: descriptionEn stores combined {en, ar} JSON — split back out
  if (typeof result.descriptionEn === "string" && !result.descriptionAr) {
    try {
      const parsed = JSON.parse(result.descriptionEn as string);
      if (parsed && typeof parsed === "object" && "en" in parsed && "ar" in parsed) {
        result.descriptionEn = parsed.en ?? "";
        result.descriptionAr = parsed.ar ?? "";
      }
    } catch {
      // plain string — leave as-is
    }
  }
  return result;
}

/** Serialize complex values (arrays, objects) to JSON strings for Appwrite. */
function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value) || (typeof value === "object" && value !== null && !Buffer.isBuffer(value))) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Serialize all fields in a record for Appwrite storage.
 * For books, merges descriptionEn + descriptionAr into a single JSON field
 * because the free tier limits attributes per collection to 16.
 */
function serializeRecord(record: Record<string, unknown>, collectionName?: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "id") continue; // Appwrite uses $id, not id
    if (collectionName === "books" && key === "descriptionAr") {
      // Skip — we merge into descriptionEn below
      continue;
    }
    result[key] = serializeValue(value);
  }
  // Books: merge descriptions into descriptionEn as JSON
  if (collectionName === "books" && record.descriptionAr !== undefined) {
    result.descriptionEn = JSON.stringify({
      en: record.descriptionEn ?? "",
      ar: record.descriptionAr ?? "",
    });
  }
  return result;
}

/**
 * Read a collection from Appwrite. Kept for backward compatibility with
 * pages/index.tsx which calls `readCollection` directly in getServerSideProps.
 */
export async function readCollection<T>(name: string): Promise<T[]> {
  const colId = COLLECTIONS[name as CollectionName] ?? name;
  const result = await adminTablesDB.listRows(DB_ID, colId);
  return result.rows.map((doc) => deserializeRow(stripMeta(doc as Record<string, unknown>)) as T);
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
  const colId = COLLECTIONS[name];

  return {
    getAll: async (): Promise<T[]> => {
      const { Query } = await import("appwrite");
      // Fetch all documents (Appwrite paginates at 100 by default; fetch up to 1000)
      const allDocs: T[] = [];
      let offset = 0;
      const limit = 100;
      while (true) {
        const result = await adminTablesDB.listRows(DB_ID, colId, [
          Query.limit(limit),
          Query.offset(offset),
        ]);
        const docs = result.rows.map(
          (doc) => deserializeRow(stripMeta(doc as Record<string, unknown>)) as T
        );
        allDocs.push(...docs);
        if (docs.length < limit) break;
        offset += limit;
      }
      return allDocs;
    },

    getById: async (id: string): Promise<T | null> => {
      try {
        const doc = await adminTablesDB.getRow(DB_ID, colId, id);
        return deserializeRow(stripMeta(doc as Record<string, unknown>)) as T;
      } catch {
        return null;
      }
    },

    create: async (
      data: Omit<T, "id" | "createdAt"> & { id?: string }
    ): Promise<T> => {
      const record = {
        ...data,
        id: (data as Record<string, unknown>).id ?? generateId(),
        createdAt: Date.now(),
      } as unknown as T;
      const touched = touch(record) as Record<string, unknown>;
      const docId = String(touched.id);
      const serialized = serializeRecord(touched, name);
      const doc = await adminTablesDB.createRow(DB_ID, colId, docId, serialized);
      return deserializeRow(stripMeta(doc as Record<string, unknown>)) as unknown as T;
    },

    update: async (
      id: string,
      patch: Partial<Omit<T, "id" | "createdAt">>
    ): Promise<T | null> => {
      try {
        // Read existing to merge
        const existing = await adminTablesDB.getRow(DB_ID, colId, id);
        const existingData = stripMeta(existing as Record<string, unknown>);
        const merged = touch({ ...existingData, ...patch }) as Record<string, unknown>;
        const serialized = serializeRecord(merged, name);
        const doc = await adminTablesDB.updateRow(DB_ID, colId, id, serialized);
        return deserializeRow(stripMeta(doc as Record<string, unknown>)) as unknown as T;
      } catch {
        return null;
      }
    },

    remove: async (id: string): Promise<boolean> => {
      try {
        await adminTablesDB.deleteRow(DB_ID, colId, id);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ─── Find helpers (query by field) ─────────────────────────────────────

async function findByField<T>(
  collectionId: string,
  fieldName: string,
  fieldValue: string
): Promise<T | null> {
  const { Query } = await import("appwrite");
  try {
    const result = await adminTablesDB.listRows(
      DB_ID,
      collectionId,
      [Query.equal(fieldName, fieldValue), Query.limit(1)]
    );
    if (result.rows.length === 0) return null;
    return deserializeRow(
      stripMeta(result.rows[0] as Record<string, unknown>)
    ) as T;
  } catch {
    return null;
  }
}

// ─── Typed per-collection API used by API routes ───────────────────────

export const db = {
  books: collection<Book>("books"),
  users: {
    ...collection<User>("users"),
    getByEmail: async (email: string): Promise<User | null> => {
      const normalized = email.trim().toLowerCase();
      // Appwrite query: case-insensitive email match
      const { Query } = await import("appwrite");
      try {
        const result = await adminTablesDB.listRows(
          DB_ID,
          COLLECTIONS.users,
          [Query.equal("email", normalized), Query.limit(1)]
        );
        if (result.rows.length === 0) return null;
        return deserializeRow(
          stripMeta(result.rows[0] as Record<string, unknown>)
        ) as unknown as User;
      } catch {
        return null;
      }
    },
  },
  orders: {
    ...collection<Order>("orders"),
    getByPaymentReference: async (ref: string): Promise<Order | null> => {
      return findByField<Order>(
        COLLECTIONS.orders,
        "paymentReference",
        ref
      );
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
      return findByField<NewsletterSubscriber>(
        COLLECTIONS.newsletter,
        "email",
        email
      );
    },
  },
  testimonials: collection<Testimonial>("testimonials"),

  /**
   * Book categories — uses `slug` as the primary key.
   */
  categories: {
    getAll: async (): Promise<CategoryInfo[]> => {
      const { Query } = await import("appwrite");
      const allDocs: CategoryInfo[] = [];
      let offset = 0;
      const limit = 100;
      while (true) {
        const result = await adminTablesDB.listRows(
          DB_ID,
          COLLECTIONS.categories,
          [Query.limit(limit), Query.offset(offset)]
        );
        const docs = result.rows.map((doc) => {
          const data = stripMeta(doc as Record<string, unknown>);
          return {
            slug: String(data.slug ?? ""),
            en: String(data.en ?? ""),
            ar: String(data.ar ?? ""),
          };
        });
        allDocs.push(...docs);
        if (docs.length < limit) break;
        offset += limit;
      }
      return allDocs;
    },

    /** Replace the entire category list atomically. */
    replaceAll: async (list: CategoryInfo[]): Promise<void> => {
      const { Query } = await import("appwrite");
      // Delete all existing categories
      const existing = await adminTablesDB.listRows(
        DB_ID,
        COLLECTIONS.categories,
        [Query.limit(100)]
      );
      for (const doc of existing.rows) {
        await adminTablesDB.deleteRow(
          DB_ID,
          COLLECTIONS.categories,
          doc.$id
        );
      }
      // Insert new categories
      for (const cat of list) {
        await adminTablesDB.createRow(
          DB_ID,
          COLLECTIONS.categories,
          cat.slug, // use slug as document id
          {
            slug: cat.slug,
            en: cat.en,
            ar: cat.ar,
            createdAt: Date.now(),
          }
        );
      }
    },
  },
};
