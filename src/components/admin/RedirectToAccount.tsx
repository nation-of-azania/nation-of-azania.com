import { redirect } from 'next/navigation'

/**
 * Replaces Payload's "Unauthorized" page (payload.config.ts →
 * admin.components.views.unauthorized). Payload sends signed-in people who may
 * not use the admin panel here after checking `Users.access.admin` against the
 * database on every request, so an access change takes effect immediately; we
 * send them on to their own account page instead of a dead end.
 */
export function RedirectToAccount(): never {
  redirect('/account')
}
