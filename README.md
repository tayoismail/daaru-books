# Daaru Kutubul Athaariyyah

An online Islamic bookstore — **bilingual (English & Arabic / RTL)**, with a
storefront, shopping cart, Flutterwave payments, and a full admin panel.

> **Backend note:** the app currently runs on a **file-based backend** (JSON
> collections in `data/`) so every flow — auth, cart, checkout, admin CRUD —
> can be built and tested locally with zero setup. Appwrite SDK code is
> scaffolded and ready; see the [Migration Guide](#migrating-to-appwrite) for
> how to swap the data layer when you're ready.

---

## ✨ Features

- **Storefront** — bilingual homepage (hero, USPs, bestsellers, categories,
  testimonials, newsletter), books listing with search/filter/sort/pagination,
  book detail pages with related titles & quick-view modals.
- **Cart & Checkout** — persistent cart (cookies), quantity controls, delivery
  form, order creation, **Flutterwave inline payments**, webhook-based
  settlement that decrements stock and logs inventory changes.
- **Authentication** — JWT + HTTP-only cookies, signup/login/logout, admin-role
  protection (`/admin/*`).
- **Admin Panel** — dashboard (stat cards, Chart.js sales-vs-expenses + expense
  breakdown, recent orders, low-stock alert), plus full CRUD for **books**
  (with image uploads), **orders** (status/payment updates, print invoice), and
  **expenses**.
- **i18n & RTL** — English (default) + Arabic with `dir="rtl"`, Noto Sans
  Arabic font, and a navbar language toggle.
- **SEO** — per-page meta/Open Graph/Twitter tags, canonical URLs, and
  JSON-LD structured data (Organization, WebSite, Product).
- **Polish** — custom 404 + 500 pages, `next/image` optimization, lazy-loaded
  modals, code-split admin charts.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm
- (Optional) Flutterwave test keys for payments

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description | Public? |
| --- | --- | --- |
| `JWT_SECRET` | Secret used to sign auth tokens (any long random string) | ❌ |
| `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` | Flutterwave public key (`FLWPUBK_TEST-…` in dev) | ✅ |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave secret key (`FLWSECK_TEST-…` in dev) | ❌ |
| `FLUTTERWAVE_WEBHOOK_HASH` | Webhook secret hash from the Flutterwave dashboard | ❌ |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (canonical/OG tags, e.g. `https://daarubooks.com`) | ✅ |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Appwrite endpoint (used after migration) | ✅ |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Appwrite project ID (used after migration) | ✅ |
| `APPWRITE_API_KEY` | Appwrite server API key (used after migration) | ❌ |

> `NEXT_PUBLIC_*` variables are exposed to the browser. `JWT_SECRET`,
> `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` and `APPWRITE_API_KEY`
> must **never** be prefixed with `NEXT_PUBLIC_`.

### 3. Seed data & demo accounts

The `data/` folder ships with seed data: 12 bilingual books, sample
orders/expenses, categories and testimonials.

**Admin account** (also auto-seeded on server start if missing):

- Email: `admin@example.com`
- Password: `admin123`

**Customer account** — register one from the signup page.

### 4. Run

```bash
npm run dev          # development  → http://localhost:3100
npm run build        # production build
npm run start        # serve the production build  → http://localhost:3100
npm run lint         # ESLint
```

> The app is pinned to **port 3100** (a dedicated port) so it never collides
> with other local dev servers you may have on the default 3000 series. To use
> a different port, pass it on the CLI, e.g. `npm run dev -- -p 3200`.

Arabic is served under `/ar` (e.g. `http://localhost:3100/ar`), or toggle in
the navbar.

---

## 🧱 Project Structure

```
components/            Reusable UI (Navbar, Footer, BookCard, modals, Seo, …)
data/                  File-based database (JSON collections + seed data)
lib/
  db.ts                File-based DB utilities (typed per-collection API)
  auth.ts              JWT verify + requireAuth wrappers
  upload.ts            multer image uploads (public/uploads)
  invoice.ts           Print-invoice HTML builder
  i18n/                i18next config + locale files (en, ar)
  contexts/            Auth, Cart, Language React contexts
  env.ts               Typed access to environment variables
pages/                 Next.js Pages Router routes
  api/                 API routes (auth, admin, orders, webhooks, contact…)
  admin/               Admin panel pages (dashboard, books, orders, expenses)
public/                Static assets + locale JSONs
styles/                Global styles (Tailwind CSS v4)
types/                 Shared TypeScript types (Book, User, Order, …)
```

---

## 🔐 Authentication

- **JWT** signed with `JWT_SECRET`, delivered as an **HTTP-only cookie**.
- Passwords are hashed with **bcryptjs**.
- API routes are protected with `requireAuth(handler, "admin"?)` from
  `lib/auth.ts`; admin pages use the `requireAdmin` gSSP guard
  (`lib/admin.ts`) which redirects anonymous users to `/login` and
  non-admins to `/`.
- The navbar shows an **Admin** link only for admin users.

---

## 💳 Payments (Flutterwave)

1. Checkout creates an order (`status: pending`, `paymentStatus: unpaid`) with
   a unique reference (`ORDER-<timestamp>-<random>`).
2. The **Flutterwave standard inline modal** opens with the order amount
   (NGN); on success the cart clears and the customer lands on
   `/order-success?reference=…`.
3. **Webhook** (`POST /api/webhooks/flutterwave`, `verif-hash` verified — the
   endpoint **fails closed** if `FLUTTERWAVE_WEBHOOK_HASH` is unset) settles
   the order: marks it paid/processing, **deducts stock**, and logs the
   inventory change. Settlement is idempotent and amount-checked.
4. For local development (webhooks can't reach `localhost`), the success page
   reconciles unpaid orders directly against Flutterwave's
   `verify_by_reference` API.

Without real keys the flow still works end-to-end — the order is created and
the success page shows a graceful "payment gateway not configured" notice.

---

## 🐳 Docker

A multi-stage `Dockerfile` is included:

```bash
docker build -t daaru-books .
docker run -p 3000:3000 \
  -e JWT_SECRET=change-me \
  -e NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-xxx \
  -e FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-xxx \
  daaru-books
```

> The `data/` folder is baked into the image. For persistent JSON storage,
> mount a volume at `/app/data`.

---

## ☁️ Deployment (Vercel / Netlify)

This is a **Pages Router** app — no special serverless config needed.

### Vercel

1. Push the repo to GitHub/GitLab/Bitbucket and import it in Vercel.
2. Add the environment variables from `.env.example` (Settings → Environment
   Variables).
3. Deploy — the build command (`next build`) and output are detected
   automatically.

### Netlify

1. Import the repo in Netlify.
2. Build command: `npm run build` · Publish directory: `.next`
3. Add the environment variables (Site settings → Environment variables).

> **Note:** with file-based storage, deployed instances are read-only for the
> `data/` folder on serverless platforms. This is fine for a static/demo
> deployment — for production, follow the [Appwrite migration](#migrating-to-appwrite)
> below so writes live in a real database. Flutterwave webhooks only work when
> the deployment has a public URL (Vercel/Netlify URLs qualify).

---

## 🔄 Migrating to Appwrite

The app was deliberately built so the data layer is **one file to swap**:
`lib/db.ts`. API routes never touch `fs` directly — they use the typed
`db` object (`db.books.getAll()`, `db.orders.update(id, patch)`, …).

### Step 1 — Scaffold (already done)

`lib/appwrite/` contains:

- `client.ts` — browser SDK (`createAppwriteClient()`)
- `server.ts` — Node admin SDK (server-only, uses `APPWRITE_API_KEY`)
- `index.ts` — re-exports

### Step 2 — Map entities to collections

Create collections matching the entity shapes in `types/index.ts`:

| JSON file | Appwrite collection | Notes |
| --- | --- | --- |
| `books.json` | `books` | Keep `id` as the document id; store bilingual fields as-is |
| `users.json` | `users` | `password` is a bcrypt hash — never expose via SDK permissions |
| `orders.json` | `orders` | Same status/payment enums |
| `expenses.json` | `expenses` | Category enum: COGS / Utility / Other |
| `inventoryLogs.json` | `inventoryLogs` | Append-only audit log |
| `contacts.json` | `contacts` | Contact form messages |
| `newsletter.json` | `newsletter` | Subscriber emails |

Set collection permissions so **users can only read/write their own
documents** (except `books`, which is public-read) and use the admin API key
server-side for privileged operations.

### Step 3 — Reimplement `db`

Replace the internals of `lib/db.ts` with Appwrite `Databases` calls while
keeping the same exported signatures:

```ts
// before (file-based)
export const db = {
  books: collection<Book>("books"),
  // …
};

// after (Appwrite — illustrative)
import { databases, DB_ID } from "@/lib/appwrite/server";
export const db = {
  books: {
    getAll: async () =>
      (await databases.listDocuments(DB_ID, "books")).documents as unknown as Book[],
    getById: async (id: string) =>
      (await databases.getDocument(DB_ID, "books", id)) as unknown as Book,
    create: (data) => databases.createDocument(DB_ID, "books", "unique()", data),
    update: (id, patch) => databases.updateDocument(DB_ID, "books", id, patch),
    remove: async (id) => { await databases.deleteDocument(DB_ID, "books", id); return true; },
  },
  // … same shape for the other collections
};
```

### Step 4 — What stays the same

- **API routes** (`pages/api/...`) — unchanged, they only call `db.*`.
- **Auth** — keep JWT + bcrypt as-is (or migrate to Appwrite Auth later;
  `lib/appwrite` can expose an auth client then).
- **File uploads** — swap `multer → public/uploads` for Appwrite **Storage**
  (upload via the browser SDK, store the returned file URL as `imageUrl`).
- **Webhooks** — unchanged.

### Step 5 — Cut over

1. Seed Appwrite with the current `data/*.json` contents (one-off script).
2. Deploy `lib/db.ts` pointing at Appwrite.
3. Remove `data/` from the runtime (keep the folder for the seed script).

---

## 🧪 Final Testing Checklist

- [ ] All pages render in both `en` and `/ar` (home, books, book detail, cart,
      checkout, about, contact, privacy, terms, auth, 404/500).
- [ ] RTL: `<html dir="rtl">` in Arabic; layout mirrors correctly (spacing,
      tables, badges, breadcrumbs).
- [ ] Auth: signup → login → logout; protected routes redirect anonymous
      users; admin pages reject customers.
- [ ] Cart: add, update quantity, remove, persist across reloads; checkout
      creates an order; payment flow (test keys) settles stock via webhook.
- [ ] Admin: books CRUD (+uploads), orders status/payment updates + invoice,
      expenses CRUD; dashboard charts reflect data changes.
- [ ] Bilingual switching works everywhere (navbar toggle + `/ar` routes).
- [ ] Responsive on mobile / tablet / desktop (grids collapse, nav drawer,
      tables scroll horizontally).
- [ ] `npm run build` and `npm run lint` pass clean.

---

## 📜 License

Private project — all rights reserved.
