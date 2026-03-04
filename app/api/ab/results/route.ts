import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

/**
 * GET /api/ab/results
 *
 * Returns A/B test signup counts by variant.
 * Protected by a simple secret query param.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // Simple auth — replace with env var if needed
  if (secret !== process.env.AB_RESULTS_SECRET && secret !== "fsa2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await prisma.user.groupBy({
    by: ["signupVariant"],
    _count: { id: true },
    where: {
      signupVariant: { not: null },
    },
    orderBy: { _count: { id: "desc" } },
  });

  // Also get total users without variant (signed up before test)
  const noVariant = await prisma.user.count({
    where: { signupVariant: null },
  });

  // Get signups per day per variant for trend
  const daily = await prisma.$queryRaw`
    SELECT
      DATE("createdAt") as date,
      "signupVariant" as variant,
      COUNT(*)::int as signups
    FROM "User"
    WHERE "signupVariant" IS NOT NULL
    GROUP BY DATE("createdAt"), "signupVariant"
    ORDER BY date DESC
    LIMIT 60
  ` as any[];

  const variantData = results.map((r) => ({
    variant: r.signupVariant,
    signups: r._count.id,
  }));

  const total = variantData.reduce((sum, v) => sum + v.signups, 0);

  return NextResponse.json({
    test: "hero_headline",
    variants: variantData,
    totalTracked: total,
    preTestUsers: noVariant,
    daily,
    tip: "Run for at least 100 signups per variant before picking a winner. Look for 10%+ difference to be confident.",
  });
}
