import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "battles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"title" varchar,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"town" varchar,
  	"town_id" varchar,
  	"attacker" varchar,
  	"defender" varchar,
  	"session" numeric,
  	"coverage" numeric,
  	"fought" numeric,
  	"track_kept_until" timestamp(3) with time zone,
  	"banner" jsonb,
  	"result" jsonb,
  	"sides" jsonb,
  	"fighters" jsonb,
  	"track" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "presence_days" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"day" varchar NOT NULL,
  	"players" numeric,
  	"slots" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "battles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "presence_days_id" integer;
  CREATE UNIQUE INDEX "battles_key_idx" ON "battles" USING btree ("key");
  CREATE INDEX "battles_started_at_idx" ON "battles" USING btree ("started_at");
  CREATE INDEX "battles_town_id_idx" ON "battles" USING btree ("town_id");
  CREATE INDEX "battles_attacker_idx" ON "battles" USING btree ("attacker");
  CREATE INDEX "battles_defender_idx" ON "battles" USING btree ("defender");
  CREATE INDEX "battles_updated_at_idx" ON "battles" USING btree ("updated_at");
  CREATE INDEX "battles_created_at_idx" ON "battles" USING btree ("created_at");
  CREATE UNIQUE INDEX "presence_days_day_idx" ON "presence_days" USING btree ("day");
  CREATE INDEX "presence_days_updated_at_idx" ON "presence_days" USING btree ("updated_at");
  CREATE INDEX "presence_days_created_at_idx" ON "presence_days" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_battles_fk" FOREIGN KEY ("battles_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_presence_days_fk" FOREIGN KEY ("presence_days_id") REFERENCES "public"."presence_days"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_battles_id_idx" ON "payload_locked_documents_rels" USING btree ("battles_id");
  CREATE INDEX "payload_locked_documents_rels_presence_days_id_idx" ON "payload_locked_documents_rels" USING btree ("presence_days_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "battles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "presence_days" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "battles" CASCADE;
  DROP TABLE "presence_days" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_battles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_presence_days_fk";
  
  DROP INDEX "payload_locked_documents_rels_battles_id_idx";
  DROP INDEX "payload_locked_documents_rels_presence_days_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "battles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "presence_days_id";`)
}
