import type { Access, FieldAccess } from 'payload'

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
