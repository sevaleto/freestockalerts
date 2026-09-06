import { AdEditor } from "@/components/admin/AdEditor";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function NewAdPage() {
  await requireAdminPage();
  return <AdEditor mode="create" />;
}
