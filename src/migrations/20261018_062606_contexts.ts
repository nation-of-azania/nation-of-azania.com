import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Sections and categories become contexts and types. Production gets the
 * three top-level contexts (Government, The Azanian Times and an unlisted
 * International), and its profiles, pages and any articles move onto them
 * before the old columns go. The down migration restores the schema only.
 */

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. The new schema: contexts, per-context access, profile contexts, and the
  //    article context, type and design columns.
  await db.execute(sql`
    CREATE TYPE "public"."enum_articles_type" AS ENUM('dispatch', 'decree', 'statement', 'explanation', 'notice', 'news', 'feature', 'analysis', 'opinion', 'announcement', 'standard', 'resolution', 'report', 'case-study');
    CREATE TYPE "public"."enum_articles_design" AS ENUM('gazette', 'times', 'international');
    CREATE TYPE "public"."enum__articles_v_version_type" AS ENUM('dispatch', 'decree', 'statement', 'explanation', 'notice', 'news', 'feature', 'analysis', 'opinion', 'announcement', 'standard', 'resolution', 'report', 'case-study');
    CREATE TYPE "public"."enum__articles_v_version_design" AS ENUM('gazette', 'times', 'international');
    CREATE TYPE "public"."enum_contexts_design" AS ENUM('gazette', 'times', 'international');
    CREATE TYPE "public"."enum_contexts_accent" AS ENUM('sea', 'lagoon', 'saffron', 'coral', 'cinnabar', 'olive', 'violet', 'slate');
    CREATE TYPE "public"."enum_users_context_access_level" AS ENUM('write', 'publish', 'manage');
    CREATE TABLE "contexts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"parent_id" integer,
  	"design" "enum_contexts_design",
  	"tagline" varchar,
  	"intro" jsonb,
  	"emblem_id" integer,
  	"accent" "enum_contexts_accent",
  	"order" numeric DEFAULT 0,
  	"listed" boolean DEFAULT true,
  	"path" varchar,
  	"label" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
    CREATE TABLE "profiles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"contexts_id" integer
  );
    CREATE TABLE "users_context_access" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"context_id" integer,
  	"level" "enum_users_context_access_level" DEFAULT 'write'
  );
    DROP INDEX "pages_slug_idx";
    ALTER TABLE "articles" ADD COLUMN "context_id" integer;
    ALTER TABLE "articles" ADD COLUMN "type" "enum_articles_type";
    ALTER TABLE "articles" ADD COLUMN "design" "enum_articles_design";
    ALTER TABLE "_articles_v" ADD COLUMN "version_context_id" integer;
    ALTER TABLE "_articles_v" ADD COLUMN "version_type" "enum__articles_v_version_type";
    ALTER TABLE "_articles_v" ADD COLUMN "version_design" "enum__articles_v_version_design";
    ALTER TABLE "pages" ADD COLUMN "context_id" integer;
    ALTER TABLE "_pages_v" ADD COLUMN "version_context_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contexts_id" integer;
    ALTER TABLE "contexts" ADD CONSTRAINT "contexts_parent_id_contexts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "contexts" ADD CONSTRAINT "contexts_emblem_id_media_id_fk" FOREIGN KEY ("emblem_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "profiles_rels" ADD CONSTRAINT "profiles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "profiles_rels" ADD CONSTRAINT "profiles_rels_contexts_fk" FOREIGN KEY ("contexts_id") REFERENCES "public"."contexts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "users_context_access" ADD CONSTRAINT "users_context_access_context_id_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "users_context_access" ADD CONSTRAINT "users_context_access_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "contexts_slug_idx" ON "contexts" USING btree ("slug");
    CREATE INDEX "contexts_parent_idx" ON "contexts" USING btree ("parent_id");
    CREATE INDEX "contexts_emblem_idx" ON "contexts" USING btree ("emblem_id");
    CREATE INDEX "contexts_path_idx" ON "contexts" USING btree ("path");
    CREATE INDEX "contexts_updated_at_idx" ON "contexts" USING btree ("updated_at");
    CREATE INDEX "contexts_created_at_idx" ON "contexts" USING btree ("created_at");
    CREATE INDEX "profiles_rels_order_idx" ON "profiles_rels" USING btree ("order");
    CREATE INDEX "profiles_rels_parent_idx" ON "profiles_rels" USING btree ("parent_id");
    CREATE INDEX "profiles_rels_path_idx" ON "profiles_rels" USING btree ("path");
    CREATE INDEX "profiles_rels_contexts_id_idx" ON "profiles_rels" USING btree ("contexts_id");
    CREATE INDEX "users_context_access_order_idx" ON "users_context_access" USING btree ("_order");
    CREATE INDEX "users_context_access_parent_id_idx" ON "users_context_access" USING btree ("_parent_id");
    CREATE INDEX "users_context_access_context_idx" ON "users_context_access" USING btree ("context_id");
    ALTER TABLE "articles" ADD CONSTRAINT "articles_context_id_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_context_id_contexts_id_fk" FOREIGN KEY ("version_context_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "pages" ADD CONSTRAINT "pages_context_id_contexts_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_context_id_contexts_id_fk" FOREIGN KEY ("version_context_id") REFERENCES "public"."contexts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contexts_fk" FOREIGN KEY ("contexts_id") REFERENCES "public"."contexts"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "articles_context_idx" ON "articles" USING btree ("context_id");
    CREATE INDEX "_articles_v_version_version_context_idx" ON "_articles_v" USING btree ("version_context_id");
    CREATE INDEX "pages_context_idx" ON "pages" USING btree ("context_id");
    CREATE INDEX "_pages_v_version_version_context_idx" ON "_pages_v" USING btree ("version_context_id");
    CREATE INDEX "payload_locked_documents_rels_contexts_id_idx" ON "payload_locked_documents_rels" USING btree ("contexts_id");
    CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  `)

  // 2. Move the data while the old columns still exist.
  await db.execute(sql`
    -- The three top-level contexts that replace the old sections. International
    -- starts unlisted: reachable by URL, left out of menus until it is ready.
    INSERT INTO "contexts" ("name", "slug", "design", "tagline", "order", "listed", "path", "label") VALUES
      ('Government', 'gov', 'gazette', 'The official record of the Nation of Azania', 1, true, '/gov', 'Government'),
      ('The Azanian Times', 'times', 'times', 'Independent of the Chancellery', 2, true, '/times', 'The Azanian Times'),
      ('International', 'intl', 'international', 'Initiatives among nations, hosted by Azania', 3, false, '/intl', 'International');

    -- Profiles: publication (government / times / both) becomes the contexts they sign in.
    INSERT INTO "profiles_rels" ("order", "parent_id", "path", "contexts_id")
    SELECT 1, p.id, 'contexts', c.id FROM "profiles" p JOIN "contexts" c ON c.slug = 'gov'
    WHERE p.publication IN ('government', 'both');
    INSERT INTO "profiles_rels" ("order", "parent_id", "path", "contexts_id")
    SELECT CASE WHEN p.publication = 'both' THEN 2 ELSE 1 END, p.id, 'contexts', c.id
    FROM "profiles" p JOIN "contexts" c ON c.slug = 'times'
    WHERE p.publication IN ('times', 'both');
    UPDATE "profiles" p SET "label" = p.name || ' · ' || p.title || CASE p.publication
      WHEN 'government' THEN ' (Government)' WHEN 'times' THEN ' (The Azanian Times)'
      ELSE ' (Government, The Azanian Times)' END;

    -- Pages were all Gazette pages.
    UPDATE "pages" SET "context_id" = (SELECT id FROM "contexts" WHERE slug = 'gov');
    UPDATE "_pages_v" SET "version_context_id" = (SELECT id FROM "contexts" WHERE slug = 'gov');

    -- Articles: section becomes the context; the category becomes a type where
    -- one fits (Decrees, Opinion) and the design's default otherwise.
    UPDATE "articles" a SET
      "context_id" = (SELECT id FROM "contexts" WHERE slug = CASE a.section WHEN 'times' THEN 'times' ELSE 'gov' END),
      "design" = (CASE a.section WHEN 'times' THEN 'times' ELSE 'gazette' END)::"enum_articles_design",
      "type" = (CASE
        WHEN cat.slug = 'decrees' AND a.section <> 'times' THEN 'decree'
        WHEN cat.slug = 'opinion' AND a.section = 'times' THEN 'opinion'
        WHEN a.section = 'times' THEN 'news'
        ELSE 'dispatch' END)::"enum_articles_type"
    FROM (SELECT a2.id, c2.slug FROM "articles" a2 LEFT JOIN "categories" c2 ON c2.id = a2.category_id) cat
    WHERE cat.id = a.id;
    UPDATE "_articles_v" v SET
      "version_context_id" = (SELECT id FROM "contexts" WHERE slug = CASE v.version_section WHEN 'times' THEN 'times' ELSE 'gov' END),
      "version_design" = (CASE v.version_section WHEN 'times' THEN 'times' ELSE 'gazette' END)::"enum__articles_v_version_design",
      "version_type" = (CASE
        WHEN cat.slug = 'decrees' AND v.version_section <> 'times' THEN 'decree'
        WHEN cat.slug = 'opinion' AND v.version_section = 'times' THEN 'opinion'
        WHEN v.version_section = 'times' THEN 'news'
        ELSE 'dispatch' END)::"enum__articles_v_version_type"
    FROM (SELECT v2.id, c2.slug FROM "_articles_v" v2 LEFT JOIN "categories" c2 ON c2.id = v2.version_category_id) cat
    WHERE cat.id = v.id;
  `)

  // 3. Retire sections, categories and publications.
  await db.execute(sql`
    ALTER TABLE "articles" DROP CONSTRAINT "articles_category_id_categories_id_fk";
    ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_category_id_categories_id_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_categories_fk";
    DROP INDEX "articles_category_idx";
    DROP INDEX "_articles_v_version_version_category_idx";
    DROP INDEX "payload_locked_documents_rels_categories_id_idx";
    ALTER TABLE "categories" DISABLE ROW LEVEL SECURITY;
    DROP TABLE "categories" CASCADE;
    ALTER TABLE "articles" DROP COLUMN "section";
    ALTER TABLE "articles" DROP COLUMN "category_id";
    ALTER TABLE "_articles_v" DROP COLUMN "version_section";
    ALTER TABLE "_articles_v" DROP COLUMN "version_category_id";
    ALTER TABLE "profiles" DROP COLUMN "publication";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "categories_id";
    DROP TYPE "public"."enum_articles_section";
    DROP TYPE "public"."enum__articles_v_version_section";
    DROP TYPE "public"."enum_profiles_publication";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_section" AS ENUM('government', 'times');
  CREATE TYPE "public"."enum__articles_v_version_section" AS ENUM('government', 'times');
  CREATE TYPE "public"."enum_profiles_publication" AS ENUM('government', 'times', 'both');
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "contexts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "profiles_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_context_access" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "contexts" CASCADE;
  DROP TABLE "profiles_rels" CASCADE;
  DROP TABLE "users_context_access" CASCADE;
  ALTER TABLE "articles" DROP CONSTRAINT "articles_context_id_contexts_id_fk";
  
  ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_context_id_contexts_id_fk";
  
  ALTER TABLE "pages" DROP CONSTRAINT "pages_context_id_contexts_id_fk";
  
  ALTER TABLE "_pages_v" DROP CONSTRAINT "_pages_v_version_context_id_contexts_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contexts_fk";
  
  DROP INDEX "articles_context_idx";
  DROP INDEX "_articles_v_version_version_context_idx";
  DROP INDEX "pages_context_idx";
  DROP INDEX "_pages_v_version_version_context_idx";
  DROP INDEX "payload_locked_documents_rels_contexts_id_idx";
  DROP INDEX "pages_slug_idx";
  ALTER TABLE "articles" ADD COLUMN "section" "enum_articles_section" DEFAULT 'government';
  ALTER TABLE "articles" ADD COLUMN "category_id" integer;
  ALTER TABLE "_articles_v" ADD COLUMN "version_section" "enum__articles_v_version_section" DEFAULT 'government';
  ALTER TABLE "_articles_v" ADD COLUMN "version_category_id" integer;
  ALTER TABLE "profiles" ADD COLUMN "publication" "enum_profiles_publication" DEFAULT 'both' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "categories_id" integer;
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category_id");
  CREATE INDEX "_articles_v_version_version_category_idx" ON "_articles_v" USING btree ("version_category_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  ALTER TABLE "articles" DROP COLUMN "context_id";
  ALTER TABLE "articles" DROP COLUMN "type";
  ALTER TABLE "articles" DROP COLUMN "design";
  ALTER TABLE "_articles_v" DROP COLUMN "version_context_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_type";
  ALTER TABLE "_articles_v" DROP COLUMN "version_design";
  ALTER TABLE "pages" DROP COLUMN "context_id";
  ALTER TABLE "_pages_v" DROP COLUMN "version_context_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contexts_id";
  DROP TYPE "public"."enum_articles_type";
  DROP TYPE "public"."enum_articles_design";
  DROP TYPE "public"."enum__articles_v_version_type";
  DROP TYPE "public"."enum__articles_v_version_design";
  DROP TYPE "public"."enum_contexts_design";
  DROP TYPE "public"."enum_contexts_accent";
  DROP TYPE "public"."enum_users_context_access_level";`)
}
