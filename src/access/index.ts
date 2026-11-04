import type { Access, FieldAccess } from 'payload'

/**
 * Access levels (src/collections/Users.ts → role). A guest is a writer from
 * outside Azania: like a resident, the contexts granted are all they reach,
 * and, not being a member, they never see what members see (lists shown to
 * members, src/access/lists.ts).
 */
export type Role = 'guest' | 'resident' | 'editor' | 'admin'

/** Whether an account is one of Azania's own: signed in, and not a guest. */
export const isMember = (user: MaybeUser): boolean => Boolean(user?.role && user.role !== 'guest')

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
