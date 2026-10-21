import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Server sites: a town's kind (a players' town, or a quarry, wasteland,
 * treasure ship or other site the server runs), and a site's income,
 * resource and terms. Sites already stored are told apart by their bot
 * rulers (Ruler1, Ruler2, …) at once; the next reading of the map fills
 * in what they pay.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_towns_kind" AS ENUM('town', 'quarry', 'wasteland', 'ship', 'site');
  ALTER TABLE "towns" ADD COLUMN "kind" "enum_towns_kind" DEFAULT 'town';
  ALTER TABLE "towns" ADD COLUMN "income" numeric;
  ALTER TABLE "towns" ADD COLUMN "resource" varchar;
  ALTER TABLE "towns" ADD COLUMN "site_note" varchar;`)
  await db.execute(sql`
  UPDATE "towns" SET "kind" = (CASE
    WHEN "name" ILIKE '%quarry%' THEN 'quarry'
    WHEN "name" ILIKE '%wasteland%' THEN 'wasteland'
    WHEN "name" ~* 'treasure.?ship' THEN 'ship'
    ELSE 'site'
  END)::"enum_towns_kind"
  WHERE "ruler" ~ '^Ruler[0-9]+$';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "towns" DROP COLUMN "kind";
  ALTER TABLE "towns" DROP COLUMN "income";
  ALTER TABLE "towns" DROP COLUMN "resource";
  ALTER TABLE "towns" DROP COLUMN "site_note";
  DROP TYPE "public"."enum_towns_kind";`)
}
