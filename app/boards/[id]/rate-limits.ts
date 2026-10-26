import { consumeRateLimit, type RateLimitResult, type RateLimitRule } from "@/lib/rate-limit";
import type { Session } from "@/lib/session";

// IGDB allows 4 req/s for the whole app, so cap what each user can spend well below that.
// Each search costs two requests.
const SEARCH_RATE_LIMIT: RateLimitRule = { cooldown: 0, max: 30, window: 60 };
// Loading a board, adding a game, and completing a game each cost one.
const LOOKUP_RATE_LIMIT: RateLimitRule = { cooldown: 0, max: 30, window: 60 };

export function consumeSearchRateLimit(session: Session): Promise<RateLimitResult> {
  return consumeRateLimit(`search:${session.user.id}`, SEARCH_RATE_LIMIT);
}

export function consumeLookupRateLimit(session: Session): Promise<RateLimitResult> {
  return consumeRateLimit(`igdb-lookup:${session.user.id}`, LOOKUP_RATE_LIMIT);
}
