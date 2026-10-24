import { defineRelationsPart } from "drizzle-orm";
import { authRelations } from "./auth-schema";
import { boardsTable, cardsTable, experienceTable, groupsTable, user } from "./schema";

const appRelations = defineRelationsPart(
  { user, boards: boardsTable, groups: groupsTable, cards: cardsTable, experience: experienceTable },
  (r) => ({
    user: {
      boards: r.many.boards({
        from: r.user.id,
        to: r.boards.ownerId,
      }),
      experience: r.one.experience({
        from: r.user.id,
        to: r.experience.userId,
      }),
    },
    boards: {
      owner: r.one.user({
        from: r.boards.ownerId,
        to: r.user.id,
        optional: false,
      }),
      groups: r.many.groups({
        from: r.boards.id,
        to: r.groups.boardId,
      }),
    },
    groups: {
      board: r.one.boards({
        from: r.groups.boardId,
        to: r.boards.id,
        optional: false,
      }),
      cards: r.many.cards({
        from: r.groups.id,
        to: r.cards.groupId,
      }),
    },
    cards: {
      group: r.one.groups({
        from: r.cards.groupId,
        to: r.groups.id,
        optional: false,
      }),
    },
    experience: {
      user: r.one.user({
        from: r.experience.userId,
        to: r.user.id,
        optional: false,
      }),
    },
  }),
);

export const relations = {
  ...authRelations,
  ...appRelations,
  // Both parts define `user`, so a plain spread would drop one side's relations.
  user: {
    ...authRelations.user,
    relations: {
      ...authRelations.user.relations,
      ...appRelations.user.relations,
    },
  },
};
