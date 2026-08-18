import { requireAdmin } from "@/lib/admin";

// /admin is the admin entry point — send admins straight to the dashboard.
export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  return {
    redirect: { destination: "/admin/dashboard", permanent: false },
  };
}

export default function AdminIndex() {
  return null;
}
