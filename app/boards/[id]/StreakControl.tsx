"use client";

import { xpForStreak } from "@/lib/experience";
import { cn } from "cn";
import { useState } from "react";

const STREAK_WEEKS = [1, 2, 3, 4, 8, 16, 20, 52] as const;

// TODO: Persist the period and completion per board, and only allow completing once per period.
// Once that's stored, checking off a game on the board should complete the streak; the Complete
// button below is only a placeholder for testing the UI and should be removed then.
/** The board's streak: how long each period lasts, what it pays, and whether this period is done. */
export function StreakControl() {
  const [weeks, setWeeks] = useState<number>(1);
  const [isCompleted, setIsCompleted] = useState(false);
  const xp = xpForStreak(weeks);

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <FlameIcon className={cn("size-5", isCompleted ? "text-orange-500" : "text-zinc-500")} />
      <select
        value={weeks}
        onChange={(e) => {
          setWeeks(Number(e.target.value));
          setIsCompleted(false);
        }}
        className="bg-zinc-900 px-1 py-0.5 text-zinc-400 [color-scheme:dark]"
        aria-label="Streak period"
      >
        {STREAK_WEEKS.map((option) => (
          <option key={option} value={option}>
            {formatStreakPeriod(option)}
          </option>
        ))}
      </select>
      {isCompleted ? (
        <span className="text-orange-500">{xp} XP earned</span>
      ) : (
        <>
          <span className="text-zinc-500">+{xp} XP</span>
          <button
            type="button"
            onClick={() => setIsCompleted(true)}
            className="border border-zinc-700 px-1.5 py-0.5 text-zinc-400 hover:border-orange-500 hover:text-orange-500"
          >
            Complete
          </button>
        </>
      )}
    </div>
  );
}

// Weeks read naturally up to 3; from 4 on, round to the months or years people think in.
function formatStreakPeriod(weeks: number): string {
  if (weeks === 52) return "1 year";
  if (weeks >= 4) {
    const months = Math.round((weeks * 12) / 52);
    return `${months} ${months === 1 ? "month" : "months"}`;
  }
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={cn("transition-colors", className)}>
      <path
        d="M12 2c.6 3.4-1.2 5.3-2.9 7.2C7.6 10.9 6 12.6 6 15.5A6 6 0 0 0 18 15.5c0-2.7-1.3-4.6-2.6-6.1-.2 1.3-.8 2.4-1.9 3 .4-3.9-.6-7.8-1.5-10.4Zm0 19a3 3 0 0 1-3-3c0-1.6 1-2.6 2-3.6.3 1 .9 1.6 1.7 2 .1-.8.4-1.5.9-2 .8.9 1.4 2 1.4 3.6a3 3 0 0 1-3 3Z"
        fillRule="evenodd"
      />
    </svg>
  );
}
