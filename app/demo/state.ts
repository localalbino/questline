/*
 * The demo's boards live entirely in the browser. These functions mirror the board server actions
 * (same validation, limits, XP, and streak rules) but return a new state instead of writing to the
 * database. Each returns the next state plus the ActionResult the board UI expects.
 */
import { z } from "zod";
import {
  addCardSchema,
  createGroupSchema,
  deleteCardSchema,
  deleteGroupSchema,
  moveCardSchema,
  moveGroupSchema,
  renameGroupSchema,
  setStreakWeeksSchema,
  updateCardSchema,
  type ActionResult,
} from "@/app/boards/[id]/schema";
import type { BoardCard, BoardGroup } from "@/app/boards/[id]/types";
import { createBoardSchema } from "@/app/boards/create/schema";
import type { BoardSummary } from "@/app/boards/BoardGrid";
import { xpForStreak, xpForTimeToBeat } from "@/lib/experience";
import type { GameDetails } from "@/lib/igdb-client";
import { MAX_BOARDS_PER_USER, MAX_CARDS_PER_GROUP, MAX_GROUPS_PER_BOARD } from "@/lib/limits";
import { completeStreak, currentStreak, type StreakState } from "@/lib/streak";

export type DemoCard = BoardCard & { streakCounted: boolean };
export type DemoGroup = { id: number; title: string; cards: DemoCard[] };
export type DemoBoard = { id: number; title: string; streak: StreakState; groups: DemoGroup[] };
export type DemoState = { boards: DemoBoard[]; xp: number; nextId: number };

export type Step<T = undefined> = { state: DemoState; result: ActionResult<T> };

const NOT_FOUND = "Not found";
const BOARDS_LIMIT_ERROR = `You've reached the limit of ${MAX_BOARDS_PER_USER} boards.`;
const GROUPS_LIMIT_ERROR = `Boards can have at most ${MAX_GROUPS_PER_BOARD} columns`;
const CARDS_LIMIT_ERROR = `Columns can have at most ${MAX_CARDS_PER_GROUP} games`;

function ok<T>(state: DemoState, data: T): Step<T> {
  return { state, result: { success: true, data } };
}

function fail<T>(state: DemoState, error: string): Step<T> {
  return { state, result: { success: false, error } };
}

function invalid<T>(state: DemoState, error: z.ZodError): Step<T> {
  return fail(state, error.issues[0]?.message ?? "Invalid input");
}

function findGroup(state: DemoState, groupId: number) {
  for (const board of state.boards) {
    const group = board.groups.find((g) => g.id === groupId);
    if (group) return { board, group };
  }
  return undefined;
}

function findCard(state: DemoState, cardId: number) {
  for (const board of state.boards) {
    for (const group of board.groups) {
      const card = group.cards.find((c) => c.id === cardId);
      if (card) return { board, group, card };
    }
  }
  return undefined;
}

function updateBoard(state: DemoState, boardId: number, update: (board: DemoBoard) => DemoBoard): DemoState {
  return { ...state, boards: state.boards.map((board) => (board.id === boardId ? update(board) : board)) };
}

function updateGroups(state: DemoState, boardId: number, update: (groups: DemoGroup[]) => DemoGroup[]): DemoState {
  return updateBoard(state, boardId, (board) => ({ ...board, groups: update(board.groups) }));
}

function updateCards(group: DemoGroup, update: (cards: DemoCard[]) => DemoCard[]): DemoGroup {
  return { ...group, cards: update(group.cards) };
}

function insertAt<T>(list: T[], index: number, item: T): T[] {
  return list.toSpliced(Math.max(0, Math.min(index, list.length)), 0, item);
}

export function summarizeBoards(state: DemoState): BoardSummary[] {
  return state.boards.map((board) => {
    const cards = board.groups.flatMap((group) => group.cards);
    return {
      id: board.id,
      title: board.title,
      columns: board.groups.length,
      games: cards.length,
      completed: cards.filter((card) => card.isCompleted).length,
    };
  });
}

export function createBoard(state: DemoState, input: { title: unknown }): Step<{ id: number }> {
  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  if (state.boards.length >= MAX_BOARDS_PER_USER) return fail(state, BOARDS_LIMIT_ERROR);

  const board: DemoBoard = {
    id: state.nextId,
    title: parsed.data.title,
    streak: { weeks: 1, count: 0, resetsAt: null, completed: false },
    groups: [],
  };
  return ok({ ...state, boards: [...state.boards, board], nextId: state.nextId + 1 }, { id: board.id });
}

export function deleteBoard(state: DemoState, input: { boardId: number }): Step {
  if (!state.boards.some((board) => board.id === input.boardId)) return fail(state, NOT_FOUND);
  return ok({ ...state, boards: state.boards.filter((board) => board.id !== input.boardId) }, undefined);
}

export function createGroup(state: DemoState, input: z.input<typeof createGroupSchema>): Step<BoardGroup> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  const { boardId, title } = parsed.data;

  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return fail(state, NOT_FOUND);
  if (board.groups.length >= MAX_GROUPS_PER_BOARD) return fail(state, GROUPS_LIMIT_ERROR);

  const group: DemoGroup = { id: state.nextId, title, cards: [] };
  const next = updateGroups({ ...state, nextId: state.nextId + 1 }, boardId, (groups) => [...groups, group]);
  return ok(next, group);
}

export function renameGroup(state: DemoState, input: z.input<typeof renameGroupSchema>): Step {
  const parsed = renameGroupSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  const { groupId, title } = parsed.data;

  const found = findGroup(state, groupId);
  if (!found) return fail(state, NOT_FOUND);
  const next = updateGroups(state, found.board.id, (groups) =>
    groups.map((group) => (group.id === groupId ? { ...group, title } : group)),
  );
  return ok(next, undefined);
}

export function moveGroup(state: DemoState, input: z.input<typeof moveGroupSchema>): Step {
  const parsed = moveGroupSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  const { groupId, toIndex } = parsed.data;

  const found = findGroup(state, groupId);
  if (!found) return fail(state, NOT_FOUND);
  const next = updateGroups(state, found.board.id, (groups) =>
    insertAt(
      groups.filter((group) => group.id !== groupId),
      toIndex,
      found.group,
    ),
  );
  return ok(next, undefined);
}

export function deleteGroup(state: DemoState, input: z.input<typeof deleteGroupSchema>): Step {
  const parsed = deleteGroupSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  const { groupId } = parsed.data;

  const found = findGroup(state, groupId);
  if (!found) return fail(state, NOT_FOUND);
  return ok(
    updateGroups(state, found.board.id, (groups) => groups.filter((group) => group.id !== groupId)),
    undefined,
  );
}

export function addCard(state: DemoState, input: { groupId: number; game: GameDetails }): Step<BoardCard> {
  const parsed = addCardSchema.safeParse({ groupId: input.groupId, gameId: input.game.id });
  if (!parsed.success) return invalid(state, parsed.error);
  const { groupId } = parsed.data;

  const found = findGroup(state, groupId);
  if (!found) return fail(state, NOT_FOUND);
  if (found.group.cards.length >= MAX_CARDS_PER_GROUP) return fail(state, CARDS_LIMIT_ERROR);

  const card: DemoCard = {
    id: state.nextId,
    gameId: input.game.id,
    dueDate: null,
    isCompleted: false,
    game: input.game,
    streakCounted: false,
  };
  const next = updateGroups({ ...state, nextId: state.nextId + 1 }, found.board.id, (groups) =>
    groups.map((group) => (group.id === groupId ? updateCards(group, (cards) => [...cards, card]) : group)),
  );
  return ok(next, card);
}

export function moveCard(state: DemoState, input: z.input<typeof moveCardSchema>): Step {
  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  const { cardId, toGroupId, toIndex } = parsed.data;

  const from = findCard(state, cardId);
  const to = findGroup(state, toGroupId);
  // Cards can only move between columns on the same board.
  if (!from || !to || from.board.id !== to.board.id) return fail(state, NOT_FOUND);
  if (from.group.id !== toGroupId && to.group.cards.length >= MAX_CARDS_PER_GROUP) {
    return fail(state, CARDS_LIMIT_ERROR);
  }

  const next = updateGroups(state, from.board.id, (groups) =>
    groups
      .map((group) => updateCards(group, (cards) => cards.filter((card) => card.id !== cardId)))
      .map((group) =>
        group.id === toGroupId ? updateCards(group, (cards) => insertAt(cards, toIndex, from.card)) : group,
      ),
  );
  return ok(next, undefined);
}

export function deleteCard(state: DemoState, input: z.input<typeof deleteCardSchema>): Step {
  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  const { cardId } = parsed.data;

  const found = findCard(state, cardId);
  if (!found) return fail(state, NOT_FOUND);
  const next = updateGroups(state, found.board.id, (groups) =>
    groups.map((group) => updateCards(group, (cards) => cards.filter((card) => card.id !== cardId))),
  );
  return ok(next, undefined);
}

/**
 * Same contract as updateCardAction: the new XP total when completion changed, otherwise null, and the
 * board's streak when a game was checked off.
 */
export function updateCard(
  state: DemoState,
  input: z.input<typeof updateCardSchema>,
  now: Date,
): Step<{ xp: number | null; streak: StreakState | null }> {
  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  const { cardId, dueDate, isCompleted } = parsed.data;

  const found = findCard(state, cardId);
  if (!found) return fail(state, NOT_FOUND);
  const { board, card } = found;

  const completionChanged = isCompleted !== undefined && isCompleted !== card.isCompleted;
  let nextCard: DemoCard = { ...card, ...(dueDate !== undefined && { dueDate }) };
  let streak = board.streak;
  let xp = state.xp;

  if (completionChanged) {
    const reward = xpForTimeToBeat(card.game?.timeToBeat ?? null) ?? 0;
    xp = Math.max(0, xp + (isCompleted ? reward : -reward));
    nextCard = { ...nextCard, isCompleted };
    // A game only counts toward the streak the first time it's checked off.
    if (isCompleted && !card.streakCounted) {
      const completed = completeStreak(streak, now);
      if (completed) {
        streak = completed;
        xp += xpForStreak(completed.weeks, completed.count);
        nextCard = { ...nextCard, streakCounted: true };
      }
    }
  }

  const next = updateBoard({ ...state, xp }, board.id, (b) => ({
    ...b,
    streak,
    groups: b.groups.map((group) => updateCards(group, (cards) => cards.map((c) => (c.id === cardId ? nextCard : c)))),
  }));
  if (!completionChanged) return ok(next, { xp: null, streak: null });
  return ok(next, { xp, streak: isCompleted ? currentStreak(streak, now) : null });
}

export function setStreakWeeks(
  state: DemoState,
  input: z.input<typeof setStreakWeeksSchema>,
  now: Date,
): Step<StreakState> {
  const parsed = setStreakWeeksSchema.safeParse(input);
  if (!parsed.success) return invalid(state, parsed.error);
  const { boardId, weeks } = parsed.data;

  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return fail(state, NOT_FOUND);
  if (currentStreak(board.streak, now).completed) {
    return fail(state, "You can change the streak period once this one ends.");
  }

  const streak: StreakState = { weeks, count: 0, resetsAt: null, completed: false };
  return ok(
    updateBoard(state, boardId, (b) => ({ ...b, streak })),
    streak,
  );
}

/** Reads a state saved with JSON.stringify, turning dates back into Dates. Returns null if it doesn't look right. */
export function parseDemoState(json: string): DemoState | null {
  try {
    const state = JSON.parse(json) as DemoState;
    if (!Array.isArray(state?.boards) || typeof state.xp !== "number" || typeof state.nextId !== "number") return null;
    const toDate = (value: unknown) => (value == null ? null : new Date(value as string));
    return {
      ...state,
      boards: state.boards.map((board) => ({
        ...board,
        streak: { ...board.streak, resetsAt: toDate(board.streak.resetsAt) },
        groups: board.groups.map((group) => ({
          ...group,
          cards: group.cards.map((card) => ({
            ...card,
            dueDate: toDate(card.dueDate),
            game: card.game && { ...card.game, releaseDate: toDate(card.game.releaseDate) },
          })),
        })),
      })),
    };
  } catch {
    return null;
  }
}
