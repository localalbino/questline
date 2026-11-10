// IGDB game ids, checked against the API. Shared by the dev seed (db/seed.ts) and the demo boards.
export const GAMES = {
  witcher3: 1942,
  gta5: 1020,
  eldenRing: 119133,
  rdr2: 25076,
  botw: 7346,
  hades: 113112,
  celeste: 26226,
  hollowKnight: 14593,
  baldursGate3: 119171,
  stardewValley: 17000,
  outerWilds: 11737,
  persona5Royal: 114283,
  sekiro: 76882,
  balatro: 251833,
  hiFiRush: 233585,
  // IGDB has no time to beat for this one, so it exercises the "unknown" label.
  metroidDread: 323061,
  // Not a real game, so the card renders the "Unknown game" fallback.
  missing: 999_999_999,
} as const;
