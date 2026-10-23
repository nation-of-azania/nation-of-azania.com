import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Diplomacy: where Azania stands with other nations (Settings → Azania
 * Maps → Diplomacy), for the map's diplomacy layer. Empty to begin with;
 * every nation not named is neutral.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_azania_maps_relations_stance" AS ENUM('ally', 'friendly', 'tense', 'hostile', 'war');
  CREATE TABLE "azania_maps_relations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"nation" varchar NOT NULL,
  	"stance" "enum_azania_maps_relations_stance" DEFAULT 'friendly' NOT NULL,
  	"note" varchar
  );
  
  ALTER TABLE "azania_maps_relations" ADD CONSTRAINT "azania_maps_relations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."azania_maps"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "azania_maps_relations_order_idx" ON "azania_maps_relations" USING btree ("_order");
  CREATE INDEX "azania_maps_relations_parent_id_idx" ON "azania_maps_relations" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "azania_maps_relations" CASCADE;
  DROP TYPE "public"."enum_azania_maps_relations_stance";`)
}
