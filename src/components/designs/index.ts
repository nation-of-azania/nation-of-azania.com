import type { Design } from '@/contexts/designs'

import { gazette } from './gazette'
import { international } from './international'
import { times } from './times'
import type { DesignViews } from './types'

/** Each design's views, by name (see src/contexts/designs.ts). */
export const DESIGN_VIEWS: Record<Design, DesignViews> = { gazette, times, international }
