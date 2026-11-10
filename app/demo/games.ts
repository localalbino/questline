import { unstable_cache } from "next/cache";
import { igdbClient, type GameDetails } from "@/lib/igdb-client";

// The demo boards always start with the same games, so their details are cached for a day instead
// of spending IGDB requests on every visit. Errors aren't cached, so a failed fetch is retried next time.
const getCachedDetails = unstable_cache(
  async (gameIds: number[]) => {
    const games = await igdbClient.getDetailsById(gameIds);
    if (!games) throw new Error("IGDB returned no game details");
    return games;
  },
  ["demo-game-details"],
  { revalidate: 24 * 60 * 60 },
);

/** Details for the demo's starting games, or null if IGDB couldn't be reached. */
export async function getDemoGameDetails(gameIds: number[]): Promise<Map<number, GameDetails> | null> {
  try {
    const games = await getCachedDetails(gameIds);
    // The cache stores JSON, so dates come back as strings.
    return new Map(
      games.map((game) => [game.id, { ...game, releaseDate: game.releaseDate && new Date(game.releaseDate) }]),
    );
  } catch (error) {
    console.error("Failed to load demo game details from IGDB", error);
    return null;
  }
}
