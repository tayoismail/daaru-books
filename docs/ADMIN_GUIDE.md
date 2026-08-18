# Daaru Books — Admin Onboarding Guide

Welcome to the Daaru Books admin panel. This guide walks you through every feature so you can manage your bookstore confidently from day one.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Managing Books](#3-managing-books)
4. [Managing Categories](#4-managing-categories)
5. [Processing Orders](#5-processing-orders)
6. [Tracking Payments](#6-tracking-payments)
7. [Recording Expenses](#7-recording-expenses)
8. [Handling Refunds](#8-handling-refunds)
9. [Viewing Reports (P&L)](#9-viewing-reports)
10. [Managing Inventory](#10-managing-inventory)
11. [Customer Management](#11-customer-management)
12. [Store Settings](#12-store-settings)
13. [Managing Testimonials](#13-managing-testimonials)
14. [Hero Slides & Homepage](#14-hero-slides--homepage)
15. [Daily/Weekly Routine](#15-dailyweekly-routine)

---

## 1. Logging In

1. Go to your store URL followed by `/login` (e.g. `https://yourstore.com/login`)
2. Enter your **email** and **password**
3. You'll be redirected to the admin dashboard

**First time?** If you don't have an account yet, go to `/signup` to create one. The first user should be created as an admin.

> **Tip:** Bookmark the login page for quick access. The admin panel is only accessible to users with the `admin` role.

---

## 2. Dashboard Overview

The dashboard is your financial command center. It shows everything at a glance.

### Period Selector
At the top of the dashboard, choose a time period:
- **This Month** — current month only
- **3m / 6m / 12m** — last 3, 6, or 12 months
- **All** — entire history
- **Custom** — pick your own date range using the From/To fields

### Stat Cards
| Card | What It Means |
|------|---------------|
| **Total Books** | Number of titles in your catalog |
| **Total Orders** | Orders placed in the selected period |
| **Revenue** | Money from delivered orders, minus refunds of those orders |
| **Cash Received** | Money actually paid (includes pending delivery orders) |
| **Gross Profit** | Revenue minus cost of goods sold (COGS) |
| **Net Profit** | Gross profit minus expenses and other refunds |

Each card shows a **delta %** comparing the current period to the previous period of equal length.

### Charts
- **Monthly Bar Chart** — Revenue, expenses, and refunds month by month
- **Cash Flow Bar Chart** — Cash in (payments received) vs cash out (expenses + refunds)
- **Expense Breakdown** — Doughnut chart showing spending by category

### Payments Panel
Shows your receivables and cash position:
- **Received** — total paid orders
- **Cash Out** — expenses + refunds
- **Net Cash** — received minus cash out
- **Unpaid** — count and total of orders awaiting payment
- **Failed** — count and total of failed payments
- **Refunded** — total refunds issued

### Recent Orders
The last 5 orders with status badges. Click any row to open the order detail modal.

### Low Stock Alert
Books with 5 or fewer copies remaining. Restock these before they sell out.

---

## 3. Managing Books

Navigate to **Admin → Books** to see your full catalog.

### Adding a New Book
1. Click the **Add Book** button
2. Fill in the fields:
   - **Title (English)** — required
   - **Title (Arabic)** — optional, for bilingual display
   - **Author** — required
   - **ISBN** — unique identifier
   - **SKU** — optional merchant stock-keeping unit
   - **Price** — selling price in ₦ (required)
   - **Original Price** — optional, for showing discount badges (e.g. "was ₦8,000, now ₦6,000")
   - **Cost Price** — what you pay per copy (used for profit calculations)
   - **Quantity** — number of copies in stock
   - **Category** — dropdown of your categories
   - **Description (English/Arabic)** — product description
   - **Image URL** — cover image path
   - **Rating** — 0–5 average rating
3. Click **Save**

### Editing a Book
- Click the **pencil icon** on any book row
- Modify the fields and save

### Deleting a Book
- Click the **trash icon** on any book row
- Confirm the deletion

### Understanding Cost Price
The **cost** field is critical for your profit reports:
- It represents what you pay the publisher/supplier per copy
- The app calculates **Gross Profit** as: `Revenue - (Cost × Quantity sold)`
- Always keep this updated when your supplier prices change

### CSV Export
Click the **Export CSV** button to download your book catalog as a spreadsheet.

---

## 4. Managing Categories

Navigate to **Admin → Categories**.

### Adding a Category
1. Click **Add Category**
2. Enter the category name in English and Arabic
3. Save

### Editing/Deleting
- Use the pencil or trash icons on each category row

> **Note:** Books are assigned to categories. Deleting a category doesn't delete the books — they just become uncategorized.

---

## 5. Processing Orders

Navigate to **Admin → Orders** to see all customer orders.

### Understanding Order Statuses

| Status | Meaning |
|--------|---------|
| **Pending** | Order placed, awaiting payment |
| **Processing** | Payment received, preparing for shipment |
| **Shipped** | Package sent to customer |
| **Delivered** | Customer received the order |
| **Cancelled** | Order cancelled (auto-refunds if paid) |

### Understanding Payment Statuses

| Status | Meaning |
|--------|---------|
| **Unpaid** | Customer hasn't paid yet |
| **Paid** | Payment confirmed |
| **Failed** | Payment attempt failed |

### Viewing an Order
1. Click any order row or the **eye icon**
2. The modal shows:
   - Order reference number
   - Status and payment badges
   - Payment method (card, bank transfer, etc.)
   - List of items with quantities and prices
   - Customer details (name, email, phone, address)
   - Order date and total

### Updating an Order
In the order detail modal:
1. **Change status** — e.g. mark as "Shipped" when you send the package
2. **Add tracking number** — enter the courier tracking reference
3. **Set delivery fee** — if you charge for delivery, add it here
4. **Mark as paid** — for bank transfer orders where the customer paid outside the app

> **Important:** When you mark an order as "Paid," the system automatically reduces your book stock. When you cancel a paid order, the system automatically creates a refund and returns the stock.

### Filtering Orders
Use the filter bar to narrow results:
- **Search** by customer name or email
- **Filter by status** (pending, processing, shipped, delivered, cancelled)
- **Filter by payment** (unpaid, paid, failed)
- **Date range** — from/to date pickers

### CSV Export
Click **Export CSV** to download the currently filtered orders as a spreadsheet — perfect for your accountant.

---

## 6. Tracking Payments

Payments are handled through **Flutterwave**. Here's the flow:

1. **Customer places order** → Flutterwave payment modal opens
2. **Customer pays** → Flutterwave sends a webhook to your app
3. **Webhook settles the order** → stock is reduced, payment marked as paid
4. **If webhook fails** → the Order Success page automatically verifies and settles

### Manual Payment (Bank Transfer)
If a customer pays via bank transfer:
1. Go to **Admin → Orders**
2. Find the order (status: pending, payment: unpaid)
3. Open the order detail modal
4. Change **Payment Status** to "Paid"
5. The system will reduce stock automatically

### Payment Methods
The system records how the customer paid: card, bank transfer, USSD, etc. This appears in the order detail modal and helps you reconcile.

---

## 7. Recording Expenses

Navigate to **Admin → Expenses** to track your business costs.

### Adding an Expense
1. Fill in the form on the left:
   - **Category** — select from the dropdown (e.g. Rent, Utilities, Marketing)
   - **Description** — what the expense was for
   - **Amount** — cost in ₦
   - **Date** — when the expense was incurred
2. Click **Add Expense**

### Default Categories
- Cost of Goods (stock purchases)
- Utilities (electricity, internet)
- Rent
- Salaries & Wages
- Shipping & Delivery
- Packaging
- Marketing & Ads
- Bank & Payment Fees
- Software & Subscriptions
- Other

### Adding Custom Categories
You can create your own categories from the admin interface. Any non-empty name is accepted.

### Editing/Deleting Expenses
- Click the **pencil icon** to edit
- Click the **trash icon** to delete (with confirmation)

### Period Filtering
Use the period buttons (This Month, 3m, 6m, 12m, All) to filter expenses by date.

### Summary Cards
The top of the page shows total expenses and per-category breakdowns with icons.

### CSV Export
Click **Export CSV** to download all expenses as a spreadsheet.

---

## 8. Handling Refunds

Navigate to **Admin → Refunds** to manage customer refunds.

### When to Issue a Refund
- Customer returned a book (damaged, wrong item, etc.)
- Order was cancelled after payment
- Duplicate charge

### Recording a Refund
1. Click **Record Refund**
2. Select the order from the dropdown
3. Enter:
   - **Amount** — how much to refund (cannot exceed remaining refundable amount)
   - **Reason** — why the refund is being issued
   - **Date** — when the refund was issued (defaults to today)
4. Confirm

### What Happens Automatically
When you record a refund:
- ✅ The refund amount is deducted from your revenue in reports
- ✅ Books are **proportionally returned to stock** (if applicable)
- ✅ The cost of goods is **reversed from your COGS** (so profit reports stay accurate)
- ✅ An inventory log entry is created for the restock

### Deleting a Refund
If you recorded a refund by mistake:
1. Click the **trash icon** on the refund
2. The system **reverses everything**: stock is removed again, COGS is restored

### Auto-Refunds on Cancellation
When you cancel a paid order, the system **automatically creates a refund** for the remaining amount. You don't need to do this manually.

---

## 9. Viewing Reports

Navigate to **Admin → Report** for your formal Profit & Loss statement.

### P&L Statement

| Line | What It Shows |
|------|---------------|
| **Revenue** | Total from delivered orders, minus refunds of delivered orders |
| **Cost of Goods Sold** | What you paid for the books that were sold |
| **Gross Profit** | Revenue − COGS (with margin %) |
| **Refunds (Cancelled Orders)** | Refunds of orders that were never delivered — a direct charge |
| **Expenses** | All recorded expenses in the period |
| **Net Profit** | Gross Profit − Refunds (cancelled) − Expenses |

### Receivables Panel
Shows money owed to you:
- Unpaid order count and total
- Failed payment count and total
- Cash out (expenses + refunds)
- Cash received
- Net cash position

### Expense Breakdown
A doughnut chart showing your spending by category, plus a list with exact amounts.

### Refunds in Period
A table showing all refunds issued during the selected period, with order reference, reason, and amount.

---

## 10. Managing Inventory

Navigate to **Admin → Inventory** to see your stock movement history.

### Understanding the Log
Every stock change is recorded:
- **Date** — when the change happened
- **Book** — which book was affected
- **Change** — +number (restock) or −number (sale/return)
- **Reason** — why the change happened (e.g. "Paid order ORDER-123", "Refund ORDER-456", "Admin update")

### Summary Cards
- **Entries** — total number of stock movements
- **Added** — total copies added to stock
- **Removed** — total copies removed from stock

### Filtering
- **Search** — find entries by book title or reason text
- **Filter by book** — dropdown to show only one book's history

### When Stock Changes
Stock automatically changes when:
- A paid order is settled (stock reduced)
- A refund is recorded (stock increased proportionally)
- A refund is deleted (stock reduced again)
- You manually update a book's quantity

---

## 11. Customer Management

Navigate to **Admin → Customers** to see aggregated customer data.

### What's Shown
- **Name** — customer's name (from their most recent order)
- **Email** — grouped by email address
- **Phone** — contact number
- **Orders** — total non-cancelled orders
- **Total Spent** — sum of paid order totals
- **Last Order** — date of most recent order

### Summary Cards
- Total customers
- Total orders across all customers
- Total revenue from all customers

### Search
Filter customers by name, email, or phone number.

> **Note:** Customers are automatically derived from orders — you don't need to add them manually. Even guest checkout customers appear here.

---

## 12. Store Settings

Navigate to **Admin → Settings** to configure your store.

### Store Branding
- **Store Name** — your business name (English and Arabic)
- **Contact Email** — shown in footer and contact page
- **Contact Phone** — shown in footer and contact page
- **WhatsApp Number** — for the floating WhatsApp button (international format, e.g. 2349059806656)
- **Physical Address** — shown in footer and contact page

---

## 13. Managing Testimonials

Navigate to **Admin → Testimonials**.

### Adding a Review
1. Click **Add Testimonial**
2. Enter:
   - **Name** — reviewer's name
   - **Handle** — social media handle or identifier
   - **Review (English/Arabic)** — the review text
   - **Rating** — 1–5 stars
   - **Avatar URL** — optional profile picture
3. Save

### Editing/Deleting
Use the pencil or trash icons on each row.

---

## 14. Hero Slides & Homepage

Navigate to **Admin → Slides** to customize your homepage hero section.

### Featured Books
- Select which books appear as hero slides
- Drag to reorder

### Welcome Slide
- Toggle the welcome slide on/off
- Customize: badge text, title, subtitle, CTA button text, search placeholder
- All fields support English and Arabic

### Banners
- Upload custom banner images for slide backgrounds
- If none uploaded, the default Islamic-themed banners are used

### Autoplay
- Set the interval between slide transitions (in milliseconds)
- Set to 0 to disable autoplay

---

## 15. Daily/Weekly Routine

### Every Morning (5 minutes)
1. **Check the dashboard** — look at unpaid orders and low stock
2. **Process pending orders** — update status for any orders ready to ship

### Weekly (15 minutes)
1. **Record expenses** — enter any bills paid during the week
2. **Check inventory** — restock any low-stock books
3. **Review refunds** — ensure any returned books are processed

### Monthly (30 minutes)
1. **Review the P&L report** — check your net profit and margin
2. **Export CSVs** — download orders and expenses for your accountant
3. **Update cost prices** — if supplier prices changed, update the cost field on affected books
4. **Review customer list** — identify your top customers

### When an Order Comes In
1. Customer places order → you see it in **Admin → Orders** (status: pending)
2. Customer pays → status changes to processing automatically
3. Pack and ship → update status to "Shipped", add tracking number
4. Customer receives → update status to "Delivered"
5. Revenue is now recognized in your reports

### When a Customer Returns a Book
1. Go to **Admin → Refunds**
2. Record the refund with reason
3. Stock is automatically returned
4. Reports update automatically

---

## Quick Reference: Where to Find Things

| I want to... | Go to... |
|--------------|----------|
| See my sales and profit | Dashboard or Report |
| Process an order | Orders |
| Add a new book | Books → Add Book |
| Record a bill I paid | Expenses → Add Expense |
| Refund a customer | Refunds → Record Refund |
| Check stock levels | Inventory |
| See who my best customers are | Customers |
| Change store name/logo | Settings |
| Customize the homepage | Slides |
| Add a customer review | Testimonials |

---

## Need Help?

- **WhatsApp button** — customers can reach you via the floating button on the storefront
- **Contact page** — `/contact` on the storefront sends messages to your inbox
- **Documentation** — see `docs/WORKFLOW.md` for the complete technical workflow
