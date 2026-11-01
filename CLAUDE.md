# Working on nation-of-azania.com

## Stay within Vercel's free (Hobby) plan

The site runs on Vercel's Hobby plan, and its limits are hard: going over any
of them pauses **every deployment on the account** (this site and condoria)
until the 30-day window resets. On 1 November 2026 the account went over the
4 hours a month of **Fluid Active CPU** (4 h 54 min) and was paused for the
month. Every change must fit the budget; treat compute as scarce.

The limits that matter, and where the site stood (2 October – 1 November 2026):

| Resource | Hobby limit | Used |
| --- | --- | --- |
| Fluid Active CPU | 4 h / month | 4 h 54 min (over) |
| Function invocations | 1,000,000 | 385K |
| CDN requests | 1,000,000 | 645K |
| ISR writes | 200,000 | 33K |
| Fluid provisioned memory | 360 GB-h | 31 GB-h |
| Fast origin transfer | 10 GB | 3.4 GB |

Before adding or changing anything that runs on the server, ask:

- **Does it run without a visitor?** The watch (`/maps/watch`) and the battle
  tracker are the only things that should, and their CPU is metered
  (`src/lib/cpuMeter.ts`; each run logs its seconds and the month's total).
  The watch's schedule is two cron-job.org jobs (README → The watch's
  schedule); don't add schedules or make runs heavier without saying what it
  costs.
- **Can the browser do it instead?** Live data the browser can read goes
  straight to it: the Rulercraft live feed through the `/maps/feed` rewrite
  (`next.config.ts`), which runs no function. External rewrites, static files
  and the CDN cost no CPU; functions do.
- **Is it cached?** Route handlers set `Vercel-CDN-Cache-Control` with
  `stale-while-revalidate`; pages use ISR no faster than a quarter of an hour
  (`revalidate = 900` on the map's pages), refreshed on demand when their
  data changes.
- **Does it parse the 5 MB marker file?** Read it as rarely as possible and
  share one parse (`src/lib/world.ts` → the `keeper`s, `src/lib/dynmap.ts` →
  `readMarkerFile`).
- **Does it poll?** Every poll from a browser is a CDN request (a million a
  month); keep intervals at the pace the data really changes, and stop
  polling in hidden tabs.
- **Does it wake the database?** Neon's free plan meters compute too: most
  watch runs must leave it asleep (`src/lib/quietWatch.ts`), and Payload
  starts only when a run needs it.

When proposing a feature, say roughly what it adds to these numbers, and
prefer the design that adds least.

## Other standing rules

- Accounts are username and password only; there's no email adapter.
- Never commit Mojang assets (`public/litematic/` is fetched at build time).
- SQLite (dev) and Postgres (production) aren't interchangeable: every schema
  change needs a Postgres migration under `src/migrations/`
  (`pnpm migrate:create <name>`). Never point dev at the production database.
- This cloud environment has no production secrets on purpose: don't ask for
  them, and don't run `pnpm ship` or `pnpm prod`.
- Frontend work goes to a frontend-focused agent with a UX brief.
