# Azania CMS

The self-hosted content management system and public website of **Azania**, a
roleplay nation on the Rulercraft Minecraft server. One application serves
everything Azania publishes, and the admin panel where people write, editors
publish, and the Chancellery keeps order. Content lives in **contexts**,
nested as deep as needed, and each top-level context has its own look:

- **Government** (`/gov`): the Azania Gazette, the government's official
  record of decrees, dispatches, documents of state and standing pages
- **The Azanian Times** (`/times`): the nation's independent newspaper
- **International** (`/intl`): initiatives among nations, hosted by Azania,
  where delegates from other nations publish too
- **The resident area** (`/login`, `/account`): everyone's own account,
  access and articles

Built with **Payload CMS 3** inside **Next.js 16** (App Router), React 19 and
Tailwind CSS v4. Local development runs on SQLite. Production runs on Postgres
(Neon) with Vercel Blob for uploads, and **every push to `main` deploys
itself**.

- [Quick start (local)](#quick-start-local)
- [Access: roles and context grants](#access-roles-and-context-grants)
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
pnpm seed                     # creates contexts, accounts, media and articles

# 3. Run
pnpm dev
```

Then visit:

- **http://localhost:3000**: the public site (redirects to Government at `/gov`)
- **http://localhost:3000/admin**: the admin panel. Sign in as `IPaaat` with
  `SEED_ADMIN_PASSWORD` from your `.env`, or `azania-dev-2026` if no `.env`
  sets it.

The seed also creates **demo accounts** so you can try every access level
right away. They exist only in your local database. Production never gets them
(see [First deploy](#first-deploy)). Their people are fictional.

| Username   | Access                                   | Password               | Writes as                              |
| ---------- | ---------------------------------------- | ---------------------- | -------------------------------------- |
| `keeper`   | Editor                                   | `azania-editor-2026`   | Ione Harrow, Keeper of the Light       |
| `marlo`    | Resident, *Publish* in the Times         | `azania-times-2026`    | Marlo Tidewell, Harbour Correspondent  |
| `resident` | Resident, *Write drafts* in Government   | `azania-resident-2026` | A Resident of Azania (no profile)      |
| `delegate` | Resident, *Manage* International         | `azania-delegate-2026` | Ilse Varnholt, Delegate of Norvessa    |
| `casi`     | Resident, *Publish* in GirlieTown, *Write drafts* in GirlieTea | `azania-girlie-2026` | DefinitelyCasi, GirlieTown |

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
Point. It includes twelve contexts (the three top-level ones, two Government
offices and GirlieTown, two Times desks and the GirlieTea column, and
International's Transport Catalogue › Road Initiative › Case Studies, four
levels deep), six accounts, nine byline profiles (IPaaat as Co-Leader in
Government, Editor-in-Chief of the Times and Representative of Azania in
International, a shared "Luixtiter, Chancellor" and "The Editors",
DefinitelyCasi for GirlieTown, and the demo staff), four media items (two
generated banner images, the Lighthouse `.glb` and a Litematica build), the
About page, and fourteen articles that exercise every content block:

- **Government:** the Charter (a pinned decree), *"The Lighthouse on Founders'
  Point, Relit"* (an interactive 3D model you can orbit), the Founding Day
  explanation from the Chancellery, *"The Long Mole Is Complete"* in Public
  Works (embed, gallery and a Litematica build), and a resident's **draft**
  proposal that demonstrates the review workflow.
- **Times:** a lead story, an analysis that quotes a Discord exchange, a
  markets report and an opinion piece.
- **GirlieTown**, in its Cherry Blossom style: a statement in the Gazette and
  a GirlieTea column in the Times.
- **International:** the Transport Catalogue's opening announcement, the
  delegate's road standard RS-1, and a case study four levels deep.

The seed is **convergent**. Every entry (context, user, profile, media item,
article, page) is looked up by a natural key and created only if it's missing.
Re-running it completes anything a failed run left out, and it never duplicates
or overwrites what already exists. To rebuild locally from scratch, delete
`azania.db` (and optionally `./media`) and run `pnpm seed` again. A read-only
check of the seeded content:

```sh
pnpm payload run src/seed/verify.ts
```

## Access: roles and context grants

Three things describe a person here. Their **role** sets their reach, their
**context grants** give a resident access to particular contexts, and their
**byline profiles** are how they're credited (see
[Bylines](#bylines-and-profiles)).

| Role (stored value)        | Can                                                                          |
| -------------------------- | ---------------------------------------------------------------------------- |
| **Resident** (`resident`)  | Their own account on `/account`. Without grants, nothing else, and no admin access. With grants, the admin panel, limited to the granted contexts. |
| **Editor** (`editor`)      | Publish anything in every context; manage media and every profile; use every block. |
| **Admin** (`admin`)        | Everything, plus accounts, grants, top-level contexts and their designs.     |

### Context grants

An admin grants a resident access under Users → edit → *Context access*: a
context and a level. A grant covers that context **and everything below it**.

| Level            | Can                                                                          |
| ---------------- | ---------------------------------------------------------------------------- |
| **Write drafts** | Write articles there and edit their own, as drafts. Never publish.          |
| **Publish**      | Also publish, edit and pin anyone's articles there, publish standing pages, use the 3D model and Litematica blocks, and sign with the shared bylines of those contexts. |
| **Manage**       | Also create, rename, move and delete sub-contexts below the granted context. |

A delegate from another nation, for example, gets *Manage* on International.
They run their initiatives there and build them out as deep as they like, but
they never see Government's drafts and can't touch the Times. Grants are read
from the database on every request (`src/access/scope.ts`), so a change
applies at once, even to someone already signed in.

Residents without grants are kept out of `/admin` and sent to `/account`.
`Users.access.admin` decides on every admin request, and Payload's
"Unauthorized" page is replaced by a redirect
(`src/components/admin/RedirectToAccount.tsx`).

### Your account

Everyone manages their own account on `/account`, not in the admin panel:
display name, Minecraft name (their head on bylines; byline profiles follow
a change) and password. Changing the password asks for the current one and
signs every other device out (`src/app/(frontend)/account/actions.ts`). The
actions run as the signed-in user with access control on, so nobody can
change their own access level. Forgotten passwords are reset by an admin
(Users → edit), since accounts have no email.

Enforcement happens on the server, twice. Collection and field **access
control** (`src/access/`) restricts reads, writes and specific fields (for
example, only those who can publish in an article's context can pin it, and
only admins can grant access). **Hooks** on the collections reject writing
outside one's contexts, publishing without the *Publish* level, slipping an
exhibit block into the content, or signing with someone else's profile,
however the request arrives.

## Content model

Collections (`src/collections/`):

- **Contexts**: where things are published, as a tree. See
  [Contexts and designs](#contexts-and-designs).
- **Articles**: title, excerpt, rich-text content, auto-generated slug,
  author, byline, a **context** and a **type** (the types depend on the
  context's design), featured image and a `pinned` flag. Drafts and autosave
  are on. `publishedAt` is stamped on first publish and can be backdated.
- **Pages**: standing pages (About, …) served under their context, e.g.
  `/gov/about`. Same editor, with drafts enabled.
- **Media**: uploads with required alt text. Images get `thumbnail`, `card`
  and `hero` renditions. It also accepts audio, `.glb` 3D models and
  `.litematic` schematics.
- **Profiles**: byline profiles, one per role a person writes in. See
  [Bylines and profiles](#bylines-and-profiles).
- **Users**: accounts. Display name, username, Minecraft name, role
  (`resident | editor | admin`) and context grants. No email; see
  [No email, anywhere](#no-email-anywhere).

### Contexts and designs

Contexts nest as deep as needed: *International › Transport Catalogue › Road
Initiative › Case Studies* is four levels. Each top-level context has a
**design** (set by admins), which dresses everything below it and decides
which article types exist there:

| Design            | Used by           | Article types                                         |
| ----------------- | ----------------- | ----------------------------------------------------- |
| **Gazette**       | Government        | Dispatch, Decree, Statement, Explanation, Notice      |
| **Times**         | The Azanian Times | News, Feature, Analysis, Opinion                      |
| **International** | International     | Announcement, Standard, Resolution, Report, Case study |

URLs follow the tree:

- `/<top>`: the context's front page
- `/<top>/articles`: its archive, filterable by type (`?type=decree`)
- `/<top>/articles/<slug>`: an article, wherever below `<top>` it sits
- `/<top>/<sub>/…`: a sub-context, listing everything below it
- `/<context path>/<slug>`: a standing page

A context has a name, a URL slug (unique among its siblings; `admin`, `api`,
`account` and the site's other paths are reserved, as is `articles` right
below a top-level context), a tagline, an intro, an optional emblem and
style (sub-contexts without their own inherit them), an order, and *Show in
navigation*. A context that still holds anything can't be deleted. Old Times
links (`/times/<slug>`) redirect to `/times/articles/<slug>`.

A new design is code: add it to `src/contexts/designs.ts` and build its views
in `src/components/designs/` (`types.ts` lists what a design renders).

### Styles

A **style** is a hand-made look that belongs to someone in Azania, layered on
a design: **Cherry Blossom** is GirlieTown's, after Minecraft's cherry trees.
It stays within the brand. A GirlieTown statement is still a Gazette record
and a GirlieTea column is still the Times, set off by pink accents and
small blossom marks. A style can go further inside a post where its owner
asks: Cherry Blossom sets headlines and labels in a bubbly face, and in the
Times a GirlieTea post sits in a pink box, on its own page and on every
card, while the page around it stays the paper's. Each style has a variant
for every design it supports.

- **Admins give a context a style** (Contexts → Style), and everything below
  it inherits the style. A sub-context can set another style, or *Plain* to
  stop inheriting.
- **Articles wear their context's style**, on their own page and wherever
  they're listed: front pages, section pages, archives. An author can set an
  article to *Plain* instead. A context's style can't be picked on an
  article elsewhere; only styles marked `open` in code could be.
- **A style is code:** add it to `src/contexts/styles.ts`, build its
  variants in `src/components/styles/`, run `pnpm migrate:create` (the
  choices are a Postgres enum) and commit the migration.

### Bylines and profiles

An article is credited through its **byline**, a profile with a **name**, a
**role**, and the contexts it's used in (each including everything below it),
e.g. "IPaaat, Co-Leader" in Government and "IPaaat, Editor-in-Chief" in the
Times. One account can hold any number of
profiles. The avatar is the player's **Minecraft head**, looked up from the
profile's Minecraft name (mc-heads.net, through Vercel's image proxy), unless
an image is uploaded instead.

- **Everyone manages their own** profiles under Content → Profiles, for the
  contexts they can write in; editors and admins can manage all of them. Name and Minecraft name default to the
  owner's.
- **Shared profiles** have no owner: "The Editors", or someone who has no
  account yet. Anyone who can publish in their context can sign with them.
- **The byline must fit:** one of the author's profiles (or, for those who
  can publish there, a shared one) for the article's context. A new article gets the author's
  first matching profile, and changing the author switches it to theirs.
  Without any profile, the byline falls back to the author's display name.
- **When a role ends**, switch its profile off (*Active*) instead of renaming
  it: past articles keep the title they were written under, and new articles
  can no longer choose it.

### Link previews

A link pasted into Discord unfurls as a clipping of its paper: the page's
Open Graph tags name the publication (`og:site_name`), the title and
summary, and a 1200×630 card drawn at **`/og/<path>`** in the design's own
voice (`src/components/og`): the Gazette's masthead and double rule, the
Times' nameplate and black headline, the registry's Plex and verdigris;
Cherry Blossom's rose, Fredoka and pink box where a context wears it. The
embed's side bar (`theme-color`) is the design's colour, or the style's.
Every public path has a card (`/og/times` is the front page's), an unknown
one gets the nation's, and a Discord webhook can ask for one directly.
Under a short headline the card sets the article's excerpt as a standfirst,
as many lines as the room allows, so a one-line title doesn't leave the
card half sand.

A page of [Azania Maps](#azania-maps) unfurls as a clipping of the map
itself (`src/lib/ogMaps.ts`, drawn by `src/components/og/maps.tsx`): the
panel beside the picture, as the map shows it. A town's card frames its
claims, with the ruler's head, `/t spawn <Town>` and Towny's figures; a
held site's frames its claims in gold around its mark, with what it pays,
its terms and the nearest town's spawn, since a site is nobody's; a
place's has its pin, large, and its lines; a road's its whole course, picked
out in gold; an event's its pennant beside a calendar leaf, the time in UTC;
`/maps` itself the heartland with every town named. The picture is the same
clipping `/mapclip` draws, at the card's size, with the roads and places
around it; the towns' names are set over it. When the Rulercraft map isn't
answering the card goes out without the picture — the sea, and a word — and
is cached only briefly, like any card drawn without one of its pictures.

The route runs in Node with `next/og` (Satori), so it reads the fonts as
static TTFs committed under `src/app/(frontend)/og/fonts/` and fetches
heads and pictures itself, with a short timeout and a monogram or blank
in place of anything slow. Cards are cached for a year at the CDN; the
page's metadata versions the URL (`?v=<updatedAt>`) so they turn over
with the page.

### RSS feeds

Every context has an RSS feed of its published articles and those of
everything below it, newest first, thirty at a time: `/gov/feed.xml` is
the whole Gazette, `/gov/girlietown/feed.xml` the town's record in it,
`/times/girlietea/feed.xml` the column, and `/feed.xml` everything the
nation publishes. Each item carries the article's title and permalink,
its first publication date, the byline's name (never an address; accounts
have none), its type and context as categories, the excerpt, the full
text as HTML (pictures and galleries as themselves, a map as its
clipping, a player as the still render of their skin, the 3D and
Litematica exhibits as a note and a link to the page) and its
link-preview card as `media:content`, so a Discord RSS bot unfurls it the
way a pasted link does. The channel is named after the paper ("GirlieTea
· The Azanian Times"), described by the context's tagline and pictured by
its emblem.

Every page names its feeds in its `<head>` (its context's, the paper's
and the nation's, most specific first), so a reader or browser extension
finds them from any URL, and each design shows a *Subscribe* link where a
reader would look for one: beside "All articles" in the Gazette and in
its colophon, under a desk's name in the Times and in its colophon,
beside "The full register" in International and in its colophon, each in
the paper's own ink and, under Cherry Blossom, in GirlieTown's rose.
Opened in a browser, a feed renders through `public/feed.xsl` as a page
in the paper's colours that says what a feed is and how to subscribe;
feed readers ignore the stylesheet.

The feeds are built by `src/lib/feed.ts` (the HTML by `src/lib/feedHtml.ts`)
and served by `src/app/(frontend)/feeds/[[...path]]/route.ts`;
`next.config.ts` rewrites `/feed.xml` and `/<context path>/feed.xml`
there, since a route can't share a segment with the catch-all page, which
is why `feeds` is a reserved top-level slug. A feed is cached for five
minutes at the CDN and served stale for an hour while a fresh one is
built, so a new article reaches subscribers within minutes of publishing.

### Live preview

The article and page editors have a **Live Preview** button (the eye icon
beside *Publish changes*): it opens the real page, in its context's design,
beside the form, with phone, tablet and desktop widths, refreshed after every save.
Autosave runs every 1.5 seconds, so it follows your typing closely. The
**Preview** button next to it opens the same draft in a new tab.

It works through Next.js draft mode: `/preview` (`src/app/(frontend)/preview`)
checks that you're signed in with admin access, turns draft mode on for your
browser only, and the pages then render the latest draft *you* may read (`src/lib/preview.ts`, `src/components/PreviewTools.tsx`). Outside the
admin a bar marks the page as a draft preview, with *Exit preview* to return
to the published version. Visitors never see drafts.

Article and page content is a Lexical rich-text field with ten custom blocks
(schema in `src/blocks/config.ts`, renderers in `src/blocks/components/`):

| Block       | Purpose                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `callout`   | Boxed aside in `note`, `decree` or `warning` style, with an optional title. |
| `quote`     | Pull quote with optional attribution and attribution title.              |
| `image`     | A single captioned image, in `standard` or `wide` layout.                |
| `gallery`   | Grid of captioned images in 2 or 3 columns.                              |
| `embed`     | YouTube/Vimeo player from a URL; other URLs render as a link card.       |
| `discord`   | An exchange quoted from Discord, rendered the way Discord renders it. See below. |
| `map`       | A piece of the map as a figure: a clipping around a Towny town or a pair of coordinates (claims outlined, the town's facts), or a **map view** drawn on Azania Maps with its highlights; still, or one readers can move. See below. |
| `skin`      | A player's Minecraft skin as a portrait: turnable in 3D, with a still render before it loads and wherever WebGL is missing. See below. |
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

### Showing the map, and a player

The `map` block puts a piece of the server's Dynmap (map.rulercraft.com) in an
article the way a figure goes in a report. Name a **Towny town** and it
centres on the town's home block, outlines its claims in the paper's colour
(or the style's: GirlieTown's maps come out in rose) and can add a plate of
the town's facts as the map records them — ruler, with their head; residents;
nation; founded. Named a site the server runs (`town: Africa_Quarry`), the
plate shows the site's mark where the head would go, what it is, what it
pays, who holds it and its terms, in the paper's voice, and the survey line
gives the nearest town's spawn and the walk, since a site is nobody's
spawn. Or give **x and z** to centre anywhere, with a town or without one. Zoom runs from *close* (about 150 blocks across) to *country*;
the clipping can be wide, square or a banner. Beneath it the figure sets the
coordinates as a survey reference and the way there as a player has it:
players have no `/tp`, only `/t spawn <town>`, so a town's figure offers
`/t spawn GirlieTown` with a *Copy* button (and says when the town's spawn
is private, for its residents alone), and a figure on coordinates names the
nearest public spawn and the walk from its home block — "/t spawn Oasis,
then 700 blocks east" (`src/maps/spawn.ts`, shared with the live map's
panels) — then a quiet link to the live map at the same spot.

The clipping itself is a JPEG from `/mapclip` (`src/app/(frontend)/mapclip`),
stitched on demand from Dynmap's tiles by `src/lib/dynmap.ts` and cached at
the CDN, so the map server sees about one request per clipping a day. Saving
never waits on it: the block checks only that it was given a town name or a
pair of coordinates. A town the map doesn't know, or a map that isn't
answering, is said in the figure's frame; a broken image never appears. When
the map answers nothing at all, `/mapclip` says so (a 503, uncached) rather
than hand out bare ground that would pass for sea.

The block has two more settings, which tie it to [Azania Maps](#azania-maps):

- **Map view.** Choose a view by its title and the block shows that view
  instead of a clipping: the frame its author set, the layers they chose
  (towns, places, roads, events) and the highlights they drew. The clipping
  fields step aside. Under the field, *Draw a new view on Azania Maps ↗*
  opens the map (`/maps?draw=view`), and once a view is chosen *Edit this
  view ↗* opens it there (`src/components/admin/MapViewLink.tsx`).
- **Let readers move the map.** Off, the figure is a still picture, quickest
  to load and drawn without any map library: the clipping from `/mapclip`
  (which takes a `span` in blocks for a view's exact frame) under an SVG
  overlay of the layers and highlights, drawn by the same components as the
  live map. On, the live map fades in over the still once the reader scrolls
  near, starting from the same frame, with buttons to zoom and to come back
  to the frame; the mouse wheel doesn't catch the page. A town or
  coordinate block can be interactive too, showing the nation's layers
  around it.

Either way the figure carries a small **Azania Maps** mark in its corner
that opens `/maps` at the same spot — with the view's highlights, when it
shows one — and the survey line links Azania Maps beside the Rulercraft map.
A view since deleted is said in the frame, and while the Rulercraft map is
down the layers still show over a plain ground, with a small plate in the
frame's corner saying so in the paper's own voice (Cherry Blossom in hers).

The `skin` block is a portrait of a player: their skin in an interactive
viewer ([skinview3d](https://github.com/bs-community/skinview3d), the one
NameMC uses), turnable by hand, breathing, walking or waving, beside their
name, a caption and a link to their NameMC page. The texture comes from
mc-heads.net, which serves raw skins with CORS headers; the same service
draws the still render shown until the viewer has loaded, and kept wherever
WebGL is missing. The viewer is loaded only in the browser, only when the
figure nears the viewport, and stops drawing while it's off screen; a reader
who asks their device for less motion gets the still pose, which they can
still turn. Both blocks are open to every writer.

### Azania Maps

Azania Maps (`/maps`) is the nation's own map, on top of the Rulercraft map's
pictures: a full-screen map in the Gazette's hand, with a panel beside it (a
sheet drawn up over it on a phone) that holds whatever is open.

- Azania's **towns**, read from Towny: their claims, names and facts; and the **sites** the server runs and the nation holds (see *Server sites* below).
- **Places** with a category and icon (cafés, town halls, ports, …), optionally with a building outline.
- Named **roads**, railways and waterways, straight from point to point or curved smoothly through them, drawn like a road map: casings under translucent fills (a wash the build shows through, thinner the closer you come), widths by zoom, the name along the line once it fits.
- **Events** with a time and a place.
- **Map views**: framed pieces of the map with highlights drawn on them, which an article's Map block can show.
- Around it all, **the rest of the world**: every other nation and its towns, Azania's **diplomacy** with them, the **sieges** on the server, and the **reach** of a capital's war (see *The world around Azania* below). None of it is kept in the database.

Everything is stored in block coordinates (`src/maps/geo.ts`), never pixels.
The categories, road kinds and highlight inks are defined in code
(`src/maps/registry.ts`), like the designs and styles; their icons, colours
and road styles in `src/maps/icons.tsx` and `src/maps/palette.ts`.

**Reading the map.** Leaflet draws it (`src/components/maps/leaflet`),
taught Dynmap's projection: zoom 0 is the tiles' own scale, two pixels a
block, and zooming closer scales the blocks up pixel for pixel. Tiles come
through the site's cache, and are only ever asked for at Dynmap's own
levels; a zoom in between scales the nearest, and the map zooms out two and
a half levels past the coarsest (to −7.5), where the whole world fits
beside the panel: down to −6 the level-5 tiles are drawn smaller, and past
that the world is one picture, the level-5 tiles drawn once into a canvas
and laid over the map in their place (`leaflet/sheet.ts`), since seven
hundred tiles on screen made a pan stutter. The map's JavaScript loads only
on `/maps` and in an interactive Map block, never with any other page.

That picture also lies **under the tiles at every zoom**, so whatever they
haven't covered yet (the ground a pinch out opens around the view just
left, a slow tile) shows the world there, soft at first and sharpening as
the tiles arrive, never the bare backdrop. It stays under them at rest
too: at the zooms between Dynmap's levels the tiles are scaled by a
fraction, and hairline gaps open along their edges, which then show the
world's own colours rather than dark lines. Past −6 it is the map, so a
pinch back in from the whole world keeps it until the tiles arrive, where
the map used to go dark the moment it crossed −6. The
server makes the picture from the 684 level-5 tiles, half size, as one WebP
of some 170 KB (`/maps/sheet`, kept at the CDN six hours and served stale
for a month while the Rulercraft map is down): one request where the browser
used to fetch the tiles themselves, 2.5 MB in 684 requests, three quarters
of all a visit to the map downloaded. It's fetched once: on the live map as
soon as its own first tiles are in and the browser is idle; at once when a
zoom starts or the map is past −6; and only then for a connection that asks
to save data, or in an article's map. While it's slow in coming (a deploy
empties the CDN, and the first visitor waits a few seconds while it's made)
or should it fail, the browser makes it from the tiles as before, nearest
the reader first, decoded off the main thread and drawn a batch at a time.
An echo's copy of the picture is made only when the view first comes near
that echo, so a session that stays close in holds one canvas, not three.
And when a zoom out ends, the tiles of the view just left stay until the
new level's tiles over them have arrived (`leaflet/tiles.ts`), so the place
the reader was looking at never goes soft.

The tiles come **a little ahead of the reader** (`leaflet/tiles.ts`):

- Through a pan, on phones too, every 200 ms rather than only once the
  finger lifts; with a ring of one tile beyond the page all round, and up
  to two more on the side a pan is heading. The ring waits until a level's
  tiles on the page are all in, so it never slows them.
- Through a pinch or the wheel, the sharper (or coarser) level the zoom has
  reached, once it has stayed there 150 ms: a pinch held sharpens before
  the fingers lift, and a quick one through three levels doesn't download
  the two it only passed.
- Before a flight to somewhere (a place, a view, "Centre here"), the
  destination's tiles, so they're in when it lands; none on the way.
- Nothing ahead of time on a connection that asks to save data, or one the
  browser rates 2g or 3g.

The overlay (claims, roads, names) is drawn 60% of the page beyond each
edge, as far as Leaflet's renderer reaches, so a pan of up to that much
shows them before the map settles.

**Zooming is continuous.** Leaflet would scale the overlay like a picture
mid-zoom and redraw it only when the gesture ends, so names ballooned and
then snapped. Instead the overlay's group is moved and scaled with the
ground frame by frame (`leaflet/overlay.ts`), while names, pins, marks and
heads keep their size on the page and glide with their point, and lines
keep their width (`leaflet/steady.ts`; the layers say what holds steady in
data attributes, `layers/projection.ts`). A button or key zoom follows
the tiles' own CSS transition exactly. A gesture held still for 150 ms
draws the overlay again for the view as it stands, and when the view
settles the names glide to their new spots, fade out or fade in rather
than swap (a plain swap for readers who ask for less motion). Sizes that
step with the zoom (a name's 11, 12 or 13 px) still change when it settles.

The live map repeats the world east and west, so a pan never runs out of
map (`src/maps/source.ts` holds the sheet's extent: x from −36,864 to
36,864, the level-5 tiles' columns −18 to 17). The world doesn't wrap in
the game — nobody walks west out of one edge into the other — and the map
says so without a word, since that is a thing to see rather than read:
each repeat is an **echo**, the sheet washed pale under it and the nation's
layers drawn faded over it, and at every edge the sheet is **torn**, a dark
gap with ragged paper either side (`layers/WorldEdge.tsx`). An echo is
inert: the pointer over it is over nothing (the readout goes quiet), a
click on its ground lands nowhere, a tool's drag stops at the world's edge,
and a frame drawn over it is saved over the real world; but a click on a
town or a place in an echo opens the real one, and the map comes back to
it. The address in the query always names the real spot. An article's
embedded map stays bounded.

The reader is always **home**, though: the moment the view's centre
crosses a seam — when most of the page is on an echo — the copy under
them becomes the real one and the one they came from its echo, so a pan
east can go on for ever with the echoes only ever at the edges of the
page (`leaflet/home.ts`). Nothing on the page moves for it. Rather than
panning back a world, the map's own pixel origin is shifted by exactly a
world's width, so the same spot on the page now means the same spot a
world over; every tile is re-keyed to the column it now stands for
(`leaflet/tiles.ts`), the picture there being the same, so no tile is
asked for, not even of the browser's cache; the heads, the sheets and the
overlay are told to stand again where they are; and the overlay is drawn
again with the real world in full colour under the reader and the wash
gone over to the other side, the two crossing over in a moment (still, for
readers who ask for less motion). The address names the same spot, the
heads keep gliding, and a drag or a fling under way carries on, since it
only moves the map's pane; the re-basing happens mid-pan, where the seam
is crossed, and otherwise when the map settles after a zoom, a key or a
jump. A little slack past each seam keeps a centre that sits right on one
from flipping to and fro, and the map is never re-based while a tool's
drag or a pen stroke is in progress.
The layers themselves are plain SVG (`src/components/maps/layers`), drawn
through one projection interface, so the same components draw the live map
in the browser and a block's still picture on the server. They are
re-rendered only when the map settles after a move; during a drag, a pinch
or a zoom the overlay is moved and scaled by Leaflet alone, and a transform
carries what's already drawn into place until the fresh render lands.

- **Zooming.** The wheel is handled by the map itself rather than Leaflet:
  a trackpad's two-finger scroll zooms in proportion to how far you scroll,
  easing around the pointer as you go; a click-wheel mouse zooms half a
  level a notch; a trackpad pinch (which browsers send as a wheel with Ctrl
  held) zooms at its own ratio. Safari sends a trackpad pinch as gesture
  events of its own instead, and would otherwise magnify the whole page
  (or, pinching out, show its tabs): the map takes those too, zooming by
  the pinch's scale about the pointer, at the same ratio; a pinch on a
  touchscreen stays Leaflet's, and should a browser send one pinch both
  ways, it still zooms once. The ratios are at the top of
  `leaflet/canvas.tsx`, with the zoom's floor and ceiling, which the wheel
  and the buttons both keep to. In an article's embedded map the wheel and
  the pinch are left to the page, so scrolling past it never catches.
- **Names.** Where every name goes is planned in one pass before anything
  is drawn (`layers/labels.ts`): an article's highlights outrank the map's
  own names, no name ever covers a pin or a mark, and towns, roads, places
  and events then take free spots in that order, each with alternatives (a
  road's name slides along it, a place's goes right, left, below or above).
  Inside a town its name moves to the top edge of its claim and fades;
  closer still it's left off, since the panel names it.

- **Addresses.** `/maps/town/<slug>`, `/maps/place/<id>`, `/maps/road/<id>`
  and `/maps/event/<id>` open the thing with its panel: a town's Towny facts
  with the ruler's head, its mayor's lines, growth charts from the census,
  its places and events and the articles about it; a held site's what it is
  and pays, its terms said kindly (and the map's own words), the nearest
  town's spawn with the walk, its places, events and articles — no ruler's
  head, residents or growth, since its ruler is a bot and nobody lives
  there; a place's category,
  description and events; a road's class and length; an event's time in the
  reader's own time zone, its place, host and article. A town with claims
  away from the one holding its home block lists them as **outposts**, each
  with *Show on map*; *Fit to town* fits the main claim. `/maps/abroad/<slug>`
  and `/maps/nation/<slug>` open a town of another nation (or of none) and
  another nation (see *The world around Azania*). These pages are
  rendered on the server and cached for everyone alike, a minute at a time
  (and regenerated at once after someone draws), so links unfurl and search
  engines read them; the visitor's own drawing rights are fetched in the
  browser (`/api/users/me`). The map's own spot travels in the query —
  `?at=<x>,<z>,<zoom>`, `&layers=towns,roads`, `&view=<id>` for an article's
  view with its highlights — written as the map moves, so any address can
  be shared. `layers` also names the layers that aren't the nation's own
  data (`EXTRA_LAYERS` in `src/maps/url.ts`): `players`, `world` and
  `reach`, on unless the address lists layers without them, and
  `diplomacy`, off unless listed. (Old links with `&map=biomes` still open;
  the biome map is no longer drawn.) Every page of Azania's own has its own
  link-preview card, a clipping of the map with the thing on it (see
  [Link previews](#link-previews)); the pages abroad have the site's plain
  card for now.
- **Getting there.** Players have no `/tp`, so what's offered to copy is
  what they can type: `/t spawn <Town>` for a town, and for anything else
  the nearest town's spawn with the walk from its home block ("then 40
  blocks north-east"). Public spawns are preferred within reason; a town
  whose spawn is private (Towny's *Public Teleport* off) is said so —
  only its residents can use it. Coordinates stay on the page, as F3
  shows them.
- **Tools.** Search across towns, held sites (by name or by kind: "diamond"
  finds the quarry), places, roads and events, and once the world has
  arrived the other nations and their towns and sites, after Azania's own;
  layer toggles (Azania's own layers, then the world's) and a legend; the
  block under the pointer (the centre, on a phone) with its nearest spawn
  to copy; the nation at a glance on the map's own front — any siege
  Azania is in, first of all; the players' towns, residents and chunks
  with the census's trend; a small ledger of **Holdings**: the sites the
  nation holds, what each pays, and the day's total; Azania's
  **Diplomacy**, friends first; and the rest of the server's sieges.
- **Players (live).** Who is on the server and where, as the Rulercraft
  map's own feed has it, passed on through `/maps/players`
  (`src/maps/players.ts`) and kept nowhere: the CDN shares each answer
  among everyone watching for three seconds, the browser asks again every
  three seconds while the layer is on and the tab is in view (not at all
  otherwise, and less and less often while the map is down), and the
  positions live in that browser alone — never in the address, never in
  storage. Each player is a small Minecraft head (`layers/PlayersLayer.tsx`,
  plain Leaflet markers in a pane of their own, moved by one animation
  frame loop, so nothing else on the map is redrawn for a poll) that
  **glides** from one reading to the next rather than jumping, and jumps
  only for a teleport; Azania's residents, matched against the towns'
  resident lists, are ringed in saffron. Every head is the player's
  monogram, an initial in an ink of its own (picked by name, from the
  house's quieter colours: never saffron, coral or the backdrop's night
  sea), with the face laid over it once the face has arrived; so a Bedrock
  player (a name starting with "."), a face still on its way and one that
  won't load all read as a person, never an empty square. Names show on hover,
  on the chosen player, and close in. A click opens a small card beside the
  head: who they are and, if Azanian, of which town; their coordinates to
  copy; and the way there as a player has it, the nearest town's `/t spawn`
  and the walk, since nobody has `/tp`. A head is never drawn in an echo of
  the world. The layer is on by default (it is the point of a live map, and
  costs one shared request every few seconds), switched in the layers menu,
  and remembered in the address's `layers` like the others (`players`
  among them); a quiet "N online" sits beside the readout.
- **Events.** A pennant on the map where it's held, breathing while the
  event is on (two hours from the start, when no end is given; still for
  readers who ask for less motion), hollow once it's past. A *What's on*
  strip along the foot of the map lists what's coming, soonest first and
  anything happening now ahead of it; past events show only when asked (the
  layers menu). Times are shown in the reader's own time zone; the panel
  says so.
- **When the Rulercraft map is down:** `/maps/status` says so, the page
  notes it is showing the map as last saved, and tiles the cache doesn't have
  leave a plain ground; towns, places and everything else are the site's own
  data, so they never go dark. The world around Azania and the war come from
  the Rulercraft map itself: the last reading stays on the page while it's
  down, and a page abroad says plainly when there's none to show.

**The world around Azania.** The map draws the whole server around the
nation, from two readings of the Rulercraft map's markers that the site
passes on and keeps nowhere: `/maps/world.json`, every Towny town and nation
(`src/lib/world.ts`, types in `src/maps/world.ts`; each claim's corners sent
as steps from one to the next, which halves the download), shared at the CDN for
a quarter of an hour, and `/maps/war`, the sieges and every capital,
shared for three minutes. The browser always asks for the bare path,
which the routes insist on, so every viewer shares one copy.

- **Other nations** (a layer, on by default). The world is asked for once
  the map has settled and the browser is idle, so Azania paints first (at
  once on a page abroad, which needs it), and again every quarter of an
  hour while the tab is in view. `src/maps/abroad.ts` makes it ready:
  Azania's own towns, matched by Towny's id (`MapTown.townyId`), are left
  to the nation's own layers, and every other town gets an address, its
  bounds and its nation. They are drawn quietly under Azania's layers
  (`layers/AbroadLayer.tsx`): a thin edge and a faint fill in the nation's
  Towny colour, tempered so a web red or yellow doesn't shout (the hue is
  kept, the saturation reined in; `nationInk` in `src/maps/palette.ts`),
  and the towns of no nation in grey with a dashed edge. Azania stays the
  one in full colour, and glows saffron among the others: soft discs about
  its towns far out, a casing about its claims nearer. Far out the world
  is nations: their names in spaced capitals across their heartlands (the
  towns about the capital, weighted by the ground they hold; only the great
  ones at the scale of the world), Azania's own underscored in saffron; a
  town too small to draw is a dot, all a nation's claims are one path, and
  a click opens the nation. Coming in, the capitals' names appear, ringed
  dots as an atlas marks them, then every town's, smaller than Azania's and
  placed after them; a click opens the town. A server site another nation
  holds wears the site's mark rimmed in its holder's colour, with what it
  pays, since it changes hands by siege. The pointer over a nation
  strengthens its claims. The echoes carry the world like everything else,
  washed.
- **Pages abroad.** `/maps/abroad/<slug>` is a light page for a town of
  another nation or of none: its nation, ruler, residents, claims and
  founding, its `/t spawn` when anyone may use it (otherwise, and for a
  site, the nearest spawn anyone may use, anywhere on the server, with the
  walk), a site's pay, Azania's stance with its nation, any siege of it,
  and how far it is from Azania's capital. `/maps/nation/<slug>` is a
  nation's: its totals, capital, Azania's stance, its sieges, the reach of
  its war, its holdings and its towns. There's no editing, census or mayor
  abroad. Both are cached like the others; they read the world through
  `src/lib/abroad.ts` (`unstable_cache`, so the read doesn't make them
  dynamic), and tell the map where to open before the world arrives. A
  town that has joined Azania redirects to its own page, and Azania's
  nation to the front.
- **Diplomacy** (a layer, off by default). Where Azania stands with the
  other nations, set under Settings → Azania Maps → Diplomacy, and public
  on the map: the nations are drawn by stance instead of their own colours,
  a road from green to red through a quiet grey (`STANCE_COLOURS` in
  `src/maps/palette.ts`): allies washed deep green, enemies red and, at
  war, hatched, the neutral receding; far out, friends' and foes' names are
  set in bold. A key sits at the map's top left while it's on; a nation's
  page says the stance in a sentence, with the admins' note, and so does a
  town abroad of a nation that isn't neutral.
- **Sieges**, always, whenever there are any: there's no layer to switch
  off. The war is asked for as the page arrives and every three minutes
  while the tab is in view (`components/maps/war.ts`); offline, the last
  sieges known stay, said to be as of then. A mark stands at each siege
  banner (`layers/SiegesLayer.tsx`): crossed swords on coral, breathing,
  while a battle is fought; a small fire while it's quiet; named "Siege:
  attacker vs defender", and the town besieged edged in coral, with a
  thread from the banner to its home. A click opens a card beside the
  banner with the siege in plain words (`src/maps/sieges.ts`): what kind,
  the battle sessions fought, who's ahead, who holds the banner, this
  battle's points and time left, the war chest, and SiegeWar's own lines.
  A siege Azania is in — its town besieged, or Azania attacking or
  defending — is unmissable: a larger mark ringed in saffron, the town's
  claims glowing, its name placed before Azania's own towns'; an alert at
  the map's top left ("Cape Agulhas is under siege", with *Show*), the
  same in full at the top of the front, and on a phone the sheet's folded
  line. A besieged town's page and a nation's page show theirs.
- **War reach** (a layer, on by default). A nation may besiege towns only
  within 12,320 blocks of its capital (`CAPITAL_WAR_RADIUS`, about Africa's
  width), and this is that circle (`layers/ReachLayer.tsx`): Azania's about
  its capital, a calm dashed line in the deep sea on a whitewash casing,
  named along its arc; another nation's in its colour while its page is
  open or it's under the pointer. It's sampled finely enough to stay round
  at every zoom, and only the arcs over the page are drawn. It ends where
  the world does — the game's world doesn't wrap, so no capital reaches
  across a seam — so each copy of the world draws its ring cut at its own
  edges: a ring near the east edge stops at the tear, and is seen again,
  washed, just west of the west tear, in the echo that is the east edge's
  copy. A town abroad says whether it lies within Azania's reach; a nation
  which of Azania's towns lie within its own.
- **Keeping it quick.** Three hundred-odd towns and some thirty thousand
  claim corners are redrawn each time the map settles, so the drawing is
  lean: the projection is applied as the scale and shift it is rather than
  point by point, a corner within a pixel of the last is dropped, a claim
  off the page or under a pixel is left out, far out a nation's claims are
  one path and a small town a dot, one click and one hover handler serve
  every town, and a hover restyles by a rule of its own, never mid-drag.

**Drawing on the map.** Sign in (the panel's *Sign in* comes back to the map)
and, with rights, the pencil in the map's corner offers what you may do;
everyone else only looks. Beside your name the panel says what you may do
("IPaaat · draws anywhere", "Mayor of GirlieTown", "map views only"), so
nobody has to guess. Who you are is asked of the Registry once the page
is in the browser (`/api/users/me`), and asked again, with a pause between
tries, when the connection drops: only the Registry's own word makes a
visitor of you. When it can't be reached at all, the panel's head says so,
with *Retry*, rather than showing *Sign in* to someone who is signed in;
it asks again of its own accord when the browser comes back online.

- **Places:** drop the pin, trace a building's outline if there is one (click
  around it; the first point or *Enter* closes it), then name it, pick its
  category from the icons, add a line or two and, for somewhere underground
  or in the sky, a height. A traced outline is edited point by point like a
  road (below).
- **Roads:** click along the course point by point (*Enter* or a double-click
  finishes, *Backspace* takes a point back), give it a name and a class. The
  length is shown as you draw. A road is **straight** from point to point
  unless you choose **curved**, when it bends smoothly through them, one
  bend flowing into the next (a centripetal Catmull–Rom curve, `roadCourse`
  in `src/maps/geo.ts`, which never loops or overshoots). The curve is what
  the map draws, what the length measures, and what the server checks a
  mayor's road against, so a bend can't swing outside the claims.
- **Editing a line**, whether a road, an outline or a map view's line or
  area, is one grammar on the map (`src/components/maps/editor/Tools.tsx`),
  and the panel shows it with the handles as they're drawn:
  - **drag** a point to move it;
  - **press the line itself** — on the bend, for a curved road — or the
    small **+** halfway between two points, to add a point right there,
    picked, and drag it into place (with a mouse, a ghost **+** rides along
    the line under the pointer first);
  - **click** a point to pick it, and a chip beside it offers *Remove*,
    *Sharp corner* (a curved road's inner point: a sharp turn, as at a
    junction, drawn square; alt-click does the same) and *Continue from
    here* (an end: drawing carries on from it, the road run the other way
    first if it was the start). Clicking a point twice, right-clicking it,
    or *Delete* removes it; a line keeps at least two points, an outline or
    an area three;
  - **undo and redo** step through the session's drawing (⌘Z/Ctrl+Z,
    ⇧⌘Z/Ctrl+Y, or the two buttons in the editor's head), one step per drag;
    the words typed in the fields are the fields' own to undo.
- **Events:** at one of your town's places or at a point you pick on the map,
  with a start, an optional end, a host and, optionally, the article
  announcing it.
- **Edit, move and delete** anything from its panel: *Edit the course*, *Edit
  or move*, stand right under its name for those who may. Mayors see their
  own towns' claims in gold while drawing and are told before saving when
  something reaches outside them; the server checks again and its refusal
  is shown as it comes. A save that never reached the Registry says so and
  keeps the draft where it is, with *Try again*. Mayors also write their
  town's description from the town's panel.
- **Map views** (for anyone who writes articles): choose *New map view* and
  a frame appears on the map in the aspect you pick (wide, square, banner);
  move and zoom the map to set what it shows, choose the layers in the
  picture, then mark it up with the **highlighter**: a pen for
  freehand strokes, lines point by point, shaded areas, pins and short
  notes, in the fixed inks (red, gold, sea, green, rose, ink, white), with
  three weights and an optional arrowhead. Pick a highlight to change its
  ink or label, edit its points as a road's, or remove it. Save, and the
  panel says how to use it: in the Registry, add a Map block to an article
  and choose the view by its title. A view is a framed piece of the map for
  that block: readers see it in the article, or through its link
  (`/maps?view=<id>`), never on the public map. **Your map views** has a
  home on the map's own front for anyone who may draw them (everyone's, for
  staff), and under the pencil: each to *Show* on the map, *Edit*, or
  *Copy link*.

Writes go through Payload's REST API as the signed-in person
(`src/components/maps/api.ts`), so every rule in the collections applies
however the request arrives. A request that never gets through — the
browser's "Failed to fetch" — is said in one plain line ("Couldn't reach
the Registry; your connection may have dropped"), with *Retry* wherever
something was being fetched.

- **Which towns are Azanian:** set under Settings → Azania Maps. Every town of the named Towny nations counts, plus any town listed by name, such as towns that haven't joined yet.
  - The Towny nation is "Azania" (it was "Canada" until October 2026). When Towny renames it, the next reading follows by itself: if a named nation is gone from the map and most of the towns that counted under it now share one other nation, the settings take that name, and the reading's note says so. A nation that falls apart is no rename; its towns stop counting until an admin names where they went.
  - `src/lib/towns.ts` reads the map's marker file into the **Towns** collection.
  - Towns are keyed on Towny's own town id, so a renamed town keeps its places and mayors. A town that leaves or falls is kept, marked.
- **Diplomacy:** also under Settings → Azania Maps, a nation (spelt as the map has it; case, spaces and underscores don't matter), a stance (allied, friendly, tense, hostile, at war) and a line for readers. Every nation not named is neutral. It is public: the map's diplomacy layer, the front and the nations' pages show it to anyone.
- **When the map is read:**
  - after a page of Azania Maps finds the last reading a quarter of an hour old, so while people use the map it is at most about fifteen minutes behind Towny's own markers;
  - once a day by Vercel's scheduler (`vercel.json` → `/maps/sync`), which also writes the day's **census** (residents and claimed chunks per town) for growth charts.

  `/maps/sync` reads at most every ten minutes, whoever calls it.
- **Server sites:** some Towny towns are run by the server itself, and their rulers are bots (`Ruler1`, `Ruler2`, …). Quarries, wastelands and treasure ships pay whichever nation holds them and change hands by siege; there are a few others, such as the server's spawn.
  - The reading tells them apart by the ruler, and keeps each one's kind, what it pays a day, what a quarry produces, and its terms as the map gives them (Towns → *kind*, *income*, *resource*, *site's terms*).
  - A held site is part of Azania on the map, but it isn't a town: it has no census, isn't counted in the nation's growth, and is nobody's `/t spawn`. The front's figures count players' towns alone.
  - On the map a site reads as ground the nation holds rather than a town it built: its claims are hatched in the treasury's gold with a dashed edge, and at its home block, where a town has its lozenge, it wears a mark — a whitewash disc rimmed in gold with the kind's glyph inside: a gem tinted by what the quarry produces (diamond, emerald, iron, gold, coal), a ship, a bare tree for a wasteland, a banner for any other site. Its name is set in gold ink with a line beneath saying what it gives and pays ("diamonds · $333 a day"), placed by the label plan after the towns' names. The words, tints, glyphs and the terms said kindly are in `src/maps/sites.ts`; the mark in `src/components/maps/layers/SiteMark.tsx`.
  - Nobody is mayor of a site. Someone given one to draw in is said to "draw at" it beside their name, and a place there names the site, not a mayor.
- **Who draws:**
  - Admins make a member **mayor** of towns (Users → Azania Maps). A mayor draws and edits places, roads and events inside those towns' claims, and writes the town's description. The claims are checked on every save.
  - **Cartographers**, editors and admins draw anywhere, including national roads between towns.
  - Map views belong to whoever drew them and are for anyone who writes articles.
  - Every edit to a place, road or event keeps a version, so vandalism is one restore away.
- **Tiles:** `/maps/tiles/<map>/<level>/<column>/<row>.jpg`. The CDN keeps a tile fresh for 15 minutes, then refreshes it in the background the next time someone looks, so nobody waits on the Rulercraft map. Browsers keep a tile 5 minutes and then check back by its ETag. The two coarsest levels (4 and 5) are kept 6 hours at the CDN and an hour in the browser, as is `/maps/sheet`, the whole world as one picture made from level 5. While the map errors, the CDN keeps serving the last good tile for a month.
  - New building shows on Azania Maps about 15 minutes after the Rulercraft map draws it; the Rulercraft map itself often lags behind the game.
  - Ground the map hasn't drawn comes back as an empty, cached tile.
  - `/maps/status` says whether the map is answering.
- **Articles:** an article can name the towns, places and events it's about (*On Azania Maps* in the sidebar). The article shows them as chips, in its paper's own hand, that open them on the map, and the town, place or event lists the article in return.

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
branch, and the build script never writes to a database outside a production
build, so work on other branches never touches the production database. A
typical change looks like this:

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
   Nothing needs configuring: `vercel.json` pins the Next.js framework preset
   and the build command, and pnpm is detected from the lockfile. It also
   runs the server in **Frankfurt (`fra1`)**, beside the database (step 3):
   the admin asks the database dozens of things per page, and each one that
   crosses the Atlantic costs about 80 ms. (Vercel
   detects the preset only once, at import, and falls back to "Other" if
   the repository was empty then. "Other" publishes nothing but `public/`,
   so every page 404s; the pin rules that out.) Under Settings → Git,
   confirm the **production branch is `main`**.
3. **Add Postgres:** Storage → Create → **Neon** (from the Marketplace), in
   the region `vercel.json` names (`fra1`; change `regions` there if the
   database lives elsewhere), then connect it to the project. This sets
   `DATABASE_URL` for you. Any hosted
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
`SEED_ADMIN_PASSWORD`, the three **top-level contexts** and the **About
page**. International starts hidden from navigation; switch on its *Show in
navigation* when it's ready. Nothing
else: no demo accounts and no demo articles. From the second deploy on, the
bootstrap sees that accounts exist and does nothing, so you can delete
`SEED_ADMIN_PASSWORD` from Vercel once you've signed in at
`https://nation-of-azania.vercel.app/admin`.

Then create the other accounts in the admin panel (Users → Create New), for
example the Chancellor's, and give residents context grants where they should
write. Each person adds their byline profiles under Content → Profiles (a
role for the contexts they write in), and you can start writing.

### Discord announcements (optional)

The site can post each newly published article to a Discord channel: its
title, excerpt, byline with the author's head, a link, and the link preview
image, in the colour of its paper or style. It is off until a channel is set.

1. In Discord, open the channel's settings → *Integrations* → *Webhooks* →
   *New Webhook*, name it and give it an avatar (the crest suits the
   Gazette), and *Copy Webhook URL*.
2. In the admin panel, open **Settings → Discord** (admins only) and add a
   channel: a context and the webhook URL. A channel takes the articles of
   its context and everything below it, and the most specific one wins, so
   Government, the Times and GirlieTea can each have their own channel.
   *Announce new articles* switches everything off at once.

An article is announced once, when someone first publishes it; edits,
re-publishing, scripts and migrations never post, and articles published
before a channel was set are never announced later. A failed post is logged
and never blocks publishing (`src/lib/discord.ts`). Webhook URLs are
secrets (anyone holding one can post to its channel), so only admins can
read the settings. As a fallback, the environment variables
`DISCORD_WEBHOOK_<SLUG>` (e.g. `DISCORD_WEBHOOK_TIMES`) and
`DISCORD_WEBHOOK_URL` work too.

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
│  ├─ (frontend)/       # public site: [top]/[[...rest]] serves every context; /login, /account, /preview
│  │  ├─ og/            # /og/<path>: link-preview cards (route + the TTFs they are set in)
│  │  ├─ feeds/         # /feeds/<path>: the RSS feeds, reached as /<path>/feed.xml and /feed.xml
│  │  ├─ mapclip/       # /mapclip?town=…: a clipping of the Rulercraft map, for the map block
│  │  └─ maps/          # Azania Maps: the map (layout), its pages (town/, place/, road/, event/), tiles/, status/, sync/
│  └─ (payload)/        # Payload admin UI + REST/GraphQL API routes
├─ access/              # role helpers and context grants (scope.ts)
├─ blocks/
│  ├─ config.ts         # the ten content-block schemas (single source of truth)
│  └─ components/       # React renderers for each block (Skin/, Model3D/ and Litematic/ load their viewers client-only)
├─ collections/         # Articles, Contexts, Pages, Profiles, Media, Users
├─ components/
│  ├─ RichText.tsx      # Lexical → React converter map (register new blocks here)
│  ├─ designs/          # each design's views: gazette/, times/, international/
│  ├─ maps/             # Azania Maps: the shell and scene, layers/ (plain SVG), leaflet/, panels/, editor/, still/ and embed/ (for the Map block)
│  ├─ og/               # link-preview cards, one per design, drawn with Satori
│  ├─ site/             # Gazette chrome (header, footer, crest, cards, …)
│  ├─ times/            # Times chrome (masthead, footer, story cards)
│  └─ members/          # resident area (login form, header)
├─ contexts/            # designs and article types, the context tree
├─ fields/              # shared fields: auto-generated slug, Minecraft name
├─ lib/                 # site tree and routing, data helpers, live preview, Litematica parser, the Dynmap client (dynmap.ts), the towns sync (towns.ts), Azania Maps' reads (maps.ts)
├─ maps/                # Azania Maps in code: geometry (geo.ts), the registries, icons, palette, addresses, time
├─ seed/                # pnpm seed (index.ts), first-deploy bootstrap, verify.ts, assets/
├─ migrations/          # Postgres migrations (pnpm migrate:create; commit these)
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
