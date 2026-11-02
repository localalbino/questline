// @vitest-environment node

import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  MAX_STREAK_MULTIPLIER,
  levelForXp,
  levelProgress,
  xpForLevel,
  xpForStreak,
  xpForTimeToBeat,
} from "@/lib/experience";

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

describe("levelProgress", () => {
  test("measures progress from the start of the current level", () => {
    // Level 4 starts at 900 XP and level 5 at 1600.
    assert.deepEqual(levelProgress(1000), { level: 4, xpIntoLevel: 100, xpForNextLevel: 700 });
  });

  test("starts a fresh level at zero progress", () => {
    assert.deepEqual(levelProgress(0), { level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    assert.deepEqual(levelProgress(100), { level: 2, xpIntoLevel: 0, xpForNextLevel: 300 });
  });
});

describe("xpForStreak", () => {
  test("pays per day of the period", () => {
    assert.equal(xpForStreak(1, 1), 70);
    assert.equal(xpForStreak(52, 1), 3640);
  });

  test("multiplies by periods in a row, up to the cap", () => {
    assert.equal(xpForStreak(1, 3), 210);
    assert.equal(xpForStreak(1, MAX_STREAK_MULTIPLIER + 5), 70 * MAX_STREAK_MULTIPLIER);
  });
});
