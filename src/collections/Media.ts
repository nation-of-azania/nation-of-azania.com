import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionConfig } from 'payload'

import { isEditorOrAdmin } from '../access'
import { canUseAdmin } from '../access/scope'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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
