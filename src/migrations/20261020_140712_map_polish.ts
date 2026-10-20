import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_roads_shape" AS ENUM('straight', 'curved');
  CREATE TYPE "public"."enum__roads_v_version_shape" AS ENUM('straight', 'curved');
  ALTER TABLE "towns" ADD COLUMN "public_spawn" boolean;
  ALTER TABLE "roads" ADD COLUMN "shape" "enum_roads_shape" DEFAULT 'straight' NOT NULL;
  ALTER TABLE "roads" ADD COLUMN "corners" jsonb;
  ALTER TABLE "_roads_v" ADD COLUMN "version_shape" "enum__roads_v_version_shape" DEFAULT 'straight' NOT NULL;
  ALTER TABLE "_roads_v" ADD COLUMN "version_corners" jsonb;
  ALTER TABLE "map_views" DROP COLUMN "map";
  DROP TYPE "public"."enum_map_views_map";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_map_views_map" AS ENUM('flat', 'biomes');
  ALTER TABLE "map_views" ADD COLUMN "map" "enum_map_views_map" DEFAULT 'flat' NOT NULL;
  ALTER TABLE "towns" DROP COLUMN "public_spawn";
  ALTER TABLE "roads" DROP COLUMN "shape";
  ALTER TABLE "roads" DROP COLUMN "corners";
  ALTER TABLE "_roads_v" DROP COLUMN "version_shape";
  ALTER TABLE "_roads_v" DROP COLUMN "version_corners";
  DROP TYPE "public"."enum_roads_shape";
  DROP TYPE "public"."enum__roads_v_version_shape";`)
}
