'use client'

/**
 * Whether the reader's connection asks the map to go easy: the browser's
 * Save-Data setting, or a connection it rates 2g or 3g. The map then asks
 * for only what's on the page, nothing ahead of time; Safari and Firefox
 * don't say, and get the map as everyone else does.
 */
export function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection
  return connection?.saveData === true || /(^|-)(2g|3g)$/.test(connection?.effectiveType ?? '')
}
