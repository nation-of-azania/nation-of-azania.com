import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest } from 'payload'

import { block, discordMessage } from '../seed/lexical'

/**
 * Content, not schema: sets up the Severe Sanction List of Azania on
 * production, once, and fills the placeholders the two drafts about the
 * Condorian Genocide were left with.
 *
 *  - The list (src/collections/Lists.ts), public in the Gazette at
 *    /gov/sanctions/severe, in two saves so its changelog has the two acts
 *    of the decree "Official denouncement of Imperial Avalonia" apart: those
 *    responsible, named in Condoria's declaration of dissolution (Indefinite,
 *    War crime, Moral code), then Imperial Avalonia's residents for as long
 *    as they are (Moral code). ClaytonPlaysMC, as Condoria spelt him, is
 *    ClaytonPlayzMC on the map. No town is excepted as held by occupation.
 *  - The decree (denounce-condorian-genocide): its two placeholders become
 *    Sanction list blocks, the first save as recorded and the changelog
 *    through Imperial Avalonia.
 *  - The Times' analysis (genocide-tutorial-001): its two Discord
 *    placeholders become Discord quotes, the German one translated, with
 *    the captions its notes asked for. 1Kakashi's image is left for the
 *    author to add to the first message, as the note said.
 *
 * Both articles are saved as drafts, as they were. It goes through the
 * local API, so the hooks record the list's changes and render it down
 * against the map as an edit in the admin would. Anything already done is
 * left alone: a list with the slug is reused, and an article whose
 * placeholders are gone is not touched.
 */

const SLUG = 'severe'
const DECREE = 'denounce-condorian-genocide'
const ANALYSIS = 'genocide-tutorial-001'
const NOTE = 'Decree: Official denouncement of Imperial Avalonia'

const ALL_CLASSES = ['Indefinite', 'War crime', 'Moral code']
const LEADERS = ['Its_Pandaz', 'Juizy1']
const PARTICIPANTS = ['Hutmore', 'Pesimkos', 'clacck', 'BTriangle', 'KlutchItUp', 'ClaytonPlayzMC', 'Im_Wentzer', 'quadecaelite68']

const log = (payload: Payload, message: string) => payload.logger.info(`[sanctions] ${message}`)

type Node = { type?: string; text?: string; children?: Node[]; fields?: Record<string, unknown> }
type Content = { root: Node & { children: Node[] } }

const textOf = (node: Node): string => node.text ?? (node.children ?? []).map(textOf).join(' ')
/** A node's words, as the placeholders are matched: spaces collapsed, in capitals. */
const said = (node: Node) => textOf(node).replace(/\s+/g, ' ').trim().toUpperCase()

/** The children with the nodes from the first `start` to the next `end` (inclusive) replaced by one; null when not there. */
function swap(children: Node[], start: (node: Node) => boolean, end: (node: Node) => boolean, replacement: Node): Node[] | null {
  const from = children.findIndex(start)
  if (from === -1) return null
  const to = children.findIndex((node, index) => index >= from && end(node))
  if (to === -1) return null
  return [...children.slice(0, from), replacement, ...children.slice(to + 1)]
}

async function ensureList(payload: Payload, req: PayloadRequest) {
  const { docs } = await payload.find({ collection: 'lists', where: { slug: { equals: SLUG } }, limit: 1, depth: 0, req })
  if (docs[0]) {
    log(payload, `the list /gov/sanctions/${SLUG} exists, kept as it is`)
    return docs[0]
  }
  const { docs: govs } = await payload.find({
    collection: 'contexts',
    where: { and: [{ slug: { equals: 'gov' } }, { parent: { exists: false } }] },
    limit: 1,
    depth: 0,
    req,
  })
  const gov = govs[0]
  if (!gov) throw new Error('No top-level context "gov" to publish the sanction list in.')

  const player = (name: string, reason: string) => ({ kind: 'player' as const, name, classes: ALL_CLASSES, reason })
  const created = await payload.create({
    collection: 'lists',
    data: {
      name: 'Severe Sanction List of Azania',
      slug: SLUG,
      kind: 'sanctions',
      visibility: 'public',
      context: gov.id,
      description:
        'The Severe Sanction List of Azania is a list containing the names of people that contribute or have contributed actively and clearly to an objective worsening of a specific severe situation.\n\nAzanian towns are explicitly instructed to enforce the updated list immediately. Allies are requested to enforce it as well, to the best of their ability.',
      classes: ALL_CLASSES.map((name) => ({ name })),
      entries: [
        ...LEADERS.map((name) => player(name, 'Leader and initiator of the Condorian Genocide')),
        ...PARTICIPANTS.map((name) => player(name, 'Participant in the Condorian Genocide')),
      ],
      changeNote: `${NOTE}: those responsible`,
    },
    depth: 0,
    req,
  })
  log(payload, `created the list, naming ${LEADERS.length + PARTICIPANTS.length} players`)

  const updated = await payload.update({
    collection: 'lists',
    id: created.id,
    data: {
      entries: [
        ...(created.entries ?? []),
        {
          kind: 'nation',
          name: 'Imperial_Avalonia',
          classes: ['Moral code'],
          reason: 'Resident of Imperial Avalonia, for as long as they are one',
          exceptTowns: [],
          exceptPlayers: [],
        },
      ],
      changeNote: `${NOTE}: residents of Imperial Avalonia`,
    },
    depth: 0,
    req,
  })
  // Read back: the roster is written after the save, by the list's own hook.
  const saved = await payload.findByID({ collection: 'lists', id: updated.id, depth: 0, req })
  const players = Object.keys((saved.roster ?? {}) as object).length
  log(payload, players ? `added Imperial Avalonia's residents: ${players} players on the list` : 'added Imperial Avalonia; the map couldn’t be read, so the watch will bring its residents onto the list')
  return saved
}

/** The latest draft of an article by slug, its content edited by `edit` and saved as a draft; nothing when `edit` finds nothing to do. */
async function fill(payload: Payload, req: PayloadRequest, slug: string, edit: (children: Node[]) => Node[] | null) {
  const { docs } = await payload.find({ collection: 'articles', where: { slug: { equals: slug } }, draft: true, limit: 2, depth: 0, req })
  if (docs.length !== 1) {
    log(payload, `${docs.length === 0 ? 'no article' : 'more than one article'} "${slug}"; left alone`)
    return
  }
  const article = docs[0]
  const content = article.content as unknown as Content | null
  const children = content?.root?.children ? edit(content.root.children) : null
  if (!content || !children) {
    log(payload, `"${slug}" has no placeholders left; left alone`)
    return
  }
  await payload.update({
    collection: 'articles',
    id: article.id,
    data: { content: { ...content, root: { ...content.root, children } } as never },
    draft: true,
    depth: 0,
    req,
  })
  log(payload, `filled the placeholders in "${slug}" (saved as a draft)`)
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const list = await ensureList(payload, req)
  const { docs: changes } = await payload.find({
    collection: 'list-changes',
    where: { and: [{ list: { equals: list.id } }, { source: { equals: 'edit' } }] },
    sort: 'at',
    limit: 1,
    depth: 0,
    req,
  })
  const named = changes[0]

  // The decree: the save that named those responsible, and the residents' log.
  await fill(payload, req, DECREE, (children) => {
    let edited: Node[] | null = children
    const responsible = (node: Node) => said(node).startsWith('(INSERT CHANGELOG FOR ADDING THOSE RESPONSIBLE')
    const residents = (node: Node) => said(node).startsWith('(INSERT LIVE VIEW OF CHANGELOG')
    let changed = false
    if (named && edited.some(responsible)) {
      edited = swap(edited, responsible, responsible, block('sanctions', {
        list: list.id,
        show: 'change',
        change: named.id,
        caption: 'The amendment entering those responsible for the Condorian Genocide into the Severe Sanction List.',
      })) ?? edited
      changed = true
    }
    if (edited.some(residents)) {
      edited = swap(edited, residents, residents, block('sanctions', {
        list: list.id,
        show: 'log',
        through: 'Imperial_Avalonia',
        limit: 30,
        caption: 'New and past residents of Imperial Avalonia, with the dates they came onto the list and left it, kept up to date from the Rulercraft map.',
      })) ?? edited
      changed = true
    }
    return changed ? edited : null
  })

  // The Times' analysis: the two Discord quotes.
  await fill(payload, req, ANALYSIS, (children) => {
    // The bot as the article already quotes it, avatar and all.
    const ruler = children
      .flatMap((node) => (node.type === 'block' && node.fields?.blockType === 'discord' ? ((node.fields.messages ?? []) as Record<string, unknown>[]) : []))
      .find((message) => message.author === 'RulerApp')
    const avatar = ruler?.avatar && typeof ruler.avatar === 'object' ? (ruler.avatar as { id?: number }).id : ruler?.avatar
    let edited: Node[] | null = children
    let changed = false

    const blahja = (node: Node) => said(node).startsWith('(DISCORD QUOTE') && said(node).includes('KEJSAREBLAHJA')
    if (edited.some(blahja)) {
      edited = swap(edited, blahja, blahja, block('discord', {
        channel: '📜｜in-game-chat',
        messages: [
          discordMessage('RulerApp', {
            bot: true,
            ...(avatar ? { avatar } : {}),
            ...(ruler?.roleColour ? { roleColour: ruler.roleColour } : {}),
            timestamp: '14.09.26, 07:34',
            body: 'Patron kejsareblahja » no-one but juizy voted on the war dec',
          }),
        ],
        caption:
          'In the server’s chat a day later, kejsareblahja, a former mayor of one of Imperial Avalonia’s towns: the war was Juizy1’s decision alone.',
      })) ?? edited
      changed = true
    }

    const opens = (node: Node) => said(node).startsWith('(DISCORD QUOTE') && !said(node).includes('KEJSAREBLAHJA')
    const closes = (node: Node) => said(node).endsWith('COMMUNICATION CHANNELS)')
    const from = edited.findIndex(opens)
    const to = edited.findIndex((node, index) => index > from && closes(node))
    if (from !== -1 && to !== -1 && edited.slice(from, to + 1).some((node) => said(node).includes('WARUM ESTACION'))) {
      edited = swap(edited, opens, closes, block('discord', {
        channel: '',
        messages: [
          // Left for 1Kakashi's image, as the note said; a message with nothing in it isn't shown.
          discordMessage('1Kakashi', { timestamp: '13.09.26, 14:11' }),
          discordMessage('1Kakashi', { timestamp: '13.09.26, 14:11', body: 'Warum Estacion', translation: 'Why Estacion?' }),
          discordMessage('1Kakashi', { timestamp: '13.09.26, 14:11', body: 'Was hast du angestellt noname', translation: 'What did you do, noname?' }),
          discordMessage('NoNamePlusEis [AZA] [RC]', {
            timestamp: '13.09.26, 18:41',
            body: 'Ich habe pandas ansage gemacht',
            translation: 'I gave Panda a piece of my mind.',
          }),
          discordMessage('NoNamePlusEis [AZA] [RC]', {
            timestamp: '13.09.26, 18:41',
            body: 'Die versuchen zum 3 mal geld aus uns rauszubekommen',
            translation: 'They’re trying to squeeze money out of us for the third time.',
          }),
        ],
        caption: 'An exclusive excerpt from Condoria’s private communication channels, translated from German.',
      })) ?? edited
      changed = true
    }
    return changed ? edited : null
  })
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Nothing to undo here: the list is deleted, and the articles edited, in the admin.
}
