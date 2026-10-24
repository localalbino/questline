/*
 * Seeds the dev database with accounts and boards for manual/live testing. Safe to re-run: it deletes
 * the seed accounts (cascading to their boards) and recreates them.
 *
 *   npm run db:seed
 *
 * Accounts (all share SEED_PASSWORD):
 *   dev@questline.test         verified, 3 boards (at the board limit)
 *   other@questline.test       verified, 1 board, for checking other users' boards 404
 *   fresh@questline.test       verified, no boards, for the create board flow
 *   unverified@questline.test  unverified, for the /verify redirect
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { inArray } from "drizzle-orm";
import { db } from "./index";
import { account, boardsTable, cardsTable, groupsTable, user } from "./schema";
import { MAX_CARDS_PER_GROUP, MAX_GROUPS_PER_BOARD } from "./boards";

const SEED_PASSWORD = "password123";

// IGDB game ids, checked against the API.
const GAMES = {
  witcher3: 1942,
  gta5: 1020,
  eldenRing: 119133,
  rdr2: 25076,
  botw: 7346,
  hades: 113112,
  celeste: 26226,
  hollowKnight: 14593,
  baldursGate3: 119171,
  stardewValley: 17000,
  outerWilds: 11737,
  persona5Royal: 114283,
  sekiro: 76882,
  balatro: 251833,
  hiFiRush: 233585,
  // IGDB has no time to beat for this one, so it exercises the "unknown" label.
  metroidDread: 323061,
  // Not a real game, so the card renders the "Unknown game" fallback.
  missing: 999_999_999,
} as const;

type SeedCard = { gameId: number; isCompleted?: boolean; dueInDays?: number };
type SeedBoard = { title: string; columns: { title: string; cards: SeedCard[] }[] };
type SeedUser = { email: string; name: string; emailVerified: boolean; boards: SeedBoard[] };

const allGameIds = Object.values(GAMES).filter((id) => id !== GAMES.missing);

const USERS: SeedUser[] = [
  {
    email: "dev@questline.test",
    name: "Dev",
    emailVerified: true,
    boards: [
      {
        title: "Backlog",
        columns: [
          {
            title: "Backlog",
            cards: [
              { gameId: GAMES.witcher3, dueInDays: -3 }, // overdue
              { gameId: GAMES.baldursGate3, dueInDays: 14 },
              { gameId: GAMES.eldenRing },
              { gameId: GAMES.rdr2 },
              { gameId: GAMES.persona5Royal },
              { gameId: GAMES.sekiro },
              { gameId: GAMES.metroidDread },
              { gameId: GAMES.missing },
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
              { gameId: GAMES.hollowKnight, isCompleted: true, dueInDays: -10 }, // past due but done
              { gameId: GAMES.outerWilds, isCompleted: true },
              { gameId: GAMES.hiFiRush, isCompleted: true },
            ],
          },
          { title: "Wishlist", cards: [] },
        ],
      },
      {
        // One column and one card short of the limits, to test hitting them.
        title: "At the limits",
        columns: Array.from({ length: MAX_GROUPS_PER_BOARD - 1 }, (_, i) => ({
          title: i === 0 ? "Almost full" : `Column ${i + 1}`,
          cards:
            i === 0
              ? Array.from({ length: MAX_CARDS_PER_GROUP - 1 }, (_, j) => ({
                  gameId: allGameIds[j % allGameIds.length],
                }))
              : [],
        })),
      },
      { title: "Empty board", columns: [] },
    ],
  },
  {
    email: "other@questline.test",
    name: "Other",
    emailVerified: true,
    boards: [
      {
        title: "Not yours",
        columns: [{ title: "Private", cards: [{ gameId: GAMES.stardewValley }] }],
      },
    ],
  },
  { email: "fresh@questline.test", name: "Fresh", emailVerified: true, boards: [] },
  { email: "unverified@questline.test", name: "Unverified", emailVerified: false, boards: [] },
];

function daysFromToday(days: number): Date {
  // Due dates are calendar days stored as UTC midnight (see GameCard.tsx).
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function seedUser(seed: SeedUser, passwordHash: string) {
  const userId = randomUUID();
  const now = new Date();
  await db.insert(user).values({ id: userId, name: seed.name, email: seed.email, emailVerified: seed.emailVerified });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  const boardIds: number[] = [];
  for (const board of seed.boards) {
    const [{ id: boardId }] = await db
      .insert(boardsTable)
      .values({ title: board.title, ownerId: userId })
      .returning({ id: boardsTable.id });
    boardIds.push(boardId);
    if (board.columns.length === 0) continue;

    const groups = await db
      .insert(groupsTable)
      .values(board.columns.map((column, rank) => ({ title: column.title, rank: String(rank), boardId })))
      .returning({ id: groupsTable.id, rank: groupsTable.rank });

    const cards = groups.flatMap((group) =>
      board.columns[Number(group.rank)].cards.map((card, rank) => ({
        groupId: group.id,
        rank: String(rank),
        gameId: card.gameId,
        isCompleted: card.isCompleted ?? false,
        dueDate: card.dueInDays === undefined ? null : daysFromToday(card.dueInDays),
      })),
    );
    if (cards.length > 0) await db.insert(cardsTable).values(cards);
  }
  return boardIds;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed with NODE_ENV=production");
  }

  // Board, group, and card rows cascade from the user.
  await db.delete(user).where(
    inArray(
      user.email,
      USERS.map((u) => u.email),
    ),
  );

  const passwordHash = await hashPassword(SEED_PASSWORD);
  for (const seed of USERS) {
    const boardIds = await seedUser(seed, passwordHash);
    console.log(`${seed.email}${boardIds.length ? ` -> boards ${boardIds.join(", ")}` : ""}`);
  }
  console.log(`All seed accounts use the password in db/seed.ts (SEED_PASSWORD).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
