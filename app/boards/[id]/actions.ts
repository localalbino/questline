"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cardsTable, groupsTable } from "@/db/schema";
import {
  CARDS_PER_GROUP_LIMIT,
  GROUPS_PER_BOARD_LIMIT,
  MAX_CARDS_PER_GROUP,
  MAX_GROUPS_PER_BOARD,
  deleteCard,
  deleteGroup,
  getOwnedBoard,
  getOwnedCard,
  getOwnedGroup,
  isLimitError,
  moveCard,
  moveGroup,
} from "@/db/boards";
import { setCardCompleted } from "@/db/experience";
import { xpForTimeToBeat } from "@/lib/experience";
import { requireVerifiedSession } from "@/lib/session";
import { igdbClient, type GameDetails } from "@/lib/igdb-client";
import type { RateLimitResult } from "@/lib/rate-limit";
import { consumeLookupRateLimit, consumeSearchRateLimit } from "./rate-limits";
import {
  ActionResult,
  addCardSchema,
  createGroupSchema,
  deleteCardSchema,
  deleteGroupSchema,
  moveCardSchema,
  moveGroupSchema,
  renameGroupSchema,
  SEARCH_PAGE_SIZE,
  searchGamesSchema,
  updateCardSchema,
} from "./schema";
import type { BoardCard, BoardGroup } from "./types";

// None of these revalidate the page: the board keeps its own optimistic state and only
// asks for a refresh when an action fails. Refreshing re-queries IGDB, which is rate limited.

const NOT_FOUND = "Not found";
const GROUPS_LIMIT_ERROR = `Boards can have at most ${MAX_GROUPS_PER_BOARD} columns`;
const CARDS_LIMIT_ERROR = `Columns can have at most ${MAX_CARDS_PER_GROUP} games`;

function rateLimited(limit: Extract<RateLimitResult, { allowed: false }>): { success: false; error: string } {
  return { success: false, error: `Too many requests. Try again in ${limit.retryAfter}s.` };
}

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
  if (count >= MAX_GROUPS_PER_BOARD) return { success: false, error: GROUPS_LIMIT_ERROR };

  let group: { id: number; title: string };
  try {
    [group] = await db
      .insert(groupsTable)
      .values({ boardId, title, rank: String(count) })
      .returning({ id: groupsTable.id, title: groupsTable.title });
  } catch (error) {
    // Another request filled the board after we counted.
    if (isLimitError(error, GROUPS_PER_BOARD_LIMIT)) return { success: false, error: GROUPS_LIMIT_ERROR };
    throw error;
  }
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

export async function deleteGroupAction(input: z.input<typeof deleteGroupSchema>): Promise<ActionResult> {
  const parsed = deleteGroupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const session = await requireVerifiedSession();
  const group = await getOwnedGroup(session, parsed.data.groupId);
  if (!group) return { success: false, error: NOT_FOUND };

  await deleteGroup(group);
  return { success: true, data: undefined };
}

export async function addCardAction(input: z.input<typeof addCardSchema>): Promise<ActionResult<BoardCard>> {
  const parsed = addCardSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { groupId, gameId } = parsed.data;

  const session = await requireVerifiedSession();
  if (!(await getOwnedGroup(session, groupId))) return { success: false, error: NOT_FOUND };

  const count = await db.$count(cardsTable, eq(cardsTable.groupId, groupId));
  if (count >= MAX_CARDS_PER_GROUP) return { success: false, error: CARDS_LIMIT_ERROR };

  const limit = await consumeLookupRateLimit(session);
  if (!limit.allowed) return rateLimited(limit);

  // Confirms the game exists before we store its id, and gives the client something to render.
  const [game] = (await igdbClient.getDetailsById([gameId])) ?? [];
  if (!game) return { success: false, error: "Game not found" };

  let card: Omit<BoardCard, "game">;
  try {
    [card] = await db
      .insert(cardsTable)
      .values({ groupId, gameId, rank: String(count) })
      .returning({
        id: cardsTable.id,
        gameId: cardsTable.gameId,
        dueDate: cardsTable.dueDate,
        isCompleted: cardsTable.isCompleted,
      });
  } catch (error) {
    if (isLimitError(error, CARDS_PER_GROUP_LIMIT)) return { success: false, error: CARDS_LIMIT_ERROR };
    throw error;
  }
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
    if (count >= MAX_CARDS_PER_GROUP) return { success: false, error: CARDS_LIMIT_ERROR };
  }

  try {
    await moveCard(owned.card, toGroupId, toIndex);
  } catch (error) {
    if (isLimitError(error, CARDS_PER_GROUP_LIMIT)) return { success: false, error: CARDS_LIMIT_ERROR };
    throw error;
  }
  return { success: true, data: undefined };
}

export async function deleteCardAction(input: z.input<typeof deleteCardSchema>): Promise<ActionResult> {
  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const session = await requireVerifiedSession();
  const owned = await getOwnedCard(session, parsed.data.cardId);
  if (!owned) return { success: false, error: NOT_FOUND };

  await deleteCard(owned.card);
  return { success: true, data: undefined };
}

/** Returns the user's new XP total when completion changed, otherwise null. */
export async function updateCardAction(
  input: z.input<typeof updateCardSchema>,
): Promise<ActionResult<{ xp: number | null }>> {
  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { cardId, dueDate, isCompleted } = parsed.data;

  const session = await requireVerifiedSession();
  const owned = await getOwnedCard(session, cardId);
  if (!owned) return { success: false, error: NOT_FOUND };

  const completionChanged = isCompleted !== undefined && isCompleted !== owned.card.isCompleted;
  // Checked before any write so a rejected request doesn't half apply.
  if (completionChanged) {
    const limit = await consumeLookupRateLimit(session);
    if (!limit.allowed) return rateLimited(limit);
  }

  if (dueDate !== undefined) {
    await db.update(cardsTable).set({ dueDate }).where(eq(cardsTable.id, cardId));
  }

  if (completionChanged) {
    // Look the reward up server side rather than trusting the client's copy of the game.
    let game: GameDetails | undefined;
    try {
      [game] = (await igdbClient.getDetailsById([owned.card.gameId])) ?? [];
    } catch {
      return { success: false, error: "Couldn't reach IGDB to award XP. Try again in a moment." };
    }
    const xp = xpForTimeToBeat(game?.timeToBeat ?? null) ?? 0;
    return { success: true, data: { xp: await setCardCompleted(session.user.id, cardId, isCompleted, xp) } };
  }
  return { success: true, data: { xp: null } };
}

export async function searchGamesAction(
  input: z.input<typeof searchGamesSchema>,
): Promise<ActionResult<{ games: GameDetails[]; hasMore: boolean }>> {
  const parsed = searchGamesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { query, offset } = parsed.data;

  const session = await requireVerifiedSession();
  const limit = await consumeSearchRateLimit(session);
  if (!limit.allowed) {
    return { success: false, error: `Too many searches. Try again in ${limit.retryAfter}s.` };
  }

  const games = await igdbClient.searchByTitle(query, SEARCH_PAGE_SIZE, offset);
  if (!games) return { success: false, error: "IGDB is busy right now. Try again in a moment." };
  return { success: true, data: { games, hasMore: games.length === SEARCH_PAGE_SIZE } };
}
