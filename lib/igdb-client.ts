import { z } from "zod";

if (!process.env.IGDB_CLIENT_SECRET) {
  throw new Error("environment variable IGDB_CLIENT_SECRET is not configured");
}

if (!process.env.IGDB_CLIENT_ID) {
  throw new Error("environment variable IGDB_CLIENT_ID is not configured");
}

// NOTE: This type may change, but these are the bare minimum for
// the UI to meaningfully render a game on the search menu and cards.
export type GameDetails = {
  id: number;
  title: string;
  boxArtUrl: string | null;
  releaseDate: Date | null;
  publishers: string[];
  timeToBeat: number | null; // IGDB's normally estimate, in seconds.
};

// IGDB endpoints are all POST with an APICalypse query string as the body.
// Rate limit: 4 req/s, max 8 open requests. Max `limit` is 500 per query.
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_BASE_URL = "https://api.igdb.com/v4";
const IGDB_IMAGE_URL = "https://images.igdb.com/igdb/image/upload";
const GAME_FIELDS =
  "name, first_release_date, cover.image_id, involved_companies.publisher, involved_companies.company.name";

class IGDBRateLimitError extends Error {}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.int().positive(),
  token_type: z.literal("bearer"),
});

const gameSchema = z.object({
  id: z.int().positive(),
  name: z.string(),
  first_release_date: z.int().optional(),
  cover: z.object({ image_id: z.string() }).optional(),
  involved_companies: z
    .array(
      z.object({
        publisher: z.boolean().optional(),
        company: z.object({ name: z.string() }).optional(),
      }),
    )
    .optional(),
});

const timeSchema = z.object({
  game_id: z.int().positive(),
  normally: z.int().nonnegative().optional(),
});

function toGameDetails(game: z.infer<typeof gameSchema>, timeToBeat: number | null): GameDetails {
  return {
    id: game.id,
    title: game.name,
    boxArtUrl: game.cover ? `${IGDB_IMAGE_URL}/t_cover_big/${game.cover.image_id}.jpg` : null,
    releaseDate: game.first_release_date === undefined ? null : new Date(game.first_release_date * 1000),
    publishers: [
      ...new Set(
        (game.involved_companies ?? []).flatMap((company) =>
          company.publisher && company.company ? [company.company.name] : [],
        ),
      ),
    ],
    timeToBeat,
  };
}

const detailsResponseSchema = z.array(
  z.discriminatedUnion("name", [
    z.object({ name: z.literal("games"), result: z.array(gameSchema) }),
    z.object({
      name: z.literal("times"),
      result: z.array(timeSchema),
    }),
  ]),
);

class IGDBClient {
  private id: string;
  private secret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private tokenRequest: Promise<void> | null = null;

  constructor(clientId: string, clientSecret: string) {
    this.id = clientId;
    this.secret = clientSecret;
  }

  private async setAccessToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return;
    if (this.tokenRequest) return this.tokenRequest;

    this.tokenRequest = this.requestAccessToken();
    try {
      await this.tokenRequest;
    } finally {
      this.tokenRequest = null;
    }
  }

  private async requestAccessToken(): Promise<void> {
    const requestedAt = Date.now();
    const response = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      cache: "no-store",
      body: new URLSearchParams({
        client_id: this.id,
        client_secret: this.secret,
        grant_type: "client_credentials",
      }),
    });
    if (!response.ok) {
      if (response.status === 429) throw new IGDBRateLimitError("Twitch token rate limit exceeded. Status: 429");
      throw new Error(`Twitch token request failed. Status: ${response.status}`);
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new Error("Twitch token response is not valid JSON");
    }

    const validatedResult = tokenResponseSchema.safeParse(result);
    if (!validatedResult.success) {
      const fields = z.flattenError(validatedResult.error).fieldErrors;
      throw new Error(`Invalid Twitch token response fields: ${fields}`);
    }

    const { access_token, expires_in } = validatedResult.data;
    // Refresh early, allowing short-lived tokens to retain most of their lifetime.
    const marginMs = Math.min(60_000, expires_in * 100);
    this.accessToken = access_token;
    this.tokenExpiresAt = requestedAt + expires_in * 1000 - marginMs;
  }

  private async query<T>(endpoint: string, body: string): Promise<T[]> {
    await this.setAccessToken();

    const response = await fetch(`${IGDB_BASE_URL}/${endpoint.replace(/^\/+/, "")}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Client-ID": this.id,
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new IGDBRateLimitError("IGDB rate limit exceeded. Status: 429");
      }
      throw new Error(`IGDB query failed. Status: ${response.status}`);
    }

    const result: unknown = await response.json();
    if (!Array.isArray(result)) {
      throw new Error("Invalid IGDB query response: expected an array");
    }
    return result as T[];
  }

  async getDetailsById(gameIds: number[]): Promise<GameDetails[] | null> {
    if (gameIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      throw new Error("Game IDs must be positive safe integers");
    }
    if (gameIds.length === 0) return [];

    const uniqueIds = [...new Set(gameIds)];
    const details = new Map<number, GameDetails>();
    for (let offset = 0; offset < uniqueIds.length; offset += 500) {
      const ids = uniqueIds.slice(offset, offset + 500).join(",");
      const response = detailsResponseSchema.parse(
        await this.query<unknown>(
          "multiquery",
          `
        query games "games" {
          fields ${GAME_FIELDS};
          where id = (${ids});
          limit 500;
        };
        query game_time_to_beats "times" {
          fields game_id, normally;
          where game_id = (${ids});
          limit 500;
        };
      `,
        ),
      );
      const games = response.find((entry) => entry.name === "games");
      const times = response.find((entry) => entry.name === "times");
      if (!games || !times || response.length !== 2) {
        throw new Error("Invalid IGDB multiquery response: expected games and times");
      }
      const timesById = new Map(times.result.map((time) => [time.game_id, time.normally]));
      for (const game of games.result) {
        details.set(game.id, toGameDetails(game, timesById.get(game.id) ?? null));
      }
    }
    // Preserve requested order (including duplicates); omit IDs IGDB didn't find.
    return gameIds.flatMap((id) => {
      const game = details.get(id);
      return game ? [game] : [];
    });
  }

  async searchByTitle(title: string, limit = 10, offset = 0): Promise<GameDetails[] | null> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new Error("Search limit must be an integer between 1 and 500");
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new Error("Search offset must be a nonnegative safe integer");
    }
    const searchTitle = title.trim();
    if (!searchTitle) return [];
    const escapedTitle = searchTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    try {
      const games = z.array(gameSchema).parse(
        await this.query<unknown>(
          "games",
          `
        search "${escapedTitle}";
        fields ${GAME_FIELDS};
        where version_parent = null;
        limit ${limit};
        offset ${offset};
      `,
        ),
      );
      if (games.length === 0) return [];
      // Completion times require the IDs returned by the search first.
      const times = z.array(timeSchema).parse(
        await this.query<unknown>(
          "game_time_to_beats",
          `
        fields game_id, normally;
        where game_id = (${games.map((game) => game.id).join(",")});
        limit 500;
      `,
        ),
      );
      const timesById = new Map(times.map((time) => [time.game_id, time.normally]));
      return games.map((game) => toGameDetails(game, timesById.get(game.id) ?? null));
    } catch (error) {
      if (error instanceof IGDBRateLimitError) return null;
      throw error;
    }
  }
}

export const igdbClient = new IGDBClient(process.env.IGDB_CLIENT_ID!, process.env.IGDB_CLIENT_SECRET!);
