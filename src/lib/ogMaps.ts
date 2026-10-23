import type { CardByline, MapCard, MapFact, MapPicture, MapSubject } from '@/components/og/model'
import { MAP_PICTURE } from '@/components/og/tokens'
import { formatDate, minecraftHeadUrl } from '@/components/site/format'
import {
  heartland,
  homeClaimBounds,
  isSite,
  spoken,
  townCentre,
  type MapData,
  type MapEvent,
  type MapPlace,
  type MapRoad,
  type MapTown,
} from '@/maps/data'
import { boundsOf, roadCourse, pathLength, type Bounds, type Outline, type Point } from '@/maps/geo'
import { ICONS } from '@/maps/icons'
import { GROUND, GROUP_COLOURS, ROAD_STYLES } from '@/maps/palette'
import { PLACE_CATEGORIES, ROAD_KINDS } from '@/maps/registry'
import {
  holdingsOf,
  incomeWords,
  resourceWords,
  settlements,
  SITE_GLYPHS,
  siteFacts,
  siteInk,
  siteTerms,
  siteTitle,
  type SiteFacts,
} from '@/maps/sites'
import { compassFrom, spawnCommand, spawnRoute } from '@/maps/spawn'
import { eventPhase } from '@/maps/time'
import { clampSpan } from '@/maps/view'

import { renderClip, type ClipCourse, type ClipMark } from './dynmap'
import { findEvent, findPlace, findRoad, findTown, getMapData } from './maps'
import type { Loaded, Pictures } from './og'

/**
 * The link-preview card of a page of Azania Maps (src/components/og/maps.tsx):
 * the nation's heartland for /maps, and for a town, a held site, a place, a
 * road or an event, a clipping of the map framed on it, drawn by renderClip
 * with the thing on it the way the map draws it — claims outlined (a site's
 * in gold), roads in their class's style, pins and site marks with their
 * glyphs — and its particulars beside. The clipping is fetched here like any
 * other card picture: when the Rulercraft map isn't answering the card is
 * drawn without it, and marked incomplete so the route caches it only
 * briefly.
 */

/** How much ground to leave around the thing, as a share of its extent. */
const MARGIN = { town: 0.3, place: 1.2, road: 0.22, nation: 0.1 }

/** The narrowest a frame gets, in blocks across: enough ground to tell where the thing is. */
const MIN_SPAN = { town: 320, place: 180, road: 220, event: 240, nation: 2400 }

/** The pennant on the 24 grid, as EventsLayer draws it (src/components/maps/layers). */
const PENNANT = { d: 'M7 3v18M7 4h10l-3 4 3 4H7', fill: false }

export async function loadMapCard(segments: string[], pictures: Pictures): Promise<Loaded | null> {
  const data = await getMapData()
  const [kind, raw] = segments
  if (!kind) return nation(data, pictures)
  if (kind === 'town' && raw) {
    const town = findTown(data, raw)
    if (!town) return null
    const site = siteFacts(town)
    return site ? siteCard(data, town, site, pictures) : townCard(data, town, pictures)
  }
  const id = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null
  if (id == null) return null
  switch (kind) {
    case 'place': {
      const place = findPlace(data, id)
      return place ? placeCard(data, place, pictures) : null
    }
    case 'road': {
      const road = findRoad(data, id)
      return road ? roadCard(data, road, pictures) : null
    }
    case 'event': {
      const event = findEvent(data, id)
      return event ? eventCard(data, event, pictures) : null
    }
    default:
      return null
  }
}

// ── The picture ─────────────────────────────────────────────────────────────

type Frame = {
  centre: Point
  span: number
  outlines?: Outline[]
  colour?: string
  courses?: ClipCourse[]
  marks?: ClipMark[]
  /** The thing the card is about: no town's name is set over it. */
  clear?: Point
}

/** The span that fits `bounds` in the picture with a margin around it, never narrower than `min`. */
function fitSpan(bounds: Bounds, margin: number, min: number): number {
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxZ - bounds.minZ)
  const ppb = Math.min(MAP_PICTURE.width / width, MAP_PICTURE.height / height) / (1 + 2 * margin)
  return clampSpan(Math.max(min, MAP_PICTURE.width / ppb))
}

const centreOf = (bounds: Bounds): Point => [(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2]

/** The frame's extent in blocks, from the picture's size and the span. */
function extent(centre: Point, span: number): Bounds {
  const tall = (span * MAP_PICTURE.height) / MAP_PICTURE.width
  return { minX: centre[0] - span / 2, maxX: centre[0] + span / 2, minZ: centre[1] - tall / 2, maxZ: centre[1] + tall / 2 }
}

const within = (bounds: Bounds, [x, z]: Point): boolean =>
  x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ

const touches = (a: Bounds | null, b: Bounds): boolean =>
  a !== null && a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ

/** The roads the frame shows, as the map styles them; `pick` is the road the card is about. */
function roadsIn(data: MapData, bounds: Bounds, pick: MapRoad | null): ClipCourse[] {
  return data.roads
    .filter((road) => touches(boundsOf(road.line), bounds))
    .map((road) => ({
      ...ROAD_STYLES[road.kind],
      points: roadCourse(road.line, road.shape, road.corners),
      halo: road.id === pick?.id ? GROUND.saffron : null,
    }))
}

const placeColour = (place: MapPlace) => GROUP_COLOURS[PLACE_CATEGORIES[place.category].group]

/** The places the frame shows as pins; `pick` is drawn larger. */
function placesIn(data: MapData, bounds: Bounds, pick: MapPlace | null): ClipMark[] {
  return data.places
    .filter((place) => within(bounds, place.point))
    .map((place) => ({
      x: place.point[0],
      z: place.point[1],
      colour: placeColour(place),
      radius: place.id === pick?.id ? 16 : 10,
      glyph: ICONS[place.category],
    }))
}

/** The held sites the frame shows, as the map marks them: a gold-rimmed disc with the kind's glyph in its ink; `pick` is drawn larger. */
function sitesIn(data: MapData, bounds: Bounds, pick: MapTown | null): ClipMark[] {
  return data.towns
    .filter((town) => isSite(town) && town.home && within(bounds, town.home))
    .map((town) => {
      const facts = siteFacts(town)!
      return {
        x: town.home![0],
        z: town.home![1],
        colour: GROUND.whitewash,
        ring: GROUND.saffronDeep,
        ink: siteInk(facts),
        radius: town.id === pick?.id ? 16 : 12,
        glyph: SITE_GLYPHS[facts.kind as keyof typeof SITE_GLYPHS] ?? SITE_GLYPHS.site,
      }
    })
}

/**
 * The clipping, with the towns' names set over it at their home blocks
 * (the biggest first, each only where no other stands; a held site's
 * without the lozenge, its mark being in the picture), and nothing when
 * the map isn't answering.
 */
async function picture(data: MapData, frame: Frame, pictures: Pictures, selected: number | null = null): Promise<MapPicture> {
  const [x, z] = frame.centre
  let labels: MapPicture['labels'] = []
  let src: string | null = null
  try {
    const clip = await renderClip({
      x,
      z,
      span: frame.span,
      map: 'flat',
      aspect: 'wide',
      size: MAP_PICTURE,
      outlines: frame.outlines,
      colour: frame.colour,
      courses: frame.courses,
      marks: frame.marks,
    })
    if (!clip.complete) pictures.complete = false
    if (!clip.offline) src = `data:image/jpeg;base64,${clip.image.toString('base64')}`
    const project = ([bx, bz]: Point): [number, number] => [
      (bx - clip.origin[0]) * clip.ppb,
      (bz - clip.origin[1]) * clip.ppb,
    ]
    const taken: { x: number; y: number; w: number; h: number }[] = []
    if (frame.clear) {
      const [px, py] = project(frame.clear)
      taken.push({ x: px - 48, y: py - 48, w: 96, h: 96 })
    }
    const inset = 16
    // Towns first, the biggest of them first; the held sites after.
    const ordered = [...data.towns].sort((a, b) => Number(isSite(a)) - Number(isSite(b)) || b.residents - a.residents)
    for (const town of ordered) {
      if (!town.home) continue
      const site = isSite(town)
      const [px, py] = project(town.home)
      const text = spoken(town.name).toUpperCase()
      const w = text.length * 15 * 0.68 + 24
      const h = 30
      const box = { x: px - w / 2, y: py - (site ? 20 : 15) - h, w, h }
      if (box.x < inset || box.y < inset || box.x + w > MAP_PICTURE.width - inset) continue
      if (taken.some((o) => box.x < o.x + o.w && box.x + w > o.x && box.y < o.y + o.h && box.y + h > o.y)) continue
      taken.push(box)
      labels.push({ x: px, y: py, text, selected: town.id === selected, site })
    }
  } catch {
    // The map could not be drawn: the card goes out without it, and briefly.
    pictures.complete = false
    labels = []
  }
  return { src, labels }
}

// ── The cards ───────────────────────────────────────────────────────────────

const survey = ([x, z]: Point, y?: number | null): string =>
  [`X ${Math.round(x)}`, ...(y != null ? [`Y ${Math.round(y)}`] : []), `Z ${Math.round(z)}`].join('  /  ')

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

/** "Oct 10 2026", as Towny writes it, in the site's own date form; the raw text if it won't parse. */
function foundedOn(raw: string | null): string | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : (formatDate(date.toISOString()) ?? raw)
}

const townName = (data: MapData, id: number | null): string | null => {
  const town = data.towns.find((candidate) => candidate.id === id)
  return town ? spoken(town.name) : null
}

const card = (subject: MapSubject, picture: MapPicture, facts: MapFact[], survey: string | null): MapCard => ({
  kind: 'map',
  subject,
  picture,
  facts,
  survey,
})

/** /maps: the heartland of the nation's towns, every claim outlined and named, the held sites marked. */
async function nation(data: MapData, pictures: Pictures): Promise<Loaded> {
  const heart = heartland(data.towns) ?? { minX: 3000, maxX: 5600, minZ: 4400, maxZ: 7200 }
  const centre = centreOf(heart)
  const span = fitSpan(heart, MARGIN.nation, MIN_SPAN.nation)
  const bounds = extent(centre, span)
  // The figures count players' towns alone: a held site's bot isn't a resident.
  const towns = settlements(data.towns)
  const shown = await picture(
    data,
    {
      centre,
      span,
      outlines: towns.flatMap((town) => town.claims),
      colour: GROUND.sea700,
      courses: roadsIn(data, bounds, null).filter((course) => course.blocks >= 5),
      marks: sitesIn(data, bounds, null),
    },
    pictures,
  )
  const residents = towns.reduce((total, town) => total + town.residents, 0)
  const chunks = towns.reduce((total, town) => total + town.chunks, 0)
  const coming = data.events.filter((event) => eventPhase(event) !== 'past').length
  const { sites, total } = holdingsOf(data.towns)
  const figures = [count(towns.length, 'town'), count(residents, 'resident'), count(data.places.length, 'place')]
  return {
    card: card(
      { what: 'nation', figures: figures.join(' · ') },
      shown,
      [
        { label: 'Towns', value: String(towns.length) },
        { label: 'Residents', value: residents.toLocaleString('en-GB') },
        { label: 'Claimed chunks', value: chunks.toLocaleString('en-GB') },
        { label: 'Events coming', value: String(coming) },
        ...(sites.length
          ? [{ label: count(sites.length, 'site') + ' held', value: incomeWords(total) ?? 'paying nothing' }]
          : []),
      ],
      null,
    ),
    complete: pictures.complete,
  }
}

/**
 * A held site: its claims in the treasury's gold around its mark, what it
 * is and pays, its terms, and the nearest town's spawn with the walk, since
 * a site is nobody's `/t spawn`.
 */
async function siteCard(data: MapData, town: MapTown, facts: SiteFacts, pictures: Pictures): Promise<Loaded> {
  const centre = townCentre(town) ?? ([0, 0] as Point)
  const around = homeClaimBounds(town) ?? extent(centre, MIN_SPAN.town)
  const span = fitSpan(around, MARGIN.town, MIN_SPAN.town)
  const bounds = extent(centre, span)
  const shown = await picture(
    data,
    {
      centre,
      span,
      outlines: town.claims,
      colour: GROUND.saffronDeep,
      courses: roadsIn(data, bounds, null),
      marks: [...placesIn(data, bounds, null), ...sitesIn(data, bounds, town)],
    },
    pictures,
    town.id,
  )
  const route = town.home ? spawnRoute(town.home, data.towns) : null
  const places = data.places.filter((place) => place.town === town.id).length
  const produces = facts.kind === 'quarry' ? resourceWords(facts.resource) : null
  return {
    card: card(
      {
        what: 'site',
        name: spoken(town.name),
        kind: siteTitle(facts),
        holder: 'Azania',
        pays: incomeWords(facts.income),
        terms: siteTerms(facts).join(' '),
        spawn: route ? { command: route.command, then: route.then } : null,
        mark: {
          ...(SITE_GLYPHS[facts.kind as keyof typeof SITE_GLYPHS] ?? SITE_GLYPHS.site),
          ink: siteInk(facts),
        },
      },
      shown,
      [
        {
          label: 'Held by',
          value: town.nation && town.nation.toLowerCase() !== 'azania' ? `Azania (${spoken(town.nation)})` : 'Azania',
        },
        ...(produces ? [{ label: 'Produces', value: produces.adjective }] : []),
        { label: 'Claimed chunks', value: town.chunks.toLocaleString('en-GB') },
        { label: 'Places', value: places ? String(places) : 'None yet' },
      ],
      town.home ? survey(town.home, 64) : null,
    ),
    complete: pictures.complete,
  }
}

/** A town: its claims outlined around its home, the ruler's head, and Towny's figures. */
async function townCard(data: MapData, town: MapTown, pictures: Pictures): Promise<Loaded> {
  const centre = townCentre(town) ?? ([0, 0] as Point)
  const around = homeClaimBounds(town) ?? extent(centre, MIN_SPAN.town)
  const span = fitSpan(around, MARGIN.town, MIN_SPAN.town)
  const bounds = extent(centre, span)
  const [shown, ruler] = await Promise.all([
    picture(
      data,
      {
        centre,
        span,
        outlines: town.claims,
        colour: GROUND.sea700,
        courses: roadsIn(data, bounds, null),
        marks: placesIn(data, bounds, null),
      },
      pictures,
      town.id,
    ),
    rulerOf(town, pictures),
  ])
  const places = data.places.filter((place) => place.town === town.id).length
  return {
    card: card(
      {
        what: 'town',
        name: spoken(town.name),
        nation: town.nation ? spoken(town.nation) : null,
        ruler,
        spawn: town.home ? { command: spawnCommand(town), open: town.publicSpawn } : null,
      },
      shown,
      [
        { label: town.residents === 1 ? 'Resident' : 'Residents', value: town.residents.toLocaleString('en-GB') },
        { label: 'Claimed chunks', value: town.chunks.toLocaleString('en-GB') },
        { label: 'Founded', value: foundedOn(town.founded) ?? 'Not recorded' },
        { label: 'Places', value: places ? String(places) : 'None yet' },
      ],
      town.home ? survey(town.home, 64) : null,
    ),
    complete: pictures.complete,
  }
}

/** The ruler as a byline, with their head from the skin service. */
const rulerOf = (town: MapTown, pictures: Pictures): Promise<CardByline | null> =>
  town.ruler
    ? pictures.byline({ name: town.ruler, title: 'Ruler', avatar: { url: minecraftHeadUrl(town.ruler), alt: '', pixelated: true } })
    : Promise.resolve(null)

/** A place: its pin, large, with the building's outline if it has one, and its category and lines. */
async function placeCard(data: MapData, place: MapPlace, pictures: Pictures): Promise<Loaded> {
  const outline = place.outline ? boundsOf(place.outline) : null
  const span = outline ? fitSpan(outline, MARGIN.place, MIN_SPAN.place) : MIN_SPAN.place
  const bounds = extent(place.point, span)
  const colour = placeColour(place)
  const shown = await picture(
    data,
    {
      centre: place.point,
      span,
      outlines: place.outline ? [{ x: place.outline.map(([x]) => x), z: place.outline.map(([, z]) => z) }] : [],
      colour,
      courses: roadsIn(data, bounds, null),
      marks: placesIn(data, bounds, place),
      clear: place.point,
    },
    pictures,
  )
  const category = PLACE_CATEGORIES[place.category]
  const town = townName(data, place.town)
  const coming = data.events.filter((event) => event.place === place.id && eventPhase(event) !== 'past').length
  const facts: MapFact[] = [
    ...(town ? [{ label: 'In', value: town }] : []),
    ...(coming ? [{ label: 'Events coming', value: String(coming) }] : []),
    ...(place.y != null ? [{ label: 'Height', value: `Y ${Math.round(place.y)}` }] : []),
  ]
  return {
    card: card(
      {
        what: 'place',
        name: place.name,
        category: { label: category.label, d: ICONS[place.category].d, fill: Boolean(ICONS[place.category].fill), colour },
        town,
        description: tidy(place.description),
      },
      shown,
      facts,
      survey(place.point, place.y),
    ),
    complete: pictures.complete,
  }
}

/** A road: its whole course, picked out in gold among the roads around it. */
async function roadCard(data: MapData, road: MapRoad, pictures: Pictures): Promise<Loaded> {
  const course = roadCourse(road.line, road.shape, road.corners)
  const along = boundsOf(course) ?? extent(road.line[0], MIN_SPAN.road)
  const centre = centreOf(along)
  const span = fitSpan(along, MARGIN.road, MIN_SPAN.road)
  const bounds = extent(centre, span)
  const shown = await picture(
    data,
    { centre, span, courses: roadsIn(data, bounds, road), marks: placesIn(data, bounds, null) },
    pictures,
  )
  const length = Math.round(pathLength(course))
  const from = road.line[0]
  const to = road.line[road.line.length - 1]
  const kind = ROAD_KINDS[road.kind].label
  const town = townName(data, road.town)
  const heading = compassFrom(from, to)
  const description = `${/^[AEIOU]/i.test(kind) ? 'An' : 'A'} ${kind.toLowerCase()} ${town ? `in ${town}` : 'between towns'}, ${length.toLocaleString('en-GB')} blocks along its ${road.shape === 'curved' ? 'curve' : 'course'}${heading ? `, running ${heading}` : ''}.`
  return {
    card: card(
      { what: 'road', name: road.name ?? 'Unnamed road', kind, town, description },
      shown,
      [
        { label: 'Length', value: `${length.toLocaleString('en-GB')} blocks` },
        { label: 'Course', value: road.shape === 'curved' ? 'Curved' : `${road.line.length} points` },
      ],
      `${survey(from)}   →   ${survey(to)}`,
    ),
    complete: pictures.complete,
  }
}

/** An event: its pennant where it's held, and when, in UTC, since a card can't know the reader's clock. */
async function eventCard(data: MapData, event: MapEvent, pictures: Pictures): Promise<Loaded> {
  const place = event.place != null ? (data.places.find((candidate) => candidate.id === event.place) ?? null) : null
  const span = MIN_SPAN.event
  const bounds = extent(event.point, span)
  // Beside the place's own pin, as the map sets it.
  const ppb = MAP_PICTURE.width / span
  const shown = await picture(
    data,
    {
      centre: event.point,
      span,
      courses: roadsIn(data, bounds, null),
      marks: [
        ...placesIn(data, bounds, null),
        { x: event.point[0] + 18 / ppb, z: event.point[1] - 16 / ppb, colour: GROUND.coral, radius: 14, glyph: PENNANT },
      ],
      clear: event.point,
    },
    pictures,
  )
  const town = townName(data, event.town)
  const where = place ? `${place.name}${town ? `, ${town}` : ''}` : (town ?? `${Math.round(event.point[0])}, ${Math.round(event.point[1])}`)
  const start = new Date(event.startsAt)
  const end = event.endsAt ? new Date(event.endsAt) : null
  const utc = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' })
  const clock = utc({ hour: '2-digit', minute: '2-digit' })
  const sameDay = end ? utc({ dateStyle: 'short' }).format(start) === utc({ dateStyle: 'short' }).format(end) : true
  const time = end
    ? sameDay
      ? `${clock.format(start)}–${clock.format(end)} UTC`
      : `${clock.format(start)} to ${utc({ weekday: 'short', day: 'numeric', month: 'short' }).format(end)}, ${clock.format(end)} UTC`
    : `${clock.format(start)} UTC`
  const hours = end ? (end.getTime() - start.getTime()) / 3600000 : null
  const lasts =
    hours == null || hours <= 0
      ? null
      : hours < 1
        ? `${Math.round(hours * 60)} minutes`
        : `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hour${hours === 1 ? '' : 's'}`
  return {
    card: card(
      {
        what: 'event',
        title: event.title,
        leaf: {
          day: utc({ day: 'numeric' }).format(start),
          month: utc({ month: 'short' }).format(start),
          weekday: utc({ weekday: 'short' }).format(start),
        },
        time,
        where,
        town,
        description: tidy(event.description),
      },
      shown,
      [
        ...(event.host ? [{ label: 'Hosted by', value: event.host }] : []),
        ...(lasts ? [{ label: 'Lasts', value: lasts }] : []),
        { label: 'Date', value: utc({ day: 'numeric', month: 'short', year: 'numeric' }).format(start) },
      ],
      survey(event.point),
    ),
    complete: pictures.complete,
  }
}

/** A description as one run of text, for a line clamp. */
const tidy = (text: string | null): string | null => text?.replace(/\s+/g, ' ').trim() || null
