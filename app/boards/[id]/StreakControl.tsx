"use client";

import { xpForStreak } from "@/lib/experience";
import { currentStreak, STREAK_WEEKS, type StreakState } from "@/lib/streak";
import { ConfirmDeleteDialog } from "@/ui/components/ConfirmDeleteDialog";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { setStreakWeeksAction } from "./actions";

type StreakContextValue = { streak: StreakState; setStreak: (streak: StreakState) => void };

const StreakContext = createContext<StreakContextValue | null>(null);

/** Shares the board's streak between the header, which shows it, and the board, which completes it. */
export function StreakProvider({ initialStreak, children }: PropsWithChildren<{ initialStreak: StreakState }>) {
  const [streak, setStreak] = useState(initialStreak);
  // A server refresh (e.g. after a failed action) hands us a fresh streak, which replaces ours.
  const [prevInitialStreak, setPrevInitialStreak] = useState(initialStreak);
  if (initialStreak !== prevInitialStreak) {
    setPrevInitialStreak(initialStreak);
    setStreak(initialStreak);
  }

  return <StreakContext value={{ streak, setStreak }}>{children}</StreakContext>;
}

export function useStreak() {
  const context = useContext(StreakContext);
  if (!context) throw new Error("useStreak must be used inside a StreakProvider");
  return context;
}

/** The board's streak: its multiplier, how long each period lasts, what it pays, and whether this period is done. */
export function StreakControl({ boardId }: { boardId: number }) {
  const router = useRouter();
  const { streak, setStreak } = useStreak();
  const [error, setError] = useState<string | null>(null);
  // A period choice waiting on confirmation, since switching would throw away a running streak.
  const [pendingWeeks, setPendingWeeks] = useState<number | null>(null);
  const now = useNow();
  // The page can stay open past the end of a period, so work out where the streak stands as time passes.
  const { weeks, count, resetsAt, completed } = currentStreak(streak, now);

  async function changeWeeks(next: number): Promise<string | null> {
    setError(null);
    const result = await setStreakWeeksAction({ boardId, weeks: next as (typeof STREAK_WEEKS)[number] });
    if (!result.success) {
      router.refresh();
      return result.error;
    }
    setStreak(result.data);
    return null;
  }

  return (
    <div
      className="flex shrink-0 items-center gap-2 text-xs"
      title="Check off a game to complete this period's streak. Missing a period starts it over."
    >
      <span className={cn("flex items-center gap-0.5", completed ? "text-orange-500" : "text-zinc-500")}>
        <FlameIcon className="size-5" />
        <span>
          <span className="sr-only">Streak: </span>
          {count}
          <span className="sr-only"> in a row</span>
        </span>
      </span>
      <select
        value={weeks}
        disabled={completed}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (count > 0) setPendingWeeks(next);
          else changeWeeks(next).then((message) => message && setError(message));
        }}
        className="bg-zinc-900 px-1 py-0.5 text-zinc-400 [color-scheme:dark] disabled:opacity-60"
        aria-label="Streak period"
        title={completed ? "You can change the period once this one ends" : undefined}
      >
        {STREAK_WEEKS.map((option) => (
          <option key={option} value={option}>
            {formatStreakPeriod(option)}
          </option>
        ))}
      </select>
      {completed ? (
        <span className="text-orange-500">{xpForStreak(weeks, count)} XP earned</span>
      ) : (
        <span className="text-zinc-500">+{xpForStreak(weeks, count + 1)} XP</span>
      )}
      {resetsAt && (
        // The time left depends on the clock, so the server and client can render it differently.
        <span className="text-zinc-600" suppressHydrationWarning>
          {completed ? "next" : "ends"} in {formatTimeLeft(resetsAt, now)}
        </span>
      )}
      {error && <span className="text-red-400">{error}</span>}
      {pendingWeeks !== null && (
        <ConfirmDeleteDialog
          title="Start your streak over?"
          confirmLabel="Start over"
          pendingLabel="Switching…"
          onConfirm={() => changeWeeks(pendingWeeks)}
          onClose={() => setPendingWeeks(null)}
        >
          Switching to {formatStreakPeriod(pendingWeeks)} resets your {count} in a row back to 0. XP you&apos;ve earned
          stays.
        </ConfirmDeleteDialog>
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

/** The current time, updated every minute. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

function formatTimeLeft(resetsAt: Date, now: Date): string {
  // Rounds up, so a period that just started reads as its full length.
  const hours = Math.max(1, Math.ceil((resetsAt.getTime() - now.getTime()) / (60 * 60 * 1000)));
  return hours >= 24 ? `${Math.ceil(hours / 24)}d` : `${hours}h`;
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
