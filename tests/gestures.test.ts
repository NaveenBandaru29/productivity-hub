import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarPageOffset,
  widgetDropIndex,
} from "../src/hub/gesture-decisions";

test("calendar paging distinguishes taps, flicks, and cancelled swipes", () => {
  assert.equal(calendarPageOffset(12, 900, false), 0);
  assert.equal(calendarPageOffset(32, -800, false), 0);
  assert.equal(calendarPageOffset(-32, -800, false), 1);
  assert.equal(calendarPageOffset(80, 0, false), -1);
  assert.equal(calendarPageOffset(-80, 0, true), 0);
});

test("dashboard drops use measured centers for differently sized widgets", () => {
  const ids = ["list", "shortcuts", "summary"];
  const centers = new Map([
    ["list", 60],
    ["shortcuts", 185],
    ["summary", 260],
  ]);
  assert.equal(widgetDropIndex(ids, centers, 0, 124), 0);
  assert.equal(widgetDropIndex(ids, centers, 0, 130), 1);
  assert.equal(widgetDropIndex(ids, centers, 2, -250), 0);
  assert.equal(widgetDropIndex(ids, new Map(), 1, 200), 1);
});
