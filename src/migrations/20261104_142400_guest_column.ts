import { randomBytes } from 'node:crypto'

import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest, Where } from 'payload'

import { ITALIC, paragraph, root, text } from '../seed/lexical'

/**
 * Content, not schema: opens the Times' guest column and gives its first
 * writer an account, once.
 *
 *  - the Guest Column, under the Times, in the Airmail style (src/contexts/
 *    styles.ts), where writers from outside Azania publish once a Times
 *    editor has reviewed their drafts
 *  - 3zys, mayor of Klaipeda (a town of no nation), as a Guest (src/access:
 *    the contexts granted, nothing for members) with Write drafts in the
 *    column, and their byline there
 *
 * The account's first password was made at random outside the repository
 * and handed to its owner, who changes it on first signing in: only its
 * salt and PBKDF2 hash are here, in the form Payload stores (its
 * generatePasswordSaltHash: 25,000 rounds of SHA-256, 512 bytes, hex). The
 * account is made with a throwaway password, then given that hash.
 *
 * Anything that already exists is kept as it is; an existing account named
 * 3zys keeps its password. On a fresh database, which has no accounts while
 * migrations run, only the column is made.
 */

const WRITER = '3zys'
const STYLE = 'airmail'

const SALT = '65ed79f9a23909278b06113f166a2e4db17b7e523dacbe9d2523a68cab2f563e'
const HASH =
  'f36b75299dfd9d3d677cd90cce91d6718c9103f8cd42d6b07a7655d8fbbdacb8aa2e6e0e2676970783a1b1393e0d6d0248eedba601f00bacfb94179deb1773d9' +
  'f5e285a9dbd4e7bb7f5a688eb6d005723f13bf34056ff1775be2c4b41ed1b1cdca2e3326cba3c816cf9199e7a5c9b91f2ec1099dd45e9c40bb7488e07e8ca350' +
  '9e0c29a6fe87ab6fba98b83b31163d95de7882111246993386744875b8bea89701b46bffeb68f9aaeb9a9b88e31330422fbff78a64e07fd35fedc576266cfc21' +
  '58a1ff70645d5b3347a33ff7096ff69297954b4678b2734726f725477cd48e970a8b45dec3de3c1a58352b24ebddbe25137ace329915e7c3591d436e6ffccdb9' +
  '7a2e12de997e110073e60fa69f9e9493bb8c93dea9f099d8f2ed26376ac554b1b12eecfeff26a822ca0c8074c32ab159a5af5ebab6ee42c8e81c2fb162617810' +
  'afbf33af5c67ea6d8dcf60283ae87df6e64cfda2eef335cce03b963e47503103dd0ac52802b52113866161cd0be062cddefa75d871360f672be5e0a4f9b9005b' +
  '2621d78c8252551a09aafc4065052065c53878017e3b60b0351a8bce0131e543fe570ddcfa5a6bdd86cff410f65a08daf831eaee12deb2454d9572446a446aee' +
  'ff9b65e324094df5146fd7b1f8ca9cbecc8e266627291262a186b7a0c4f79b522b89b87b8f13522ed020c9a9c1a7427f731c01d2452f20bf8772ba153cd0e030'

const log = (payload: Payload, message: string) => payload.logger.info(`[guest column] ${message}`)

async function lookup<TSlug extends 'contexts' | 'users' | 'profiles'>(payload: Payload, req: PayloadRequest, collection: TSlug, where: Where) {
  const { docs } = await payload.find({ collection, where, limit: 2, depth: 0, req })
  return docs
}

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.execute(sql`SELECT EXISTS (SELECT 1 FROM "users") AS "any"`)
  const accounts = Boolean((rows[0] as { any?: boolean } | undefined)?.any)

  const [times] = await lookup(payload, req, 'contexts', { and: [{ slug: { equals: 'times' } }, { parent: { exists: false } }] })
  if (!times) {
    log(payload, 'the Times is missing; nothing set up')
    return
  }

  let [column] = await lookup(payload, req, 'contexts', { and: [{ slug: { equals: 'guest' } }, { parent: { equals: times.id } }] })
  if (column) log(payload, `context ${column.path} exists, kept as it is`)
  else {
    column = await payload.create({
      collection: 'contexts',
      data: {
        name: 'Guest Column',
        slug: 'guest',
        parent: times.id,
        style: STYLE,
        listed: true,
        tagline: 'Writers from beyond Azania, in the Times',
        intro: root(
          paragraph(
            'The Guest Column is where the Azanian Times hosts writers from beyond Azania: mayors, ',
            'citizens and observers of other nations, or of none. Their articles are reviewed and ',
            'published by the Times’ editors.',
          ),
          paragraph(text('The views in the Guest Column are its writers’ own, not the Times’ or Azania’s.', ITALIC)),
        ),
      },
      depth: 0,
      req,
    })
    log(payload, `created context ${column.path} (${STYLE} style)`)
  }

  if (!accounts) {
    log(payload, `no accounts yet; ${WRITER}'s account is left for an admin to make`)
    return
  }

  const found = await lookup(payload, req, 'users', { or: [{ username: { equals: WRITER } }, { minecraftName: { equals: WRITER } }] })
  if (found.length > 1) {
    log(payload, `more than one account found for ${WRITER}; set them up under Users`)
    return
  }
  let writer = found[0]
  if (writer) {
    log(payload, `account "${writer.username}" exists, kept as it is (password unchanged)`)
  } else {
    writer = await payload.create({
      collection: 'users',
      data: {
        username: WRITER,
        name: WRITER,
        minecraftName: WRITER,
        role: 'guest',
        contextAccess: [{ context: column.id, level: 'write' }],
        password: randomBytes(24).toString('hex'),
      },
      depth: 0,
      req,
    })
    // The first password, as its hash: the way Payload's own password reset stores one.
    await payload.db.updateOne({ collection: 'users', id: writer.id, data: { salt: SALT, hash: HASH }, req })
    log(payload, `created ${WRITER}'s account: Guest, Write drafts in ${column.path}`)
  }

  const [profile] = await lookup(payload, req, 'profiles', { and: [{ name: { equals: WRITER } }, { owner: { equals: writer.id } }] })
  if (profile) log(payload, `profile ${profile.label} exists, kept as it is`)
  else {
    const created = await payload.create({
      collection: 'profiles',
      data: { name: WRITER, title: 'Mayor of Klaipeda', contexts: [column.id], owner: writer.id, minecraftName: WRITER },
      depth: 0,
      req,
    })
    log(payload, `created profile ${created.label}`)
  }
}

/** Removes the byline, the account and the column, if nothing was written there since. */
export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.delete({ collection: 'profiles', where: { and: [{ name: { equals: WRITER } }, { title: { equals: 'Mayor of Klaipeda' } }] }, req })
  await payload.delete({ collection: 'users', where: { and: [{ username: { equals: WRITER } }, { role: { equals: 'guest' } }] }, req })
  const { errors } = await payload.delete({ collection: 'contexts', where: { slug: { equals: 'guest' } }, req })
  if (errors.length > 0) log(payload, 'kept the Guest Column: it holds something')
}
