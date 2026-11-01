import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Battles: the version of the battle analysis their fighters were worked out
 * by (src/lib/battleTracker.ts → ANALYSIS), so those an older one worked out
 * are worked out again from their readings. Empty for the battles saved so
 * far, which are all worked out again.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "battles" ADD COLUMN "analysis" numeric;
  CREATE INDEX "battles_analysis_idx" ON "battles" USING btree ("analysis");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "battles_analysis_idx";
  ALTER TABLE "battles" DROP COLUMN "analysis";`)
}
