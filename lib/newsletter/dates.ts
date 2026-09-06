/**
 * Calendar-day helpers in the publication's timezone. Everything in the
 * pipeline keys on a `YYYY-MM-DD` string in America/Los_Angeles; the cron's
 * UTC hour never leaks into the date math.
 */
import { NEWSLETTER } from "./config";

export type DateKey = string;

const partsFormatter = new Intl.DateTimeFormat("en-US", { timeZone: NEWSLETTER.timezone, year: "numeric", month: "2-digit", day: "2-digit" });

/** The calendar date in Pacific time for an instant. */
export function pacificDateKey(d: Date): DateKey {
  const parts = partsFormatter.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Shape and calendar validity ("2026-02-30" is rejected, not rolled into March). */
export const isDateKey = (s: unknown): s is DateKey => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && shiftDateKey(s, 0) === s;

/** Add days to a date key; pure calendar arithmetic, no timezone involved. */
export function shiftDateKey(key: DateKey, days: number): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const yesterdayPacific = (d: Date): DateKey => shiftDateKey(pacificDateKey(d), -1);

/** 0 = Sunday … 6 = Saturday, for the calendar day itself. */
export const dateKeyWeekday = (key: DateKey) => new Date(`${key}T00:00:00Z`).getUTCDay();

/** "09/05/2026", the form used in The Smart Investor post titles and the report. */
export function toMMDDYYYY(key: DateKey): string {
  const [y, m, d] = key.split("-");
  return `${m}/${d}/${y}`;
}

/** "Sep 5" for subject lines and headings. */
export function shortDate(key: DateKey): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const etParts = new Intl.DateTimeFormat("en-US", { timeZone: NEWSLETTER.marketTimezone, hour: "2-digit", minute: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" });

/** Minutes since midnight in New York for an instant. */
export function easternMinutes(d: Date): number {
  const parts = etParts.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return (get("hour") % 24) * 60 + get("minute");
}

/** The calendar date in New York for an instant. */
export function easternDateKey(d: Date): DateKey {
  const parts = etParts.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "Friday, September 4" for headlines and prompts. */
export function longDate(key: DateKey): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
