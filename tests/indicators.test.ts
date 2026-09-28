import { test } from "node:test";
import assert from "node:assert/strict";
import { averageVolume, rsiSeries, sma } from "../lib/marketData/indicators";
import { avgVolumeFromBars, rsiSnapshotFromBars, smaSnapshotFromBars } from "../lib/marketData/technicals";
import type { DailyBarTD } from "../lib/api/twelveData";

// StockCharts ChartSchool RSI worked example (14-period Wilder smoothing), full-precision closes from their spreadsheet.
const CLOSES = [
  44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826, 45.8931, 46.0328, 45.614, 46.282, 46.282, 46.0028, 46.0328, 46.4116,
  46.2222, 45.6439, 46.2122, 46.2521, 45.7137, 46.4515, 45.7835, 45.3548, 44.0288, 44.1783, 44.2181, 44.5672, 43.4205, 42.6628, 43.1314,
];
const EXPECTED_FROM_INDEX_14 = [70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38, 54.71, 50.42, 39.99, 41.46, 41.87, 45.46, 37.3, 33.08, 37.77];

const bars = (closes: number[], start = "2026-01-01", volume = 1_000): DailyBarTD[] =>
  closes.map((close, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), open: close, high: close, low: close, close, volume };
  });

test("rsiSeries matches the StockCharts worked example", () => {
  const series = rsiSeries(CLOSES, 14);
  for (let i = 0; i < 14; i++) assert.equal(series[i], null, `index ${i} should have no RSI yet`);
  EXPECTED_FROM_INDEX_14.forEach((want, k) => {
    const got = series[14 + k]!;
    assert.ok(Math.abs(got - want) < 0.05, `RSI at index ${14 + k}: got ${got.toFixed(2)}, want ${want}`);
  });
});

test("rsiSeries edge cases: too little history, flat and one-way series", () => {
  assert.deepEqual(rsiSeries([1, 2, 3], 14), [null, null, null]);
  assert.equal(rsiSeries(Array(20).fill(10), 14).at(-1), 50);
  assert.equal(rsiSeries(Array.from({ length: 20 }, (_, i) => 10 + i), 14).at(-1), 100);
  assert.equal(rsiSeries(Array.from({ length: 20 }, (_, i) => 30 - i), 14).at(-1), 0);
});

test("sma averages the last N values and refuses short input", () => {
  assert.equal(sma([1, 2, 3, 4, 5], 5), 3);
  assert.equal(sma([1, 2, 3, 4, 5], 2), 4.5);
  assert.equal(sma([1, 2], 3), null);
  assert.equal(sma([1, 2, 3], 0), null);
});

test("averageVolume ignores zero and missing volumes", () => {
  assert.equal(averageVolume([0, 100, 200, 0, 300], 5), 200);
  assert.equal(averageVolume([0, 0], 2), null);
  assert.equal(averageVolume([10, 20, 30, 40], 2), 35);
});

test("rsiSnapshotFromBars returns today's and yesterday's RSI and the newest date", () => {
  const snap = rsiSnapshotFromBars("xyz", bars(CLOSES), 14)!;
  assert.equal(snap.ticker, "XYZ");
  assert.ok(Math.abs(snap.rsi - 37.77) < 0.05);
  assert.ok(Math.abs(snap.previousRsi! - 33.08) < 0.05);
  assert.equal(snap.date, bars(CLOSES).at(-1)!.date);
  assert.equal(rsiSnapshotFromBars("xyz", bars([1, 2, 3]), 14), null);
});

test("smaSnapshotFromBars exposes the prior session so a cross can be detected", () => {
  const snap = smaSnapshotFromBars("abc", bars([10, 10, 10, 10, 20]), 4)!;
  assert.equal(snap.sma, 12.5);
  assert.equal(snap.close, 20);
  assert.equal(snap.previousSma, 10);
  assert.equal(snap.previousClose, 10);
  assert.equal(smaSnapshotFromBars("abc", bars([1, 2]), 4), null);
});

test("avgVolumeFromBars leaves out today's forming bar", () => {
  const b = bars([1, 1, 1, 1], "2026-09-25");
  b.forEach((x, i) => (x.volume = [100, 100, 100, 5_000][i]));
  // Newest bar is 2026-09-28; at 11:00 New York time that day it is still forming.
  assert.equal(avgVolumeFromBars(b, new Date("2026-09-28T15:00:00Z"), 30), 100);
  // The next morning it is a completed session and counts.
  assert.equal(avgVolumeFromBars(b, new Date("2026-09-29T15:00:00Z"), 30), 1325);
});
