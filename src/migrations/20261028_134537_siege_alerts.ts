import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discord" ADD COLUMN "sieges_enabled" boolean DEFAULT true;
  ALTER TABLE "discord" ADD COLUMN "sieges_webhook_url" varchar;
  ALTER TABLE "discord" ADD COLUMN "sieges_role" varchar;
  ALTER TABLE "discord" ADD COLUMN "sieges_battles" boolean DEFAULT false;
  ALTER TABLE "discord" ADD COLUMN "sieges_ended" boolean DEFAULT true;
  ALTER TABLE "discord" ADD COLUMN "sieges_laid_by_azania" boolean DEFAULT false;
  ALTER TABLE "azania_maps" ADD COLUMN "siege_watch" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "discord" DROP COLUMN "sieges_enabled";
  ALTER TABLE "discord" DROP COLUMN "sieges_webhook_url";
  ALTER TABLE "discord" DROP COLUMN "sieges_role";
  ALTER TABLE "discord" DROP COLUMN "sieges_battles";
  ALTER TABLE "discord" DROP COLUMN "sieges_ended";
  ALTER TABLE "discord" DROP COLUMN "sieges_laid_by_azania";
  ALTER TABLE "azania_maps" DROP COLUMN "siege_watch";`)
}
