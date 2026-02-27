import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Upsert: create default preferences if they don't exist
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    return NextResponse.json({ data: prefs });
  } catch (error) {
    console.error("GET /api/user/preferences error:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof payload.emailAlerts === "boolean")
    data.emailAlerts = payload.emailAlerts;
  if (typeof payload.dailyDigest === "boolean")
    data.dailyDigest = payload.dailyDigest;
  if (typeof payload.digestTime === "string")
    data.digestTime = payload.digestTime;
  if (typeof payload.timezone === "string") data.timezone = payload.timezone;
  if (typeof payload.marketOpenReminder === "boolean")
    data.marketOpenReminder = payload.marketOpenReminder;
  if (typeof payload.marketCloseReminder === "boolean")
    data.marketCloseReminder = payload.marketCloseReminder;

  try {
    const prefs = await prisma.userPreferences.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return NextResponse.json({ data: prefs });
  } catch (error) {
    console.error("PATCH /api/user/preferences error:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
