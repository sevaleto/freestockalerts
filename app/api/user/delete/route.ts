import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete user data from our DB (cascade will remove alerts, history, prefs, subscriptions)
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {
      // User may not exist in our DB yet (only in Supabase auth)
    });

    return NextResponse.json({ message: "Account deleted" });
  } catch (error) {
    console.error("DELETE /api/user/delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
