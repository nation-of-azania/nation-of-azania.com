/**
 * What a draft link is, for the server and the editor's share panel alike
 * (src/collections/DraftLinks.ts): how long one may last, and what its
 * token and address look like.
 */

/** The longest a link may last. */
export const DRAFT_LINK_MAX_DAYS = 30
/** What a link lasts when the editor doesn't say. */
export const DRAFT_LINK_DEFAULT_DAYS = 7

/** What a link's token looks like, checked before any lookup. */
export const DRAFT_TOKEN = /^[A-Za-z0-9_-]{20,64}$/

/** Where a link leads, from the site's root. */
export const draftLinkPath = (token: string) => `/draft/${token}`
