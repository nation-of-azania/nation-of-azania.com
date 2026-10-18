import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import sharp from 'sharp'

import { Articles } from './collections/Articles'
import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Profiles } from './collections/Profiles'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (process.env.NODE_ENV === 'production' && !process.env.PAYLOAD_SECRET) {
  throw new Error('PAYLOAD_SECRET must be set in production.')
}

/**
 * Database adapter, selected via DATABASE_ADAPTER:
 *  - "sqlite" (default): file-based local dev database. Schema is pushed
 *    automatically in dev — no migrations needed.
 *  - "postgres": production database (Neon). Migrations in src/migrations are
 *    applied by the production build — see the README for the SQLite→Postgres
 *    caveat.
 */
const db =
  process.env.DATABASE_ADAPTER === 'postgres'
    ? postgresAdapter({
        pool: {
          connectionString: process.env.DATABASE_URL || '',
        },
        migrationDir: path.resolve(dirname, 'migrations'),
        // Never dev-push schema into Postgres. Push marks the database as
        // dev-managed, after which `payload migrate` offers only a
        // drop-and-replay ("data loss will occur"). Postgres schema changes
        // go through migration files: pnpm migrate:create → commit → push main.
        push: false,
      })
    : sqliteAdapter({
        client: {
          url: process.env.DATABASE_URL || 'file:./azania.db',
        },
      })

export default buildConfig({
  // NO email adapter is configured — deliberately. Payload falls back to its
  // consoleEmailAdapter: password-reset and other emails are written to the
  // server console and NEVER sent. Accounts are username-only and carry no
  // email address. If you ever add a real adapter, re-enable email on the
  // Users collection with addresses on a domain the nation owns.
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // Nothing of Payload shows to people: titles, link previews, favicon and
    // the logo and icon are the Registry's own.
    meta: {
      titleSuffix: '· Azania Registry',
      description: 'The Registry of the Nation of Azania, where its publications are written.',
      icons: [{ rel: 'icon', type: 'image/x-icon', url: '/favicon.ico' }],
      defaultOGImageType: 'off',
      openGraph: {
        siteName: 'Azania',
        title: 'Azania Registry',
        description: 'The Registry of the Nation of Azania, where its publications are written.',
      },
    },
    components: {
      graphics: {
        Logo: '/components/admin/RegistryGraphics#RegistryLogo',
        Icon: '/components/admin/RegistryGraphics#RegistryIcon',
      },
      afterLogin: ['/components/admin/RegistryGraphics#LoginHelp'],
    },
    avatar: 'default',
  },
  collections: [Articles, Pages, Profiles, Media, Categories, Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'azania-insecure-dev-secret',
  // serverURL is intentionally NOT set: media URLs stay relative
  // (/api/media/file/…), which next/image's localPatterns matches and which
  // survive domain changes between dev and production.
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db,
  sharp,
  plugins: [
    // File storage: Vercel Blob in production, local ./media directory in dev.
    // The plugin is ALWAYS in the array and merely `enabled`-gated on the token
    // (no token -> disabled -> falls back to local storage). It must never be
    // conditionally omitted: when omitted, `payload generate:importmap` does not
    // emit the Blob client upload handler, and then wherever the token IS set
    // (production/Vercel) Payload cannot resolve that admin component and the
    // ENTIRE admin panel renders blank. `pnpm generate:importmap` therefore
    // always runs with a placeholder token (package.json), so the handler is
    // emitted even in a shell without the real one.
    vercelBlobStorage({
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
})
