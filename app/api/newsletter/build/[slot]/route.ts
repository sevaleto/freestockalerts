import { handleBuildRequest } from "@/lib/newsletter/http";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** GET /api/newsletter/build/1 and /2: one slot per invocation (vercel.json crons, admin builds). */
export async function GET(request: Request, ctx: { params: Promise<{ slot: string }> }) {
  const { slot } = await ctx.params;
  return handleBuildRequest(request, slot);
}
