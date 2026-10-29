import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access'

/**
 * The last good reading of the rest of the world and of the war, kept so
 * Azania Maps carries on while the Rulercraft map is down
 * (src/lib/snapshot.ts): the watch saves it every quarter of an hour, and
 * the world, the war and the pages abroad fall back to it when the map
 * doesn't answer. Nobody edits it; it isn't in the admin panel.
 */
export const MapSnapshot: GlobalConfig = {
  slug: 'map-snapshot',
  label: 'Map snapshot',
  admin: { hidden: true },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    // The world as /maps/world.json sends it (src/maps/world.ts → PackedWorld).
    { name: 'world', type: 'json' },
    // The war as /maps/war sends it (src/maps/world.ts → War).
    { name: 'war', type: 'json' },
    { name: 'takenAt', type: 'date' },
  ],
}
