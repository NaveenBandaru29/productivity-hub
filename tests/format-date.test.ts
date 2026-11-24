import test from "node:test";
import assert from "node:assert/strict";
import { formatDate } from "../src/hub/format-date";

test("local dates use two-digit days, English month abbreviations and four-digit years", () => {
  assert.equal(formatDate("2024-02-29"), "29-Feb-2024");
  assert.equal(formatDate("2026-09-01"), "01-Sep-2026");
  assert.equal(formatDate(new Date(2026, 0, 3, 0, 1)), "03-Jan-2026");
});
