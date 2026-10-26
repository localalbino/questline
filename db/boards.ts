import { Session } from "@/lib/session";
import { boardsTable, cardsTable, groupsTable } from "./schema";
import { db } from ".";
import { and, count, countDistinct, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

export const MAX_BOARDS_PER_USER = 3;
// Keeps a single board from eating our Neon free tier storage.
export const MAX_GROUPS_PER_BOARD = 10;
export const MAX_CARDS_PER_GROUP = 50;

// Triggers enforce the limits above in the database too, so concurrent requests can't all slip
// past the app's count checks. See the enforce_limits migration, which has its own copy of the numbers.
export const BOARDS_PER_USER_LIMIT = "boards_per_user_limit";
export const GROUPS_PER_BOARD_LIMIT = "groups_per_board_limit";
export const CARDS_PER_GROUP_LIMIT = "cards_per_group_limit";

/** Whether a write failed because it would have gone over the given limit. */
export function isLimitError(error: unknown, limit: string): boolean {
  // Drizzle wraps the driver's error, so look through the causes.
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ("constraint" in e && e.constraint === limit) return true;
  }
  return false;
}

export type Board = typeof boardsTable.$inferSelect;
export type Group = typeof groupsTable.$inferSelect;
export type Card = typeof cardsTable.$inferSelect;

export async function userCanCreateBoards(session: Session): Promise<boolean> {
  return (await db.$count(boardsTable, eq(boardsTable.ownerId, session.user.id))) < MAX_BOARDS_PER_USER;
}

/** Returns the board if it exists and belongs to the session's user, otherwise undefined. */
export async function getOwnedBoard(session: Session, boardId: number): Promise<Board | undefined> {
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(and(eq(boardsTable.id, boardId), eq(boardsTable.ownerId, session.user.id)))
    .limit(1);
  return board;
}

/** Lists the user's boards with how many columns and games each has, oldest first. */
export async function getBoardSummaries(session: Session) {
  return db
    .select({
      id: boardsTable.id,
      title: boardsTable.title,
      columns: countDistinct(groupsTable.id),
      games: count(cardsTable.id),
      completed: count(sql`CASE WHEN ${cardsTable.isCompleted} THEN 1 END`),
    })
    .from(boardsTable)
    .leftJoin(groupsTable, eq(groupsTable.boardId, boardsTable.id))
    .leftJoin(cardsTable, eq(cardsTable.groupId, groupsTable.id))
    .where(eq(boardsTable.ownerId, session.user.id))
    .groupBy(boardsTable.id)
    .orderBy(boardsTable.id);
}

/** Returns the group if its board belongs to the session's user, otherwise undefined. */
export async function getOwnedGroup(session: Session, groupId: number): Promise<Group | undefined> {
  const [row] = await db
    .select({ group: groupsTable })
    .from(groupsTable)
    .innerJoin(boardsTable, eq(groupsTable.boardId, boardsTable.id))
    .where(and(eq(groupsTable.id, groupId), eq(boardsTable.ownerId, session.user.id)))
    .limit(1);
  return row?.group;
}

/** Returns the card and its board id if the board belongs to the session's user, otherwise undefined. */
export async function getOwnedCard(
  session: Session,
  cardId: number,
): Promise<{ card: Card; boardId: number } | undefined> {
  const [row] = await db
    .select({ card: cardsTable, boardId: groupsTable.boardId })
    .from(cardsTable)
    .innerJoin(groupsTable, eq(cardsTable.groupId, groupsTable.id))
    .innerJoin(boardsTable, eq(groupsTable.boardId, boardsTable.id))
    .where(and(eq(cardsTable.id, cardId), eq(boardsTable.ownerId, session.user.id)))
    .limit(1);
  return row;
}

/** Loads a board with its groups and cards, each sorted by rank. */
export async function getBoardContents(session: Session, boardId: number) {
  return db.query.boards.findFirst({
    where: { id: boardId, ownerId: session.user.id },
    with: {
      groups: {
        orderBy: { rank: "asc", id: "asc" },
        with: { cards: { orderBy: { rank: "asc", id: "asc" } } },
      },
    },
  });
}

/*
 * Ranks are dense integers (0..n-1) within their parent. A move removes the item from its list,
 * splices it in at the requested index, and renumbers everything that shifted. Lists are capped
 * small enough that rewriting them is cheap, and recomputing from the current rows means a stale
 * client can't leave gaps or duplicate ranks behind.
 */

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

async function runBatch(statements: BatchItem<"pg">[]) {
  if (statements.length === 0) return;
  // neon-http runs a batch as a single transaction.
  await db.batch(statements as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}

export async function moveGroup(group: Group, toIndex: number): Promise<void> {
  const siblings = await db
    .select({ id: groupsTable.id, rank: groupsTable.rank })
    .from(groupsTable)
    .where(eq(groupsTable.boardId, group.boardId))
    .orderBy(groupsTable.rank, groupsTable.id);

  const ordered = siblings.filter((g) => g.id !== group.id);
  ordered.splice(clampIndex(toIndex, ordered.length), 0, { id: group.id, rank: group.rank });

  await runBatch(
    ordered.flatMap((g, rank) =>
      Number(g.rank) === rank
        ? []
        : [
            db
              .update(groupsTable)
              .set({ rank: String(rank) })
              .where(eq(groupsTable.id, g.id)),
          ],
    ),
  );
}

export async function moveCard(card: Card, toGroupId: number, toIndex: number): Promise<void> {
  const groupIds = [...new Set([card.groupId, toGroupId])];
  const cards = await db
    .select({ id: cardsTable.id, rank: cardsTable.rank, groupId: cardsTable.groupId })
    .from(cardsTable)
    .where(inArray(cardsTable.groupId, groupIds))
    .orderBy(cardsTable.rank, cardsTable.id);

  const others = cards.filter((c) => c.id !== card.id);
  const target = others.filter((c) => c.groupId === toGroupId);
  target.splice(clampIndex(toIndex, target.length), 0, { id: card.id, rank: card.rank, groupId: card.groupId });

  const lists = [target.map((c) => ({ ...c, newGroupId: toGroupId }))];
  if (card.groupId !== toGroupId) {
    lists.push(others.filter((c) => c.groupId === card.groupId).map((c) => ({ ...c, newGroupId: card.groupId })));
  }

  await runBatch(
    lists.flatMap((list) =>
      list.flatMap((c, rank) =>
        Number(c.rank) === rank && c.groupId === c.newGroupId
          ? []
          : [
              db
                .update(cardsTable)
                .set({ rank: String(rank), groupId: c.newGroupId })
                .where(eq(cardsTable.id, c.id)),
            ],
      ),
    ),
  );
}

/** Deletes a board the session's user owns; its columns and cards go with it. Returns whether it existed. */
export async function deleteOwnedBoard(session: Session, boardId: number): Promise<boolean> {
  const deleted = await db
    .delete(boardsTable)
    .where(and(eq(boardsTable.id, boardId), eq(boardsTable.ownerId, session.user.id)))
    .returning({ id: boardsTable.id });
  return deleted.length > 0;
}

/** Deletes a column and its cards, closing the gap in the remaining columns' ranks. */
export async function deleteGroup(group: Group): Promise<void> {
  const siblings = await db
    .select({ id: groupsTable.id, rank: groupsTable.rank })
    .from(groupsTable)
    .where(eq(groupsTable.boardId, group.boardId))
    .orderBy(groupsTable.rank, groupsTable.id);

  await runBatch([
    db.delete(groupsTable).where(eq(groupsTable.id, group.id)),
    ...siblings
      .filter((g) => g.id !== group.id)
      .flatMap((g, rank) =>
        Number(g.rank) === rank
          ? []
          : [
              db
                .update(groupsTable)
                .set({ rank: String(rank) })
                .where(eq(groupsTable.id, g.id)),
            ],
      ),
  ]);
}

/** Deletes a card, closing the gap in its column's ranks. XP it awarded is kept. */
export async function deleteCard(card: Card): Promise<void> {
  const siblings = await db
    .select({ id: cardsTable.id, rank: cardsTable.rank })
    .from(cardsTable)
    .where(eq(cardsTable.groupId, card.groupId))
    .orderBy(cardsTable.rank, cardsTable.id);

  await runBatch([
    db.delete(cardsTable).where(eq(cardsTable.id, card.id)),
    ...siblings
      .filter((c) => c.id !== card.id)
      .flatMap((c, rank) =>
        Number(c.rank) === rank
          ? []
          : [
              db
                .update(cardsTable)
                .set({ rank: String(rank) })
                .where(eq(cardsTable.id, c.id)),
            ],
      ),
  ]);
}
