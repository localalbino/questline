"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cardsTable, groupsTable } from "@/db/schema";
import {
  MAX_CARDS_PER_GROUP,
  MAX_GROUPS_PER_BOARD,
  getOwnedBoard,
  getOwnedCard,
  getOwnedGroup,
  moveCard,
  moveGroup,
} from "@/db/boards";
import { requireVerifiedSession } from "@/lib/session";
import { igdbClient } from "@/lib/igdb-client";
import {
  ActionResult,
  addCardSchema,
  createGroupSchema,
  moveCardSchema,
  moveGroupSchema,
  renameGroupSchema,
  updateCardSchema,
} from "./schema";
import type { BoardCard, BoardGroup } from "./types";

// None of these revalidate the page: the board keeps its own optimistic state and only
// asks for a refresh when an action fails. Refreshing re-queries IGDB, which is rate limited.

const NOT_FOUND = "Not found";

function invalid(error: z.ZodError): { success: false; error: string } {
  return { success: false, error: error.issues[0]?.message ?? "Invalid input" };
}

export async function createGroupAction(input: z.input<typeof createGroupSchema>): Promise<ActionResult<BoardGroup>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { boardId, title } = parsed.data;

  const session = await requireVerifiedSession();
  if (!(await getOwnedBoard(session, boardId))) return { success: false, error: NOT_FOUND };

  const count = await db.$count(groupsTable, eq(groupsTable.boardId, boardId));
  if (count >= MAX_GROUPS_PER_BOARD) {
    return { success: false, error: `Boards can have at most ${MAX_GROUPS_PER_BOARD} columns` };
  }

  const [group] = await db
    .insert(groupsTable)
    .values({ boardId, title, rank: String(count) })
    .returning({ id: groupsTable.id, title: groupsTable.title });
  return { success: true, data: { ...group, cards: [] } };
}

export async function renameGroupAction(input: z.input<typeof renameGroupSchema>): Promise<ActionResult> {
  const parsed = renameGroupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { groupId, title } = parsed.data;

  const session = await requireVerifiedSession();
  if (!(await getOwnedGroup(session, groupId))) return { success: false, error: NOT_FOUND };

  await db.update(groupsTable).set({ title }).where(eq(groupsTable.id, groupId));
  return { success: true, data: undefined };
}

export async function moveGroupAction(input: z.input<typeof moveGroupSchema>): Promise<ActionResult> {
  const parsed = moveGroupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { groupId, toIndex } = parsed.data;

  const session = await requireVerifiedSession();
  const group = await getOwnedGroup(session, groupId);
  if (!group) return { success: false, error: NOT_FOUND };

  await moveGroup(group, toIndex);
  return { success: true, data: undefined };
}

export async function addCardAction(input: z.input<typeof addCardSchema>): Promise<ActionResult<BoardCard>> {
  const parsed = addCardSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { groupId, gameId } = parsed.data;

  const session = await requireVerifiedSession();
  if (!(await getOwnedGroup(session, groupId))) return { success: false, error: NOT_FOUND };

  const count = await db.$count(cardsTable, eq(cardsTable.groupId, groupId));
  if (count >= MAX_CARDS_PER_GROUP) {
    return { success: false, error: `Columns can have at most ${MAX_CARDS_PER_GROUP} games` };
  }

  // Confirms the game exists before we store its id, and gives the client something to render.
  const [game] = (await igdbClient.getDetailsById([gameId])) ?? [];
  if (!game) return { success: false, error: "Game not found" };

  const [card] = await db
    .insert(cardsTable)
    .values({ groupId, gameId, rank: String(count) })
    .returning({
      id: cardsTable.id,
      gameId: cardsTable.gameId,
      dueDate: cardsTable.dueDate,
      isCompleted: cardsTable.isCompleted,
    });
  return { success: true, data: { ...card, game } };
}

export async function moveCardAction(input: z.input<typeof moveCardSchema>): Promise<ActionResult> {
  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { cardId, toGroupId, toIndex } = parsed.data;

  const session = await requireVerifiedSession();
  const [owned, toGroup] = await Promise.all([getOwnedCard(session, cardId), getOwnedGroup(session, toGroupId)]);
  // Cards can only move between columns on the same board.
  if (!owned || !toGroup || owned.boardId !== toGroup.boardId) return { success: false, error: NOT_FOUND };

  if (owned.card.groupId !== toGroupId) {
    const count = await db.$count(cardsTable, eq(cardsTable.groupId, toGroupId));
    if (count >= MAX_CARDS_PER_GROUP) {
      return { success: false, error: `Columns can have at most ${MAX_CARDS_PER_GROUP} games` };
    }
  }

  await moveCard(owned.card, toGroupId, toIndex);
  return { success: true, data: undefined };
}

export async function updateCardAction(input: z.input<typeof updateCardSchema>): Promise<ActionResult> {
  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { cardId, ...changes } = parsed.data;

  const session = await requireVerifiedSession();
  if (!(await getOwnedCard(session, cardId))) return { success: false, error: NOT_FOUND };
  if (changes.isCompleted === undefined && changes.dueDate === undefined) return { success: true, data: undefined };

  await db.update(cardsTable).set(changes).where(eq(cardsTable.id, cardId));
  return { success: true, data: undefined };
}
