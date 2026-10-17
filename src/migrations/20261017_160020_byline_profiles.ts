import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_profiles_publication" AS ENUM('government', 'times', 'both');
  CREATE TABLE "profiles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"publication" "enum_profiles_publication" DEFAULT 'both' NOT NULL,
  	"minecraft_name" varchar,
  	"avatar_id" integer,
  	"owner_id" integer,
  	"active" boolean DEFAULT true,
  	"label" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "articles" ADD COLUMN "byline_id" integer;
  ALTER TABLE "_articles_v" ADD COLUMN "version_byline_id" integer;
  ALTER TABLE "users" ADD COLUMN "minecraft_name" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "profiles_id" integer;
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "profiles" ADD CONSTRAINT "profiles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "profiles_avatar_idx" ON "profiles" USING btree ("avatar_id");
  CREATE INDEX "profiles_owner_idx" ON "profiles" USING btree ("owner_id");
  CREATE INDEX "profiles_updated_at_idx" ON "profiles" USING btree ("updated_at");
  CREATE INDEX "profiles_created_at_idx" ON "profiles" USING btree ("created_at");
  ALTER TABLE "articles" ADD CONSTRAINT "articles_byline_id_profiles_id_fk" FOREIGN KEY ("byline_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_byline_id_profiles_id_fk" FOREIGN KEY ("version_byline_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_profiles_fk" FOREIGN KEY ("profiles_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_byline_idx" ON "articles" USING btree ("byline_id");
  CREATE INDEX "_articles_v_version_version_byline_idx" ON "_articles_v" USING btree ("version_byline_id");
  CREATE INDEX "payload_locked_documents_rels_profiles_id_idx" ON "payload_locked_documents_rels" USING btree ("profiles_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "profiles" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "profiles" CASCADE;
  ALTER TABLE "articles" DROP CONSTRAINT "articles_byline_id_profiles_id_fk";
  
  ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_byline_id_profiles_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_profiles_fk";
  
  DROP INDEX "articles_byline_idx";
  DROP INDEX "_articles_v_version_version_byline_idx";
  DROP INDEX "payload_locked_documents_rels_profiles_id_idx";
  ALTER TABLE "articles" DROP COLUMN "byline_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_byline_id";
  ALTER TABLE "users" DROP COLUMN "minecraft_name";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "profiles_id";
  DROP TYPE "public"."enum_profiles_publication";`)
}
