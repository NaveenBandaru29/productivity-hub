import test from "node:test";
import assert from "node:assert/strict";
import { accentColors, contrast } from "../src/hub/accent";

test("accent fills keep the exact choice, with readable labels and surface text in both themes", () => {
  for (const dark of [false, true]) {
    for (const hex of [
      "#316C56",
      "#5856D6",
      "#F6C744",
      "#000000",
      "#FFFFFF",
      "#777777",
    ]) {
      const colors = accentColors(hex, dark);
      assert.equal(colors.accentFill, hex);
      assert.ok(contrast(colors.onAccent, hex) >= 4.5);
      for (const bg of [colors.bg, colors.surface, colors.wash]) {
        assert.ok(contrast(colors.accent, bg) >= 4.5, hex + " on " + bg);
      }
    }
    assert.notEqual(
      accentColors("#5856D6", dark).wash,
      accentColors("#316C56", dark).wash,
    );
  }
});

test("changing the accent repaints the dark navigation and card surfaces", () => {
  const forest = accentColors("#316C56", true);
  const indigo = accentColors("#5856D6", true);
  const neutral = accentColors("#888888", true);
  for (const key of ["bg", "surface", "border", "wash"] as const) {
    assert.notEqual(indigo[key], forest[key]);
    assert.notEqual(indigo[key], neutral[key]);
  }
  assert.ok(contrast(indigo.fg, indigo.surface) >= 4.5);
  assert.ok(contrast(indigo.muted, indigo.surface) >= 4.5);
});
