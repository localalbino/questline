"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { SEARCH_PAGE_SIZE, searchGamesSchema, type ActionResult } from "@/app/boards/[id]/schema";
import { SEARCH_RATE_LIMIT } from "@/app/boards/[id]/rate-limits";
import { igdbClient, type GameDetails } from "@/lib/igdb-client";
import { consumeRateLimit, type RateLimitRule } from "@/lib/rate-limit";

// Demo visitors have no account, so searches are limited per IP like a user's, and all of them share
// one budget so the demo can't eat the app's 4 req/s IGDB allowance. Each search costs two requests.
const DEMO_SEARCH_RATE_LIMIT: RateLimitRule = { cooldown: 0, max: 60, window: 60 };

async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/** searchGamesAction for the demo. The only demo action that runs on the server, since it needs IGDB. */
export async function searchDemoGamesAction(
  input: z.input<typeof searchGamesSchema>,
): Promise<ActionResult<{ games: GameDetails[]; hasMore: boolean }>> {
  const parsed = searchGamesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { query, offset } = parsed.data;

  const visitor = await consumeRateLimit(`demo-search:${await clientIp()}`, SEARCH_RATE_LIMIT);
  if (!visitor.allowed) return { success: false, error: `Too many searches. Try again in ${visitor.retryAfter}s.` };
  const everyone = await consumeRateLimit("demo-search", DEMO_SEARCH_RATE_LIMIT);
  if (!everyone.allowed) {
    return { success: false, error: `The demo is busy right now. Try again in ${everyone.retryAfter}s.` };
  }

  const games = await igdbClient.searchByTitle(query, SEARCH_PAGE_SIZE, offset);
  if (!games) return { success: false, error: "IGDB is busy right now. Try again in a moment." };
  return { success: true, data: { games, hasMore: games.length === SEARCH_PAGE_SIZE } };
}
