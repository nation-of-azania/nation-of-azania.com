import type { AccessResult, Where } from 'payload'

import { hasRole, type Role } from './index'

/**
 * Who may read a list (src/collections/Lists.ts), and so its changelog:
 * staff every list; anyone signed in the public lists and the members'; a
 * visitor only the public ones. `path` points at the visibility from the
 * changelog (`list.visibility`).
 */
export function listVisibility(user: unknown, path = 'visibility'): AccessResult {
  if (hasRole(user as { role?: Role | null }, 'admin', 'editor')) return true
  return { [path]: { in: user ? ['public', 'members'] : ['public'] } } as Where
}
