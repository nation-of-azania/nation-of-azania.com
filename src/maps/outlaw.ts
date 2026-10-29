/**
 * Towny's outlaw command, for one name, as a mayor types it in game: one
 * name a command, a Bedrock player's dot part of their name. Shared by the
 * outlaw lists on Azania Maps' panels (src/components/maps/panels/people.tsx)
 * and the sanction lists (src/blocks/components/Sanctions).
 */
export const outlawCommand = (name: string): string => `/t outlaw add ${name}`
