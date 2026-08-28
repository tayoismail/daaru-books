// Client-side services (browser, session-based auth).
export { client, account, databases, storage } from "@/lib/appwrite/client";

// Server-only admin services (API key). Import from
// "@/lib/appwrite/server" directly in API routes / server-side code instead.
export { adminClient, adminTablesDB, adminStorage } from "@/lib/appwrite/server";
