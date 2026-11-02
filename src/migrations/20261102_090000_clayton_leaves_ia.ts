import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import { block, discordMessage, paragraph, root } from '../seed/lexical'

/**
 * Content, not schema: a second news update in the Times' feature "A
 * dictator, a tyranny, a genocide" (dictator-tyranny-genocide), at the end
 * of its "Intermission" chapter, in a Panel (src/blocks/config.ts →
 * PanelBlock): ClaytonPlayzMC, the article's third decision-maker, has left
 * Imperial Avalonia, as the chapter expected. On the map: his one-man town
 * Sagrado_Corazon was Imperial Avalonia's at 14:10 CET on 1 November and
 * the United States of PAC's (capital Golden_State, mayor Varsovia_) the
 * next morning; NoNamePlusEis broke the news at 22:55 that evening.
 *
 * Saved as a draft on top of the published article, for the author to read
 * through the share link and publish. Found by its chapter, not its slug: the
 * article whose latest draft has an "Intermission" heading naming
 * ClaytonPlayzMC. Nothing is done if the update is there already, or the
 * article isn't found exactly once.
 */

type Node = { type?: string; tag?: string; text?: string; children?: Node[]; fields?: Record<string, unknown> }
type Content = { root: Node & { children: Node[] } }

const LABEL = 'Update, 1 November 2026'

const textOf = (node: Node): string => node.text ?? (node.children ?? []).map(textOf).join(' ')
const isHeading = (node: Node) => node.type === 'heading'
const isIntermission = (node: Node) => isHeading(node) && textOf(node).trim().toLowerCase() === 'intermission'

const log = (payload: MigrateUpArgs['payload'], message: string) => payload.logger.info(`[articles] ${message}`)

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const { docs } = await payload.find({ collection: 'articles', draft: true, pagination: false, depth: 0, req })
  const found = docs.filter((doc) => {
    const children = (doc.content as unknown as Content | null)?.root?.children ?? []
    const at = children.findIndex(isIntermission)
    return at !== -1 && children.slice(at, at + 3).some((node) => textOf(node).includes('ClaytonPlayzMC'))
  })
  if (found.length !== 1) {
    log(payload, `${found.length ? 'more than one article' : 'no article'} with the Intermission chapter; the Clayton update is left out`)
    return
  }
  const article = found[0]
  const content = article.content as unknown as Content
  const children = content.root.children
  if (children.some((node) => node.type === 'block' && node.fields?.blockType === 'panel' && node.fields?.label === LABEL)) {
    log(payload, `"${article.slug}" has the Clayton update already; left alone`)
    return
  }

  // The chapter ends where the next heading begins (the next chapter's date, then its title).
  const start = children.findIndex(isIntermission)
  const next = children.findIndex((node, index) => index > start && isHeading(node))
  const at = next === -1 ? children.length : next

  // NoNamePlusEis as the article already quotes them: their avatar and name colour.
  const known = children
    .flatMap((node) => (node.type === 'block' && node.fields?.blockType === 'discord' ? ((node.fields.messages ?? []) as Record<string, unknown>[]) : []))
    .find((message) => typeof message.author === 'string' && message.author.startsWith('NoNamePlusEis'))
  const avatar = known?.avatar && typeof known.avatar === 'object' ? (known.avatar as { id?: number }).id : known?.avatar
  const looks = { ...(avatar ? { avatar } : {}), ...(known?.roleColour ? { roleColour: known.roleColour } : {}) }

  const update = block('panel', {
    tone: 'warm',
    label: LABEL,
    content: root(
      paragraph(
        'Just as we expected, ClaytonPlayzMC has come to his senses. On 1 November, his town Sagrado_Corazon left Imperial Avalonia and joined the United States of PAC, the nation of Varsovia_.',
      ),
      block('discord', {
        channel: '',
        messages: [
          discordMessage('NoNamePlusEis [AZA] [RC]', { ...looks, timestamp: '01.11.26, 22:55', body: 'big news' }),
          discordMessage('NoNamePlusEis [AZA] [RC]', { ...looks, timestamp: '01.11.26, 22:55', body: '1. clayton joined vasovia nation' }),
        ],
        caption: 'Azania hears the news on the evening of 1 November.',
      }),
      paragraph(
        'Of the four decision-makers Imperial Avalonia had when we began writing this article, only two remain: Its_Pandaz and Juizy1.',
      ),
    ),
  })

  await payload.update({
    collection: 'articles',
    id: article.id,
    data: { content: { ...content, root: { ...content.root, children: [...children.slice(0, at), update, ...children.slice(at)] } } as never },
    draft: true,
    depth: 0,
    req,
  })
  log(payload, `added the Clayton update to "${article.slug}" (saved as a draft, for its author to publish)`)
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Content: taken out in the admin, if at all.
}
