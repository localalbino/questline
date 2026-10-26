import { eq, sql } from "drizzle-orm";
import { db } from ".";
import { cardsTable, experienceTable } from "./schema";

/** The user's total XP. Users who haven't completed anything yet have no row and count as 0. */
export async function getXp(userId: string): Promise<number> {
  const [row] = await db
    .select({ xp: experienceTable.xp })
    .from(experienceTable)
    .where(eq(experienceTable.userId, userId))
    .limit(1);
  return row?.xp ?? 0;
}

/**
 * Marks a card completed or not and moves the user's XP by the game's reward in the same statement.
 * XP only changes when the card's completion actually flips, so a repeated or stale request can't
 * award twice, and the total never drops below zero. Returns the user's new total.
 */
export async function setCardCompleted(
  userId: string,
  cardId: number,
  isCompleted: boolean,
  xp: number,
): Promise<number> {
  const delta = isCompleted ? xp : -xp;
  // Postgres doesn't allow table-qualified columns in SET or INSERT column lists.
  const col = (column: { name: string }) => sql.identifier(column.name);
  await db.execute(sql`
    WITH changed AS (
      UPDATE ${cardsTable} SET ${col(cardsTable.isCompleted)} = ${isCompleted}
      WHERE ${cardsTable.id} = ${cardId} AND ${cardsTable.isCompleted} <> ${isCompleted}
      RETURNING ${cardsTable.id}
    )
    INSERT INTO ${experienceTable} (${col(experienceTable.userId)}, ${col(experienceTable.xp)})
    SELECT ${userId}, GREATEST(${delta}::integer, 0) FROM changed
    ON CONFLICT (${col(experienceTable.userId)})
    DO UPDATE SET ${col(experienceTable.xp)} = GREATEST(${experienceTable.xp} + ${delta}::integer, 0)
  `);
  return getXp(userId);
}

/** Puts the user back at 0 XP. Completed cards stay completed; un-completing one later stays floored at 0. */
export async function resetXp(userId: string): Promise<void> {
  await db.delete(experienceTable).where(eq(experienceTable.userId, userId));
}
