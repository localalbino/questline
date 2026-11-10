// Keeps a single user from eating our Neon free tier storage. Kept apart from db/boards.ts so client
// code (the demo) can import them without pulling in the database.
// Triggers in the enforce_limits migration enforce the same numbers in the database; change both together.
export const MAX_BOARDS_PER_USER = 3;
export const MAX_GROUPS_PER_BOARD = 10;
export const MAX_CARDS_PER_GROUP = 50;
