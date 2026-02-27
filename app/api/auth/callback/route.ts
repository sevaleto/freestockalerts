import { NextResponse } from "next/server";

export async function GET() {
  // TODO: Replace with Supabase auth callback handling.
  return NextResponse.redirect(new URL("/dashboard", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}
