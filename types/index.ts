/**
 * Shared application types (file-based backend — see `lib/db.ts` and `data/`).
 * When migrating to Appwrite, these plain entities will be mapped to Appwrite
 * Documents without changing the API routes. All timestamps are epoch
 * milliseconds (numbers).
 */

export interface Book {
  id: string;
  titleEn: string;
  titleAr: string;
  author: string;
  isbn: string;
  price: number;
  /**
   * Pre-discount price, when the book is on sale. `price` is always the
   * current selling price; cards show a "-X%" badge and a strikethrough.
   */
  originalPrice?: number;
  /**
   * Cost price (what the store pays per copy). Optional — powers the gross
   * margin shown on the books page and feeds profit insights.
   */
  cost?: number;
  quantity: number;
  category: string;
  descriptionEn: string;
  descriptionAr: string;
  imageUrl: string;
  /** 0–5 average rating (shown as stars on the book detail page). */
  rating?: number;
  /** Number of customer reviews behind the rating. */
  reviews?: number;
  /** Merchant SKU, when assigned (e.g. "DK-0001"). */
  sku?: string;
  createdAt: number;
  updatedAt: number;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "failed";

export interface OrderItem {
  bookId: string;
  title: string;
  quantity: number;
  price: number;
  /**
   * Cost price (what the store pays per copy) snapshotted at checkout so
   * COGS/gross-profit reports stay accurate even if the book's cost changes
   * later. `null` means the cost was looked up but not found (reports fall
   * back to 0). Absent (`undefined`) for orders created before this field
   * existed.
   */
  cost?: number | null;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentReference: string;
  /** Flutterwave payment channel (card / bank_transfer / ussd / …), recorded
   * when the payment settles. */
  paymentMethod?: string;
  /** Customer-facing delivery fee charged for this order (0 when none). Set
   * by the admin; shown on the invoice and feeds per-order margin reports. */
  deliveryFee?: number;
  /** Courier tracking number, set by the admin when the order is shipped. */
  trackingNumber?: string;
  createdAt: number;
  updatedAt: number;
}

export type Role = "admin" | "customer";

export interface User {
  id: string;
  name: string;
  email: string;
  /** bcrypt hash — never expose this outside the server */
  password: string;
  role: Role;
  createdAt: number;
}

/**
 * Expense category id — one of the ids in `expenseCategories` (seeded with
 * COGS / Utility / Other and manageable from the admin expenses page). Was a
 * closed 3-value union; widened so store owners can add their own.
 */
export type ExpenseCategory = string;

/** An expense category the admin can pick from, with bilingual names. */
export interface ExpenseCategoryDef {
  id: string;
  nameEn: string;
  nameAr: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  /** Epoch ms */
  date: number;
  createdAt: number;
}

/**
 * A refund recorded against a paid order (e.g. a returned or damaged book).
 * Refunds reduce recognized revenue in P&L reports.
 */
export interface Refund {
  id: string;
  /** The order this refund belongs to. */
  orderId: string;
  amount: number;
  reason: string;
  /** Epoch ms — day the refund was issued. */
  date: number;
  createdAt: number;
  /**
   * Books returned to stock by this refund (proportional to the refunded
   * fraction of the order), snapshotted so deleting the refund can reverse
   * the restock exactly. Absent for refunds that returned nothing.
   */
  restockedItems?: { bookId: string; quantity: number }[];
  /**
   * COGS backed out of the P&L by this refund — the refunded fraction of the
   * order's cost of goods (cost × quantity per item, legacy items filled
   * with the book's current cost at refund time). Absent for refunds recorded
   * before this snapshot existed.
   */
  costRefunded?: number;
}

/** change > 0 = stock added (restock); change < 0 = stock removed (sale/write-off) */
export interface InventoryLog {
  id: string;
  bookId: string;
  change: number;
  reason: string;
  createdAt: number;
}

/** Inventory history row joined with book titles (admin inventory screen). */
export interface InventoryLogRow extends InventoryLog {
  /** Empty when the book was deleted. */
  bookTitleEn: string;
  bookTitleAr: string;
}

/** Book option for the inventory filter dropdown. */
export interface InventoryBookOption {
  id: string;
  titleEn: string;
  titleAr: string;
}

/** Customer aggregated from their orders (admin customers screen). */
export interface CustomerRow {
  /** Normalized (lowercased) email — the grouping key. */
  email: string;
  name: string;
  phone: string;
  /** Number of non-cancelled orders. */
  orderCount: number;
  /** Total value of paid, non-cancelled orders. */
  totalSpent: number;
  /** Epoch ms of the most recent order. */
  lastOrderAt: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  createdAt: number;
}

export interface Testimonial {
  id: string;
  name: string;
  handle: string;
  reviewEn: string;
  reviewAr: string;
  rating: number;
  avatarUrl?: string;
  createdAt: number;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  createdAt: number;
}

/**
 * Frontend cart item — a snapshot of a book at add-to-cart time. Both
 * titles are stored so the cart can localize at render time.
 */
export interface CartItem {
  bookId: string;
  titleEn: string;
  titleAr: string;
  author: string;
  /** Current (sale) price charged for this item. */
  price: number;
  /** Pre-discount price, carried for "was" strikethroughs in cart/checkout. */
  originalPrice?: number;
  quantity: number;
  imageUrl?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

export interface FlutterwavePaymentData {
  transaction_id: string;
  status: "successful" | "failed";
  currency: string;
  amount: number;
  customer: {
    email: string;
    name?: string;
  };
}

export interface ApiError {
  error: string;
  message?: string;
}

/** A string in both storefront languages. An empty value means "fall back to
 * the default translation" (except where the shape's own defaults apply). */
export interface BilingualText {
  en: string;
  ar: string;
}

/**
 * Store-wide branding + contact settings, stored in `data/settings.json` and
 * managed from Admin → Settings. Values override the matching i18n keys
 * (`appName`, `contact.*`, `whatsapp.number`) at runtime so every page picks
 * them up without per-page plumbing.
 */
export interface StoreSettings {
  /** Store display name (overrides the `appName` i18n key). */
  storeName: BilingualText;
  /** Contact email shown in the footer, contact page and legal pages. */
  contactEmail: string;
  /** Contact phone shown in the footer, contact page and legal pages. */
  contactPhone: string;
  /** WhatsApp number in international format (e.g. 2349059806656). */
  whatsappNumber: string;
  /** Physical address shown in the footer + contact page. */
  address: string;
  /** Epoch ms of the last update. */
  updatedAt: number;
}

/** Editable text fields of the welcome hero slide (mirrors the `hero.*` i18n
 * keys). Empty values fall back to the locale JSON translations. */
export interface SlidesWelcome {
  enabled: boolean;
  badge: BilingualText;
  title: BilingualText;
  subtitle: BilingualText;
  cta: BilingualText;
  secondary: BilingualText;
  searchPlaceholder: BilingualText;
  searchButton: BilingualText;
  newArrivalsBadge: BilingualText;
  viewBook: BilingualText;
}

/**
 * Homepage hero-slider configuration, stored in `data/slides.json` and
 * managed from the admin panel (Admin → Slides). An empty `featuredBookIds`
 * falls back to the 3 newest in-stock books; an empty `banners` list falls
 * back to the built-in banner set shipped in `public/hero/`.
 */
export interface SlidesConfig {
  /** Book ids to feature as slides, in display order. */
  featuredBookIds: string[];
  /** Background banner URLs (e.g. `/uploads/…`), cycled across slides. */
  banners: string[];
  /** Autoplay interval in ms. 0 disables autoplay. */
  autoplayMs: number;
  /** Welcome-slide copy and visibility. */
  welcome: SlidesWelcome;
}
