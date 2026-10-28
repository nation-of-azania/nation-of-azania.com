import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discord" ADD COLUMN "sieges_session_times" varchar DEFAULT '13:00, 19:00, 01:00';
  ALTER TABLE "discord" ADD COLUMN "sieges_session_zone" varchar DEFAULT 'Europe/Berlin';
  ALTER TABLE "discord" ADD COLUMN "sieges_sessions_seen" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discord" DROP COLUMN "sieges_session_times";
  ALTER TABLE "discord" DROP COLUMN "sieges_session_zone";
  ALTER TABLE "discord" DROP COLUMN "sieges_sessions_seen";`)
}
