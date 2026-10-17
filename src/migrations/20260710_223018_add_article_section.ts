import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_section" AS ENUM('government', 'times');
  CREATE TYPE "public"."enum__articles_v_version_section" AS ENUM('government', 'times');
  ALTER TABLE "articles" ADD COLUMN "section" "enum_articles_section" DEFAULT 'government';
  ALTER TABLE "_articles_v" ADD COLUMN "version_section" "enum__articles_v_version_section" DEFAULT 'government';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP COLUMN "section";
  ALTER TABLE "_articles_v" DROP COLUMN "version_section";
  DROP TYPE "public"."enum_articles_section";
  DROP TYPE "public"."enum__articles_v_version_section";`)
}
