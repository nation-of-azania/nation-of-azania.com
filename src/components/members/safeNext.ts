/**
 * Where to go after signing in: a `?next=` that is a path on this site, else
 * the account page. Refuses anything a browser could read as another site:
 * `//host`, and `/\host`, which browsers normalise to `//host`; backslashes
 * and control characters are refused outright.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/account'
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return '/account'
  return raw
}
