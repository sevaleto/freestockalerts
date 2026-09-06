/**
 * Admin gate for the ads area. Admins are the addresses in ADMIN_EMAILS
 * (comma-separated); the defaults are the owner's accounts plus the two
 * people who run sponsorships and email ops, so a missing variable does not
 * lock anyone out. Anyone else gets a 403 from the API
 * and a 404 from the pages, so the area does not advertise itself.
 */
import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";

const DEFAULT_ADMINS = ["manuel@tradingtips.com", "sevaleto@gmail.com", "chelsie@trading-tips.us", "nicole@trading-tips.us"];

export function adminEmails(): string[] {
  const configured = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ADMINS;
}

export const isAdminEmail = (email: string | null | undefined) => !!email && adminEmails().includes(email.trim().toLowerCase());

/** The signed-in user when they are an admin, else null. */
export async function getAdminUser() {
  const user = await getAuthUser();
  return user && isAdminEmail(user.email) ? user : null;
}

/** For admin pages: 404 unless the signed-in user is an admin. Layouts do not re-run on client navigation, so each page calls this. */
export async function requireAdminPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();
  return admin;
}
