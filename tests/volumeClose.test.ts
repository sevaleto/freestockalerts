import { test } from "node:test";
import assert from "node:assert/strict";
import { lastSessionVolumeFromBars, sessionCloseUtc, MIN_FULL_MARKET_SHARE } from "../lib/marketData/technicals";
import { volumeSpikeFromSession } from "../lib/alerts/evaluator";
import { watchlistMetric } from "../lib/lp/watchlistMetric";
import { notificationFrequencyCopy } from "../lib/alerts/frequency";
import type { DailyBarTD } from "../lib/api/twelveData";

/** 31 completed sessions at 1M shares ending 2026-09-25, then a final bar dated `lastDate`. */
function history(lastDate: string, lastVolume: number, lastClose = 110): DailyBarTD[] {
  const out: DailyBarTD[] = [];
  const d = new Date("2026-09-25T00:00:00Z");
  while (out.length < 31) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.unshift({ date: d.toISOString().slice(0, 10), open: 100, high: 100, low: 100, close: 100, volume: 1_000_000 });
    d.setUTCDate(d.getUTCDate() - 1);
  }
  out.push({ date: lastDate, open: 100, high: 110, low: 100, close: lastClose, volume: lastVolume });
  return out;
}

test("during the session today's forming bar is skipped and the previous session is judged", () => {
  const bars = history("2026-09-28", 30_000); // venue-sample volume at 1:30 pm
  const s = lastSessionVolumeFromBars(bars, new Date("2026-09-28T17:30:00Z"))!; // 1:30 pm EDT
  assert.equal(s.date, "2026-09-25");
  assert.equal(s.volume, 1_000_000);
  assert.equal(s.finalized, true);
});

test("after 4:15 pm the completed bar for today is judged against the 30 sessions before it", () => {
  const bars = history("2026-09-28", 3_000_000);
  const s = lastSessionVolumeFromBars(bars, new Date("2026-09-28T22:15:00Z"))!; // 6:15 pm EDT
  assert.equal(s.date, "2026-09-28");
  assert.equal(s.avgVolume, 1_000_000, "the session itself is not in its own average");
  assert.equal(s.ratio, 3);
  assert.equal(s.close, 110);
  assert.equal(s.previousClose, 100);
  assert.equal(s.finalized, true);
});

test("a completed bar still carrying the venue sample is not finalized", () => {
  const venue = Math.floor(1_000_000 * MIN_FULL_MARKET_SHARE) - 1;
  const s = lastSessionVolumeFromBars(history("2026-09-28", venue), new Date("2026-09-28T22:15:00Z"))!;
  assert.equal(s.date, "2026-09-28");
  assert.equal(s.finalized, false);
});

test("a morning catch-up run judges the previous session", () => {
  const s = lastSessionVolumeFromBars(history("2026-09-28", 2_500_000), new Date("2026-09-29T12:30:00Z"))!; // 8:30 am EDT next day
  assert.equal(s.date, "2026-09-28");
  assert.equal(s.ratio, 2.5);
});

test("sessionCloseUtc is 4 pm New York in both daylight and standard time", () => {
  assert.equal(sessionCloseUtc("2026-09-28").toISOString(), "2026-09-28T20:00:00.000Z");
  assert.equal(sessionCloseUtc("2026-12-01").toISOString(), "2026-12-01T21:00:00.000Z");
});

test("volumeSpikeFromSession fires only on a finalized session at or above the threshold", () => {
  const base = { date: "2026-09-28", volume: 3_000_000, avgVolume: 1_000_000, ratio: 3, close: 110, previousClose: 100, finalized: true };
  const fired = volumeSpikeFromSession({ id: "a1", triggerValue: 2 }, base);
  assert.equal(fired.triggered, true);
  assert.equal(fired.priceAtTrigger, 110);
  assert.equal(fired.sessionDate, "2026-09-28");
  assert.match(fired.reason!, /3\.0x its 30-session average on 2026-09-28/);

  assert.equal(volumeSpikeFromSession({ id: "a2", triggerValue: 4 }, base).triggered, false);
  const pending = volumeSpikeFromSession({ id: "a3", triggerValue: 0.01 }, { ...base, volume: 30_000, ratio: 0.03, finalized: false });
  assert.equal(pending.triggered, false);
  assert.match(pending.reason!, /not published yet/);
  assert.equal(volumeSpikeFromSession({ id: "a4", triggerValue: 2 }, null).reason, "Daily bars unavailable");
});

test("landing-page volume rows say when the numbers are from the last session", () => {
  const item = { ticker: "XYZ", alertType: "VOLUME_SPIKE", triggerValue: 2, triggerDirection: "ABOVE" } as never;
  assert.deepEqual(watchlistMetric(item, { price: 10, changePercent: 0, volume: 3e6, avgVolume: 1e6, volumeFromLastSession: true }), { label: "3.0x avg volume last session", met: true });
  assert.equal(watchlistMetric(item, { price: 10, changePercent: 0, volumeFromLastSession: true }), null);
});

test("volume-spike frequency copy explains the post-close check", () => {
  assert.match(notificationFrequencyCopy("VOLUME_SPIKE"), /after each close/);
  assert.match(notificationFrequencyCopy("PERCENT_CHANGE_DAY"), /at most one email per trading day/);
});
