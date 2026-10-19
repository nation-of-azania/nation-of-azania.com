import type { TextField } from 'payload'

/** Java Edition usernames: 3–16 letters, digits or underscores. A leading "." marks a Bedrock player. */
export const MINECRAFT_NAME = /^\.?\w{3,16}$/

/**
 * A Minecraft username. Optional; when set, the player's head is used as the
 * avatar on bylines (see `minecraftHeadUrl` in src/components/site/format.ts).
 */
export const minecraftNameField = (description: string): TextField => ({
  name: 'minecraftName',
  type: 'text',
  label: 'Minecraft name',
  admin: { description },
  validate: (value: null | string | undefined) =>
    !value ||
    MINECRAFT_NAME.test(value.trim()) ||
    'Enter a Minecraft username: 3–16 letters, digits or underscores.',
  hooks: {
    beforeValidate: [
      ({ value }) => (typeof value === 'string' ? value.trim() || undefined : value),
    ],
  },
})
