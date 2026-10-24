"use client";

import { levelProgress } from "@/lib/experience";
import { useXp } from "./XpProvider";

/** The signed-in user's level and progress to the next one, pinned to the top right of every page. */
export function LevelBadge() {
  const { xp } = useXp();
  if (xp === null) return null;

  const { level, xpIntoLevel, xpForNextLevel } = levelProgress(xp);
  return (
    // Same height as PageHeader so it sits inside its row, in the space it leaves free.
    <div
      className="fixed top-0 right-0 z-10 flex h-13 items-center gap-3 px-4 text-xs"
      title={`${xp} XP total · ${xpForNextLevel - xpIntoLevel} XP to level ${level + 1}`}
    >
      <span className="shrink-0 text-sm text-emerald-500">Lv {level}</span>
      <div className="flex w-24 flex-col gap-1 sm:w-48">
        <div
          role="progressbar"
          aria-label={`Level ${level} progress`}
          aria-valuemin={0}
          aria-valuemax={xpForNextLevel}
          aria-valuenow={xpIntoLevel}
          className="h-1 bg-zinc-800"
        >
          <div
            className="h-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${(xpIntoLevel / xpForNextLevel) * 100}%` }}
          />
        </div>
        <span className="truncate text-zinc-500">
          {xpIntoLevel} / {xpForNextLevel} XP
        </span>
      </div>
    </div>
  );
}
