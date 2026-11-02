// Each board has a streak: checking off a game completes it once per period, and completing it in
// consecutive periods grows its multiplier. Nothing runs when a period ends, so the stored state can
// be out of date; currentStreak works out where it stands now.

export const STREAK_WEEKS = [1, 2, 3, 4, 8, 16, 20, 52] as const;

export type StreakState = {
  weeks: number;
  /** Periods completed in a row. */
  count: number;
  /** When the current period ends, or null when no streak is running. */
  resetsAt: Date | null;
  /** Whether the current period has been completed. */
  completed: boolean;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function periodMs(weeks: number): number {
  return weeks * WEEK_MS;
}

/** Brings a stored streak up to date: moves on to the next period, or breaks it if one was missed. */
export function currentStreak(streak: StreakState, now: Date): StreakState {
  if (!streak.resetsAt || now < streak.resetsAt) return streak;
  const nextResetsAt = new Date(streak.resetsAt.getTime() + periodMs(streak.weeks));
  if (streak.completed && now < nextResetsAt) {
    return { ...streak, resetsAt: nextResetsAt, completed: false };
  }
  return { ...streak, count: 0, resetsAt: null, completed: false };
}

/** The streak after completing the current period, or null if it's already been completed. */
export function completeStreak(streak: StreakState, now: Date): StreakState | null {
  const current = currentStreak(streak, now);
  if (current.completed) return null;
  return {
    ...current,
    count: current.count + 1,
    completed: true,
    // The first completion starts the clock.
    resetsAt: current.resetsAt ?? new Date(now.getTime() + periodMs(current.weeks)),
  };
}
