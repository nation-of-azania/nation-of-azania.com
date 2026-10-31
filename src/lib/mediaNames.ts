/**
 * The names an image is saved under again when it's edited in place:
 * cropped, resized or given a new focal point in the admin. Payload makes
 * the edited file, and its sizes, under the names they already have, and
 * expects the storage to overwrite them; Vercel Blob refuses to ("This blob
 * already exists"), so the save fails with a 500. An edited image takes a
 * fresh name instead, with its stamp in place of any earlier edit's
 * (estacion-at-night.png → estacion-at-night-edit-mh8x0k2p.png), and its
 * sizes follow. A new name is also a new address, so no CDN, browser or
 * image optimiser can go on serving the picture as it was before the edit.
 * The storage plugin deletes the old files once the new ones are saved.
 * Pure, so it is tested without a database (scripts/test-media-names.ts).
 */

/** An earlier edit's stamp at the end of a stem. */
const EDIT_STAMP = /-edit-[0-9a-z]+$/

const split = (filename: string) => {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? { stem: filename.slice(0, dot), ext: filename.slice(dot) } : { stem: filename, ext: '' }
}

/** A stamp for one edit: the time, in base 36. */
export const editStamp = (now = Date.now()) => now.toString(36)

/** The name an edited file is saved under: its stem, without an earlier edit's stamp, with this one's. */
export function editedFilename(filename: string, stamp: string): string {
  const { stem, ext } = split(filename)
  return `${stem.replace(EDIT_STAMP, '')}-edit-${stamp}${ext}`
}

type Size = { filename?: string | null } & Record<string, unknown>

/**
 * The sizes renamed with their image: a size is named after the image's
 * stem (estacion-at-night-480x270.png), so it takes the new stem. A size
 * that wasn't made (an image narrower than it) has no name and stays so.
 */
export function renamedSizes<T extends Record<string, Size | null | undefined>>(sizes: T, from: string, to: string): T {
  const old = split(from).stem
  const fresh = split(to).stem
  return Object.fromEntries(
    Object.entries(sizes).map(([name, size]) => [
      name,
      size?.filename && size.filename.startsWith(`${old}-`)
        ? { ...size, filename: `${fresh}${size.filename.slice(old.length)}` }
        : size,
    ]),
  ) as T
}
