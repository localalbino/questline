import { and, eq, isNull, sql } from "drizzle-orm";
import { xpForStreak } from "@/lib/experience";
import { completeStreak, currentStreak, type StreakState } from "@/lib/streak";
import { db } from ".";
import { boardsTable, cardsTable, experienceTable } from "./schema";

const streakColumns = {
  weeks: boardsTable.streakWeeks,
  count: boardsTable.streakCount,
  resetsAt: boardsTable.streakResetsAt,
  completed: boardsTable.streakCompleted,
};

/** The board's streak as stored, which may be behind; see currentStreak. */
export async function getStoredStreak(boardId: number): Promise<StreakState | undefined> {
  const [row] = await db.select(streakColumns).from(boardsTable).where(eq(boardsTable.id, boardId)).limit(1);
  return row;
}

// Only writes if the board's streak is still what we read, so concurrent requests can't both
// complete the same period or overwrite each other.
function isUnchanged(boardId: number, stored: StreakState) {
  return and(
    eq(boardsTable.id, boardId),
    eq(boardsTable.streakWeeks, stored.weeks),
    eq(boardsTable.streakCount, stored.count),
    // Dates in JS only keep milliseconds, so compare at that precision or a stored value with
    // microseconds would never match.
    stored.resetsAt
      ? sql`date_trunc('milliseconds', ${boardsTable.streakResetsAt}) = ${stored.resetsAt.toISOString()}::timestamptz`
      : isNull(boardsTable.streakResetsAt),
    eq(boardsTable.streakCompleted, stored.completed),
  );
}

/**
 * Completes the board's streak for this period with a just checked off game, and awards the
 * streak's XP in the same statement. Does nothing if the period is already completed or the game
 * has counted toward the streak before. Returns the board's streak as it now stands.
 */
export async function completeStreakWithCard(
  userId: string,
  boardId: number,
  cardId: number,
): Promise<StreakState | undefined> {
  const now = new Date();
  const stored = await getStoredStreak(boardId);
  if (!stored) return undefined;
  const next = completeStreak(stored, now);
  if (!next) return currentStreak(stored, now);

  const xp = xpForStreak(next.weeks, next.count);
  // Postgres doesn't allow table-qualified columns in SET or INSERT column lists.
  const col = (column: { name: string }) => sql.identifier(column.name);
  await db.execute(sql`
    WITH board AS (
      UPDATE ${boardsTable} SET
        ${col(boardsTable.streakCount)} = ${next.count},
        ${col(boardsTable.streakResetsAt)} = ${next.resetsAt!.toISOString()}::timestamptz,
        ${col(boardsTable.streakCompleted)} = true
      WHERE ${isUnchanged(boardId, stored)} AND EXISTS (
        SELECT 1 FROM ${cardsTable}
        WHERE ${cardsTable.id} = ${cardId} AND ${cardsTable.isCompleted} AND NOT ${cardsTable.streakCounted}
      )
      RETURNING ${boardsTable.id}
    ), card AS (
      UPDATE ${cardsTable} SET ${col(cardsTable.streakCounted)} = true
      WHERE ${cardsTable.id} = ${cardId} AND EXISTS (SELECT 1 FROM board)
    )
    INSERT INTO ${experienceTable} (${col(experienceTable.userId)}, ${col(experienceTable.xp)})
    SELECT ${userId}, ${xp}::integer FROM board
    ON CONFLICT (${col(experienceTable.userId)})
    DO UPDATE SET ${col(experienceTable.xp)} = ${experienceTable.xp} + ${xp}::integer
  `);

  const updated = await getStoredStreak(boardId);
  return updated && currentStreak(updated, now);
}

/**
 * Switches the board's streak to a new period length, which starts it over. Not allowed while the
 * current period is completed, or a streak could be completed twice in one period by switching.
 * Returns the new streak, or null if it can't change right now.
 */
export async function setStreakWeeks(boardId: number, weeks: number): Promise<StreakState | null> {
  const stored = await getStoredStreak(boardId);
  if (!stored || currentStreak(stored, new Date()).completed) return null;

  const next: StreakState = { weeks, count: 0, resetsAt: null, completed: false };
  const updated = await db
    .update(boardsTable)
    .set({ streakWeeks: next.weeks, streakCount: 0, streakResetsAt: null, streakCompleted: false })
    .where(isUnchanged(boardId, stored))
    .returning({ id: boardsTable.id });
  return updated.length > 0 ? next : null;
}
