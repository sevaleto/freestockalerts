import { requireAdminPage } from "@/lib/auth/admin";
import { LandingPageEditor } from "@/components/admin/LandingPageEditor";
import { strategyOptions } from "@/components/admin/strategyOptions";

export const dynamic = "force-dynamic";

export default async function NewLandingPagePage() {
  await requireAdminPage();
  return <LandingPageEditor mode="create" strategies={strategyOptions()} />;
}
