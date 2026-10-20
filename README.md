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
nation; founded. Or give **x and z** to centre anywhere, with a town or
without one. Zoom runs from *close* (about 150 blocks across) to *country*;
the clipping can be wide, square or a banner, on the flat map or the biome
map. Beneath it the figure sets the coordinates as a survey reference, with a
*Copy* button that copies them as a `/tp` would take them, and a quiet link
to the live map at the same spot.

The clipping itself is a JPEG from `/mapclip` (`src/app/(frontend)/mapclip`),
stitched on demand from Dynmap's tiles by `src/lib/dynmap.ts` and cached at
the CDN, so the map server sees about one request per clipping a day. Saving
never waits on it: the block checks only that it was given a town name or a
pair of coordinates. A town the map doesn't know, or a map that isn't
answering, is said in the figure's frame; a broken image never appears.

The block has two more settings, which tie it to [Azania Maps](#azania-maps):

- **Map view.** Choose a view by its title and the block shows that view
  instead of a clipping: the frame its author set, the layers they chose
  (towns, places, roads, events) and the highlights they drew. The clipping
  fields step aside.
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
down the layers still show over a plain ground.

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

- Azania's **towns**, read from Towny: their claims, names and facts.
- **Places** with a category and icon (cafés, town halls, ports, …), optionally with a building outline.
- Named **roads**, railways and waterways, straight from point to point or curved smoothly through them, drawn like a road map: casings under translucent fills (a wash the build shows through, thinner the closer you come), widths by zoom, the name along the line once it fits.
- **Events** with a time and a place.
- **Map views**: framed pieces of the map with highlights drawn on them, which an article's Map block can show.

Everything is stored in block coordinates (`src/maps/geo.ts`), never pixels.
The categories, road kinds and highlight inks are defined in code
(`src/maps/registry.ts`), like the designs and styles; their icons, colours
and road styles in `src/maps/icons.tsx` and `src/maps/palette.ts`.

**Reading the map.** Leaflet draws it (`src/components/maps/leaflet`),
taught Dynmap's projection: zoom 0 is the tiles' own scale, two pixels a
block, and zooming closer scales the blocks up pixel for pixel. Tiles come
through the site's cache, and are only ever asked for at Dynmap's own
levels; a zoom in between scales the nearest. The map's JavaScript loads
only on `/maps` and in an interactive Map block, never with any other page.
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
  held) zooms at its own ratio. The ratios are at the top of
  `leaflet/canvas.tsx`. In an article's embedded map the wheel is left to
  the page, so scrolling past it never catches.
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
  its places and events and the articles about it; a place's category,
  description and events; a road's class and length; an event's time in the
  reader's own time zone, its place, host and article. A town with claims
  away from the one holding its home block lists them as **outposts**, each
  with *Show on map*; *Fit to town* fits the main claim. These pages are
  rendered on the server and cached for everyone alike, a minute at a time
  (and regenerated at once after someone draws), so links unfurl and search
  engines read them; the visitor's own drawing rights are fetched in the
  browser (`/api/users/me`). The map's own spot travels in the query —
  `?at=<x>,<z>,<zoom>`, `&layers=towns,roads`, `&view=<id>` for an article's
  view with its highlights — written as the map moves, so any address can
  be shared. (Old links with `&map=biomes` still open; the biome map is no
  longer drawn.)
- **Getting there.** Players have no `/tp`, so what's offered to copy is
  what they can type: `/t spawn <Town>` for a town, and for anything else
  the nearest town's spawn with the walk from its home block ("then 40
  blocks north-east"). Public spawns are preferred within reason; a town
  whose spawn is private (Towny's *Public Teleport* off) is said so —
  only its residents can use it. Coordinates stay on the page, as F3
  shows them.
- **Tools.** Search across towns, places, roads and events; layer toggles
  and a legend; the block under the pointer (the centre, on a phone) with
  its nearest spawn to copy; the nation at a glance, with the census's
  trend, on the map's own front.
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
  data, so they never go dark.

**Drawing on the map.** Sign in (the panel's *Sign in* comes back to the map)
and, with rights, the pencil in the map's corner offers what you may do;
everyone else only looks.

- **Places:** drop the pin, trace a building's outline if there is one (click
  around it; the first point or *Enter* closes it), then name it, pick its
  category from the icons, add a line or two and, for somewhere underground
  or in the sky, a height.
- **Roads:** click along the course point by point (*Enter* or a double-click
  finishes, *Backspace* takes a point back), then drag any point to move it,
  drag the small handle between two to add one, pick a point and press
  *Delete* to remove it; give it a name and a class. The length is shown as
  you draw. A road is **straight** from point to point unless you choose
  **curved**, when it bends smoothly through them, one bend flowing into
  the next (a centripetal Catmull–Rom curve, `roadCourse` in
  `src/maps/geo.ts`, which never loops or overshoots); where it should turn
  sharply, as at a junction, pick the point and mark it a *sharp corner*,
  or alt-click it — it's drawn square. The curve is what the map draws,
  what the length measures, and what the server checks a mayor's road
  against, so a bend can't swing outside the claims.
- **Events:** at one of your town's places or at a point you pick on the map,
  with a start, an optional end, a host and, optionally, the article
  announcing it.
- **Edit, move and delete** anything from its panel. Mayors see their own
  towns' claims in gold while drawing and are told before saving when
  something reaches outside them; the server checks again and its refusal
  is shown as it comes. Mayors also write their town's description from the
  town's panel.
- **Map views** (for anyone who writes articles): choose *New map view* and
  a frame appears on the map in the aspect you pick (wide, square, banner);
  move and zoom the map to set what it shows, choose the layers in the
  picture, then mark it up with the **highlighter**: a pen for
  freehand strokes, lines point by point, shaded areas, pins and short
  notes, in the fixed inks (red, gold, sea, green, rose, ink, white), with
  three weights and an optional arrowhead. Pick a highlight to change its
  ink or label, nudge its points, or remove it; *Ctrl+Z* undoes the last.
  Save, and the panel says how to use it: in the Registry, add a Map block
  to an article and choose the view by its title. *My map views* lists your
  views (everyone's, for staff) to show again, redraw, rename or delete.

Writes go through Payload's REST API as the signed-in person
(`src/components/maps/api.ts`), so every rule in the collections applies
however the request arrives.

- **Which towns are Azanian:** set under Settings → Azania Maps. Every town of the named Towny nations counts, plus any town listed by name, such as towns that haven't joined yet.
  - The nation still has its old Towny name, "Canada"; rename it there when it changes in game.
  - `src/lib/towns.ts` reads the map's marker file into the **Towns** collection.
  - Towns are keyed on Towny's own town id, so a renamed town keeps its places and mayors. A town that leaves or falls is kept, marked.
- **When the map is read:**
  - after a page of Azania Maps finds the last reading an hour old;
  - once a day by Vercel's scheduler (`vercel.json` → `/maps/sync`), which also writes the day's **census** (residents and claimed chunks per town) for growth charts.

  `/maps/sync` reads at most every ten minutes, whoever calls it.
- **Who draws:**
  - Admins make a member **mayor** of towns (Users → Azania Maps). A mayor draws and edits places, roads and events inside those towns' claims, and writes the town's description. The claims are checked on every save.
  - **Cartographers**, editors and admins draw anywhere, including national roads between towns.
  - Map views belong to whoever drew them and are for anyone who writes articles.
  - Every edit to a place, road or event keeps a version, so vandalism is one restore away.
- **Tiles:** `/maps/tiles/<map>/<level>/<column>/<row>.jpg`, which the CDN caches for a day. While the map errors, the CDN keeps serving the last good tile for a month.
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
   and the build command, and pnpm is detected from the lockfile. (Vercel
   detects the preset only once, at import, and falls back to "Other" if
   the repository was empty then. "Other" publishes nothing but `public/`,
   so every page 404s; the pin rules that out.) Under Settings → Git,
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
