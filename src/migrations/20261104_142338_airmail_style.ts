import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_articles_style" ADD VALUE 'airmail';
  ALTER TYPE "public"."enum__articles_v_version_style" ADD VALUE 'airmail';
  ALTER TYPE "public"."enum_contexts_style" ADD VALUE 'airmail';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" ALTER COLUMN "style" SET DATA TYPE text;
  DROP TYPE "public"."enum_articles_style";
  CREATE TYPE "public"."enum_articles_style" AS ENUM('plain', 'blossom');
  ALTER TABLE "articles" ALTER COLUMN "style" SET DATA TYPE "public"."enum_articles_style" USING "style"::"public"."enum_articles_style";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_style" SET DATA TYPE text;
  DROP TYPE "public"."enum__articles_v_version_style";
  CREATE TYPE "public"."enum__articles_v_version_style" AS ENUM('plain', 'blossom');
  ALTER TABLE "_articles_v" ALTER COLUMN "version_style" SET DATA TYPE "public"."enum__articles_v_version_style" USING "version_style"::"public"."enum__articles_v_version_style";
  ALTER TABLE "contexts" ALTER COLUMN "style" SET DATA TYPE text;
  DROP TYPE "public"."enum_contexts_style";
  CREATE TYPE "public"."enum_contexts_style" AS ENUM('plain', 'blossom');
  ALTER TABLE "contexts" ALTER COLUMN "style" SET DATA TYPE "public"."enum_contexts_style" USING "style"::"public"."enum_contexts_style";`)
}
