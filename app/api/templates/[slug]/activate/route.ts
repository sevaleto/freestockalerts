import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import {
  activateTemplateForUser,
  AlertLimitError,
  TemplateNotFoundError,
} from "@/lib/templates/activate";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ slug: string }>;
}

/** POST /api/templates/[slug]/activate — subscribe + create the template's alerts for the session user. */
export async function POST(_: Request, props: RouteProps) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await props.params;
  try {
    const result = await activateTemplateForUser(user.id, slug);
    return NextResponse.json({
      data: {
        templateId: result.template.id,
        templateName: result.template.name,
        created: result.created,
        alreadyActive: result.alreadyActive,
        alertCount: result.alerts.length,
      },
    });
  } catch (err) {
    if (err instanceof TemplateNotFoundError) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    if (err instanceof AlertLimitError) {
      return NextResponse.json(
        { error: `You've reached the ${err.limit}-alert limit. Delete a few alerts and try again.` },
        { status: 409 }
      );
    }
    console.error(`[activate] ${slug}:`, err);
    return NextResponse.json({ error: "Failed to activate template" }, { status: 500 });
  }
}
