import { Crest } from '@/components/site/Crest'

/**
 * The admin panel's own graphics, replacing Payload's logo and icon (wired up
 * in payload.config.ts → admin.components.graphics). The admin doesn't load
 * the site's Tailwind, so sizing lives in src/app/(payload)/custom.scss.
 */

/** The login page: the crest and the Registry wordmark. */
export function RegistryLogo() {
  return (
    <span className="registry-logo">
      <Crest />
      <span className="registry-logo__words">
        <span className="registry-logo__name">Azania</span>
        <span className="registry-logo__sub">Registry</span>
      </span>
    </span>
  )
}

/** The navigation icon. */
export function RegistryIcon() {
  return (
    <span className="registry-icon">
      <Crest />
    </span>
  )
}

/**
 * Below the login form, in place of "Forgot password?" (hidden in custom.scss):
 * accounts have no email address, so an administrator resets passwords.
 */
export function LoginHelp() {
  return (
    <p className="registry-login-help">
      Forgotten your password? An administrator can reset it for you.
    </p>
  )
}
