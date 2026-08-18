/**
 * Fetch book cover images into public/covers/<isbn>.jpg and wire them into
 * data/books.json (only for books that get a cover; existing imageUrl is kept).
 *
 * Sources (Open Library, no API key needed):
 *  1. Covers API by ISBN  — https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg
 *  2. Search API by title + author → cover_i → https://covers.openlibrary.org/b/id/<cover_i>-L.jpg
 *
 * A cover is accepted only when it is an actual image larger than 8 KB
 * (Open Library serves a tiny 1x1 GIF placeholder when nothing exists).
 *
 * Usage:
 *   node scripts/fetch-covers.mjs
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const books = JSON.parse(
  await readFile(path.join(root, "data", "books.json"), "utf8")
);
const outDir = path.join(root, "public", "covers");
await mkdir(outDir, { recursive: true });

const MIN_BYTES = 8_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Download an image, retrying on rate-limit/server errors. Open Library
 * throttles bursts, so we back off between attempts.
 */
async function fetchRealImage(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "daaru-books-cover-fetcher/1.0 (testing)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 || res.status >= 500) {
      await sleep(1_500 * (attempt + 1));
      continue;
    }
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "";
    if (bytes.length >= MIN_BYTES && type.includes("image")) return bytes;
    return null;
  }
  return null;
}

async function coverByIsbn(isbn) {
  return fetchRealImage(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);
}

/** Pick the most relevant search hit that actually has a cover. */
function pickDoc(docs, author) {
  const target = (author ?? "").toLowerCase().trim();
  const scored = (docs ?? [])
    .filter((doc) => doc.cover_i)
    .map((doc) => {
      let score = 0;
      if (target) {
        const names = (doc.author_name ?? []).map((n) => n.toLowerCase());
        if (names.some((n) => n.includes(target.slice(0, 12)))) score += 3;
      }
      if ((doc.language ?? []).includes("eng")) score += 1;
      return { doc, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.doc ?? null;
}

async function coverBySearch(title, author) {
  // Search with the clean title only — full title+author strings often match
  // nothing (the search API ANDs all terms). Drop "(...)" subtitles and keep
  // the first few words, e.g. "The Sealed Nectar (Ar-Raheeq Al-Makhtum)" ->
  // "The Sealed Nectar". Author relevance is handled by pickDoc afterwards.
  const cleanTitle = title
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ");
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(cleanTitle)}&limit=8&fields=title,author_name,cover_i,language`,
    { signal: AbortSignal.timeout(20_000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const doc = pickDoc(data.docs, author);
  if (!doc) return null;
  return fetchRealImage(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`);
}

let okCount = 0;
const covers = new Map(); // bookId -> local url

for (const book of books) {
  // Pace requests so Open Library does not throttle the whole batch.
  await sleep(800);
  const isbn = String(book.isbn ?? "").trim();
  const slug = isbn.replace(/\D/g, "") || book.id.slice(0, 8);

  let bytes = isbn ? await coverByIsbn(isbn) : null;
  let source = "isbn";
  if (!bytes) {
    bytes = await coverBySearch(book.titleEn, book.author);
    source = "search";
  }

  if (bytes) {
    await writeFile(path.join(outDir, `${slug}.jpg`), bytes);
    covers.set(book.id, `/covers/${slug}.jpg`);
    okCount += 1;
    console.log(
      `OK  ${source.padEnd(6)} ${book.titleEn.slice(0, 42).padEnd(42)} -> /covers/${slug}.jpg (${bytes.length} bytes)`
    );
  } else {
    console.log(`MISS           ${book.titleEn.slice(0, 42)}`);
  }
}

// Persist the new imageUrl values (existing covers are never overwritten).
const updated = books.map((b) => ({
  ...b,
  imageUrl: covers.get(b.id) ?? b.imageUrl,
}));
await writeFile(
  path.join(root, "data", "books.json"),
  `${JSON.stringify(updated, null, 2)}\n`
);

console.log(
  `\nDone. ${okCount}/${books.length} covers saved to public/covers/ and data/books.json updated.`
);
