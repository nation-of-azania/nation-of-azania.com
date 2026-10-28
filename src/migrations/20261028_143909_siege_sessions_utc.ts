import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discord" ALTER COLUMN "sieges_session_times" SET DEFAULT '12:00, 18:00, 00:00';
  ALTER TABLE "discord" ALTER COLUMN "sieges_session_zone" SET DEFAULT 'UTC';`)
  // The server keeps UTC, not European time (README → Siege alerts): the settings follow, unless an admin set them.
  await db.execute(sql`
   UPDATE "discord" SET "sieges_session_times" = '12:00, 18:00, 00:00', "sieges_session_zone" = 'UTC'
   WHERE "sieges_session_times" = '13:00, 19:00, 01:00' AND "sieges_session_zone" = 'Europe/Berlin';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discord" ALTER COLUMN "sieges_session_times" SET DEFAULT '13:00, 19:00, 01:00';
  ALTER TABLE "discord" ALTER COLUMN "sieges_session_zone" SET DEFAULT 'Europe/Berlin';`)
}
