# Condoria CMS — build contract (internal)

Shared interfaces for the parallel build streams. **Schema and file ownership
are FIXED here — do not change another stream's files or any collection/block
schema.** If something seems wrong, work around it locally and report back.

## Stack facts

- Payload CMS **3.85.2** + Next.js **16.2.6** (App Router) + React 19.2.6, TypeScript, pnpm.
- Tailwind CSS **v4** (CSS-first config in `src/app/(frontend)/globals.css` via `@theme`).
  There is NO tailwind.config.js. Utilities come from the tokens below.
- Path aliases: `@/*` → `src/*`, `@payload-config` → `src/payload.config.ts`.
- Generated types: `src/payload-types.ts` (exists after `generate:types`; import
  `Article`, `Page`, `Media`, `User`, `Category`, and block interfaces
  `CalloutBlockType`, `QuoteBlockType`, `ImageBlockType`, `GalleryBlockType`,
  `EmbedBlockType`, `Model3DBlockType` from it).
- Do NOT run `pnpm install`, `pnpm dev`, `pnpm build`, or `payload generate:*`.
  The integrator does that. You may run `pnpm exec tsc --noEmit` to check types.

## Content model (fixed)

Collections (slugs): `users`, `media`, `categories`, `articles`, `pages`.

- **articles**: `title` (text, req), `excerpt` (textarea), `content` (lexical
  richText with blocks), `slug` (unique, auto from title), `publishedAt` (date),
  `author` (rel → users), `category` (rel → categories), `pinned` (checkbox),
  `featuredImage` (rel → media). Drafts enabled: query only
  `_status: { equals: 'published' }` on the frontend (the `src/lib/queries.ts`
  helpers already do).
- **pages**: `title`, `content` (same lexical editor), `slug`. Drafts enabled.
- **media**: upload; `alt` (req). Image sizes: `thumbnail` (480w), `card` (960w),
  `hero` (1920w). `url`, `mimeType`, `width`, `height`, `sizes.*` available when
  populated (depth ≥ 1). Accepts images and `.glb` (`model/gltf-binary`).
- **users**: `name`, `email`, `role` (`resident | editor | admin`).
- **categories**: `name`, `slug`.

## Lexical blocks (fixed schema — see `src/blocks/config.ts`)

Stored as `{ type: 'block', fields: { blockType: '<slug>', ...fields } }` nodes.

| blockType | fields |
|---|---|
| `callout` | `style: 'note'\|'decree'\|'warning'`, `title?`, `body` |
| `quote` | `quote`, `attribution?`, `attributionTitle?` |
| `image` | `image` (Media), `caption?`, `layout: 'standard'\|'wide'` |
| `gallery` | `items: { image: Media, caption? }[]`, `columns: '2'\|'3'` |
| `embed` | `url`, `caption?` |
| `model3d` | `model?` (Media, .glb), `caption?`, `autoRotate` (bool) |

## Cross-stream interfaces

- **Stream B exports** `RichText` from `src/components/RichText.tsx`:
  `<RichText data={article.content} />` — props
  `{ data: SerializedEditorState | null | undefined; className?: string }`.
  Renders nothing for empty data. All six blocks render; `model3d` renders a
  client-only three.js canvas (never imported server-side; must not break SSR).
- **Stream C consumes** `RichText` and the query helpers in `src/lib/queries.ts`
  (`getPinnedArticles`, `getLatestArticles`, `getArticlesPage`,
  `getArticleBySlug`, `getAllArticleSlugs`, `getPageBySlug`, `getAllPageSlugs`,
  `ARTICLES_PER_PAGE`). Helpers return only published docs, `depth: 2`, and
  never throw.
- **Media URLs**: use `media.url` (string, may be relative `/api/media/file/…`).
  For `next/image` pass `media.sizes?.card?.url ?? media.url` etc. Always
  handle `media` being a string ID (unpopulated) defensively:
  `typeof media === 'object'`.

## File ownership

| Stream | Owns (create/edit) | Read-only |
|---|---|---|
| B (blocks) | `src/blocks/components/**`, `src/components/RichText.tsx` | everything else |
| C (frontend) | `src/app/(frontend)/**`, `src/components/site/**` | everything else |
| D (seed/docs) | `src/seed/**`, `README.md`, `scripts/**` | everything else |

Stream C: keep the `@theme` token block in `globals.css` intact (extend below it).
Stream B/C boundary: C renders `<RichText>` inside a `.prose`-like article shell
of its own making; B's components style themselves with Tailwind utilities and
must look right on the parchment background without external wrappers.

## Design tokens (Tailwind v4 `@theme` — already in globals.css)

- Ground: `parchment-50` (page bg), `parchment-100/200` (panels), `parchment-300` (rules/borders).
- Text: `ink-900` (body), `ink-700`, `ink-500` (muted), `ink-400` (faint).
- Primary: `pine-950…100` (deep green; nav/footer `pine-900`, links `pine-700`).
- Accent: `gold-600…200` (antique gold; hairlines, eyebrows, seals).
- Alert/seal: `oxide-700/600` (dark red).
- Fonts: `font-display` (Fraunces — headings, wordmark), `font-body` (Public Sans).
  Stream C loads both via `next/font/google` with CSS variables
  `--font-fraunces` and `--font-public-sans` on `<html>` (tokens already
  reference those variables; loading them activates the real fonts).

Voice: official gazette of a small proud nation — restrained, typographic,
lightly heraldic (hairline double rules, small-caps eyebrows, a seal motif).
Not a startup landing page.

## Model3D block requirements (Stream B)

- deps available: `three@0.180.0`, `@react-three/fiber@^9`, `@react-three/drei@^10`.
- Server-safe entry component (rendered by RichText in RSC) → client wrapper
  (`'use client'`) → `next/dynamic(() => import('./Scene'), { ssr: false })` →
  Scene renders `<Canvas>`; three.js code must be imported ONLY inside Scene so
  it never ships to non-3D pages.
- Scene: drei `useGLTF` for the .glb URL, `OrbitControls`, ambient +
  directional lighting, `Suspense` loading state, auto-rotate when
  `autoRotate`, and a built-in spinning placeholder mesh when `model` is
  missing/unpopulated (it must ALWAYS render something).
- Do not fetch environment maps or any network asset besides the .glb itself.
