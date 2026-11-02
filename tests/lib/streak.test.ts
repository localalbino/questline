// @vitest-environment node

import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { completeStreak, currentStreak, type StreakState } from "@/lib/streak";

const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-11-02T12:00:00Z");
const after = (days: number) => new Date(start.getTime() + days * DAY);
const fresh: StreakState = { weeks: 1, count: 0, resetsAt: null, completed: false };

describe("completeStreak", () => {
  test("the first completion starts the period", () => {
    assert.deepEqual(completeStreak(fresh, start), { weeks: 1, count: 1, resetsAt: after(7), completed: true });
  });

  test("only completes once per period", () => {
    const done = completeStreak(fresh, start)!;
    assert.equal(completeStreak(done, after(6)), null);
  });

  test("grows when the next period is completed", () => {
    const done = completeStreak(fresh, start)!;
    assert.deepEqual(completeStreak(done, after(10)), { weeks: 1, count: 2, resetsAt: after(14), completed: true });
  });
});

describe("currentStreak", () => {
  test("is unchanged within the period", () => {
    const done = completeStreak(fresh, start)!;
    assert.deepEqual(currentStreak(done, after(3)), done);
  });

  test("opens the next period after a completed one", () => {
    const done = completeStreak(fresh, start)!;
    assert.deepEqual(currentStreak(done, after(7)), { weeks: 1, count: 1, resetsAt: after(14), completed: false });
  });

  test("breaks when a whole period is missed", () => {
    const done = completeStreak(fresh, start)!;
    assert.deepEqual(currentStreak(done, after(14)), fresh);
  });

  test("breaks when the current period ends uncompleted", () => {
    const open = currentStreak(completeStreak(fresh, start)!, after(8));
    assert.deepEqual(currentStreak(open, after(14)), fresh);
  });
});
