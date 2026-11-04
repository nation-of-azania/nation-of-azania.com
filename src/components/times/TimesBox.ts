/**
 * The Times' box, for a style that switches it on (src/components/styles/slots.ts
 * → DESIGN_BOXES): a post set in a rounded, bordered panel — on its own page
 * around its header and body, in a listing the whole card. Its ground and
 * edge are the style's `--box-ground` and `--box-edge`. The edge is painted
 * as a background layer under a transparent border rather than as the
 * border's colour, so a style may give it a colour (Cherry Blossom's petal
 * pink) or an image (Airmail's chevrons) and the corners stay round either
 * way; the ground is clipped to the padding box so it never shows through.
 * Each place adds its own radius and padding.
 */
export const TIMES_BOX =
  'border-2 border-transparent [background:linear-gradient(var(--box-ground),var(--box-ground))_padding-box,var(--box-edge)_border-box]'
