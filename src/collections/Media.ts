import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isEditorOrAdmin } from '../access'
import { canUseAdmin } from '../access/scope'
import { editedFilename, editStamp, renamedSizes } from '../lib/mediaNames'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * An image edited in place (cropped, resized, a new focal point) is saved
 * under a fresh name, because Vercel Blob won't overwrite the old one
 * (src/lib/mediaNames.ts). Only where the files live in the Blob store:
 * on disk, in development, Payload has already written the edit over the
 * old file by the time this runs, under the old name. The edit is told
 * apart by the file being made again (req.file) under the name it already
 * had; a new upload never is, as Payload numbers a name that's taken.
 *
 * The storage plugin, once the files are up, saves their names in a second
 * update on this same request, and Payload would read the edit from the
 * query again there: download the edited file and edit it over again. So
 * from here on the request asks for nothing but the focal point the image
 * now has, which is no edit.
 */
const renameEditedImage: CollectionBeforeChangeHook = ({ collection, data, operation, originalDoc, req }) => {
  const upload = typeof collection.upload === 'object' ? collection.upload : null
  if (operation !== 'update' || !upload?.disableLocalStorage || !req.file || req.context?.skipCloudStorage) return data
  const filename = originalDoc?.filename
  if (typeof filename !== 'string' || data.filename !== filename) return data
  const renamed = editedFilename(filename, editStamp())
  data.filename = renamed
  if (data.sizes && typeof data.sizes === 'object') data.sizes = renamedSizes(data.sizes, filename, renamed)
  if (req.query && typeof data.focalX === 'number' && typeof data.focalY === 'number') {
    req.query.uploadEdits = { focalPoint: { x: data.focalX, y: data.focalY } }
  }
  return data
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
    description:
      'Images, audio clips, 3D models (.glb) and Litematica schematics. Alt text is required for accessibility.',
  },
  access: {
    read: () => true,
    // Whoever can write somewhere; residents without grants have nothing to illustrate.
    create: ({ req }) => canUseAdmin(req.user),
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    // application/octet-stream is allowed because some browsers/OSes upload
    // .glb files with that generic type instead of model/gltf-binary.
    // application/gzip (+ x-gzip) is required for Litematica .litematic files:
    // they are gzip-compressed NBT, so Payload's content sniffing reports gzip
    // regardless of the generic type the browser sends — that's the server-side
    // validation.
    //
    // The bare ".litematic" is for the file PICKER: Payload builds the input's
    // `accept` attribute from this list, and Windows/macOS map an unregistered
    // extension to NO MIME type, so without the literal extension the OS file
    // dialog greys out .litematic files. It's inert for server validation (a
    // sniffed MIME type never starts with ".litematic").
    mimeTypes: [
      'image/*',
      // Voice clips and audio attachments quoted in the Discord Quote block.
      'audio/*',
      'model/gltf-binary',
      'application/octet-stream',
      'application/gzip',
      'application/x-gzip',
      '.litematic',
    ],
    imageSizes: [
      { name: 'thumbnail', width: 480 },
      { name: 'card', width: 960 },
      { name: 'hero', width: 1920 },
    ],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
  hooks: {
    beforeChange: [renameEditedImage],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describe the image for screen readers, or the model for its caption.',
      },
    },
  ],
}
