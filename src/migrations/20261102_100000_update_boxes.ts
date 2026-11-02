import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import { block, discordMessage } from '../seed/lexical'

/**
 * Content, not schema: the two news updates in the Times' feature "A
 * dictator, a tyranny, a genocide" as two Panels, one after the other, as
 * the author asked:
 *
 *  1. The "Intermission" chapter (the author's own update of 30 October:
 *     ClaytonPlayzMC superseded, Imperial Avalonia's war on Salvador) becomes
 *     a warm panel labelled "Update, 30 October 2026", its heading gone and
 *     its words and quotes as they were.
 *  2. The Clayton update (20261102_090000_clayton_leaves_ia) quotes the
 *     server's own announcement in #👑 | diplomacy, not an Azanian's message:
 *     Azania's own channels are internal. The bot as the article already
 *     quotes it there (its name, avatar and channel), at 22:16 on 1 November:
 *     "👑 Town of Sagrado_Corazon has joined United_States_Of_PAC 👑".
 *
 * Saved in the state the article is in: as a draft on a draft, or published
 * if its latest version has been published since. Each part is done only if
 * it isn't done already.
 */

type Node = { type?: string; tag?: string; text?: string; children?: Node[]; fields?: Record<string, unknown> }
type Content = { root: Node & { children: Node[] } }

const LATER = 'Update, 1 November 2026'
const EARLIER = 'Update, 30 October 2026'
const ANNOUNCEMENT = 'Town of Sagrado_Corazon has joined United_States_Of_PAC'

const log = (payload: MigrateUpArgs['payload'], message: string) => payload.logger.info(`[articles] ${message}`)
const textOf = (node: Node): string => node.text ?? (node.children ?? []).map(textOf).join(' ')
const isHeading = (node: Node) => node.type === 'heading'
const isIntermission = (node: Node) => isHeading(node) && textOf(node).trim().toLowerCase() === 'intermission'
const isPanel = (label: string) => (node: Node) => node.type === 'block' && node.fields?.blockType === 'panel' && node.fields?.label === label
const isDiscord = (node: Node) => node.type === 'block' && node.fields?.blockType === 'discord'
const messagesOf = (node: Node) => (node.fields?.messages ?? []) as Record<string, unknown>[]
const innerOf = (panel: Node) => (panel.fields?.content as Content | undefined)?.root?.children ?? []
const withInner = (panel: Node, children: Node[]): Node => {
  const content = panel.fields?.content as Content
  return { ...panel, fields: { ...panel.fields, content: { ...content, root: { ...content.root, children } } } }
}
/** A rich-text state for a panel, from its nodes. */
const stateOf = (children: Node[]) => ({ root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } })

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({ collection: 'articles', draft: true, pagination: false, depth: 0, req })
  const found = docs.filter((doc) => ((doc.content as unknown as Content | null)?.root?.children ?? []).some(isPanel(LATER)))
  if (found.length !== 1) {
    log(payload, `${found.length ? 'more than one article' : 'no article'} with the Clayton update; the update boxes are left as they are`)
    return
  }
  const article = found[0]
  const content = article.content as unknown as Content
  let children = content.root.children
  const done: string[] = []

  // 1. The Intermission chapter as the earlier update's panel: everything from its heading to the later panel or the next heading.
  const start = children.findIndex(isIntermission)
  if (start !== -1 && !children.some(isPanel(EARLIER))) {
    const end = children.findIndex((node, index) => index > start && (isHeading(node) || isPanel(LATER)(node)))
    const stop = end === -1 ? children.length : end
    const earlier = block('panel', { tone: 'warm', label: EARLIER, content: stateOf(children.slice(start + 1, stop)) })
    children = [...children.slice(0, start), earlier as Node, ...children.slice(stop)]
    done.push('the Intermission chapter is the 30 October update’s panel')
  }

  // 2. The later update quotes the server's announcement.
  const at = children.findIndex(isPanel(LATER))
  const later = children[at]
  const inner = innerOf(later)
  if (!inner.some((node) => isDiscord(node) && messagesOf(node).some((message) => String(message.body ?? '').includes(ANNOUNCEMENT)))) {
    // The bot and its channel as the article already quotes them, in or out of a panel: its announcement of a town joining a nation.
    const everywhere = children.flatMap((node) => (node.type === 'block' && node.fields?.blockType === 'panel' ? innerOf(node) : [node]))
    const announcer = everywhere.filter(isDiscord).find((node) => messagesOf(node).some((message) => message.bot && String(message.body ?? '').includes('has joined')))
    const bot = announcer ? messagesOf(announcer).find((message) => message.bot) : undefined
    const avatar = bot?.avatar && typeof bot.avatar === 'object' ? (bot.avatar as { id?: number }).id : bot?.avatar
    const quote = block('discord', {
      channel: (announcer?.fields?.channel as string | undefined) || '👑 | diplomacy',
      messages: [
        discordMessage(typeof bot?.author === 'string' ? bot.author : 'Ruler', {
          bot: true,
          ...(avatar ? { avatar } : {}),
          ...(bot?.roleColour ? { roleColour: bot.roleColour } : {}),
          timestamp: '1.11.26, 22:16',
          body: `👑 ${ANNOUNCEMENT} 👑`,
        }),
      ],
    }) as Node
    const swapped = inner.some(isDiscord) ? inner.map((node) => (isDiscord(node) ? quote : node)) : [inner[0], quote, ...inner.slice(1)]
    children = [...children.slice(0, at), withInner(later, swapped), ...children.slice(at + 1)]
    done.push('the 1 November update quotes the server’s announcement')
  }

  if (!done.length) {
    log(payload, `"${article.slug}": both update boxes are as they should be; left alone`)
    return
  }
  const published = article._status === 'published'
  await payload.update({
    collection: 'articles',
    id: article.id,
    data: {
      content: { ...content, root: { ...content.root, children } } as never,
      ...(published ? { _status: 'published' as const } : {}),
    },
    draft: !published,
    depth: 0,
    req,
  })
  log(payload, `"${article.slug}": ${done.join('; ')} (${published ? 'published, as it was' : 'saved as a draft'})`)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Content: changed in the admin, if at all.
}
