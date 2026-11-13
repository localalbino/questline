# Questline

This project is a Trello-inspired gaming backlog management platform
with an integrated XP system to gamify finally catching up on your
backlog.
(Let's be honest, you have at least 10 games you need to play that you haven't gotten to yet...)

**Try it out:** [https://questline.localalbino.com](Questline) No account needed: the demo at `/demo`
(linked from the home page) runs the real board UI, but everything stays in your
browser tab and nothing gets written to the database. Sign up if you want your
boards and XP to stick around.

<!-- TODO: usage video + screenshots -->

## The general concept and XP System

You build out Kanban-style boards with the games that you want to get
completed over the next few weeks, months, whatever, pulled from the IGDB database.
Then, you can set due dates for yourself with XP rewards for completion.

Each game rewards XP based on its time-to-beat data from IGDB, so the
harder the grind, the greater the reward. For each board, you can also
set a streak goal: complete games consecutively within the time limit to
bump your streak and XP multiplier.

The numbers: a game is worth 10 XP per hour of its time-to-beat, and
reaching level L takes 100 * (L - 1)^2 total XP. Streaks pay 10 XP per day
of the streak period times your current streak count, capped at 10x. I
went with a quadratic curve so the first few levels come quickly, but
each level after that takes a bit more than the last. A linear curve
would make level 30 feel the same as level 3, and an exponential one
would make it feel impossible for anyone who isn't playing games full time.

## Technology Used

This project is built on top of a Next.js stack, as it provides a nice
modern router for CRUD-style applications that I was able to get up and
running with quickly. Plus, with it being hosted on Vercel, deployment
was stupid simple.

### Frontend

- **React**: Used by Next as the default frontend framework. React
  would be my choice in most cases, as it has a mature ecosystem of
  plugins, component libraries, and tutorials for building quickly.
  Plus, my agent has plenty of training data to go around with it :).
- **TailwindCSS**: Used for the app's styling across all pages and
  components. This is built into Next, but it was my default choice anyway. It
  allowed for quick ideation and prototyping of the auth and dashboard
  pages. I avoided using a component library such as shadcn/ui here so that
  I could get some practice in with Tailwind itself. That said, in general,
  I think it's probably best to pick up a component library when building
  small apps like this.
- **dnd-kit**: The main package for managing the drag and
  drop functions on a board's dashboard. This library seems to be a
  standard pick in the industry, and I was able to get functionality up
  quickly.
- **Zod**: Zod allowed me to easily validate data on the frontend before
  sending it to the server. You just build out a schema with defined rules,
  and it will handle parsing and errors.

### Backend/Database

- **Drizzle ORM**: A standard modern pick for a TypeScript ORM. I really
  enjoyed using this as a tool, since it stays close to SQL while
  still giving me the benefits that you'd want from TypeScript's type
  system. Would definitely use this again on any future TypeScript
  projects.
- **Better Auth**: Better Auth handles all of the application's
  authentication and authorization. It allows me to place auth
  directly into my own database without the need for an external provider.
  It's easy to configure and has APIs for both the client and server.
  I decided to stick with Better Auth's default session implementation with
  cookies. I didn't need to expose an API to both a website and a mobile app
  for my setup, so I felt that bearer auth would be overkill.
- **Resend**: Resend was my default choice for an email provider. I'd
  used this service before as part of my college capstone. It's easy to
  set up and easy to configure. I use it to send verification emails for sign
  up and for password resets. Its free tier is generous enough for a tiny
  app such as this one.
- **Neon**: Neon was the database provider I chose to use for this
  project. It runs on PostgreSQL, an industry standard at this point, and
  has several features that made it wonderful to work with for this project.
  First, I made heavy use of its database branching for
  development. I found this to be arguably the most useful thing they
  provide. I could just create a branch on the dashboard and update my .env.
  Second, the Drizzle and Next integrations worked seamlessly. I could run
  migrations through drizzle-kit and immediately see the results in the
  Vercel deployment.

## Design decisions

### Optimistic boards, no revalidation

Board changes show up instantly on the client, and the server action
runs in the background. I don't revalidate after actions; the board only
refreshes when an action fails.

The reason is IGDB. A refresh re-fetches every game on the board from
IGDB, which is rate-limited, so refreshing after every drag or checkbox
would burn through the budget fast. The trade-off is that the client and
server can drift apart (say, if you have the same board open in two tabs)
until a failure triggers a refresh. For a personal backlog, I felt that
was an acceptable price for a board that feels instant.

### Streaks without a cron job

Nothing runs when a streak period ends. Instead, the current streak is
worked out from what's stored whenever it's read.

A scheduled job would mean paying for (or working around the limits of)
Vercel cron, plus one more moving part that can silently break. Since a
streak is just a period length, a count, a reset time, and whether this
period has been completed, the real state can be worked out from those
fields and the current time. That logic is a pure function, which also
makes it easy to test.

Writes use optimistic concurrency: the update only goes through if the
stored streak still matches what was read. That way, two tabs checking off
games at the same moment can't both complete the same period. Each card
also has a `streakCounted` flag, so unchecking and rechecking a game
can't be used to farm streak XP.

### Rate limiting in Postgres

IGDB allows 4 requests per second for the whole app, so every user gets
their own search/lookup budget. Auth email and sign-in endpoints are
limited too.

I already had a database, so I didn't see the point in adding Redis or
Upstash just for this. A single upsert checks and increments the counter at
the same time, so concurrent requests can't all slip past the same check.
The trade-off is a database round-trip on every check, which would matter
at scale but is barely noticeable for an app this size.

### Storing only the game ID

Cards only store IGDB's `gameId`; the title, box art and time-to-beat are
fetched from IGDB when a board loads.

This way, there are no stale copies of game data to keep in sync. If IGDB
fixes a title or updates a time-to-beat, boards pick it up automatically.
The trade-off is more IGDB calls per board load, which is exactly why the
rate limiting and no-revalidation choices above exist.

### Limits enforced twice

Caps on boards, columns and cards are checked in app code and again by
database triggers.

The app check gives users a friendly error message, while the trigger
catches races where two requests both pass the app check at once. Trigger
violations get mapped back to the same friendly errors. The trade-off is
that the numbers live in two places (`lib/limits.ts` and the migration),
so changing a limit means changing both.

### Card ordering

Columns and cards each have a numerical rank in the database, which keeps
boards in order on the server and across page reloads. Every move rewrites
the affected list's ranks to 0..n in one batch, skipping rows that didn't
change. I had considered a system like Jira's LexoRank, but decided that
it would be too complicated for the general uses of the app. Rewriting is
O(n), but lists are capped at 50 cards and moves are a cold path, so the
complexity outweighs any performance gained here.

## My workflow

For this project, I tried a mix of agentic engineering and hand coding
workflows. Specifically, I hand-rolled most of the Better Auth
configurations and server actions while letting Claude Code perform
security checks. For the boards and dashboard pages, I would provide a
feature architecture to Claude and incrementally tweak the output until
results matched what I'd desired.

**Which workflow did I prefer?**: Working with Claude directly was the
most efficient approach I found. I worked on small features, one at a
time, to ensure that both the agent and I knew what had changed and what the
underlying architecture was. In general, I tried to follow
Mitchell Hashimoto's **"whiteboard defense"** principle. I should be able
to defend any architectural decision made and explain why I chose it. I don't
necessarily need to know what each line of code says, but I must know the
underlying architecture well. The design decisions above are what that
looks like in practice.

## Testing

The streak and XP logic lives in `lib/` with no framework or database
imports, so it can be unit tested with Vitest without spinning anything up.
The demo's state logic and the IGDB client (with mocked requests) are
covered the same way. Vitest can't render async server components, so
those are covered end-to-end instead.

```bash
npm run test:run
```

## Running locally

Create a `.env` file with the following:

```bash
DATABASE_URL=          # Postgres connection string (I use a Neon branch)
BETTER_AUTH_SECRET=    # any long random string
BETTER_AUTH_URL=http://localhost:3000
IGDB_CLIENT_ID=        # from a Twitch developer application
IGDB_CLIENT_SECRET=
RESEND_API_KEY=
```

Then install, migrate, seed, and run:

```bash
npm install
npx drizzle-kit migrate
npm run db:seed
npm run dev
```

The seed script creates a few verified accounts (e.g. `dev@questline.test`)
that all share the password `password123`, so you can skip email
verification locally.

## What I'd do next

- **Cache game details.** Every board load still hits IGDB for every game.
  Caching game details for a while (the demo already does this for a day)
  would cut down on IGDB calls and make refreshing after actions affordable.
- **Keep tabs in sync.** Since boards don't revalidate, two open tabs can
  drift apart. Refreshing when a tab regains focus would be a cheap fix.
- **Board sharing.** Boards are private right now. A read-only share link
  would be a nice way to show off a backlog (or get called out for it).
- **More from IGDB.** Platforms, genres, and release dates are all
  available, and filtering a board by them would help with bigger backlogs.
