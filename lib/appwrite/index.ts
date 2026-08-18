// Client-side services (browser, session-based auth).
export { client, account, databases, storage } from "@/lib/appwrite/client";

// Server-only admin services (API key). Marked `server-only` — importing this
// barrel from a client component fails the build. Import from
// "@/lib/appwrite/server" directly in API routes / server-side code instead.
export { adminClient, adminDatabases, adminStorage } from "@/lib/appwrite/server";
