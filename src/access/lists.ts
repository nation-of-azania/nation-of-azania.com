import type { AccessResult, Where } from 'payload'

import { hasRole, isMember, type Role } from './index'

/**
 * Who may read a list (src/collections/Lists.ts), and so its changelog:
 * staff every list; Azania's other accounts the public lists and the
 * members'; a guest (a writer from abroad) and a visitor only the public
 * ones. `path` points at the visibility from the changelog
 * (`list.visibility`).
 */
export function listVisibility(user: unknown, path = 'visibility'): AccessResult {
  const account = user as { role?: Role | null } | null
  if (hasRole(account, 'admin', 'editor')) return true
  return { [path]: { in: isMember(account) ? ['public', 'members'] : ['public'] } } as Where
}
