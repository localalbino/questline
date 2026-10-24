// @vitest-environment node

import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { levelForXp, xpForLevel, xpForTimeToBeat } from "@/lib/experience";

describe("xpForTimeToBeat", () => {
  test("awards 10 XP per hour", () => {
    assert.equal(xpForTimeToBeat(100 * 3600), 1000);
    assert.equal(xpForTimeToBeat(90 * 60), 15);
  });

  test("awards nothing without time to beat data", () => {
    assert.equal(xpForTimeToBeat(null), null);
  });
});

describe("levels", () => {
  test("starts at level 1", () => {
    assert.equal(xpForLevel(1), 0);
    assert.equal(levelForXp(0), 1);
    assert.equal(levelForXp(99), 1);
  });

  test("levels up exactly at each threshold", () => {
    for (let level = 1; level <= 200; level++) {
      assert.equal(levelForXp(xpForLevel(level)), level);
      assert.equal(levelForXp(xpForLevel(level) - 1), Math.max(1, level - 1));
    }
  });

  test("a 100-hour game alone reaches level 4", () => {
    assert.equal(levelForXp(xpForTimeToBeat(100 * 3600)!), 4);
  });
});
