import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_lists_entries_kind" AS ENUM('player', 'town', 'nation');
  CREATE TYPE "public"."enum_lists_kind" AS ENUM('sanctions', 'plain');
  CREATE TYPE "public"."enum_lists_visibility" AS ENUM('public', 'members', 'staff');
  CREATE TYPE "public"."enum_list_changes_source" AS ENUM('edit', 'world');
  CREATE TABLE "lists_classes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "lists_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_lists_entries_kind" DEFAULT 'player' NOT NULL,
  	"name" varchar NOT NULL,
  	"reason" varchar,
  	"added_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "lists" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"kind" "enum_lists_kind" DEFAULT 'plain' NOT NULL,
  	"visibility" "enum_lists_visibility" DEFAULT 'staff' NOT NULL,
  	"context_id" integer,
  	"description" varchar,
  	"change_note" varchar,
  	"roster" jsonb,
  	"roster_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lists_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "list_changes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar,
  	"list_id" integer,
  	"at" timestamp(3) with time zone NOT NULL,
  	"source" "enum_list_changes_source" NOT NULL,
  	"by_id" integer,
  	"note" varchar,
  	"entries" jsonb,
  	"players" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lists_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "list_changes_id" integer;
  ALTER TABLE "lists_classes" ADD CONSTRAINT "lists_classes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lists_entries" ADD CONSTRAINT "lists_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lists" ADD CONSTRAINT "lists_context_id_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lists_texts" ADD CONSTRAINT "lists_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "list_changes" ADD CONSTRAINT "list_changes_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "list_changes" ADD CONSTRAINT "list_changes_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "lists_classes_order_idx" ON "lists_classes" USING btree ("_order");
  CREATE INDEX "lists_classes_parent_id_idx" ON "lists_classes" USING btree ("_parent_id");
  CREATE INDEX "lists_entries_order_idx" ON "lists_entries" USING btree ("_order");
  CREATE INDEX "lists_entries_parent_id_idx" ON "lists_entries" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "lists_slug_idx" ON "lists" USING btree ("slug");
  CREATE INDEX "lists_context_idx" ON "lists" USING btree ("context_id");
  CREATE INDEX "lists_updated_at_idx" ON "lists" USING btree ("updated_at");
  CREATE INDEX "lists_created_at_idx" ON "lists" USING btree ("created_at");
  CREATE INDEX "lists_texts_order_parent" ON "lists_texts" USING btree ("order","parent_id");
  CREATE INDEX "list_changes_list_idx" ON "list_changes" USING btree ("list_id");
  CREATE INDEX "list_changes_at_idx" ON "list_changes" USING btree ("at");
  CREATE INDEX "list_changes_by_idx" ON "list_changes" USING btree ("by_id");
  CREATE INDEX "list_changes_updated_at_idx" ON "list_changes" USING btree ("updated_at");
  CREATE INDEX "list_changes_created_at_idx" ON "list_changes" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lists_fk" FOREIGN KEY ("lists_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_list_changes_fk" FOREIGN KEY ("list_changes_id") REFERENCES "public"."list_changes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_lists_id_idx" ON "payload_locked_documents_rels" USING btree ("lists_id");
  CREATE INDEX "payload_locked_documents_rels_list_changes_id_idx" ON "payload_locked_documents_rels" USING btree ("list_changes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "lists_classes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lists_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lists" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lists_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "list_changes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "lists_classes" CASCADE;
  DROP TABLE "lists_entries" CASCADE;
  DROP TABLE "lists" CASCADE;
  DROP TABLE "lists_texts" CASCADE;
  DROP TABLE "list_changes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_lists_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_list_changes_fk";
  
  DROP INDEX "payload_locked_documents_rels_lists_id_idx";
  DROP INDEX "payload_locked_documents_rels_list_changes_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lists_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "list_changes_id";
  DROP TYPE "public"."enum_lists_entries_kind";
  DROP TYPE "public"."enum_lists_kind";
  DROP TYPE "public"."enum_lists_visibility";
  DROP TYPE "public"."enum_list_changes_source";`)
}
