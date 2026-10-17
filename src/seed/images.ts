import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

/**
 * Generates the two seed banner images (1600×900 PNG) at seed time by
 * rasterizing hand-written SVG with sharp. Palette matches the site tokens:
 * parchment ground, pine silhouettes, antique-gold accents.
 */

const PARCHMENT = '#f4eee0'
const PARCHMENT_DEEP = '#e7ddc6'
const PINE = '#1d3625'
const PINE_LIGHT = '#33513e'
const PINE_FAINT = '#4a6a54'
const GOLD = '#c9a84c'
const GOLD_DEEP = '#a8843a'
const GORGE = '#142219'

const W = 1600
const H = 900

/** Hairline double rules top and bottom — the gazette signature. Drawn last. */
const rules = `
  <g stroke="${GOLD_DEEP}" stroke-width="2" opacity="0.85">
    <line x1="70" y1="46" x2="1530" y2="46" />
    <line x1="70" y1="56" x2="1530" y2="56" stroke-width="1" />
    <line x1="70" y1="844" x2="1530" y2="844" stroke-width="1" />
    <line x1="70" y1="854" x2="1530" y2="854" />
  </g>`

/**
 * Banner 1 — "Founding Day": a gold sun disc rising over pine mountain
 * silhouettes, with a minimal CONDORIA wordmark. (The design stands on the
 * shapes alone, so nothing is lost if SVG text rendering is unavailable.)
 */
const foundingDaySvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${PARCHMENT}" />
  <text x="800" y="150" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="58" letter-spacing="26" fill="${PINE}">CONDORIA</text>
  <!-- sun disc with concentric ring and rays -->
  <g>
    <circle cx="800" cy="430" r="196" fill="none" stroke="${GOLD_DEEP}" stroke-width="3" opacity="0.7" />
    <circle cx="800" cy="430" r="148" fill="${GOLD}" />
    <circle cx="800" cy="430" r="118" fill="none" stroke="${PARCHMENT}" stroke-width="3" opacity="0.55" />
    <g stroke="${GOLD_DEEP}" stroke-width="4" opacity="0.8">
      <line x1="800" y1="180" x2="800" y2="216" />
      <line x1="1010" y1="270" x2="984" y2="296" />
      <line x1="590" y1="270" x2="616" y2="296" />
      <line x1="1050" y1="430" x2="1014" y2="430" />
      <line x1="550" y1="430" x2="586" y2="430" />
    </g>
  </g>
  <!-- mountain ranges: faint behind, dark in front -->
  <polygon fill="${PINE_FAINT}" points="0,660 190,500 340,610 520,440 700,620 880,470 1060,610 1240,480 1420,600 1600,520 1600,900 0,900" />
  <polygon fill="${PINE_LIGHT}" points="0,720 240,560 430,690 640,520 830,700 1030,540 1230,690 1440,570 1600,660 1600,900 0,900" />
  <polygon fill="${PINE}" points="0,800 200,660 400,780 620,620 840,790 1080,650 1300,780 1480,690 1600,760 1600,900 0,900" />
  ${rules}
</svg>`

/**
 * Banner 2 — "The Great North Road": a continuous gold road band running
 * through pine hills, crossing a dark gorge on a stone viaduct, toward a
 * ringed sun over the pass.
 */
const northRoadSvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${PARCHMENT}" />
  <!-- sun over the pass -->
  <circle cx="1280" cy="240" r="118" fill="none" stroke="${GOLD_DEEP}" stroke-width="3" opacity="0.7" />
  <circle cx="1280" cy="240" r="84" fill="${GOLD}" />
  <!-- far range -->
  <path fill="${PINE_FAINT}" d="M-20,520 C260,470 520,515 800,472 C1080,430 1300,472 1620,418 L1620,900 L-20,900 Z" />
  <!-- mid hills carrying the road, cut by the gorge -->
  <path fill="${PINE_LIGHT}" d="M-20,612 C200,584 440,608 618,572 L618,900 L-20,900 Z" />
  <path fill="${PINE_LIGHT}" d="M982,572 C1180,538 1340,498 1620,452 L1620,900 L982,900 Z" />
  <!-- the gorge: deep shadow under the crossing -->
  <rect x="618" y="572" width="364" height="328" fill="${GORGE}" />
  <g stroke="${PARCHMENT_DEEP}" stroke-width="3" opacity="0.5" fill="none">
    <path d="M618,872 C700,864 760,878 830,872 C900,866 940,878 982,872" />
  </g>
  <!-- viaduct: stone wall, three arches, gold deck -->
  <rect x="618" y="584" width="364" height="272" fill="${PARCHMENT_DEEP}" />
  <path fill="${GORGE}" d="M646,824 L646,742 A42,42 0 0 1 730,742 L730,824 Z" />
  <path fill="${GORGE}" d="M758,824 L758,742 A42,42 0 0 1 842,742 L842,824 Z" />
  <path fill="${GORGE}" d="M870,824 L870,742 A42,42 0 0 1 954,742 L954,824 Z" />
  <rect x="606" y="558" width="388" height="26" fill="${GOLD_DEEP}" />
  <!-- the road: one continuous gold band from the vale to the pass -->
  <path d="M-20,612 C200,584 440,606 616,571 L984,571 C1180,537 1340,497 1620,451"
        fill="none" stroke="${GOLD}" stroke-width="22" />
  <!-- waymark posts -->
  <g>
    <rect x="398" y="540" width="12" height="58" fill="${PINE}" />
    <rect x="393" y="528" width="22" height="13" fill="${GOLD_DEEP}" />
    <rect x="1150" y="468" width="12" height="58" fill="${PINE}" />
    <rect x="1145" y="456" width="22" height="13" fill="${GOLD_DEEP}" />
  </g>
  <!-- small pines on the right ridge -->
  <g fill="${PINE}">
    <polygon points="1330,470 1352,470 1341,428" />
    <polygon points="1368,462 1388,462 1378,424" />
    <polygon points="1236,492 1256,492 1246,452" />
  </g>
  <!-- foreground banks -->
  <path fill="${PINE}" d="M-20,900 L-20,772 C160,756 340,796 500,824 C560,834 610,848 640,858 L640,900 Z" />
  <path fill="${PINE}" d="M1620,900 L1620,700 C1480,720 1330,756 1160,800 C1080,820 1010,842 962,856 L962,900 Z" />
  ${rules}
</svg>`

export interface SeedBanner {
  /** Absolute path of the generated PNG. */
  filePath: string
  /** Alt text for the media document. */
  alt: string
}

export interface SeedBanners {
  foundingDay: SeedBanner
  northRoad: SeedBanner
}

/**
 * Rasterize both banners into `assetsDir` (created if missing) and return
 * their paths + alt text. Overwrites any previous run's files.
 */
export async function generateBannerImages(assetsDir: string): Promise<SeedBanners> {
  await mkdir(assetsDir, { recursive: true })

  const render = async (svg: string, filename: string): Promise<string> => {
    const filePath = path.join(assetsDir, filename)
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    await writeFile(filePath, png)
    return filePath
  }

  const [foundingDayPath, northRoadPath] = await Promise.all([
    render(foundingDaySvg, 'founding-day-banner.png'),
    render(northRoadSvg, 'north-road-banner.png'),
  ])

  return {
    foundingDay: {
      filePath: foundingDayPath,
      alt: 'Gold sun disc rising over pine mountain silhouettes on a parchment ground — the Founding Day banner of Condoria',
    },
    northRoad: {
      filePath: northRoadPath,
      alt: 'A gold road crossing an arched stone bridge through pine hills — banner for the Great North Road',
    },
  }
}
