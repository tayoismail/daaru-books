/* Thorough audit of locales, data integrity, referential integrity and files. */
import { readFileSync, existsSync, readdirSync } from "fs";

let problems = 0;
const report = (level, msg) => {
  if (level === "ERR") problems++;
  console.log(`${level}: ${msg}`);
};

const read = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
};

/* ---------------- 1. Locale key parity (en vs ar) ---------------- */
console.log("\n=== 1. LOCALE KEY PARITY ===");
const en = read("public/locales/en/common.json", {});
const ar = read("public/locales/ar/common.json", {});
const keys = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? keys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
const enKeys = new Set(keys(en));
const arKeys = new Set(keys(ar));
let missingInAr = 0;
for (const k of enKeys) if (!arKeys.has(k)) { report("ERR", `ar missing key: ${k}`); missingInAr++; }
if (!missingInAr) console.log("OK: every en key exists in ar");
// Arabic has plural categories (_zero/_two/_few/_many) that English correctly
// omits — those are expected differences, not bugs.
const missingInEn = [...arKeys].filter(
  (k) =>
    !enKeys.has(k) &&
    !/_(zero|two|few|many)$/.test(k)
);
missingInEn.forEach((k) => report("ERR", `en missing key: ${k}`));
if (!missingInEn.length)
  console.log("OK: every non-plural ar key exists in en (Arabic-only plural forms are expected)");

/* ---------------- 2. Static t() usage vs locale definitions ---------------- */
console.log("\n=== 2. STATIC t() KEY USAGE ===");
const files = [
  ...walk("pages", ".tsx"),
  ...walk("pages", ".ts"),
  ...walk("components", ".tsx"),
  ...walk("lib", ".tsx"),
];
function walk(dir, ext) {
  let out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out = out.concat(walk(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}
// A key like "admin.orders.results" is fine when its plural variants
// (results_one / results_other) exist — i18next resolves those with `count`.
const pluralBaseExists = (key) =>
  ["_zero", "_one", "_two", "_few", "_many", "_other"].some((s) =>
    enKeys.has(`${key}${s}`)
  );
const missingKeys = new Set();
const usedKeys = new Set();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/t\(\s*"([^"]+)"/g)) {
    const key = m[1];
    // Skip path-looking matches (e.g. `import("../../locales/...")` in
    // pages/books/[id].tsx) — only real dotted i18n keys are meaningful.
    if (!key.includes(".") || key.includes("/")) continue;
    usedKeys.add(key);
    if (!enKeys.has(key) && !pluralBaseExists(key)) missingKeys.add(key);
  }
}
if (missingKeys.size === 0) console.log(`OK: all ${usedKeys.size} static t() keys resolve (incl. plural variants)`);
else [...missingKeys].forEach((k) => report("ERR", `t() key not in locales: ${k}`));

/* ---------------- 3. Data integrity ---------------- */
console.log("\n=== 3. DATA INTEGRITY ===");
const books = read("data/books.json", []);
const orders = read("data/orders.json", []);
const expenses = read("data/expenses.json", []);
const logs = read("data/inventoryLogs.json", []);
const categories = read("data/categories.json", []);
const testimonials = read("data/testimonials.json", []);
const newsletter = read("data/newsletter.json", []);

// books
const bookIds = new Set();
books.forEach((b, i) => {
  if (!b.id) report("ERR", `books[${i}] missing id`);
  if (bookIds.has(b.id)) report("ERR", `duplicate book id ${b.id}`);
  bookIds.add(b.id);
  if (!b.titleEn || !b.titleAr) report("ERR", `book ${b.id || i} missing bilingual title`);
  if (!(b.price > 0)) report("ERR", `book ${b.titleEn || b.id} price not > 0 (${b.price})`);
  if (!Number.isInteger(b.quantity) || b.quantity < 0) report("ERR", `book ${b.titleEn} bad quantity ${b.quantity}`);
  if (b.originalPrice !== undefined && b.originalPrice <= b.price) report("ERR", `book ${b.titleEn} originalPrice <= price (discount logic)`);
  if (b.cost !== undefined && (b.cost < 0 || !Number.isFinite(b.cost))) report("ERR", `book ${b.titleEn} bad cost ${b.cost}`);
});
console.log(`books: ${books.length} checked`);

// categories referenced by books
const catNames = new Set(categories.map((c) => c.en));
const slugSet = new Set();
categories.forEach((c, i) => {
  if (!c.slug) report("ERR", `categories[${i}] missing slug`);
  if (slugSet.has(c.slug)) report("ERR", `duplicate category slug ${c.slug}`);
  slugSet.add(c.slug);
  if (!c.en || !c.ar) report("ERR", `category ${c.slug} missing bilingual name`);
});
books.forEach((b) => {
  if (!catNames.has(b.category) && b.category !== "Other")
    report("ERR", `book "${b.titleEn}" references unknown category "${b.category}"`);
});

// orders
const validStatus = ["pending", "processing", "shipped", "delivered", "cancelled"];
const validPayment = ["unpaid", "paid", "failed"];
orders.forEach((o, i) => {
  if (!validStatus.includes(o.status)) report("ERR", `order[${i}] bad status ${o.status}`);
  if (!validPayment.includes(o.paymentStatus)) report("ERR", `order[${i}] bad paymentStatus ${o.paymentStatus}`);
  if (!o.customerEmail || !o.customerName) report("ERR", `order[${i}] missing customer info`);
  const itemsTotal = (o.items || []).reduce((s, it) => s + it.price * it.quantity, 0);
  if (Math.abs(itemsTotal - o.total) > 0.01) report("ERR", `order[${i}] ${o.paymentReference} total ${o.total} != items ${itemsTotal}`);
  (o.items || []).forEach((it) => {
    if (!bookIds.has(it.bookId)) report("WARN", `order[${i}] item references unknown book ${it.bookId}`);
  });
});
console.log(`orders: ${orders.length} checked`);

// inventory logs
logs.forEach((l, i) => {
  if (!Number.isInteger(l.change) || l.change === 0) report("ERR", `inventoryLog[${i}] bad change ${l.change}`);
});
console.log(`inventoryLogs: ${logs.length} checked`);

// testimonials
testimonials.forEach((t, i) => {
  if (!t.name || !t.reviewEn || !t.reviewAr) report("ERR", `testimonial[${i}] missing fields`);
  if (t.rating !== undefined && (t.rating < 0 || t.rating > 5)) report("ERR", `testimonial[${i}] bad rating`);
});

// expenses
expenses.forEach((e, i) => {
  if (!["COGS", "Utility", "Other"].includes(e.category)) report("ERR", `expense[${i}] bad category ${e.category}`);
  if (!(e.amount > 0)) report("ERR", `expense[${i}] bad amount ${e.amount}`);
});

// newsletter
newsletter.forEach((n, i) => {
  if (!n.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(n.email)) report("ERR", `newsletter[${i}] bad email`);
});

/* ---------------- 4. Referential integrity: slides + images ---------------- */
console.log("\n=== 4. REFERENTIAL + FILE INTEGRITY ===");
const slides = read("data/slides.json", null);
if (slides) {
  (slides.featuredBookIds || []).forEach((id) => {
    if (!bookIds.has(id)) report("ERR", `slides.featuredBookIds references unknown book ${id}`);
  });
  if (slides.featuredBookIds && new Set(slides.featuredBookIds).size !== slides.featuredBookIds.length)
    report("ERR", "slides.featuredBookIds has duplicates");
  (slides.banners || []).forEach((b) => {
    if (b.startsWith("/uploads/") && !existsSync(`public${b}`)) report("ERR", `slides.banners file missing: ${b}`);
  });
  if (typeof slides.autoplayMs !== "number" || slides.autoplayMs < 0) report("ERR", "slides.autoplayMs invalid");
}

books.forEach((b) => {
  if (!b.imageUrl) return;
  if (b.imageUrl.startsWith("/")) {
    if (!existsSync(`public${b.imageUrl}`)) report("ERR", `book cover file missing: ${b.imageUrl} (${b.titleEn})`);
  } else if (!/^https?:\/\//.test(b.imageUrl)) {
    report("ERR", `book ${b.titleEn} odd imageUrl: ${b.imageUrl}`);
  }
});

// orphaned uploads
const uploadDir = "public/uploads";
if (existsSync(uploadDir)) {
  const referenced = new Set();
  books.forEach((b) => b.imageUrl && b.imageUrl.startsWith("/uploads/") && referenced.add(b.imageUrl));
  (slides?.banners || []).forEach((b) => b.startsWith("/uploads/") && referenced.add(b));
  readdirSync(uploadDir).forEach((f) => {
    if (!referenced.has(`/uploads/${f}`)) report("WARN", `possibly orphaned upload: /uploads/${f}`);
  });
}

// orphaned covers
const coverDir = "public/covers";
if (existsSync(coverDir)) {
  readdirSync(coverDir).forEach((f) => {
    if (!books.some((b) => b.imageUrl === `/covers/${f}`)) report("WARN", `unreferenced cover: /covers/${f}`);
  });
}

/* ---------------- 5. Enum translation keys ---------------- */
console.log("\n=== 5. ENUM TRANSLATION KEYS ===");
validStatus.forEach((s) => {
  if (!enKeys.has(`admin.status.${s}`)) report("ERR", `missing admin.status.${s}`);
  if (!arKeys.has(`admin.status.${s}`)) report("ERR", `missing ar admin.status.${s}`);
});
validPayment.forEach((p) => {
  if (!enKeys.has(`admin.payment.${p}`)) report("ERR", `missing admin.payment.${p}`);
});
["cogs", "utility", "other"].forEach((c) => {
  if (!enKeys.has(`admin.expenseCategories.${c}`)) report("ERR", `missing admin.expenseCategories.${c}`);
});

/* ---------------- 6. Nav vs pages ---------------- */
console.log("\n=== 6. ADMIN NAV VS PAGES ===");
const navPages = [
  "dashboard", "books", "inventory", "categories", "testimonials",
  "orders", "customers", "expenses", "slides", "settings", "users",
];
navPages.forEach((p) => {
  if (!existsSync(`pages/admin/${p}.tsx`)) report("ERR", `nav points to missing page: pages/admin/${p}.tsx`);
});

console.log(`\n=== AUDIT RESULT: ${problems} ERROR${problems === 1 ? "" : "S"} ===`);
process.exit(problems > 0 ? 1 : 0);
