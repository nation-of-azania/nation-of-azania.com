import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "roads" ADD COLUMN "lanes" jsonb;
  ALTER TABLE "_roads_v" ADD COLUMN "version_lanes" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "roads" DROP COLUMN "lanes";
  ALTER TABLE "_roads_v" DROP COLUMN "version_lanes";`)
}
