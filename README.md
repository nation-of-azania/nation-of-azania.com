# Azania CMS

The self-hosted content management system and public website of **Azania**, a
roleplay nation on the Rulercraft Minecraft server. One application serves the
nation's two publications and the admin panel where residents draft, editors
publish, and the Chancellery keeps order:

- **The Azania Gazette** (`/gov`): the government's official record of
  decrees, dispatches, documents of state and standing pages
- **The Azanian Times** (`/times`): the nation's independent newspaper
- **The resident area** (`/login`, `/account`): residents sign in and see
  their own articles and drafts

Built with **Payload CMS 3** inside **Next.js 16** (App Router), React 19 and
Tailwind CSS v4. Local development runs on SQLite. Production runs on Postgres
(Neon) with Vercel Blob for uploads, and **every push to `main` deploys
itself**.

- [Quick start (local)](#quick-start-local)
- [Roles and permissions](#roles-and-permissions)
- [Content model](#content-model)
- [Database adapters and migrations](#database-adapters-and-migrations)
- [Deploying: push to main](#deploying-push-to-main)
- [Claude Code cloud sessions](#claude-code-cloud-sessions)
- [Extending the CMS with custom blocks](#extending-the-cms-with-custom-blocks)
- [Scripts](#scripts)
- [Project layout](#project-layout)

## Quick start (local)

You need **Node.js ≥ 20.9** and **pnpm 11** (`npm i -g pnpm@11.11.0`; the
version is pinned in `packageManager`). Nothing else: local development uses a
SQLite file database and stores uploads in a local `./media` directory, so it
needs no external services.

```sh
# 1. Configuration
cp .env.example .env          # Windows (cmd): copy .env.example .env
#    → set PAYLOAD_SECRET to a long random string, e.g.
#      node -e "console.log(crypto.randomBytes(32).toString('hex'))"
#    (`pnpm dev` and `pnpm seed` also run without a .env, on SQLite and a dev
#    secret; `pnpm build` / `pnpm start` require PAYLOAD_SECRET.)

# 2. Install and seed
pnpm install
pnpm seed                     # creates users, categories, media and articles

# 3. Run
pnpm dev
```

Then visit:

- **http://localhost:3000**: the public site (redirects to the Gazette at `/gov`)
- **http://localhost:3000/admin**: the admin panel. Sign in as `IPaaat` with
  `SEED_ADMIN_PASSWORD` from your `.env`, or `azania-dev-2026` if no `.env`
  sets it.

The seed also creates **demo accounts** so you can try every role right away.
They exist only in your local database. Production never gets them (see
[First deploy](#first-deploy)).

| Username   | Role     | Password               | Byline                 |
| ---------- | -------- | ---------------------- | ---------------------- |
| `keeper`   | editor   | `azania-editor-2026`   | Keeper of the Light    |
| `marlo`    | editor   | `azania-times-2026`    | Marlo Tidewell (Times) |
| `resident` | resident | `azania-resident-2026` | A Resident of Azania   |

Usernames are case-insensitive: Payload stores them lowercased, so `IPaaat`
and `ipaaat` are the same account.

### No email, anywhere

Accounts are **username + password only** (`auth.loginWithUsername` in
`src/collections/Users.ts`). Users carry no email address at all, because the
nation owns no mail domain. No email adapter is configured either: if anything
ever tried to send mail, Payload would write it to the **server console
instead of sending it**. If someone forgets their password, an admin sets a new
one in the panel (Users → edit → New Password).

### What the seed creates

`pnpm seed` creates a demo nation with placeholder lore: a coastal trading
nation with a harbour capital, Port Azania, and a lighthouse on Founders'
Point. It includes four accounts, six categories, four media items (two
generated banner images, the Lighthouse `.glb` and a Litematica build), the
About page, and nine articles that exercise every content block:

- **Gazette:** the Charter (pinned), *"The Lighthouse on Founders' Point,
  Relit"* (an interactive 3D model you can orbit), the Founding Day feature,
  *"The Long Mole Is Complete"* (embed, gallery and a Litematica build), and a
  resident's **draft** proposal that demonstrates the review workflow.
- **Times:** a lead story, an investigation that quotes a Discord exchange, a
  markets report and an editorial.

The seed is **convergent**. Every entry (user, category, media item, article,
page) is looked up by a natural key and created only if it's missing.
Re-running it completes anything a failed run left out, and it never duplicates
or overwrites what already exists. To rebuild locally from scratch, delete
`azania.db` (and optionally `./media`) and run `pnpm seed` again. A read-only
check of the seeded content:

```sh
pnpm payload run src/seed/verify.ts
```

## Roles and permissions

| Role         | Can                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------- |
| **resident** | Sign in to the resident area and see their own articles. Access control lets them write **drafts of their own articles** but never publish, and never add the 3D model or Litematica blocks. |
| **editor**   | Create, edit and publish any article or page; manage categories and media; use every block. |
| **admin**    | Everything an editor can, plus manage users and assign roles.                                |

Residents are kept out of `/admin` and sent to their branded register at
`/account` (`src/middleware.ts` handles the redirect; `Users.access.admin`
is the real, server-side gate). That also means residents have no in-browser
editor yet: until the resident area gets one, an editor files a resident's
article for them.

Enforcement happens on the server, twice. Collection and field **access
control** (`src/access/index.ts`) restricts reads, writes and specific fields
(for example, only editors and admins can set `pinned` or reassign `author`).
**Hooks** on the Articles collection (`src/collections/Articles.ts`) reject a
resident's attempt to publish, or to slip an exhibit block into the content,
however the request arrives.

## Content model

Collections (`src/collections/`):

- **Articles**: title, excerpt, rich-text content, auto-generated slug,
  author, category, featured image, a `pinned` flag, and a **section**
  (`government` for the Gazette at `/gov`, `times` for the Times at `/times`).
  Drafts and autosave are on. `publishedAt` is stamped on first publish and
  can be backdated.
- **Pages**: standing pages (About, …) served at `/gov/<slug>`. Same editor,
  with drafts enabled.
- **Media**: uploads with required alt text. Images get `thumbnail`, `card`
  and `hero` renditions. It also accepts audio, `.glb` 3D models and
  `.litematic` schematics.
- **Categories**: a name plus an auto-generated slug.
- **Users**: name, username and role (`resident | editor | admin`). No email;
  see [No email, anywhere](#no-email-anywhere).

Article and page content is a Lexical rich-text field with eight custom blocks
(schema in `src/blocks/config.ts`, renderers in `src/blocks/components/`):

| Block       | Purpose                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `callout`   | Boxed aside in `note`, `decree` or `warning` style, with an optional title. |
| `quote`     | Pull quote with optional attribution and attribution title.              |
| `image`     | A single captioned image, in `standard` or `wide` layout.                |
| `gallery`   | Grid of captioned images in 2 or 3 columns.                              |
| `embed`     | YouTube/Vimeo player from a URL; other URLs render as a link card.       |
| `discord`   | An exchange quoted from Discord, rendered the way Discord renders it. See below. |
| `model3d`   | Interactive three.js viewer for a `.glb` from the media library, with optional auto-rotate (editors and admins only). |
| `litematic` | Interactive viewer for a Litematica `.litematic` build (editors and admins only). |

The Litematica viewer draws blocks with vanilla Minecraft textures. Those are
Mojang's, so **they are never committed**: `scripts/fetch-mc-assets.mjs`
downloads them into `public/litematic/` (gitignored) before every `dev` and
`build`.

### Quoting Discord

The `discord` block replaces the screenshot people usually paste. Give it a
list of messages in order and it lays them out the way the client does:
40px avatars in a 72px gutter, with **consecutive messages from one author
grouped under a single name and timestamp**. Each message can carry an image or
an audio clip (played in a Discord-style player), an `edited` flag, or a
*Repeat the name* tick that breaks a group where Discord would, at a gap in
time. Avatar, role colour and the bot tag are set **once per person**; later
messages from the same name reuse them.

Message text takes Discord's own markdown: `**bold**`, `*italic*`,
`__underline__`, `~~strike~~`, `` `code` ``, ```` ```code blocks``` ````,
`> quotes`, `||spoilers||`, links, `@mentions` and `#channels`. It's parsed
into React elements, never HTML, so a pasted message can't inject markup.
`pnpm test:discord` covers the parser, including that escaping.

## Database adapters and migrations

`DATABASE_ADAPTER` selects the database:

- `sqlite` (the default): a local file (`DATABASE_URL=file:./azania.db`). In
  dev the schema is **pushed** automatically, with no migration files involved.
- `postgres`: production (Neon). Schema changes are applied from **migration
  files** in `src/migrations/`. The production build applies them
  automatically; see [Deploying](#deploying-push-to-main).

> [!WARNING]
> **SQLite and Postgres are not interchangeable.** The two adapters generate
> different SQL, and SQLite dev mode never writes migration files, so a schema
> change that works locally doesn't exist for Postgres until you create its
> migration. **Every change to a collection, field or block schema needs a
> committed migration:**
>
> ```sh
> pnpm generate:types               # refresh src/payload-types.ts
> pnpm migrate:create my-change     # write src/migrations/<timestamp>_my_change.{ts,json}
> pnpm migrate:check                # confirm config and migrations agree
> git add src/migrations src/payload-types.ts && git commit
> ```
>
> `migrate:create` and `migrate:check` need **no database and no
> credentials**: they diff the config against the newest snapshot in
> `src/migrations/`, so they work anywhere, cloud sessions included. If you
> forget, the production build runs `migrate:check` and **fails the deploy**
> rather than shipping code whose tables don't exist yet.
>
> Content doesn't move between adapters. The SQLite file and the Postgres
> database are separate worlds; production content is written in the
> production admin panel.

> [!CAUTION]
> **Never point `.env` (and with it `pnpm dev`) at the production database.**
> Dev mode *pushes* schema straight into the database and stamps it as
> dev-managed. From then on, `payload migrate` only offers to drop everything
> and replay the migrations ("data loss will occur"). The Postgres adapter
> has `push` disabled in `payload.config.ts` as a guard, and the production
> build refuses to migrate a database that carries the dev stamp, telling you
> how to clear it. If that ever happens to a database whose tables match the
> committed migrations, remove the stamp in the Neon SQL editor:
> `DELETE FROM payload_migrations WHERE batch = -1;`

## Deploying: push to main

Deploying is `git push origin main`. Vercel's Git integration builds every
push to `main` with `pnpm vercel-build` (`scripts/vercel-build.mjs`), which on
a production build:

1. **checks migrations** (`pnpm migrate:check`): fails if the schema changed
   without a migration;
2. **migrates Neon** (`scripts/prepare-production-db.ts`): applies pending
   migrations from `src/migrations/`. On the very first deploy it also
   bootstraps the nation (see below);
3. **builds the site** (`pnpm build`), prerendering pages against the freshly
   migrated database.

If any step fails, the deployment fails and Vercel keeps serving the previous
one. Only `main` deploys: `vercel.json` turns off deployments for every other
branch (and skips any non-production build that slips through), so work on
other branches never touches the production database. A typical change looks
like this:

```sh
git checkout main
git merge my-branch
pnpm typecheck && pnpm lint && pnpm migrate:check   # optional; the build checks migrations anyway
git push origin main                                 # → Vercel builds and deploys (a few minutes)
```

Public pages revalidate within about two minutes of a content change, so
content edits in the admin panel need no deploy.

### One-time setup

1. **Push `main` to GitHub** and make it the repository's default branch
   (GitHub → Settings → General → Default branch).
2. **Import the repository into Vercel** (Add New → Project). A project named
   `nation-of-azania` gets the address `https://nation-of-azania.vercel.app`.
   The defaults are right: Next.js preset, pnpm detected from the lockfile,
   and the build command comes from `vercel.json`. Under Settings → Git,
   confirm the **production branch is `main`**.
3. **Add Postgres:** Storage → Create → **Neon** (from the Marketplace), then
   connect it to the project. This sets `DATABASE_URL` for you. Any hosted
   Postgres works if you paste the connection string yourself.
4. **Add Blob storage:** Storage → Create → **Blob**, then connect it to the
   project. This sets `BLOB_READ_WRITE_TOKEN`. Uploads need it: without Blob
   they would land on Vercel's ephemeral disk and vanish, so the build refuses
   to run without the token.
5. **Set the remaining environment variables** (Settings → Environment
   Variables, scoped to **Production**):

   | Variable               | Value                                                          |
   | ---------------------- | -------------------------------------------------------------- |
   | `PAYLOAD_SECRET`       | a long random string (not your dev value)                      |
   | `DATABASE_ADAPTER`     | `postgres`                                                     |
   | `SEED_ADMIN_USERNAME`  | `IPaaat`: the first admin account                              |
   | `SEED_ADMIN_PASSWORD`  | a strong password, at least 12 characters                      |

   `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` come from steps 3 and 4.
   `NEXT_PUBLIC_SERVER_URL` is optional: it defaults to the project's
   production domain.
6. **Deploy:** redeploy from the Vercel dashboard, or push to `main`.

### First deploy

The first production build finds an empty database. It runs every migration,
then creates the **admin account** from `SEED_ADMIN_USERNAME` /
`SEED_ADMIN_PASSWORD`, the six **categories** and the **About page**. Nothing
else: no demo accounts and no demo articles. From the second deploy on, the
bootstrap sees that accounts exist and does nothing, so you can delete
`SEED_ADMIN_PASSWORD` from Vercel once you've signed in at
`https://nation-of-azania.vercel.app/admin`.

Then create the other accounts in the admin panel (Users → Create New), for
example the Chancellor's, and start writing.

### Custom domain, rollbacks and production commands

- **Custom domain:** add it under Settings → Domains. Links pick it up on
  the next deploy, because the site URL defaults to the production domain.
- **Rollback:** Vercel's *Instant Rollback* swaps the code back, but it
  doesn't undo migrations, so prefer schema changes that only add (new
  collections, new optional fields): older code keeps working on top of them.
  Revert the commit and push to undo for good.
- **Ad-hoc production commands:** copy `.env.ship.example` to `.env.ship`
  (git-ignored) with the Neon `DATABASE_URL`, then run Payload CLI commands
  against production with `pnpm prod`, e.g. `pnpm prod migrate:status` or
  `pnpm prod run src/seed/verify.ts`. `.env` itself always stays on SQLite.

## Claude Code cloud sessions

The repo is ready for Claude Code cloud sessions (claude.ai/code). A
SessionStart hook in `.claude/settings.json` runs
`scripts/cloud-session-start.sh`, which installs dependencies from the
lockfile and fetches the Minecraft assets. It runs only when
`CLAUDE_CODE_REMOTE=true`, so local sessions skip it.

Configure the cloud environment like this:

- **Network access:** Trusted (the default). `registry.npmjs.org` and
  `raw.githubusercontent.com` are on its default list, and dev needs nothing
  else.
- **Environment variables:** none. Without them the app uses SQLite, a
  dev-only secret and the seed's demo accounts. **Never** add the production
  values (Neon `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`): every command in the
  session can read them, and dev mode against production Postgres breaks
  migrations (see [Database adapters](#database-adapters-and-migrations)).
  None are needed anyway: `pnpm migrate:create` and `pnpm migrate:check` work
  offline.
- **Setup script:** pin the pnpm version from `packageManager`:

  ```sh
  #!/bin/bash
  set -euo pipefail
  npm install -g pnpm@11.11.0
  ```

Cloud sessions push to their own branches, which never deploy. Merge to
`main` locally and push when you're ready to deploy. The cloud GitHub proxy
rejects `gh pr create`; if you want a pull request, use the **Create PR**
button.

## Extending the CMS with custom blocks

Blocks are the intended extension point, and the 3D model block is the worked
example: every step below points at its real source. Adding your own block
takes five steps.

**1. Define the block schema** in `src/blocks/config.ts` and add it to the
`contentBlocks` array at the bottom of the file. This is the single source of
truth for both the admin UI form and the stored data:

```ts
export const Model3DBlock: Block = {
  slug: 'model3d',                    // becomes `blockType` in the stored JSON
  interfaceName: 'Model3DBlockType',  // generated TypeScript interface name
  fields: [
    { name: 'model', type: 'upload', relationTo: 'media' /* … */ },
    { name: 'caption', type: 'text' },
    { name: 'autoRotate', type: 'checkbox', defaultValue: true },
  ],
}

export const contentBlocks: Block[] = [/* …, */ Model3DBlock]
```

**2. Regenerate the types** so your block's interface appears in
`src/payload-types.ts`:

```sh
pnpm generate:types
```

Blocks inside rich text are stored as JSON, so adding one changes no table
and needs no migration. `pnpm migrate:check` confirms that.

**3. Build the React component** under `src/blocks/components/`. Components
receive the block's `fields` object as props. Write a **server component**
unless the block needs browser APIs. The Model3D block shows the pattern for
heavy client-side libraries (`src/blocks/components/Model3D/`): a server-safe
entry (`index.tsx`) renders the frame, a `'use client'` wrapper (`Client.tsx`)
loads the scene with `next/dynamic` and `ssr: false`, and all three.js imports
live only in `Scene.tsx`. That way three.js never runs on the server and never
ships to pages without the block:

```tsx
// src/blocks/components/Model3D/Client.tsx
'use client'
import dynamic from 'next/dynamic'

const Scene = dynamic(() => import('./Scene'), { ssr: false })
```

**4. Register the renderer** in the converter map in
`src/components/RichText.tsx`, keyed by the block's slug:

```tsx
const converters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  blocks: {
    // …
    model3d: ({ node }) => <Model3DBlock {...node.fields} />,
    myblock: ({ node }) => <MyBlock {...node.fields} />,   // ← yours
  },
})
```

**5. Restart `pnpm dev`.** The admin editor UI for your block comes entirely
from the field schema in step 1, with no admin code needed.
`pnpm generate:importmap` is only required when you add **custom admin
components**, which plain blocks don't. When you do run it, the script passes
a placeholder Blob token, so the Blob upload handler always stays in the
import map. Without that handler, the production admin panel renders blank.

## Scripts

| Script                    | Does                                                        |
| ------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                | Start the dev server (site + admin) at `localhost:3000`.    |
| `pnpm build`              | Production build.                                           |
| `pnpm start`              | Serve the production build.                                 |
| `pnpm vercel-build`       | Vercel's build: check migrations → migrate Neon (+ first-deploy bootstrap) → build. |
| `pnpm lint`               | ESLint.                                                     |
| `pnpm typecheck`          | `tsc --noEmit`.                                             |
| `pnpm seed`               | Seed the local database with the demo nation (idempotent).  |
| `pnpm migrate:create <name>` | Write a Postgres migration for schema changes (offline). |
| `pnpm migrate:check`      | Fail if the schema changed without a migration (offline).   |
| `pnpm prod <args>`        | Any Payload CLI command against production via `.env.ship`, e.g. `pnpm prod migrate:status`. |
| `pnpm payload <cmd>`      | Payload CLI (`migrate`, `run <script>`, …).                 |
| `pnpm generate:types`     | Regenerate `src/payload-types.ts` from the config.          |
| `pnpm generate:importmap` | Regenerate the admin import map (custom admin components).  |
| `pnpm test:discord`       | Discord markdown parser tests.                              |
| `pnpm test:litematic`     | Litematica parser tests.                                    |
| `pnpm test:uvlock`        | Litematica texture UV-lock tests.                           |

## Project layout

```
src/
├─ app/
│  ├─ (frontend)/       # public site: / → /gov, /gov (Gazette), /times (Times), /login, /account
│  └─ (payload)/        # Payload admin UI + REST/GraphQL API routes
├─ access/              # role helpers shared by all collections
├─ blocks/
│  ├─ config.ts         # the eight content-block schemas (single source of truth)
│  └─ components/       # React renderers for each block (Model3D/ and Litematic/ are client-only)
├─ collections/         # Articles, Pages, Media, Categories, Users
├─ components/
│  ├─ RichText.tsx      # Lexical → React converter map (register new blocks here)
│  ├─ site/             # Gazette chrome (header, footer, crest, cards, …)
│  ├─ times/            # Times chrome (masthead, footer, story cards)
│  └─ members/          # resident area (login form, header)
├─ fields/slug.ts       # shared auto-generated slug field
├─ lib/                 # typed, published-only data helpers; Litematica parser
├─ seed/                # pnpm seed (index.ts), first-deploy bootstrap, verify.ts, assets/
├─ migrations/          # Postgres migrations (pnpm migrate:create; commit these)
├─ middleware.ts        # keeps residents out of /admin
└─ payload.config.ts    # the Payload config: collections, adapters, storage
scripts/
├─ vercel-build.mjs           # Vercel's build command (migrate → build)
├─ prepare-production-db.ts   # migrations + first-deploy bootstrap against Neon
├─ check-migrations.ts        # schema ↔ migration drift check
├─ fetch-mc-assets.mjs        # downloads vanilla Minecraft textures (never committed)
├─ make-sample-glb.mjs        # regenerates the Lighthouse .glb
└─ cloud-session-start.sh     # Claude Code cloud session setup
media/                  # local dev uploads (gitignored; Blob in production)
```

---

Built for the Rulercraft roleplay community. Adapted from the Condoria CMS.
