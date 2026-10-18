'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as nextHeaders } from 'next/headers'
import { getPayload, ValidationError } from 'payload'

/**
 * Self-service account settings for everyone with an account, residents
 * included, so nobody needs the admin panel to manage themselves. Every change
 * runs as the signed-in user with access control on (`overrideAccess: false`),
 * so Payload's own rules decide what may change: people edit their own
 * account, never their access level.
 */

export type AccountFormState = {
  ok: boolean
  /** A sentence for the whole form, e.g. "Saved." or why it failed. */
  message?: string
  /** Messages per field, keyed by the input's name. */
  errors?: Record<string, string>
} | null

const MIN_PASSWORD_LENGTH = 10

async function currentUser() {
  const payload = await getPayload({ config })
  const { user } = await payload
    .auth({ headers: await nextHeaders() })
    .catch(() => ({ user: null }))
  return { payload, user }
}

const signedOut: AccountFormState = {
  ok: false,
  message: 'Your session has ended. Sign in again to continue.',
}

/** Field errors from a Payload ValidationError, keyed by field path. */
const fieldErrors = (error: unknown): Record<string, string> | undefined =>
  error instanceof ValidationError
    ? Object.fromEntries(error.data.errors.map((entry) => [entry.path, entry.message]))
    : undefined

/** Display name and Minecraft name. */
export async function updateAccount(
  _: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const { payload, user } = await currentUser()
  if (!user) return signedOut

  const name = String(formData.get('name') ?? '').trim()
  const minecraftName = String(formData.get('minecraftName') ?? '').trim()
  if (!name) return { ok: false, errors: { name: 'Enter the name to show for your account.' } }
  if (name.length > 60) return { ok: false, errors: { name: 'Keep it to 60 characters.' } }

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { name, minecraftName: minecraftName || null },
      overrideAccess: false,
      user,
    })
  } catch (error) {
    return { ok: false, message: 'Those details couldn’t be saved.', errors: fieldErrors(error) }
  }
  revalidatePath('/account')
  return { ok: true, message: 'Saved.' }
}

/**
 * A new password, confirmed with the current one. Afterwards every other
 * session is signed out, so whoever knew the old password loses access; this
 * browser stays signed in.
 */
export async function changePassword(
  _: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const { payload, user } = await currentUser()
  if (!user) return signedOut

  const current = String(formData.get('currentPassword') ?? '')
  const next = String(formData.get('newPassword') ?? '')
  const confirm = String(formData.get('confirmPassword') ?? '')
  const errors: Record<string, string> = {}
  if (!current) errors.currentPassword = 'Enter your current password.'
  if (next.length < MIN_PASSWORD_LENGTH)
    errors.newPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  else if (next === current)
    errors.newPassword = 'Choose a password different from the current one.'
  if (confirm !== next) errors.confirmPassword = 'The two new passwords don’t match.'
  if (Object.keys(errors).length) return { ok: false, errors }

  // Checking the current password through the real login counts failed
  // attempts toward the account lockout, like any other sign-in.
  try {
    await payload.login({
      collection: 'users',
      data: { username: user.username ?? '', password: current },
    })
  } catch {
    return { ok: false, errors: { currentPassword: 'That isn’t your current password.' } }
  }

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { password: next },
      overrideAccess: false,
      user,
    })
  } catch (error) {
    return { ok: false, message: 'The password couldn’t be changed.', errors: fieldErrors(error) }
  }

  // Keep only this browser's session; the same mechanism Payload's own
  // "log out of all sessions" uses.
  const currentSession = (user as typeof user & { _sid?: string })._sid
  const stored = await payload.db.findOne<{ id: number; sessions?: { id: string }[] }>({
    collection: 'users',
    where: { id: { equals: user.id } },
  })
  if (stored) {
    await payload.db.updateOne({
      collection: 'users',
      id: user.id,
      data: {
        ...stored,
        sessions: (stored.sessions ?? []).filter((session) => session.id === currentSession),
        updatedAt: null,
      },
      returning: false,
    })
  }
  return { ok: true, message: 'Password changed. Any other devices have been signed out.' }
}
