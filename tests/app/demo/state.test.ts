// @vitest-environment node
import { describe, expect, test } from "vitest";
import { createDemoState, DEMO_GAME_IDS } from "@/app/demo/demo-boards";
import * as demo from "@/app/demo/state";
import type { DemoState } from "@/app/demo/state";
import { xpForStreak } from "@/lib/experience";
import type { GameDetails } from "@/lib/igdb-client";
import { MAX_BOARDS_PER_USER, MAX_GROUPS_PER_BOARD } from "@/lib/limits";

const NOW = new Date("2026-11-10T12:00:00Z");
const HOUR = 3600;

function game(id: number, hours: number | null = 10): GameDetails {
  return {
    id,
    title: `Game ${id}`,
    boxArtUrl: null,
    releaseDate: new Date("2020-01-01T00:00:00Z"),
    publishers: [],
    timeToBeat: hours === null ? null : hours * HOUR,
  };
}

const games = new Map(DEMO_GAME_IDS.map((id) => [id, game(id)]));

function initial(): DemoState {
  return createDemoState(games, NOW);
}

function expectOk<T>(step: demo.Step<T>): { state: DemoState; data: T } {
  if (!step.result.success) throw new Error(`Expected success, got: ${step.result.error}`);
  return { state: step.state, data: step.result.data };
}

function cards(state: DemoState, boardIndex = 0) {
  return state.boards[boardIndex].groups.map((group) => group.cards.map((card) => card.id));
}

describe("createDemoState", () => {
  test("starts below the board limit with unique ids", () => {
    const state = initial();
    expect(state.boards.length).toBeLessThan(MAX_BOARDS_PER_USER);
    const ids = state.boards.flatMap((b) => [b.id, ...b.groups.flatMap((g) => [g.id, ...g.cards.map((c) => c.id)])]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...ids)).toBeLessThan(state.nextId);
  });

  test("still builds when IGDB couldn't be reached", () => {
    const state = createDemoState(null, NOW);
    expect(state.boards[0].groups[0].cards[0].game).toBeNull();
  });
});

describe("boards and columns", () => {
  test("creates boards up to the limit", () => {
    let state = initial();
    while (state.boards.length < MAX_BOARDS_PER_USER) {
      state = expectOk(demo.createBoard(state, { title: "Another" })).state;
    }
    const step = demo.createBoard(state, { title: "One too many" });
    expect(step.result.success).toBe(false);
    expect(step.state).toBe(state);
  });

  test("validates board titles like the real form", () => {
    expect(demo.createBoard(initial(), { title: "x" }).result.success).toBe(false);
  });

  test("deletes a board", () => {
    const state = initial();
    const next = expectOk(demo.deleteBoard(state, { boardId: state.boards[0].id })).state;
    expect(next.boards.map((b) => b.id)).toEqual([state.boards[1].id]);
  });

  test("adds, renames, moves, and deletes columns", () => {
    let state = initial();
    const boardId = state.boards[0].id;
    const { state: added, data: group } = expectOk(demo.createGroup(state, { boardId, title: "  Later  " }));
    state = added;
    expect(group.title).toBe("Later");
    expect(state.boards[0].groups.at(-1)?.id).toBe(group.id);

    state = expectOk(demo.renameGroup(state, { groupId: group.id, title: "Someday" })).state;
    state = expectOk(demo.moveGroup(state, { groupId: group.id, toIndex: 0 })).state;
    expect(state.boards[0].groups[0]).toMatchObject({ id: group.id, title: "Someday" });

    state = expectOk(demo.deleteGroup(state, { groupId: group.id })).state;
    expect(state.boards[0].groups.some((g) => g.id === group.id)).toBe(false);
  });

  test("caps columns per board", () => {
    let state = initial();
    const boardId = state.boards[0].id;
    while (state.boards[0].groups.length < MAX_GROUPS_PER_BOARD) {
      state = expectOk(demo.createGroup(state, { boardId, title: "More" })).state;
    }
    expect(demo.createGroup(state, { boardId, title: "Too many" }).result.success).toBe(false);
  });
});

describe("cards", () => {
  test("adds a searched game to the end of a column", () => {
    const state = initial();
    const groupId = state.boards[0].groups[3].id;
    const { state: next, data: card } = expectOk(demo.addCard(state, { groupId, game: game(42) }));
    expect(card).toMatchObject({ gameId: 42, isCompleted: false, dueDate: null });
    expect(next.boards[0].groups[3].cards.map((c) => c.id)).toEqual([card.id]);
    expect(next.nextId).toBe(state.nextId + 1);
  });

  test("moves a card within and between columns", () => {
    let state = initial();
    const [backlog, playing] = state.boards[0].groups;
    const cardId = backlog.cards[0].id;

    state = expectOk(demo.moveCard(state, { cardId, toGroupId: backlog.id, toIndex: 2 })).state;
    expect(cards(state)[0][2]).toBe(cardId);

    state = expectOk(demo.moveCard(state, { cardId, toGroupId: playing.id, toIndex: 0 })).state;
    expect(cards(state)[0]).not.toContain(cardId);
    expect(cards(state)[1][0]).toBe(cardId);
  });

  test("won't move a card to another board", () => {
    const state = initial();
    const cardId = state.boards[0].groups[0].cards[0].id;
    const otherGroup = state.boards[1].groups[0].id;
    expect(demo.moveCard(state, { cardId, toGroupId: otherGroup, toIndex: 0 }).result.success).toBe(false);
  });

  test("deletes a card", () => {
    const state = initial();
    const cardId = state.boards[0].groups[0].cards[0].id;
    const next = expectOk(demo.deleteCard(state, { cardId })).state;
    expect(cards(next).flat()).not.toContain(cardId);
  });

  test("sets a due date without touching XP", () => {
    const state = initial();
    const cardId = state.boards[0].groups[0].cards[0].id;
    const dueDate = new Date("2026-12-01T00:00:00Z");
    const { state: next, data } = expectOk(demo.updateCard(state, { cardId, dueDate }, NOW));
    expect(data).toEqual({ xp: null, streak: null });
    expect(next.xp).toBe(state.xp);
    expect(next.boards[0].groups[0].cards[0].dueDate).toEqual(dueDate);
  });
});

describe("XP and streaks", () => {
  test("checking off a game awards its XP and completes the streak once", () => {
    let state = initial();
    const board = state.boards[0];
    const [first, second] = board.groups[0].cards;
    const streakXp = xpForStreak(board.streak.weeks, board.streak.count + 1);

    const checked = expectOk(demo.updateCard(state, { cardId: first.id, isCompleted: true }, NOW));
    expect(checked.data.xp).toBe(state.xp + 100 + streakXp);
    expect(checked.data.streak).toMatchObject({ count: board.streak.count + 1, completed: true });
    state = checked.state;

    // The period is done, so the next game only pays its own XP.
    const again = expectOk(demo.updateCard(state, { cardId: second.id, isCompleted: true }, NOW));
    expect(again.data.xp).toBe(state.xp + 100);
    expect(again.data.streak?.count).toBe(board.streak.count + 1);
  });

  test("unchecking takes the game's XP back and rechecking can't farm the streak", () => {
    let state = initial();
    const cardId = state.boards[0].groups[0].cards[0].id;
    state = expectOk(demo.updateCard(state, { cardId, isCompleted: true }, NOW)).state;
    const afterCheck = state.xp;

    state = expectOk(demo.updateCard(state, { cardId, isCompleted: false }, NOW)).state;
    expect(state.xp).toBe(afterCheck - 100);

    // Next period: the streak is open again, but this card has already counted.
    const later = new Date(state.boards[0].streak.resetsAt!.getTime() + 1000);
    const { data } = expectOk(demo.updateCard(state, { cardId, isCompleted: true }, later));
    expect(data.xp).toBe(afterCheck);
    expect(data.streak?.completed).toBe(false);
  });

  test("XP never drops below zero", () => {
    const state = { ...initial(), xp: 0 };
    const beaten = state.boards[0].groups[2].cards[0];
    const { data } = expectOk(demo.updateCard(state, { cardId: beaten.id, isCompleted: false }, NOW));
    expect(data.xp).toBe(0);
  });

  test("games without a time to beat award no XP", () => {
    const state = createDemoState(new Map(DEMO_GAME_IDS.map((id) => [id, game(id, null)])), NOW);
    const cardId = state.boards[0].groups[0].cards[0].id;
    const { data } = expectOk(demo.updateCard({ ...state, xp: 0 }, { cardId, isCompleted: true }, NOW));
    expect(data.xp).toBe(xpForStreak(1, state.boards[0].streak.count + 1));
  });

  test("the streak period can change only while this period is open", () => {
    const state = initial();
    const [open, completed] = state.boards;
    const { data } = expectOk(demo.setStreakWeeks(state, { boardId: open.id, weeks: 4 }, NOW));
    expect(data).toEqual({ weeks: 4, count: 0, resetsAt: null, completed: false });
    expect(demo.setStreakWeeks(state, { boardId: completed.id, weeks: 4 }, NOW).result.success).toBe(false);
  });
});

test("state survives a JSON round trip with its dates", () => {
  const state = initial();
  const parsed = demo.parseDemoState(JSON.stringify(state));
  expect(parsed).toEqual(state);
  expect(parsed?.boards[0].streak.resetsAt).toBeInstanceOf(Date);
  expect(demo.parseDemoState("not json")).toBeNull();
  expect(demo.parseDemoState("{}")).toBeNull();
});
