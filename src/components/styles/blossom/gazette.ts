import type { Variant } from '../types'
import { Blossom } from './Blossom'

/**
 * Cherry Blossom on the Gazette: a GirlieTown statement is still an
 * official record of Azania, so the letterhead, crest and seal of the
 * nation stay. Rose takes the saffron's places, the leaves' pink the
 * hairline's, cherry planks the sand's where a ground is tinted at all,
 * and the town's blossom stands where the seal would.
 */
export const blossomGazette: Variant<'gazette'> = {
  colours: {
    'accent-ink': 'var(--color-blossom-700)',
    accent: 'var(--color-blossom-400)',
    'accent-wash': 'var(--color-blossom-plank)',
    'seal-ink': 'var(--color-blossom-700)',
    seal: 'var(--color-blossom-400)',
  },
  Mark: Blossom,
}
