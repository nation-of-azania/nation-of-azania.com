import type { MapTown } from './data'
import { GROUND, GROUP_COLOURS } from './palette'
import type { TownKind } from './registry'

/**
 * The server's sites as Azania Maps shows them: what each kind is called,
 * what it pays and gives, the mark that stands for it, and its terms said
 * kindly. Pure functions over the few facts the reading keeps
 * (src/lib/dynmap.ts → siteOf): the kind, what it pays a day, what a
 * quarry produces, and the map's own words. Shared by the live map, the
 * panels, the Map block and the link-preview card, so a quarry is the same
 * quarry everywhere.
 */

export type SiteKind = Exclude<TownKind, 'town'>

/** A site's facts, as MapTown.site and the Map block's Town both give them. */
export type SiteFacts = {
  kind: TownKind
  /** What it pays its holder, in $ a day. */
  income: number | null
  /** What a quarry produces: "Diamond", "Iron", … */
  resource: string | null
  /** The site's terms exactly as the map gives them. */
  note: string | null
}

/** A site's facts out of a MapTown; null for a players' town. */
export const siteFacts = (town: Pick<MapTown, 'kind' | 'site'>): SiteFacts | null =>
  town.kind === 'town' || !town.site ? null : { kind: town.kind, ...town.site }

/** The players' towns among the nation's: what the census counts and the front lists as towns. */
export const settlements = <T extends Pick<MapTown, 'kind'>>(towns: T[]): T[] =>
  towns.filter((town) => town.kind === 'town')

/** What each kind is called, on its own and in the plural. */
export const SITE_WORDS: Record<SiteKind, { label: string; plural: string }> = {
  quarry: { label: 'Quarry', plural: 'Quarries' },
  wasteland: { label: 'Wasteland', plural: 'Wastelands' },
  ship: { label: 'Treasure ship', plural: 'Treasure ships' },
  site: { label: 'Server site', plural: 'Server sites' },
}

/**
 * Whether a kind is a site's: ground the server runs that a nation holds
 * and a siege takes. Not a players' town, and not one of the server's own
 * places abroad, its trading outposts and landmarks (./trading.ts), which
 * nobody holds.
 */
export const isSiteKind = (kind: string): kind is SiteKind => kind in SITE_WORDS

/**
 * The marks, one per kind, drawn like the place icons (src/maps/icons.tsx):
 * the same 24 grid and 2-unit stroke. A quarry's gem is the one filled
 * glyph, so its tint can be the resource's; its facets are the stroke, in
 * whitewash, over the fill. A ship under sail, a bare tree for a wasteland,
 * and for any other site the banner a nation plants to take one.
 */
export const SITE_GLYPHS: Record<SiteKind, { d: string; fill: boolean }> = {
  quarry: { d: 'M7 4h10l5 5-10 12L2 9zM2 9h20M9 4l-3 5 6 12M15 4l3 5-6 12', fill: true },
  ship: { d: 'M3 14h18l-3 6H6zM12 2v12M12 4q7 1 8 10', fill: false },
  wasteland: { d: 'M12 21V7M12 12L7 8M7 8l-2 1M12 9l5-5M17 4l2-1M12 15l-3-2M5 21h14', fill: false },
  site: { d: 'M5 3h14M7 3v13l5-3 5 3V3', fill: false },
}

/** The tints a quarry's gem takes, by what it produces; anything new comes out in the sea. */
const RESOURCE_TINTS: Record<string, string> = {
  diamond: '#3fb8d0',
  emerald: '#2f9e55',
  iron: '#8d9199',
  gold: '#e0a12f',
  coal: '#2b2f36',
}

/** The ink a site's glyph is drawn in: a gem in its resource's tint, a ship in the deep water, a wasteland in quarry brown, a banner in the seal's coral. */
export function siteInk(facts: Pick<SiteFacts, 'kind' | 'resource'>): string {
  switch (facts.kind) {
    case 'quarry':
      return RESOURCE_TINTS[facts.resource?.trim().toLowerCase() ?? ''] ?? GROUND.sea500
    case 'ship':
      return GROUND.sea800
    case 'wasteland':
      return GROUP_COLOURS.industry
    default:
      return GROUND.coral
  }
}

/** What's produced, in words: "Diamond" as the map has it, "diamonds" as a reader says it. */
export function resourceWords(resource: string | null): { adjective: string; noun: string } | null {
  const word = resource?.trim()
  if (!word) return null
  const lower = word.toLowerCase()
  const adjective = lower.charAt(0).toUpperCase() + lower.slice(1)
  // Diamonds and emeralds are counted; iron, gold and coal aren't.
  const noun = /^(diamond|emerald)$/.test(lower) ? `${lower}s` : lower
  return { adjective, noun }
}

/** "$333 a day", or null when the map didn't say. */
export const incomeWords = (income: number | null): string | null =>
  income != null && income > 0 ? `$${income.toLocaleString('en-GB')} a day` : null

/** What a site is, in two words: "Diamond quarry", "Wasteland", "Treasure ship". */
export function siteTitle(facts: SiteFacts): string {
  if (facts.kind === 'town') return 'Town'
  if (facts.kind === 'quarry') {
    const words = resourceWords(facts.resource)
    return words ? `${words.adjective} quarry` : 'Quarry'
  }
  return SITE_WORDS[facts.kind].label
}

/** The line under a site's name on the map: "diamonds · $333 a day", "free resources · $160 a day". */
export function siteLine(facts: SiteFacts): string {
  const pays = incomeWords(facts.income)
  const gives =
    facts.kind === 'quarry'
      ? (resourceWords(facts.resource)?.noun ?? null)
      : facts.kind === 'wasteland'
        ? 'free resources'
        : null
  return [gives, pays].filter(Boolean).join(' · ') || SITE_WORDS[facts.kind as SiteKind]?.label || 'Server site'
}

/** "Europe & Africa & Western Asia" as a reader says it: "Europe, Africa and Western Asia". */
function regionsOf(text: string): string {
  const parts = text
    .split(/\s*(?:&|,|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? text.trim()
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * How a site changes hands, read out of the map's own words: a banner
 * planted at the quarry, or a siege open to the nations of certain regions
 * with the server's channel to ask; failing both, that it is taken by siege
 * at all, when the note says as much.
 */
function takenWords(note: string | null): string | null {
  if (!note) return null
  const banner = /place a colou?red banner at the (\w+) to begin (?:a )?siege/i.exec(note)
  if (banner) {
    return `It changes hands by siege: a nation plants a coloured banner at the ${banner[1].toLowerCase()} to begin one.`
  }
  const regions = /conquerable by nations in ([^.;]+?)(?:,?\s*see\s+#?([\w-]+)\s+for instructions)?\s*(?=[.;]|$)/i.exec(note)
  if (regions) {
    const channel = regions[2] ? `; the server’s #${regions[2]} channel says how` : ''
    return `It can be besieged by nations in ${regionsOf(regions[1])}${channel}.`
  }
  if (/siege|conquer/i.test(note)) return 'It changes hands by siege.'
  return null
}

/**
 * A site's terms, said kindly, from what the reading kept: what it is and
 * what it pays, what else it gives, and how it is taken. One sentence a
 * line, for a panel or a plate; the map's own words stay in `note` for
 * anyone who wants them exactly.
 */
export function siteTerms(facts: SiteFacts): string[] {
  const pays = incomeWords(facts.income)
  const paid = pays ? `whoever holds it is paid ${pays}` : null
  const lines: string[] = []
  switch (facts.kind) {
    case 'quarry': {
      const words = resourceWords(facts.resource)
      lines.push(`A ${words ? `${words.noun.replace(/s$/, '')} ` : ''}quarry the server runs${paid ? `: ${paid}` : ''}.`)
      break
    }
    case 'wasteland':
      lines.push(
        `A wasteland the server runs: the holding nation’s members take its natural resources freely${pays ? `, and the holder is paid ${pays}` : ''}.`,
      )
      break
    case 'ship':
      lines.push(`A treasure ship the server runs${paid ? `: ${paid}` : ''}.`)
      break
    default:
      lines.push(`A site the server runs${paid ? `: ${paid}` : ''}.`)
  }
  const taken = takenWords(facts.note)
  if (taken) lines.push(taken)
  return lines
}

/** A site in a sentence, for a page's description: "a diamond quarry held by Azania, paying $333 a day". */
export function siteSummary(facts: SiteFacts, holder = 'Azania'): string {
  const title = siteTitle(facts).toLowerCase()
  const pays = incomeWords(facts.income)
  return `${/^[aeiou]/.test(title) ? 'an' : 'a'} ${title} held by ${holder}${pays ? `, paying ${pays}` : ''}`
}

/** What the nation holds: its sites, those that pay most first, and what they pay a day together. */
export function holdingsOf<T extends Pick<MapTown, 'kind' | 'site' | 'name'>>(towns: T[]): { sites: T[]; total: number } {
  const sites = towns
    .filter((town) => town.kind !== 'town')
    .sort((a, b) => (b.site?.income ?? 0) - (a.site?.income ?? 0) || a.name.localeCompare(b.name))
  return { sites, total: sites.reduce((sum, site) => sum + (site.site?.income ?? 0), 0) }
}
