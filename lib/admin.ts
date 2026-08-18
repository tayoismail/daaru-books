import type { GetServerSidePropsContext } from "next";
import { getUserFromCookie, toSafeUser } from "@/lib/auth";
import type { User } from "@/types";

/** Admin user as exposed to the client (never includes the password hash). */
export type AdminUser = Omit<User, "password">;

export type AdminGuardResult =
  | { user: AdminUser }
  | { redirect: { destination: string; permanent: false } };

/**
 * Protect an admin page from getServerSideProps. Unauthenticated visitors are
 * sent to /login; logged-in non-admins are sent home. Returns the admin user
 * on success. Usage:
 *
 *   const guard = await requireAdmin(context);
 *   if ("redirect" in guard) return guard;
 */
export async function requireAdmin(
  context: GetServerSidePropsContext
): Promise<AdminGuardResult> {
  const user = await getUserFromCookie(
    context.req as Parameters<typeof getUserFromCookie>[0]
  );
  if (!user) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  if (user.role !== "admin") {
    return { redirect: { destination: "/", permanent: false } };
  }
  // toSafeUser strips the password hash so it never ships in page props.
  return { user: toSafeUser(user) };
}
