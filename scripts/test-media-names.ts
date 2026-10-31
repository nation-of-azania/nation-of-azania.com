/**
 * The fresh names an image edited in place is saved under, so the Blob
 * store never has to overwrite a file (src/lib/mediaNames.ts), and the
 * Media collection's hook that gives them (src/collections/Media.ts):
 * only for an edit that remakes the file under the name it had, and only
 * where the files live in the Blob store.
 *
 *   pnpm test:media-names
 */
import type { CollectionBeforeChangeHook } from 'payload'

import { Media } from '../src/collections/Media'
import { editedFilename, editStamp, renamedSizes } from '../src/lib/mediaNames'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

check(editedFilename('estacion-at-night.png', 'abc123') === 'estacion-at-night-edit-abc123.png', 'a first edit adds its stamp')
check(
  editedFilename('estacion-at-night-edit-abc123.png', 'def456') === 'estacion-at-night-edit-def456.png',
  'a later edit replaces the earlier stamp instead of adding to it',
)
check(editedFilename('screenshot-2026-10-30.png', 'x1') === 'screenshot-2026-10-30-edit-x1.png', 'a date in the name is left alone')
check(editedFilename('map.v2.webp', 'x1') === 'map.v2-edit-x1.webp', 'only the last extension is kept apart')
check(editedFilename('README', 'x1') === 'README-edit-x1', 'a name without an extension')
check(editStamp(0) === '0' && editStamp(1793433444365) === (1793433444365).toString(36), 'the stamp is the time in base 36')
check(editStamp() !== editStamp(Date.now() + 1), 'two edits a millisecond apart are named apart')

{
  const sizes = {
    thumbnail: { filename: 'estacion-at-night-480x270.png', width: 480, height: 270 },
    card: { filename: 'estacion-at-night-960x540.png', width: 960, height: 540 },
    hero: { filename: null, width: null, height: null },
  }
  const renamed = renamedSizes(sizes, 'estacion-at-night.png', 'estacion-at-night-edit-abc.png')
  check(renamed.thumbnail.filename === 'estacion-at-night-edit-abc-480x270.png', 'a size takes the new stem')
  check(renamed.card.width === 960 && renamed.card.height === 540, 'and keeps everything else')
  check(renamed.hero.filename === null, 'a size that was never made stays without a name')
  check(sizes.thumbnail.filename === 'estacion-at-night-480x270.png', 'the sizes passed in are not changed')
  const again = renamedSizes(renamed, 'estacion-at-night-edit-abc.png', 'estacion-at-night-edit-def.png')
  check(again.card.filename === 'estacion-at-night-edit-def-960x540.png', 'a second edit renames the sizes from the first')
}

// The hook, called as Payload calls it in an update.
{
  const hook = Media.hooks?.beforeChange?.[0] as CollectionBeforeChangeHook
  const blob = { slug: 'media', upload: { disableLocalStorage: true } }
  const disk = { slug: 'media', upload: { disableLocalStorage: false } }
  const original = {
    filename: 'estacion-at-night.png',
    sizes: { thumbnail: { filename: 'estacion-at-night-480x270.png' } },
  }
  const run = (collection: object, req: object, data: Record<string, unknown>, operation = 'update') =>
    hook({
      collection,
      context: {},
      data: structuredClone(data),
      operation,
      originalDoc: original,
      req,
    } as never) as Record<string, unknown>
  const remade = () => ({
    file: { name: 'estacion-at-night.png' },
    context: {},
    query: { uploadEdits: { crop: { x: 0, y: 24, width: 100, height: 56.6 }, focalPoint: { x: 49.5, y: 56.1 } } },
  })
  const edit = {
    filename: 'estacion-at-night.png',
    focalX: 50,
    focalY: 56,
    sizes: { thumbnail: { filename: 'estacion-at-night-480x270.png' } },
  }

  const req = remade()
  const cropped = run(blob, req, edit)
  check(/^estacion-at-night-edit-[0-9a-z]+\.png$/.test(String(cropped.filename)), 'a crop in the Blob store gets a fresh name')
  const size = (cropped.sizes as Record<string, { filename: string }>).thumbnail.filename
  check(size === String(cropped.filename).replace('.png', '-480x270.png'), 'and its sizes follow it')
  check(
    JSON.stringify(req.query.uploadEdits) === JSON.stringify({ focalPoint: { x: 50, y: 56 } }),
    'and the request asks for no further edit, only the focal point the image now has',
  )
  check(
    run(blob, { ...remade(), context: { skipCloudStorage: true } }, edit).filename === 'estacion-at-night.png',
    'the storage plugin’s own second update is left alone',
  )

  check(run(disk, remade(), edit).filename === 'estacion-at-night.png', 'on disk, where Payload overwrites, the name is kept')
  check(run(blob, { context: {} }, { filename: 'estacion-at-night.png', alt: 'New words' }).filename === 'estacion-at-night.png', 'an edit of the alt text alone keeps the name')
  check(run(blob, remade(), { ...edit, filename: 'estacion-at-night-1.png' }).filename === 'estacion-at-night-1.png', 'a new upload, already named apart by Payload, keeps its name')
  check(run(blob, remade(), edit, 'create').filename === 'estacion-at-night.png', 'a create is left to Payload')
}

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
