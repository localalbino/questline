import { xpForTimeToBeat } from "@/lib/experience";
import type { GameDetails } from "@/lib/igdb-client";
import { GAMES } from "@/lib/sample-games";
import type { DemoBoard, DemoState } from "./state";

type DemoCardSeed = { gameId: number; isCompleted?: boolean; dueInDays?: number };
type DemoBoardSeed = {
  title: string;
  streak: { weeks: number; count: number; endsInDays: number | null; completed: boolean };
  columns: { title: string; cards: DemoCardSeed[] }[];
};

// What every demo visitor starts with. Kept under MAX_BOARDS_PER_USER so creating a board works too.
const DEMO_BOARDS: DemoBoardSeed[] = [
  {
    title: "Backlog",
    // A running streak with this week still open, so checking off a game shows the streak paying out.
    streak: { weeks: 1, count: 3, endsInDays: 4, completed: false },
    columns: [
      {
        title: "Backlog",
        cards: [
          { gameId: GAMES.witcher3, dueInDays: -3 }, // overdue
          { gameId: GAMES.baldursGate3, dueInDays: 14 },
          { gameId: GAMES.eldenRing },
          { gameId: GAMES.rdr2 },
          { gameId: GAMES.persona5Royal },
          { gameId: GAMES.metroidDread },
        ],
      },
      {
        title: "Playing",
        cards: [{ gameId: GAMES.botw, dueInDays: 7 }, { gameId: GAMES.hades }, { gameId: GAMES.balatro }],
      },
      {
        title: "Beaten",
        cards: [
          { gameId: GAMES.celeste, isCompleted: true },
          { gameId: GAMES.hollowKnight, isCompleted: true },
          { gameId: GAMES.hiFiRush, isCompleted: true },
        ],
      },
      { title: "Wishlist", cards: [] },
    ],
  },
  {
    title: "Weekend picks",
    // Already completed for this period, so the period picker is locked until it ends.
    streak: { weeks: 2, count: 1, endsInDays: 9, completed: true },
    columns: [
      { title: "Up next", cards: [{ gameId: GAMES.outerWilds }, { gameId: GAMES.sekiro }] },
      { title: "Playing", cards: [{ gameId: GAMES.stardewValley, dueInDays: 5 }] },
      { title: "Done", cards: [{ gameId: GAMES.gta5, isCompleted: true }] },
    ],
  },
];

export const DEMO_GAME_IDS: number[] = [
  ...new Set(DEMO_BOARDS.flatMap((board) => board.columns.flatMap((column) => column.cards.map((c) => c.gameId)))),
];

// Starting XP on top of what the completed games are worth, so the level badge isn't at the very start.
const BONUS_XP = 400;

function daysFrom(now: Date, days: number, midnight: boolean): Date {
  const date = new Date(now);
  // Due dates are calendar days stored as UTC midnight (see GameCard.tsx).
  if (midnight) date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

/** The demo's starting boards, with game details from IGDB (null if it couldn't be reached). */
export function createDemoState(games: Map<number, GameDetails> | null, now: Date): DemoState {
  let nextId = 1;
  let xp = BONUS_XP;
  const boards: DemoBoard[] = DEMO_BOARDS.map((seed) => ({
    id: nextId++,
    title: seed.title,
    streak: {
      weeks: seed.streak.weeks,
      count: seed.streak.count,
      resetsAt: seed.streak.endsInDays === null ? null : daysFrom(now, seed.streak.endsInDays, false),
      completed: seed.streak.completed,
    },
    groups: seed.columns.map((column) => ({
      id: nextId++,
      title: column.title,
      cards: column.cards.map((card) => {
        const game = games?.get(card.gameId) ?? null;
        if (card.isCompleted) xp += xpForTimeToBeat(game?.timeToBeat ?? null) ?? 0;
        return {
          id: nextId++,
          gameId: card.gameId,
          dueDate: card.dueInDays === undefined ? null : daysFrom(now, card.dueInDays, true),
          isCompleted: card.isCompleted ?? false,
          game,
          // Games that start out beaten already counted toward their streak.
          streakCounted: card.isCompleted ?? false,
        };
      }),
    })),
  }));
  return { boards, xp, nextId };
}
