import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Outposts: each town's outposts' spawns as the Rulercraft map marks them,
 * so the map can tell a town's outposts from the town itself and from
 * claims that are neither (src/maps/claims.ts). Empty until the next
 * reading of the map fills it, which the map treats as no outposts.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "towns" ADD COLUMN "outposts" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "towns" DROP COLUMN "outposts";`)
}
