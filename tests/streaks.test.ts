import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, dayStatuses, localDay } from "../lib/streaks.ts";

test("no resets: one running streak from join day", () => {
  const s = summarize("2026-10-01", [], "2026-10-11");
  assert.deepEqual(s.current, { start: "2026-10-01", end: null, days: 10 });
  assert.equal(s.best, s.current);
  assert.equal(s.streaks.length, 1);
});

test("resets split streaks; ended vs running", () => {
  const s = summarize("2026-10-01", ["2026-10-05", "2026-10-07"], "2026-10-10");
  assert.deepEqual(s.streaks, [
    { start: "2026-10-07", end: null, days: 3 },
    { start: "2026-10-05", end: "2026-10-07", days: 2 },
    { start: "2026-10-01", end: "2026-10-05", days: 4 },
  ]);
  assert.deepEqual(s.best, { start: "2026-10-01", end: "2026-10-05", days: 4 });
  assert.equal(s.resetCount, 2);
});

test("reset today: current is 0 and still listed", () => {
  const s = summarize("2026-10-01", ["2026-10-10"], "2026-10-10");
  assert.equal(s.current.days, 0);
  assert.equal(s.current.end, null);
  assert.equal(s.streaks[0], s.current);
});

test("reset on join day and back-to-back days drop zero-length ended streaks", () => {
  const s = summarize("2026-10-01", ["2026-10-01", "2026-10-03", "2026-10-04"], "2026-10-06");
  assert.deepEqual(s.streaks.map((x) => x.days), [2, 1, 2]);
});

test("tie for best prefers the running streak", () => {
  const s = summarize("2026-10-01", ["2026-10-04"], "2026-10-07");
  assert.equal(s.best.end, null);
});

test("dayStatuses marks before/clean/reset/future", () => {
  const d = dayStatuses("2026-10-02", ["2026-10-03"], "2026-10-04", "2026-10-01", "2026-10-05");
  assert.deepEqual(d.map((x) => x.status), ["before", "clean", "reset", "clean", "future"]);
});

test("localDay respects timezone", () => {
  assert.equal(localDay("2026-10-16T22:30:00Z", "Asia/Jerusalem"), "2026-10-17");
  assert.equal(localDay("2026-10-16T22:30:00Z", "UTC"), "2026-10-16");
});
