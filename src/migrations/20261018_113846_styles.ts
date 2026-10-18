import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_style" AS ENUM('plain', 'blossom');
  CREATE TYPE "public"."enum__articles_v_version_style" AS ENUM('plain', 'blossom');
  CREATE TYPE "public"."enum_contexts_style" AS ENUM('plain', 'blossom');
  ALTER TABLE "articles" ADD COLUMN "style" "enum_articles_style";
  ALTER TABLE "_articles_v" ADD COLUMN "version_style" "enum__articles_v_version_style";
  ALTER TABLE "contexts" ADD COLUMN "style" "enum_contexts_style";
  ALTER TABLE "contexts" DROP COLUMN "accent";
  DROP TYPE "public"."enum_contexts_accent";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contexts_accent" AS ENUM('sea', 'lagoon', 'saffron', 'coral', 'cinnabar', 'olive', 'violet', 'slate');
  ALTER TABLE "contexts" ADD COLUMN "accent" "enum_contexts_accent";
  ALTER TABLE "articles" DROP COLUMN "style";
  ALTER TABLE "_articles_v" DROP COLUMN "version_style";
  ALTER TABLE "contexts" DROP COLUMN "style";
  DROP TYPE "public"."enum_articles_style";
  DROP TYPE "public"."enum__articles_v_version_style";
  DROP TYPE "public"."enum_contexts_style";`)
}
