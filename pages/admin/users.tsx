import Head from "next/head";
import { useTranslation } from "react-i18next";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPlaceholder from "@/components/admin/AdminPlaceholder";
import { requireAdmin, type AdminUser } from "@/lib/admin";

export async function getServerSideProps(
  context: Parameters<typeof requireAdmin>[0]
) {
  const guard = await requireAdmin(context);
  if ("redirect" in guard) return guard;
  return { props: { user: guard.user } };
}

export default function AdminUsers({ user }: { user: AdminUser }) {
  const { t } = useTranslation();
  return (
    <AdminLayout user={user}>
      <Head>
        <title>
          {t("admin.titles.users")} — {t("appName")}
        </title>
        <meta name="robots" content="noindex" />
      </Head>
      <AdminPlaceholder icon={faUsers} title={t("admin.titles.users")} />
    </AdminLayout>
  );
}
