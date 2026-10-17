# Condoria CMS

The self-hosted content management system and public website of **Condoria**, a
roleplay nation on the Rulercraft Minecraft server.
One application serves both the nation's official gazette (articles, decrees,
standing pages, an interactive 3D exhibit of the National Monument) and the
admin panel where residents draft, editors publish, and the Chancellery keeps
order. Built with **Payload CMS 3** and **Next.js 16** (App Router) with
Tailwind CSS v4 — SQLite for zero-setup local development, Postgres (Neon) and
Vercel Blob in production.

- [Quick start (local)](#quick-start-local)
- [Roles and permissions](#roles-and-permissions)
- [Content model](#content-model)
- [Database adapters](#database-adapters)
- [Deploying to production](#deploying-to-production-vercel--neon--vercel-blob)
- [Claude Code cloud sessions](#claude-code-cloud-sessions)
- [Extending the CMS with custom blocks](#extending-the-cms-with-custom-blocks)
- [Scripts](#scripts)
- [Project layout](#project-layout)

## Quick start (local)

You need **Node.js ≥ 20.9** and **pnpm ≥ 10** (`npm i -g pnpm`). Nothing else —
local development uses a SQLite file database and stores uploads in a local
`./media` directory, so no external services are required.

```sh
# 1. Configuration
cp .env.example .env          # Windows (cmd): copy .env.example .env
#    → edit .env: set PAYLOAD_SECRET to a long random string, e.g.
#      node -e "console.log(crypto.randomBytes(32).toString('hex'))"
#    → optionally change SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

# 2. Install and seed
pnpm install
pnpm seed                     # creates users, categories, media and articles

# 3. Run
pnpm dev
```

Then visit:

- **http://localhost:3000** — the public site
- **http://localhost:3000/admin** — the admin panel; sign in with the
  `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` from your `.env`

The seed also creates two **demo accounts** so every role can be tried
immediately:

| Username   | Role     | Password                |
| ---------- | -------- | ----------------------- |
| `keeper`   | editor   | `condoria-editor-2026`  |
| `resident` | resident | `condoria-resident-2026`|

> [!IMPORTANT]
> These are published demo credentials. **Change the admin password and both
> demo account passwords immediately** after first login (Admin → Users), and
> never run the seed against a shared database with the defaults.

### No email, anywhere

Accounts are **username + password only** (`auth.loginWithUsername` in
`src/collections/Users.ts`): users carry no email address at all, because the
nation owns no mail domain (`condoria.org` belongs to someone else). No email
adapter is configured either — if anything ever did try to send mail, Payload
would write it to the **server console instead of sending**. Forgotten
password? An admin sets a new one in the panel (Users → edit → New Password).
If you ever want real email (and email login), you'd need to own a domain,
add an adapter such as `@payloadcms/email-nodemailer`, and re-enable email on
the Users collection — until then, nothing can leave the app.

### What the seed creates

Four categories (Decrees, Gazette, Culture, Public Works), three media items
(two generated banner images and the National Monument `.glb`), the About page,
and five articles that exercise every content block — including
*“The National Monument, Restored”*, whose interactive 3D model block you can
orbit in the browser, and a draft article by the resident account demonstrating
the review workflow.

The seed is **convergent**: every entry (user, category, media item, article,
page) is looked up by a natural key and created only if missing, so re-running
completes anything a failed run left out and never duplicates or overwrites
what exists. To rebuild locally from scratch, delete `condoria.db` (and
optionally `./media`) and run `pnpm seed` again. A read-only check of the
seeded content is available with:

```sh
pnpm payload run src/seed/verify.ts
```

## Roles and permissions

| Role         | May do                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| **resident** | Write and edit **drafts of their own articles**. Cannot publish, and cannot add the 3D model block. |
| **editor**   | Create, edit and publish any article or page; manage categories and media; use all blocks including 3D models. |
| **admin**    | Everything an editor can, plus user management and role assignment.                           |

Enforcement is server-side, twice over: collection and field **access control**
(`src/access/index.ts`) restricts reads, writes and specific fields (e.g. only
editors/admins may set `pinned` or reassign `author`), and **hooks** on the
Articles collection (`src/collections/Articles.ts`) reject resident attempts to
publish or to smuggle a `model3d` block into content, regardless of how the
request arrives.

## Content model

Collections (`src/collections/`):

- **Articles** — the gazette: title, excerpt, rich text content, auto-generated
  slug, author, category, featured image, `pinned` flag, drafts + autosave,
  `publishedAt` stamped on first publish (backdatable).
- **Pages** — standing pages (About, …) served at `/<slug>`; same editor,
  drafts enabled.
- **Media** — uploads with required alt text; images get `thumbnail`/`card`/
  `hero` renditions; also accepts `.glb` 3D models (`model/gltf-binary`).
- **Categories** — name + auto-generated slug.
- **Users** — name, username, role (`resident | editor | admin`); no email
  (see [No email, anywhere](#no-email-anywhere)).

Article and page content is a Lexical rich-text field with eight custom blocks
(schema in `src/blocks/config.ts`, renderers in `src/blocks/components/`):

| Block       | Purpose                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `callout`   | Boxed aside in `note`, `decree` or `warning` style, with optional title. |
| `quote`     | Pull quote with optional attribution and attribution title.              |
| `image`     | Single captioned image, `standard` or `wide` layout.                     |
| `gallery`   | Grid of captioned images in 2 or 3 columns.                              |
| `embed`     | YouTube/Vimeo player from a URL; other URLs render as a link card.       |
| `discord`   | An exchange quoted from Discord, rendered as Discord renders it. See below. |
| `model3d`   | Interactive three.js viewer for a `.glb` from the media library, with optional auto-rotate. |
| `litematic` | Interactive viewer for a Litematica `.litematic` build (editors and admins only). |

### Quoting Discord

The `discord` block replaces the screenshot people usually paste. Give it a
list of messages in order and it lays them out the way the client does —
40px avatars in a 72px gutter, and **consecutive messages from one author
grouped under a single name and timestamp**. Per message you can attach an
image or an audio clip (played in a Discord-style player), flag it as
`edited`, or tick *Repeat the name* to break a group where Discord would, at a
gap in time. Avatar, role colour and the bot tag are set **once per person**;
later messages from the same name reuse them.

Message text takes Discord's own markdown — `**bold**`, `*italic*`,
`__underline__`, `~~strike~~`, `` `code` ``, ```` ```code blocks``` ````,
`> quotes`, `||spoilers||`, links, `@mentions` and `#channels`. It is parsed
into React elements, never HTML, so a pasted message cannot inject markup;
`pnpm test:discord` covers the parser, including that escaping.

The frame carries a "Discord" pill on its top border (which becomes a link to
the source when a message link is set), an optional `#channel` bar, and an
optional caption beneath it. Image attachments are shown as previews — GIFs
play — rather than linking out to the raw file.

## Database adapters

The database is selected by `DATABASE_ADAPTER` in `.env`:

- `sqlite` (default) — a local file (`DATABASE_URL=file:./condoria.db`). In
  dev the schema is **pushed** automatically; no migration files involved.
- `postgres` — production (Neon). Schema changes are applied with **migration
  files** in `src/migrations`, run via `pnpm payload migrate`.

> [!WARNING]
> **SQLite and Postgres are not interchangeable.** The two adapters generate
> different SQL, and SQLite dev mode never writes migration files — so a
> project that works locally has, by default, **no migrations for Postgres at
> all**. Postgres schema changes always travel as migration files:
>
> 1. Keep production credentials in `.env.ship` (copy `.env.ship.example`);
>    **`.env` stays on SQLite.**
> 2. After any schema change (collections, fields, blocks), run
>    `pnpm prod migrate:create my-change-name` — it diffs against
>    `src/migrations/` and writes a new migration.
> 3. **Commit `src/migrations/`**, then `pnpm ship` (which runs
>    `payload migrate` against Neon before pushing).
>
> Content does **not** transfer between adapters automatically — the SQLite
> file and the Postgres database are separate worlds. Production content comes
> from `pnpm ship`'s seed step or from the production admin panel.

> [!CAUTION]
> **Never point `.env` (and therefore `pnpm dev`) at the production database.**
> Dev mode *pushes* schema straight into the database and stamps it as
> dev-managed; from then on `payload migrate` offers only "data loss will
> occur" (drop everything and replay migrations) — that prompt means the
> database was dev-pushed at some point. The Postgres adapter has `push` (dev
> schema-push) disabled in `payload.config.ts` as a guard, and the production
> scripts read `.env.ship` instead of `.env`, so following the normal workflow
> can't trigger it. If you ever see the prompt on a database whose content you
> care about, answer **no** and remove the dev stamp instead:
> `DELETE FROM payload_migrations WHERE batch = -1;` (Neon SQL editor) — safe
> as long as your collections match the committed migrations.

## Deploying to production (Vercel + Neon + Vercel Blob)

### Day-to-day deploys: `pnpm ship`

Once the one-time setup below is done, deploying is a single command:

```sh
pnpm ship            # migrate Neon → seed (if needed) → push main (Vercel builds it)
pnpm ship --dry-run  # preview what would run, execute nothing
```

Production credentials come from **`.env.ship`** (git-ignored — copy
`.env.ship.example`); `.env` itself stays on local SQLite. Every step is
idempotent, so `pnpm ship` is always safe to re-run: migrations apply only if
pending, the convergent seed only creates what's missing, and the push is a
no-op when main is up to date. The script refuses to run off the `main`
branch, and it skips the seed step (loudly) if `BLOB_READ_WRITE_TOKEN` is
missing from `.env.ship`.

For ad-hoc Payload CLI commands against production (status checks, creating
migrations, the verify script) use `pnpm prod <args>`, e.g.
`pnpm prod migrate:status` or `pnpm prod run src/seed/verify.ts`.

### One-time setup

1. **Create a Neon project** (or any hosted Postgres). Copy the pooled
   connection string — this is your production `DATABASE_URL`.
2. **Create a Vercel Blob store** (Vercel dashboard → Storage → Blob) and copy
   its read-write token — this is `BLOB_READ_WRITE_TOKEN`. Media uploads are
   stored in Blob whenever the token is set; without it they land in `./media`,
   which **does not persist** on Vercel's ephemeral filesystem, so Blob is
   required in production.
3. **Import the repository into Vercel** (`vercel` CLI or the dashboard). The
   defaults for a Next.js project are correct; ensure the install command uses
   pnpm.
4. **Set the environment variables** on the Vercel project:

   | Variable                 | Value                                              |
   | ------------------------ | -------------------------------------------------- |
   | `PAYLOAD_SECRET`         | long random string (do not reuse the dev value)    |
   | `DATABASE_ADAPTER`       | `postgres`                                         |
   | `DATABASE_URL`           | the Neon connection string                         |
   | `BLOB_READ_WRITE_TOKEN`  | the Blob store token                               |
   | `NEXT_PUBLIC_SERVER_URL` | `https://condoria.vercel.app` (no trailing slash)  |

5. **Run the migrations against Neon** before (or as part of) the first
   deploy: locally, with the production values in your environment, run
   `pnpm payload migrate`. (Alternatively add it to the build step:
   `pnpm payload migrate && pnpm build`.) Migration files must already exist —
   see the warning above.
6. **Create `.env.ship`** from `.env.ship.example`: the Neon `DATABASE_URL`,
   the Blob token (so the monument model and banners upload to Blob), and
   **strong** `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`. Then `pnpm ship`
   migrates, seeds and deploys in one go. Change the demo account passwords
   immediately after the first seed, or delete those accounts.
7. Deploy, sign in at `https://condoria.vercel.app/admin`, and raise the flag.

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
- **Environment variables:** none needed. Without them the app uses SQLite, a
  dev-only secret and the seed's demo accounts. **Never** add the `.env.ship`
  values (Neon `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`). Every command in the
  session can read them, and dev mode against production Postgres breaks
  migrations (see [Database adapters](#database-adapters)).
- **Setup script:** pin the pnpm version from `packageManager`:

  ```sh
  #!/bin/bash
  set -euo pipefail
  npm install -g pnpm@11.11.0
  ```

Deploys stay local: merge to `main` and run `pnpm ship` from your machine. In
cloud sessions, open pull requests with the **Create PR** button. The cloud
GitHub proxy rejects `gh pr create`.

## Extending the CMS with custom blocks

Blocks are the intended extension point, and the 3D model block is the worked
example — every step below points at its real source. Adding your own block
takes five steps:

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

**3. Build the React component** under `src/blocks/components/`. Components
receive the block's `fields` object as props. Write a **server component**
unless the block needs browser APIs. The Model3D block shows the pattern for
heavy client-side libraries (`src/blocks/components/Model3D/`): a server-safe
entry (`index.tsx`) renders the frame, a `'use client'` wrapper (`Client.tsx`)
loads the scene with `next/dynamic` and `ssr: false`, and all three.js imports
live only in `Scene.tsx` — so three.js never runs on the server and never
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
from the field schema in step 1 — no admin code needed.
(`pnpm generate:importmap` is only required when you add **custom admin
components**, which plain blocks do not.)

## Scripts

| Script                    | Does                                                        |
| ------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                | Start the dev server (site + admin) at `localhost:3000`.    |
| `pnpm build`              | Production build.                                           |
| `pnpm start`              | Serve the production build.                                 |
| `pnpm lint`               | ESLint.                                                     |
| `pnpm typecheck`          | `tsc --noEmit`.                                             |
| `pnpm seed`               | Seed the database with the demo nation (idempotent).        |
| `pnpm ship`               | Deploy: migrate Neon, seed if needed, push main (`--dry-run` to preview). |
| `pnpm prod <args>`        | Any Payload CLI command against production, e.g. `pnpm prod migrate:status`. |
| `pnpm payload <cmd>`      | Payload CLI (`migrate`, `migrate:create`, `run <script>`…). |
| `pnpm generate:types`     | Regenerate `src/payload-types.ts` from the config.          |
| `pnpm generate:importmap` | Regenerate the admin import map (custom admin components).  |

## Project layout

```
src/
├─ app/
│  ├─ (frontend)/       # public site: home, /articles, /articles/[slug], /[slug]
│  └─ (payload)/        # Payload admin UI + REST/GraphQL API routes
├─ access/              # role helpers shared by all collections
├─ blocks/
│  ├─ config.ts         # the six content-block schemas (single source of truth)
│  └─ components/       # React renderers for each block (Model3D/ is client-only)
├─ collections/         # Articles, Pages, Media, Categories, Users
├─ components/
│  ├─ RichText.tsx      # Lexical → React converter map (register new blocks here)
│  └─ site/             # site chrome (header, footer, cards, …)
├─ fields/slug.ts       # shared auto-generated slug field
├─ lib/queries.ts       # typed, published-only data helpers for the frontend
├─ seed/                # pnpm seed (index.ts), verify.ts, lexical/image helpers, assets/
├─ migrations/          # Postgres migrations (created by migrate:create; commit these)
└─ payload.config.ts    # the Payload config: collections, adapters, storage
scripts/                # make-sample-glb.mjs — regenerates the monument .glb
media/                  # local dev uploads (gitignored; Blob in production)
```

---

Built for the Rulercraft roleplay community.
