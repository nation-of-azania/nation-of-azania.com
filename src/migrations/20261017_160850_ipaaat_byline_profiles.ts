import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * One-time data fix for production. The first-deploy bootstrap named the admin
 * account "Co-Leader of Azania", a role rather than a name, before roles moved
 * to byline profiles. This gives IPaaat their name, Minecraft name and the two
 * profiles they asked for. Guarded on the bootstrap's default name and on the
 * account having no profiles yet, so it never overwrites anything set by hand
 * and does nothing on any other database.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "profiles" ("name", "title", "publication", "minecraft_name", "owner_id", "active", "label")
    SELECT 'IPaaat', v.title, v.publication::"enum_profiles_publication", 'IPaaat', u.id, true,
           'IPaaat · ' || v.title || ' (' || v.publication_label || ')'
    FROM "users" u,
         (VALUES ('Co-Leader', 'government', 'Gazette'), ('Editor-in-Chief', 'times', 'Times'))
           AS v(title, publication, publication_label)
    WHERE u.username = 'ipaaat'
      AND u.name = 'Co-Leader of Azania'
      AND NOT EXISTS (SELECT 1 FROM "profiles" p WHERE p.owner_id = u.id);

    UPDATE "users" SET "name" = 'IPaaat', "minecraft_name" = COALESCE("minecraft_name", 'IPaaat')
    WHERE "username" = 'ipaaat' AND "name" = 'Co-Leader of Azania';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Data only: the profiles go with the table when the previous migration is
  // rolled back, and the corrected display name is worth keeping.
}
