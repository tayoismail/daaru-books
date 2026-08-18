# Daaru Books — Complete App Workflow

## 🏪 NON-FINANCIAL FEATURES

---

### 1. Homepage (`/`)
- **Hero slider** cycles through a welcome slide and featured book slides with banner backgrounds
- **New Arrivals** carousel shows the 12 newest in-stock books
- **Bestsellers** carousel shows the highest-rated books
- **Category rows** — one carousel per category (Quran & Tafsir, Hadith, Fiqh, etc.)
- **Category tiles** — clickable gradient cards linking to filtered book listings
- **Testimonials** — customer reviews with star ratings
- **Newsletter signup** — collects email addresses
- **Trust badges** — Authentic, Delivery, Payments, Returns USPs
- **Quick View modal** — click a book card to preview without leaving the page

### 2. Book Catalog (`/books`)
- Server-side rendering with **search, category filter, sort** (relevance, price asc/desc, newest)
- **Paginated** grid (10 books per page) with skeleton loaders during navigation
- Sticky filter bar at the top
- "Popular Now" carousel below the results
- **Quick View modal** on every book card

### 3. Book Detail (`/books/[id]`)
- Full book page with cover image, title (bilingual), author, price, description
- **Add to Cart** button
- Related books / category recommendations

### 4. Cart (`/cart`)
- Lists all items with cover thumbnail, title, author, unit price, discount badge
- **Quantity controls** — increase/decrease/remove
- **Subtotal** per item and cart total
- "Free Shipping" indicator
- **Proceed to Checkout** button

### 5. Checkout (`/checkout`)
- Customer form: **Name, Email, Phone, Shipping Address**
- Order summary sidebar with item list and total
- On submit:
  1. Creates order via `/api/orders` (POST)
  2. Order gets a unique payment reference (`ORDER-{timestamp}-{random}`)
  3. Flutterwave payment modal opens (card, bank transfer, USSD)
  4. On success → redirects to `/order-success?reference=...`
  5. On close without paying → order is saved, user can retry
  6. Cart fingerprint prevents stale retries

### 6. Order Success (`/order-success`)
- Shows order confirmation with payment reference
- **Payment reconciliation**: if webhook didn't fire (e.g. local dev), the page server-side verifies the Flutterwave transaction and settles the order
- Displays order items, total, and shipping details
- Shows "Payment Confirmed" or "Awaiting Payment" status

### 7. Authentication
- **Signup** (`/signup`) — Name, Email, Password (min 6 chars) → creates account
- **Login** (`/login`) — Email + Password → JWT token stored in cookie
- **Auth API**: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/check`
- Roles: `admin` or `customer`

### 8. Static Pages
- `/about` — About the store
- `/contact` — Contact form → saves to `data/contacts.json`
- `/privacy` — Privacy policy
- `/terms` — Terms of service

### 9. Bilingual Support (i18n)
- Full English/Arabic support across the entire app
- Book titles, descriptions, UI labels all have `en` and `ar` variants
- RTL layout support for Arabic
- Language switcher in the navbar

### 10. Notifications
- **WhatsApp integration** — floating WhatsApp button for customer support
- **Email notifications** — order shipped email sent to customer with tracking number

---

## 💰 FINANCIAL / ACCOUNTING FEATURES

---

### 11. Payment Processing (Flutterwave)
- **Payment webhook** (`/api/webhooks/flutterwave`) — receives payment confirmation from Flutterwave
- **Settlement flow**:
  1. Webhook receives payment event
  2. Verifies the payment reference matches an order
  3. Calls `settleOrder()` which:
     - Validates order is not already paid (idempotent)
     - Validates amount matches order total (tampering defense)
     - Reduces book stock for each item
     - Creates inventory log entries
     - Updates order status to `processing` and payment status to `paid`
     - Records payment method (card, bank_transfer, ussd)
- **Retry-safe**: in-process lock prevents concurrent settlement of the same order

### 12. Order Status Management (`/admin/orders` + `/api/admin/orders/[id]`)
- Admin can update orders through a modal:
  - **Status**: pending → processing → shipped → delivered (or cancelled)
  - **Payment status**: unpaid → paid (or failed)
  - **Tracking number**: set when shipped
  - **Delivery fee**: optional, added to invoice total
- **When marking as paid manually** (e.g. bank transfer):
  - Stock is reduced automatically (same as webhook path)
  - Inventory logs are created
- **When cancelling a paid order**:
  - Auto-refund is created for the remaining amount
  - Books are returned to stock
  - Inventory logs record the restock
- **CSV export** of filtered orders

### 13. Expense Tracking (`/admin/expenses`)
- **Add expense**: Category (dropdown), Description, Amount (₦), Date
- **Edit expense**: modify any field via modal
- **Delete expense**: with confirmation dialog
- **10 default categories**: Cost of Goods, Utilities, Other, Rent, Salaries, Shipping & Delivery, Packaging, Marketing, Bank & Payment Fees, Software
- **Custom categories**: admin can add/rename/delete categories from the UI
- **Period filtering**: This Month, 3m, 6m, 12m, All
- **Summary cards**: Total expenses + per-category breakdowns with icons
- **CSV export** of all expenses

### 14. Refund Management (`/admin/refunds` + `/api/admin/refunds`)
- **Record refund**: select order, enter amount, reason, date
- **Validation**: refund cannot exceed remaining refundable total
- **Automatic stock return**: refunded fraction of each item is proportionally restocked
- **COGS reversal**: the cost of refunded goods is backed out of gross profit
- **Snapshots**: restocked quantities and cost refunded are stored on the refund record so deletion can reverse exactly
- **Auto-refund on cancellation**: when a paid order is cancelled, remaining amount is auto-refunded
- **Delete refund**: reverses stock changes and removes the record

### 15. Financial Dashboard (`/admin/dashboard`)
- **Period selector**: This Month, 3m, 6m, 12m, All Time, Custom date range
- **Summary stat cards** with period-over-period delta %:
  - Total Books, Total Orders, Revenue, Cash Received, Gross Profit (with margin %), Net Profit
- **Monthly bar chart**: Revenue vs Expenses vs Refunds over time
- **Cash Flow bar chart**: Cash In (paid orders) vs Cash Out (expenses + refunds)
- **Expense breakdown doughnut chart**: by category
- **Payments panel**: Received, Cash Out, Net Cash, Unpaid count/total, Failed count/total, Refunded
- **Recent orders table**: last 5 orders with click-to-view detail modal
- **Low stock alert**: books with ≤5 copies remaining

### 16. Profit & Loss Report (`/admin/report`)
- **Same period selector** as dashboard
- **P&L statement** (formal layout):
  - Revenue (delivered orders, net of sales-return refunds)
  - Cost of Goods Sold (COGS, net of cost backed out by refunds)
  - **Gross Profit** with margin %
  - Refunds of cancelled orders (direct charge)
  - Expenses
  - **Net Profit**
- **Receivables panel**: unpaid/failed totals, cash out, cash received, net cash
- **Expense breakdown** by category with doughnut chart
- **Refunds in period table**: date, order reference, reason, amount

### 17. Inventory Management (`/admin/inventory`)
- **Inventory log** — every stock change is recorded with:
  - Book title, change amount (+/-), reason, timestamp
- **Summary cards**: Total entries, Total added, Total removed
- **Search** by book title or reason
- **Filter** by specific book
- **Paginated** table with 12 rows per page
- Stock changes come from:
  - Admin manual update
  - Payment settlement (stock reduced)
  - Refund restock (stock increased)
  - Refund deletion (stock re-reduced)

### 18. Customer Management (`/admin/customers`)
- **Customer list** aggregated from orders (grouped by email)
- **Summary cards**: Total Customers, Total Orders, Total Spent
- Shows: Name, Email, Phone, Order Count, Total Spent (paid orders only), Last Order Date
- **Search** by name, email, or phone
- Sorted by total spent (highest first)
- Cancelled orders excluded from counts/totals

### 19. Book & Category Management (`/admin/books`, `/admin/categories`)
- **CRUD for books**: add, edit, delete books with all fields (title, author, ISBN, price, cost, quantity, category, description, image)
- **Sale pricing**: set `originalPrice` for discount badges
- **Cost price**: `cost` field per book for COGS calculation
- **SKU**: optional merchant SKU field
- **Rating & reviews**: track average rating
- **Category management**: add, edit, delete categories
- **CSV export** for books

### 20. Admin Settings (`/admin/settings`)
- **Store branding**: store name (bilingual), contact email, phone, WhatsApp number, address
- **Hero slides management**: pin featured books, upload banners, configure autoplay, edit welcome slide copy
- **Testimonials management**: add, edit, delete customer reviews

### 21. Data Storage
- All data stored as JSON files in `data/`:
  - `books.json`, `orders.json`, `expenses.json`, `expenseCategories.json`, `inventoryLogs.json`, `users.json`, `categories.json`, `contacts.json`, `newsletter.json`, `settings.json`, `slides.json`, `testimonials.json`
- **No external database** — simple file-based storage
- Auth via JWT tokens with bcrypt password hashing

### 22. Cron / Maintenance
- Audit check script (`scripts/audit-check.mjs`)
- Cover image fetching (`scripts/fetch-covers.mjs`)

---

## 🔄 Complete Order Lifecycle (Financial Flow)

```
Customer browses → Adds to cart → Checkout form → Creates order (pending/unpaid)
    ↓
Flutterwave payment modal → Customer pays
    ↓
Webhook fires → Settlement: verify amount → reduce stock → mark paid → inventory log
    ↓
Order Success page → Reconciliation fallback (if webhook missed)
    ↓
Admin sees order → Updates status: processing → shipped (+ tracking #) → delivered
    ↓
Email sent to customer when shipped
    ↓
P&L: Revenue recognized on delivery, COGS calculated, Gross Profit computed
    ↓
If issues → Admin records refund → Stock returned → COGS reversed → P&L updated
If cancelled → Auto-refund → Stock returned
    ↓
Dashboard & Report show all metrics in real-time
```
