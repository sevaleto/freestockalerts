import { NextResponse } from "next/server";
import { mockAlertHistory } from "@/lib/mock/alerts";

export async function POST() {
  // TODO: Replace with cron evaluation logic and email sending.
  return NextResponse.json({
    message: "Alert check completed (mock)",
    triggered: mockAlertHistory.length,
  });
}
