import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "discord_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"context_id" integer NOT NULL,
  	"webhook_url" varchar NOT NULL
  );
  
  CREATE TABLE "discord" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "discord_channels" ADD CONSTRAINT "discord_channels_context_id_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "discord_channels" ADD CONSTRAINT "discord_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discord"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "discord_channels_order_idx" ON "discord_channels" USING btree ("_order");
  CREATE INDEX "discord_channels_parent_id_idx" ON "discord_channels" USING btree ("_parent_id");
  CREATE INDEX "discord_channels_context_idx" ON "discord_channels" USING btree ("context_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "discord_channels" CASCADE;
  DROP TABLE "discord" CASCADE;`)
}
