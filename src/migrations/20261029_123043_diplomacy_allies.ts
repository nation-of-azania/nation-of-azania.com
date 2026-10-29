import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_discord_sieges_allies" AS ENUM('besieged', 'involved', 'off');
  ALTER TABLE "users" ADD COLUMN "diplomat" boolean DEFAULT false;
  ALTER TABLE "discord" ADD COLUMN "sieges_allies" "enum_discord_sieges_allies" DEFAULT 'involved';
  ALTER TABLE "discord" ADD COLUMN "sieges_ping_allies" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "diplomat";
  ALTER TABLE "discord" DROP COLUMN "sieges_allies";
  ALTER TABLE "discord" DROP COLUMN "sieges_ping_allies";
  DROP TYPE "public"."enum_discord_sieges_allies";`)
}
