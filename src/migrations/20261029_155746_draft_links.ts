import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "draft_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token" varchar,
  	"article_id" integer,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"note" varchar,
  	"created_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "draft_links_id" integer;
  ALTER TABLE "draft_links" ADD CONSTRAINT "draft_links_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "draft_links" ADD CONSTRAINT "draft_links_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "draft_links_token_idx" ON "draft_links" USING btree ("token");
  CREATE INDEX "draft_links_article_idx" ON "draft_links" USING btree ("article_id");
  CREATE INDEX "draft_links_created_by_idx" ON "draft_links" USING btree ("created_by_id");
  CREATE INDEX "draft_links_updated_at_idx" ON "draft_links" USING btree ("updated_at");
  CREATE INDEX "draft_links_created_at_idx" ON "draft_links" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_draft_links_fk" FOREIGN KEY ("draft_links_id") REFERENCES "public"."draft_links"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_draft_links_id_idx" ON "payload_locked_documents_rels" USING btree ("draft_links_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "draft_links" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "draft_links" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_draft_links_fk";
  
  DROP INDEX "payload_locked_documents_rels_draft_links_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "draft_links_id";`)
}
