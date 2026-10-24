// Games award XP for their IGDB time to beat, and levels follow a quadratic curve:
// reaching level L takes LEVEL_CURVE_BASE * (L - 1)^2 total XP.
export const XP_PER_HOUR = 10;
export const LEVEL_CURVE_BASE = 100;

/** XP for beating a game, or null when IGDB has no time to beat for it (no data, no XP). */
export function xpForTimeToBeat(seconds: number | null): number | null {
  if (seconds === null) return null;
  return Math.round((seconds / 3600) * XP_PER_HOUR);
}

/** Total XP needed to reach a level. Level 1 starts at 0 XP. */
export function xpForLevel(level: number): number {
  return LEVEL_CURVE_BASE * Math.max(0, level - 1) ** 2;
}

export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, totalXp);
  const level = Math.floor(Math.sqrt(xp / LEVEL_CURVE_BASE)) + 1;
  // Guard against sqrt rounding across an exact threshold.
  if (xpForLevel(level + 1) <= xp) return level + 1;
  if (xpForLevel(level) > xp) return level - 1;
  return level;
}

/** Where a total lands on the curve: the current level and how far through it the user is. */
export function levelProgress(totalXp: number) {
  const level = levelForXp(totalXp);
  const levelStart = xpForLevel(level);
  return {
    level,
    xpIntoLevel: Math.max(0, totalXp) - levelStart,
    xpForNextLevel: xpForLevel(level + 1) - levelStart,
  };
}
