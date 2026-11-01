import type { CollectionConfig } from 'payload'

import { isAdmin } from '../../access'

/**
 * One row per siege per battle session, written by the battle tracker
 * (src/lib/battleTracker.ts) as it reads the map's live feed every few
 * seconds through the session: who came near the banner and what they did
 * there (src/maps/fights.ts). The readings themselves (`track`) are kept
 * a couple of months, for working the battle out again should a rule turn
 * out otherwise than assumed (the zones' sizes); what was made of them
 * (`fighters`, `result`) is kept for good, and is what the fighters' records
 * on the map are counted from.
 */
export const Battles: CollectionConfig = {
  slug: 'battles',
  labels: { singular: 'Battle', plural: 'Battles' },
  admin: {
    useAsTitle: 'title',
    group: 'Azania Maps',
    defaultColumns: ['title', 'startedAt', 'coverage', 'fought'],
    description: 'Recorded from the Rulercraft map during battle sessions, a reading every few seconds.',
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  defaultSort: '-startedAt',
  fields: [
    // The siege (its town's Towny id and its attacker) and the session's start: `townId|attacker|2026-10-31T18:00:00.000Z`.
    { name: 'key', type: 'text', required: true, unique: true, admin: { hidden: true } },
    { name: 'title', type: 'text', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'startedAt', type: 'date', required: true, index: true, admin: { readOnly: true, width: '33%', date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'town', type: 'text', admin: { readOnly: true, width: '33%' } },
        { name: 'townId', type: 'text', index: true, admin: { readOnly: true, width: '33%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'attacker', type: 'text', index: true, admin: { readOnly: true, width: '33%' } },
        { name: 'defender', type: 'text', index: true, admin: { readOnly: true, width: '33%' } },
        { name: 'session', type: 'number', admin: { readOnly: true, width: '33%', description: 'Sessions fought in the siege before this one.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'coverage', type: 'number', admin: { readOnly: true, width: '33%', description: 'How much of the hour the readings cover, 0–1.' } },
        { name: 'fought', type: 'number', admin: { readOnly: true, width: '33%', description: 'Players in the siege zone a minute or more.' } },
        { name: 'trackKeptUntil', type: 'date', admin: { readOnly: true, width: '33%' } },
      ],
    },
    // [x, z] of the banner.
    { name: 'banner', type: 'json', admin: { readOnly: true } },
    // The marker's last word: { banner, holders, attacker, defender } (src/maps/fights.ts → Mark).
    { name: 'result', type: 'json', admin: { readOnly: true } },
    // The sides' residents online during the battle: { attackers: string[], defenders: string[] }; who could have fought.
    { name: 'sides', type: 'json', admin: { readOnly: true } },
    // Fighter[] (src/maps/fights.ts): what each player near the banner did.
    { name: 'fighters', type: 'json', admin: { readOnly: true } },
    // Respawn[] (src/lib/battleTracker.ts): each death in the siege zone, and how long until the dead first teleported.
    { name: 'respawns', type: 'json', admin: { readOnly: true } },
    // The readings: { readings: packed times, marks: Mark[], players: { [name]: { side, moments: packed } } }.
    { name: 'track', type: 'json', admin: { readOnly: true, hidden: true } },
  ],
  timestamps: true,
}
