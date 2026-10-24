import { sql } from "drizzle-orm";
import { db } from ".";
import { cardsTable, experienceTable } from "./schema";

/**
 * Marks a card completed or not and moves the user's XP by the game's reward in the same statement.
 * XP only changes when the card's completion actually flips, so a repeated or stale request can't
 * award twice, and the total never drops below zero.
 */
export async function setCardCompleted(userId: string, cardId: number, isCompleted: boolean, xp: number) {
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
}
