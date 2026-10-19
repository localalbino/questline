// @vitest-environment node

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test, vi } from "vitest";

const tokenUrl = "https://id.twitch.tv/oauth2/token";
const apiUrl = "https://api.igdb.com/v4";
type Reply = Response | (() => Response | Promise<Response>);
let replies: Reply[];
let calls: { url: string; options: RequestInit | undefined }[];
let now: number;

// Import after resetting modules so each test gets a fresh singleton.
async function loadClient() {
  return (await import("@/lib/igdb-client")).igdbClient;
}

function token(value = "token", expiresIn = 3600) {
  return Response.json({ access_token: value, expires_in: expiresIn, token_type: "bearer" });
}

function details(games: unknown[] = [], times: unknown[] = []) {
  return Response.json([
    { name: "times", result: times },
    { name: "games", result: games },
  ]);
}

function body(index: number) {
  return String(calls[index].options?.body);
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("IGDB_CLIENT_ID", "test-client");
  vi.stubEnv("IGDB_CLIENT_SECRET", "test-secret");
  replies = [];
  calls = [];
  now = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
    calls.push({ url: String(url), options });
    const reply = replies.shift();
    assert.ok(reply, `Unexpected fetch: ${String(url)}`);
    return typeof reply === "function" ? reply() : reply;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  assert.equal(replies.length, 0, "Every queued response should be consumed");
});

describe("authentication", () => {
  for (const key of ["IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"]) {
    test(`rejects missing ${key} at module load`, async () => {
      vi.stubEnv(key, undefined);
      await assert.rejects(loadClient, new RegExp(`environment variable ${key} is not configured`));
      assert.equal(calls.length, 0);
    });
  }

  test("sends credentials and authenticated POST requests, reusing a valid token", async () => {
    const client = await loadClient();
    replies.push(token(), details(), details());
    await client.getDetailsById([1]);
    await client.getDetailsById([2]);
    assert.equal(calls[0].url, tokenUrl);
    assert.equal(calls[0].options?.method, "POST");
    assert.equal(calls[0].options?.cache, "no-store");
    assert.ok(calls[0].options?.body instanceof URLSearchParams);
    assert.deepEqual(Object.fromEntries(calls[0].options.body), {
      client_id: "test-client",
      client_secret: "test-secret",
      grant_type: "client_credentials",
    });
    for (const call of calls.slice(1)) {
      assert.equal(call.url, `${apiUrl}/multiquery`);
      assert.equal(call.options?.method, "POST");
      assert.equal(call.options?.cache, "no-store");
      assert.deepEqual(Object.fromEntries(new Headers(call.options?.headers)), {
        "client-id": "test-client",
        authorization: "Bearer token",
        "content-type": "text/plain",
        accept: "application/json",
      });
    }
    assert.equal(calls.length, 3);
  });

  for (const [lifetime, refreshAfter] of [
    [3600, 3_540_000],
    [10, 9000],
  ]) {
    test(`refreshes a ${lifetime}s token at its early-refresh boundary`, async () => {
      const client = await loadClient();
      const start = now;
      replies.push(token("first", lifetime), details(), details(), token("second", lifetime), details());
      await client.getDetailsById([1]);
      now = start + refreshAfter - 1;
      await client.getDetailsById([1]);
      now += 1;
      await client.getDetailsById([1]);
      assert.deepEqual(
        calls.map((call) => call.url),
        [tokenUrl, `${apiUrl}/multiquery`, `${apiUrl}/multiquery`, tokenUrl, `${apiUrl}/multiquery`],
      );
      assert.equal(new Headers(calls[4].options?.headers).get("Authorization"), "Bearer second");
    });
  }

  test("counts token lifetime from the request start", async () => {
    const client = await loadClient();
    replies.push(
      () => {
        now += 8000;
        return token("first", 10);
      },
      details(),
      token("second"),
      details(),
    );
    await client.getDetailsById([1]);
    now += 1000;
    await client.getDetailsById([1]);
    assert.equal(calls.filter((call) => call.url === tokenUrl).length, 2);
  });

  test("shares an in-flight token request between concurrent calls", async () => {
    const client = await loadClient();
    let resolveToken!: (response: Response) => void;
    replies.push(
      () =>
        new Promise<Response>((resolve) => {
          resolveToken = resolve;
        }),
      details(),
      details(),
    );
    const first = client.getDetailsById([1]);
    const second = client.getDetailsById([2]);
    assert.equal(calls.length, 1);
    resolveToken(token());
    assert.deepEqual(await Promise.all([first, second]), [[], []]);
    assert.equal(calls.filter((call) => call.url === tokenUrl).length, 1);
  });

  const invalidTokens = [
    {},
    { access_token: "", expires_in: 3600, token_type: "bearer" },
    { access_token: "token", expires_in: 0, token_type: "bearer" },
    { access_token: "token", expires_in: 1.5, token_type: "bearer" },
    { access_token: "token", expires_in: 3600, token_type: "Bearer" },
  ];
  for (const payload of invalidTokens) {
    test(`rejects invalid token fields: ${JSON.stringify(payload)}`, async () => {
      replies.push(Response.json(payload));
      await assert.rejects((await loadClient()).getDetailsById([1]), /Invalid Twitch token response fields/);
      assert.equal(calls.length, 1);
    });
  }

  for (const [label, reply, message] of [
    ["HTTP failure", () => new Response(null, { status: 500 }), /Twitch token request failed. Status: 500/],
    ["invalid JSON", () => new Response("{"), /Twitch token response is not valid JSON/],
    [
      "network failure",
      () => {
        throw new Error("offline");
      },
      /offline/,
    ],
  ] as const) {
    test(`retries authentication after ${label}`, async () => {
      const client = await loadClient();
      replies.push(reply);
      await assert.rejects(client.getDetailsById([1]), message);
      replies.push(token(), details());
      assert.deepEqual(await client.getDetailsById([1]), []);
      assert.equal(calls.filter((call) => call.url === tokenUrl).length, 2);
    });
  }
});

describe("searchByTitle", () => {
  test("returns no results for blank input without fetching", async () => {
    const client = await loadClient();
    for (const title of ["", " \t\n "]) assert.deepEqual(await client.searchByTitle(title), []);
    assert.equal(calls.length, 0);
  });

  for (const limit of [0, -1, 501, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    test(`rejects invalid limit ${limit} without fetching`, async () => {
      await assert.rejects((await loadClient()).searchByTitle("test", limit), /Search limit/);
      assert.equal(calls.length, 0);
    });
  }
  for (const offset of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    test(`rejects invalid offset ${offset} without fetching`, async () => {
      await assert.rejects((await loadClient()).searchByTitle("test", 10, offset), /Search offset/);
      assert.equal(calls.length, 0);
    });
  }

  test("trims and escapes the title and requests the selected page", async () => {
    replies.push(token(), Response.json([]));
    assert.deepEqual(await (await loadClient()).searchByTitle(' A "B" \\ C ', 20, 40), []);
    assert.equal(calls[1].url, `${apiUrl}/games`);
    assert.ok(body(1).includes('search "A \\"B\\" \\\\ C";'));
    assert.match(body(1), /where version_parent = null;/);
    assert.match(
      body(1),
      /fields name, first_release_date, cover.image_id, involved_companies.publisher, involved_companies.company.name;/,
    );
    assert.match(body(1), /limit 20;/);
    assert.match(body(1), /offset 40;/);
    assert.equal(calls.length, 2, "Empty results must skip completion-time lookup");
  });

  for (const limit of [undefined, 1, 500]) {
    test(`accepts ${limit === undefined ? "default pagination" : `limit ${limit}`}`, async () => {
      replies.push(token(), Response.json([]));
      await (await loadClient()).searchByTitle("test", limit);
      assert.match(body(1), new RegExp(`limit ${limit ?? 10};`));
      assert.match(body(1), /offset 0;/);
    });
  }

  test("preserves search order and joins completion times by game ID", async () => {
    replies.push(
      token(),
      Response.json([
        { id: 2, name: "First" },
        { id: 1, name: "Second" },
        { id: 3, name: "Third" },
      ]),
      Response.json([{ game_id: 1, normally: 120 }, { game_id: 2, normally: 0 }, { game_id: 3 }]),
    );
    const result = await (await loadClient()).searchByTitle("test");
    assert.deepEqual(
      result?.map((game) => [game.id, game.timeToBeat]),
      [
        [2, 0],
        [1, 120],
        [3, null],
      ],
    );
    assert.equal(calls[2].url, `${apiUrl}/game_time_to_beats`);
    assert.match(body(2), /fields game_id, normally;/);
    assert.match(body(2), /where game_id = \(2,1,3\);/);
    assert.match(body(2), /limit 500;/);
  });
});

describe("getDetailsById", () => {
  test("returns an empty array without fetching for no IDs", async () => {
    assert.deepEqual(await (await loadClient()).getDetailsById([]), []);
    assert.equal(calls.length, 0);
  });

  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    test(`rejects invalid ID ${id} before fetching`, async () => {
      await assert.rejects((await loadClient()).getDetailsById([1, id]), /positive safe integers/);
      assert.equal(calls.length, 0);
    });
  }

  test("deduplicates queries, preserves requested order and duplicates, and omits missing games", async () => {
    replies.push(
      token(),
      details([
        { id: 1, name: "One" },
        { id: 2, name: "Two" },
      ]),
    );
    const result = await (await loadClient()).getDetailsById([2, 1, 999, 2]);
    assert.deepEqual(
      result?.map((game) => game.id),
      [2, 1, 2],
    );
    assert.match(body(1), /where id = \(2,1,999\);/);
    assert.match(body(1), /where game_id = \(2,1,999\);/);
    assert.match(body(1), /query games "games"/);
    assert.match(body(1), /query game_time_to_beats "times"/);
    assert.equal(calls.length, 2);
  });

  for (const count of [500, 501]) {
    test(`batches ${count} unique IDs into requests of at most 500`, async () => {
      const ids = Array.from({ length: count }, (_, index) => index + 1);
      replies.push(token(), details([{ id: 1, name: "First" }]));
      if (count > 500) replies.push(details([{ id: 501, name: "Last" }], [{ game_id: 501, normally: 60 }]));
      const result = await (await loadClient()).getDetailsById([...ids, 1]);
      assert.match(body(1), new RegExp(`where id = \\(${ids.slice(0, 500).join(",")}\\);`));
      assert.equal((body(1).match(/limit 500;/g) ?? []).length, 2);
      assert.deepEqual(
        result?.map((game) => [game.id, game.timeToBeat]),
        count === 500
          ? [
              [1, null],
              [1, null],
            ]
          : [
              [1, null],
              [501, 60],
              [1, null],
            ],
      );
      if (count > 500) {
        assert.match(body(2), /where id = \(501\);/);
        assert.match(body(2), /where game_id = \(501\);/);
      }
      assert.equal(calls.length, count === 500 ? 2 : 3);
    });
  }
});

// Both public methods must expose the same normalized game metadata.
for (const method of ["search", "details"] as const) {
  describe(`${method} result mapping`, () => {
    test("maps metadata, filters and deduplicates publishers, and keeps zero values", async () => {
      const games = [
        {
          id: 1,
          name: "Complete",
          first_release_date: 0,
          cover: { image_id: "cover" },
          involved_companies: [
            { publisher: false, company: { name: "Developer" } },
            { company: { name: "Unknown role" } },
            { publisher: true },
            { publisher: true, company: { name: "Publisher" } },
            { publisher: true, company: { name: "Publisher" } },
            { publisher: true, company: { name: "Other" } },
          ],
        },
        { id: 2, name: "Minimal" },
        { id: 3, name: "Missing estimate" },
      ];
      const times = [{ game_id: 1, normally: 0 }, { game_id: 3 }];
      replies.push(token());
      if (method === "search") replies.push(Response.json(games), Response.json(times));
      else replies.push(details(games, times));
      const client = await loadClient();
      const result = method === "search" ? await client.searchByTitle("test") : await client.getDetailsById([1, 2, 3]);
      assert.deepEqual(result, [
        {
          id: 1,
          title: "Complete",
          releaseDate: new Date(0),
          boxArtUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/cover.jpg",
          publishers: ["Publisher", "Other"],
          timeToBeat: 0,
        },
        { id: 2, title: "Minimal", releaseDate: null, boxArtUrl: null, publishers: [], timeToBeat: null },
        { id: 3, title: "Missing estimate", releaseDate: null, boxArtUrl: null, publishers: [], timeToBeat: null },
      ]);
    });
  });
}

describe("response failures", () => {
  for (const stage of ["token", "search", "times", "details"] as const) {
    async function request() {
      const client = await loadClient();
      return stage === "details" ? client.getDetailsById([1]) : client.searchByTitle("test");
    }
    function queueFailure(reply: Reply) {
      if (stage !== "token") replies.push(token());
      if (stage === "times") replies.push(Response.json([{ id: 1, name: "Game" }]));
      replies.push(reply);
    }

    test(`${stage} rate limit ${stage === "details" ? "rejects" : "returns null"}`, async () => {
      queueFailure(new Response(null, { status: 429 }));
      if (stage === "details") await assert.rejects(request(), /IGDB rate limit exceeded. Status: 429/);
      else assert.equal(await request(), null);
    });

    if (stage === "token") continue;

    test(`${stage} HTTP errors propagate`, async () => {
      queueFailure(new Response(null, { status: 503 }));
      await assert.rejects(request(), /IGDB query failed. Status: 503/);
    });
    test(`${stage} network errors propagate`, async () => {
      queueFailure(() => {
        throw new Error("offline");
      });
      await assert.rejects(request(), /offline/);
    });
    test(`${stage} malformed JSON rejects`, async () => {
      queueFailure(new Response("{"));
      await assert.rejects(request(), SyntaxError);
    });
    test(`${stage} non-array responses reject`, async () => {
      queueFailure(Response.json({ result: [] }));
      await assert.rejects(request(), /expected an array/);
    });
    test(`${stage} invalid records reject`, async () => {
      queueFailure(
        stage === "details"
          ? details([{ id: 1 }])
          : Response.json(stage === "times" ? [{ game_id: 1, normally: -1 }] : [{ id: 1 }]),
      );
      await assert.rejects(request(), { name: "ZodError" });
    });
  }

  for (const payload of [
    [],
    [{ name: "games", result: [] }],
    [{ name: "times", result: [] }],
    [
      { name: "games", result: [] },
      { name: "games", result: [] },
    ],
    [
      { name: "games", result: [] },
      { name: "times", result: [] },
      { name: "times", result: [] },
    ],
  ]) {
    test(`rejects missing or duplicate multiquery sections: ${JSON.stringify(payload)}`, async () => {
      replies.push(token(), Response.json(payload));
      await assert.rejects((await loadClient()).getDetailsById([1]), /expected games and times/);
    });
  }
});
