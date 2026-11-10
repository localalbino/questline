"use client";

import type { GameDetails } from "@/lib/igdb-client";
import { useRouter } from "next/navigation";
import { createContext, useContext, type PropsWithChildren } from "react";
import {
  addCardAction,
  createGroupAction,
  deleteCardAction,
  deleteGroupAction,
  moveCardAction,
  moveGroupAction,
  renameGroupAction,
  searchGamesAction,
  setStreakWeeksAction,
  updateCardAction,
} from "./[id]/actions";
import type { ActionResult } from "./[id]/schema";
import type { BoardCard } from "./[id]/types";
import { deleteBoardAction } from "./actions";

/**
 * Everything the board UI does to change a board. The app's boards persist through server actions;
 * the demo swaps in an implementation that only changes state in the browser.
 */
export type BoardActions = {
  deleteBoard: typeof deleteBoardAction;
  createGroup: typeof createGroupAction;
  renameGroup: typeof renameGroupAction;
  moveGroup: typeof moveGroupAction;
  deleteGroup: typeof deleteGroupAction;
  // Takes the whole game (from the search results) so the demo doesn't need to look it up again.
  addCard: (input: { groupId: number; game: GameDetails }) => Promise<ActionResult<BoardCard>>;
  moveCard: typeof moveCardAction;
  deleteCard: typeof deleteCardAction;
  updateCard: typeof updateCardAction;
  setStreakWeeks: typeof setStreakWeeksAction;
  searchGames: typeof searchGamesAction;
  /** Reloads the board from wherever it's stored, after an action failed. Defaults to a router refresh. */
  refresh?: () => void;
};

export const serverBoardActions: BoardActions = {
  deleteBoard: deleteBoardAction,
  createGroup: createGroupAction,
  renameGroup: renameGroupAction,
  moveGroup: moveGroupAction,
  deleteGroup: deleteGroupAction,
  addCard: ({ groupId, game }) => addCardAction({ groupId, gameId: game.id }),
  moveCard: moveCardAction,
  deleteCard: deleteCardAction,
  updateCard: updateCardAction,
  setStreakWeeks: setStreakWeeksAction,
  searchGames: searchGamesAction,
};

const BoardActionsContext = createContext<BoardActions>(serverBoardActions);

export function BoardActionsProvider({ actions, children }: PropsWithChildren<{ actions: BoardActions }>) {
  return <BoardActionsContext value={actions}>{children}</BoardActionsContext>;
}

/** The board actions in effect: the server's, unless a BoardActionsProvider swapped them out. */
export function useBoardActions(): Required<BoardActions> {
  const actions = useContext(BoardActionsContext);
  const router = useRouter();
  return { ...actions, refresh: actions.refresh ?? (() => router.refresh()) };
}
