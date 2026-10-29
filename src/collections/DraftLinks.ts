import { randomBytes } from 'node:crypto'

import {
  APIError,
  Forbidden,
  type Access,
  type AccessResult,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type PayloadRequest,
  type Where,
} from 'payload'

import { hasRole, type Role } from '../access'
import { DRAFT_LINK_DEFAULT_DAYS, DRAFT_LINK_MAX_DAYS } from '../lib/draftLinks'
import { Articles } from './Articles'

/**
 * A link that shows an article's latest draft to whoever has it, without an
 * account: /draft/<token> (src/app/(frontend)/draft/[token]). For sending a
 * draft to a reviewer, a council member, or anyone else who should read it
 * before it's published. Made from the article's editor by anyone who may
 * edit the article; each link names one article, lasts at most a month, and
 * can be revoked by deleting it. Staff see and revoke every link; everyone
 * else, their own.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** 24 URL-safe characters: 144 random bits, beyond guessing. */
const newToken = () => randomBytes(18).toString('base64url')

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

const ownOrStaff: Access = ({ req }): AccessResult => {
  if (!req.user) return false
  if (hasRole(req.user, 'admin', 'editor')) return true
  return { createdBy: { equals: req.user.id } }
}

/** Whether the signed-in person may edit this article, by the article's own update rule. */
async function mayEdit(req: PayloadRequest, id: number): Promise<boolean> {
  const rule = await Articles.access!.update!({ req, id })
  if (typeof rule === 'boolean') return rule
  const { totalDocs } = await req.payload.count({
    collection: 'articles',
    where: { and: [{ id: { equals: id } }, rule as Where] },
    overrideAccess: true,
    req,
  })
  return totalDocs > 0
}

/** A new link: for an article its maker may edit and that has somewhere to appear; the token and the maker are the server's. */
const prepare: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (operation !== 'create') return data
  if (!req.user) throw new Forbidden(req.t)
  const articleId = idOf(data.article)
  if (articleId == null || !(await mayEdit(req, articleId))) throw new Forbidden(req.t)
  const article = await req.payload.findByID({
    collection: 'articles',
    id: articleId,
    draft: true,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (idOf(article.context) == null) {
    throw new APIError('Choose where the article is published before sharing it.', 400, undefined, true)
  }
  return { ...data, token: newToken(), createdBy: req.user.id }
}

/** Expired links, and those whose article is gone, are of no use to anyone: each new link clears them out. */
const sweep: CollectionAfterChangeHook = async ({ operation, req }) => {
  if (operation !== 'create') return
  await req.payload.delete({
    collection: 'draft-links',
    where: { or: [{ expiresAt: { less_than: new Date().toISOString() } }, { article: { exists: false } }] },
    overrideAccess: true,
    req,
  })
}

export const DraftLinks: CollectionConfig = {
  slug: 'draft-links',
  labels: { singular: 'Draft link', plural: 'Draft links' },
  admin: {
    group: 'Administration',
    useAsTitle: 'note',
    defaultColumns: ['article', 'note', 'expiresAt', 'createdBy'],
    description:
      'Links that show an article’s latest draft to anyone who has them. Made from the article’s editor; delete one to revoke it.',
    hidden: ({ user }) => !hasRole(user as { role?: Role | null }, 'admin', 'editor'),
  },
  access: {
    read: ownOrStaff,
    create: ({ req }) => Boolean(req.user),
    // A link doesn't change: make a new one, and revoke the old.
    update: () => false,
    delete: ownOrStaff,
  },
  hooks: {
    beforeChange: [prepare],
    afterChange: [sweep],
  },
  fields: [
    {
      name: 'token',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Set by the server; the link is /draft/<token>.' },
    },
    {
      // Required, but nullable in the database: deleting the article then leaves the link dead, not the delete refused.
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      validate: (value: unknown) => (value == null ? 'Choose an article.' : true),
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date(Date.now() + DRAFT_LINK_DEFAULT_DAYS * DAY_MS).toISOString(),
      validate: (value: unknown) => {
        const at = value ? new Date(String(value)).getTime() : Number.NaN
        if (!Number.isFinite(at)) return 'Give a date.'
        if (at <= Date.now()) return 'A link must last into the future.'
        // A minute's grace, for the time the request takes to arrive.
        if (at > Date.now() + DRAFT_LINK_MAX_DAYS * DAY_MS + 60_000) {
          return `A link lasts at most ${DRAFT_LINK_MAX_DAYS} days.`
        }
        return true
      },
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'note',
      type: 'text',
      maxLength: 80,
      admin: { description: 'Who it’s for, to know which to revoke (“Council review”). Only editors see it.' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
}
