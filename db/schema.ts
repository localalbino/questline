import { boolean, decimal, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export { user, session, account, verification } from "./auth-schema";

export const boardsTable = pgTable("boards", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 30 }).notNull(),
  ownerId: text("owner_id")
    .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" })
    .notNull(),
});

export const groupsTable = pgTable(
  "groups",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    rank: decimal().notNull(),
    title: varchar({ length: 30 }).notNull(),
    boardId: integer("board_id")
      .references(() => boardsTable.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
  },
  (table) => [index("groups_boardId_idx").on(table.boardId)],
);

export const cardsTable = pgTable(
  "cards",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    rank: decimal().notNull(),
    // Game data queried directly from IGDB using their query language.
    // This should map to the id on their platform.
    gameId: integer("game_id").notNull(),
    dueDate: timestamp("due_date"),
    isCompleted: boolean().notNull().default(false),
    groupId: integer("group_id")
      .references(() => groupsTable.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
  },
  (table) => [index("cards_groupId_idx").on(table.groupId)],
);

// Counters for limiting actions like sending emails. See lib/rate-limit.ts.
export const rateLimitsTable = pgTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  lastRequestAt: timestamp("last_request_at", { withTimezone: true }).notNull(),
});
// Total experience a user has earned from completing games.
export const experienceTable = pgTable("experience", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" }),
  xp: integer().notNull().default(0),
});
