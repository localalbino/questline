import { Session } from "@/lib/session";
import { boardsTable } from "./schema";
import { db } from ".";
import { and, eq } from "drizzle-orm";

export const MAX_BOARDS_PER_USER = 3;
export type Board = typeof boardsTable.$inferSelect;

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
