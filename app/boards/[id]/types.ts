import type { GameDetails } from "@/lib/igdb-client";

export type BoardCard = {
  id: number;
  gameId: number;
  dueDate: Date | null;
  isCompleted: boolean;
  // Null when IGDB couldn't be reached or no longer knows the game.
  game: GameDetails | null;
};

export type BoardGroup = {
  id: number;
  title: string;
  cards: BoardCard[];
};
