import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Alliances between other nations (Settings → Azania Maps → Alliances), for
 * the war view and the battle tracker: the Rulercraft map doesn't show
 * them, and SiegeWar lets an ally's soldiers fight for either side.
 * Empty to begin with; the tracker also learns them from battles
 * (src/maps/alliances.ts).
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "azania_maps_alliances" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"a" varchar NOT NULL,
  	"b" varchar NOT NULL,
  	"note" varchar
  );
  
  ALTER TABLE "azania_maps_alliances" ADD CONSTRAINT "azania_maps_alliances_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."azania_maps"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "azania_maps_alliances_order_idx" ON "azania_maps_alliances" USING btree ("_order");
  CREATE INDEX "azania_maps_alliances_parent_id_idx" ON "azania_maps_alliances" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "azania_maps_alliances" CASCADE;`)
}
