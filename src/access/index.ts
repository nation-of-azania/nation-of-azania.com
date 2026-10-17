import type { Access, FieldAccess, Where } from 'payload'

export type Role = 'resident' | 'editor' | 'admin'

type MaybeUser = null | undefined | { role?: Role | null }

export const hasRole = (user: MaybeUser, ...roles: Role[]): boolean =>
  Boolean(user?.role && roles.includes(user.role))

/** Any logged-in user. */
export const isAuthenticated: Access = ({ req }) => Boolean(req.user)

/** Admins only. */
export const isAdmin: Access = ({ req }) => hasRole(req.user, 'admin')

/** Editors and admins. */
export const isEditorOrAdmin: Access = ({ req }) => hasRole(req.user, 'editor', 'admin')

/** Field-level: admins only. */
export const isAdminField: FieldAccess = ({ req }) => hasRole(req.user, 'admin')

/** Field-level: editors and admins. */
export const isEditorOrAdminField: FieldAccess = ({ req }) => hasRole(req.user, 'editor', 'admin')

/** Anyone can read published docs; authors their own; editors/admins everything. */
export const canReadPublishedOrOwn: Access = ({ req }) => {
  if (hasRole(req.user, 'editor', 'admin')) return true
  if (req.user) {
    const ownOrPublished: Where = {
      or: [{ _status: { equals: 'published' } }, { author: { equals: req.user.id } }],
    }
    return ownOrPublished
  }
  return { _status: { equals: 'published' } }
}

/** Editors/admins update anything; residents only their own docs. */
export const canUpdateOwnOrEditor: Access = ({ req }) => {
  if (hasRole(req.user, 'editor', 'admin')) return true
  if (req.user) return { author: { equals: req.user.id } }
  return false
}
