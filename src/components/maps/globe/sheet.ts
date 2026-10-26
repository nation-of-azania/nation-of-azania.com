import { GLOBE } from '@/maps/globe-switches'
import { SHEET_URL } from '@/maps/sheet'

/**
 * The world's picture for the globe (/maps/sheet.webp, the flat map's own,
 * from the browser's cache), decoded off the main thread the moment the
 * globe's code is fetched, so the globe takes it up in a moment. Taken up
 * from the flat map's <img> instead, the browser would decode it all again
 * on the main thread, as the first frame is drawn and again for a lost
 * context given back. Decoded as its bytes are, with no colour conversion
 * and nothing premultiplied, as the flat map shows them.
 *
 * A globe holds on to it while it's mounted, and lets it go with itself;
 * one decoded for a globe that was never opened (the pointer came to its
 * button and went) is let go of after as long as a closed globe lingers.
 */

export type Sheet = {
  /** The picture, once it's decoded. */
  bitmap: ImageBitmap | null
  /** The picture, or null should it not come. */
  coming: Promise<ImageBitmap | null>
}

let sheet: Sheet | null = null
let held = false
let unheld = 0

/**
 * Starts decoding the picture, if it isn't already, and says how it's
 * going; `hold`, for a globe that's mounted, keeps it until let go. Null
 * where the browser can't decode a picture off the main thread.
 */
export function warmSheet(hold = false): Sheet | null {
  if (typeof createImageBitmap !== 'function') return null
  if (!sheet) {
    const made: Sheet = { bitmap: null, coming: Promise.resolve(null) }
    made.coming = fetch(SHEET_URL)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(`The sheet answered ${response.status}.`))))
      .then((blob) => createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
      .then((bitmap) => {
        // Let go of while it was decoding: nobody wants it now.
        if (sheet !== made) {
          bitmap.close()
          return null
        }
        made.bitmap = bitmap
        return bitmap
      })
      .catch(() => {
        // It didn't come: the globe borrows the flat map's own picture, and the next to ask tries again.
        if (sheet === made) sheet = null
        return null
      })
    sheet = made
  }
  window.clearTimeout(unheld)
  held ||= hold
  if (!held) unheld = window.setTimeout(releaseSheet, GLOBE.lingerMs)
  return sheet
}

/** The globe has gone (or was never opened): the picture is let go of. */
export function releaseSheet(): void {
  window.clearTimeout(unheld)
  sheet?.bitmap?.close()
  sheet = null
  held = false
}
