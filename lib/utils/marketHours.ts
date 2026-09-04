import { addDays, getDay, set } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const MARKET_TIMEZONE = "America/New_York";

export const isMarketOpen = (date = new Date()) => {
  const et = toZonedTime(date, MARKET_TIMEZONE);
  const day = getDay(et);
  if (day === 0 || day === 6) return false;
  const open = set(et, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 });
  const close = set(et, { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 });
  return et >= open && et <= close;
};

export const getNextMarketOpen = (date = new Date()) => {
  let cursor = toZonedTime(date, MARKET_TIMEZONE);
  for (let i = 0; i < 7; i += 1) {
    const day = getDay(cursor);
    const open = set(cursor, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 });
    if (day !== 0 && day !== 6 && cursor <= open) {
      return open;
    }
    cursor = addDays(cursor, 1);
  }
  return set(cursor, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 });
};

export const getNextMarketClose = (date = new Date()) => {
  let cursor = toZonedTime(date, MARKET_TIMEZONE);
  for (let i = 0; i < 7; i += 1) {
    const day = getDay(cursor);
    const close = set(cursor, { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 });
    if (day !== 0 && day !== 6 && cursor <= close) {
      return close;
    }
    cursor = addDays(cursor, 1);
  }
  return set(cursor, { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 });
};

export const MARKET_TIMEZONE_LABEL = MARKET_TIMEZONE;

/**
 * Calendar-day key (YYYY-MM-DD) in US market time. Two timestamps with the
 * same key fall on the same trading day in New York.
 */
export const marketDayKey = (date = new Date()) => {
  const et = toZonedTime(date, MARKET_TIMEZONE);
  const y = et.getFullYear();
  const m = String(et.getMonth() + 1).padStart(2, "0");
  const d = String(et.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const isSameMarketDay = (a: Date, b: Date) =>
  marketDayKey(a) === marketDayKey(b);
