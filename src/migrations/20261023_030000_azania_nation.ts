import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Content fix: the Towny nation Azania's towns sat in, "Canada", is now
 * called "Azania" in game, and the settings still named the old one, so the
 * map stopped counting every town but those listed by name. The settings
 * now name "Azania" (src/globals/AzaniaMaps.ts); the next reading of the
 * map counts its towns again. From here on the sync follows a rename by
 * itself (src/lib/towns.ts → followRenames).
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "azania_maps_nations" SET "name" = 'Azania' WHERE lower("name") = 'canada';
  `)
  // A database whose settings never named the old nation gets the new one all the same.
  await db.execute(sql`
    INSERT INTO "azania_maps_nations" ("_order", "_parent_id", "id", "name")
    SELECT COALESCE((SELECT MAX("_order") FROM "azania_maps_nations"), 0) + 1, m."id", md5('azania-maps-nation-azania'), 'Azania'
    FROM "azania_maps" m
    WHERE NOT EXISTS (SELECT 1 FROM "azania_maps_nations" WHERE lower("name") = 'azania')
    LIMIT 1;
  `)
  payload.logger.info('Azania Maps: counting the Towny nation "Azania" (formerly "Canada")')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "azania_maps_nations" SET "name" = 'Canada' WHERE "name" = 'Azania';
  `)
}
