import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

/**
 * Generates the two seed banner images (1600×900 PNG) at seed time by
 * rasterizing hand-written SVG with sharp. Palette matches the site tokens:
 * sand and whitewash grounds, deep-sea indigo water, saffron sun, coral
 * pennants.
 */

const SKY_TOP = '#f8f3e8'
const SKY_GLOW = '#f2d59a' // saffron-200
const WHITEWASH = '#fbf8f1' // sand-50
const SAND = '#f5efe2' // sand-100
const CORAL_STONE = '#e6d8b6'
const CORAL_STONE_SHADE = '#c2ae86'
const SUN = '#d8962c' // saffron-400
const SUN_LIGHT = '#e8b65c' // saffron-300
const SUN_DEEP = '#96600f' // saffron-600
const SEA_LIGHT = '#2c6b93' // sea-500
const SEA_DEEP = '#0f2638' // sea-900
const ROCK = '#0a1b2a' // sea-950
const CORAL = '#bb4631' // coral-600

const W = 1600
const H = 900

/** Hairline double rules top and bottom — the gazette signature. Drawn last. */
const rules = `
  <g stroke="${SUN_DEEP}" stroke-width="2" opacity="0.85">
    <line x1="70" y1="46" x2="1530" y2="46" />
    <line x1="70" y1="56" x2="1530" y2="56" stroke-width="1" />
    <line x1="70" y1="844" x2="1530" y2="844" stroke-width="1" />
    <line x1="70" y1="854" x2="1530" y2="854" />
  </g>`

/** A gentle swell: one wave line across the picture at height `y`. */
function wave(y: number, amplitude = 6, period = 160, x0 = -40, x1 = W + 40): string {
  const parts: string[] = [`M${x0},${y}`]
  for (let x = x0; x < x1; x += period) {
    const q = period / 4
    parts.push(
      `C${x + q},${y - amplitude} ${x + q},${y - amplitude} ${x + period / 2},${y}`,
      `C${x + 3 * q},${y + amplitude} ${x + 3 * q},${y + amplitude} ${x + period},${y}`,
    )
  }
  return parts.join(' ')
}

/**
 * A lateen-rigged dhow, bow to the left, drawn around (0,0) at the waterline
 * and scaled by `s`: dark hull, raked mast, one whitewashed sail and a coral
 * pennant at the peak.
 */
function dhow(x: number, y: number, s: number): string {
  return `
  <g transform="translate(${x},${y}) scale(${s})">
    <polygon fill="${ROCK}" points="-72,0 74,0 56,30 -50,30" />
    <line x1="-10" y1="0" x2="4" y2="-118" stroke="${ROCK}" stroke-width="6" stroke-linecap="round" />
    <polygon fill="${WHITEWASH}" stroke="${CORAL_STONE_SHADE}" stroke-width="2" stroke-linejoin="round"
             points="-60,-8 70,-136 44,-8" />
    <line x1="-60" y1="-8" x2="70" y2="-136" stroke="${ROCK}" stroke-width="4" stroke-linecap="round" />
    <polygon fill="${CORAL}" points="70,-136 70,-154 96,-146" />
  </g>`
}

/**
 * Banner 1 — "Founding Day": dawn over the sea. A saffron sun lifts off the
 * horizon, the lighthouse on Founders' Point throws its beam across the
 * roads, and a lone dhow stands off on the far side, under a minimal AZANIA
 * wordmark. (The design stands on the shapes alone, so nothing is lost if
 * SVG text rendering is unavailable.)
 */
const HORIZON = 520

const foundingDaySvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SKY_TOP}" />
      <stop offset="0.55" stop-color="${SAND}" />
      <stop offset="1" stop-color="${SKY_GLOW}" />
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SEA_LIGHT}" />
      <stop offset="1" stop-color="${SEA_DEEP}" />
    </linearGradient>
    <clipPath id="above-horizon"><rect x="0" y="0" width="${W}" height="${HORIZON}" /></clipPath>
  </defs>
  <rect width="${W}" height="${HORIZON}" fill="url(#sky)" />
  <text x="800" y="150" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="58" letter-spacing="26" fill="${SEA_DEEP}">AZANIA</text>
  <!-- the rising sun: rays, outer ring, disc, inner ring — all cut at the horizon -->
  <g clip-path="url(#above-horizon)">
    <g stroke="${SUN_DEEP}" stroke-width="4" stroke-linecap="round" opacity="0.7">
      <line x1="800" y1="238" x2="800" y2="272" />
      <line x1="660" y1="276" x2="684" y2="300" />
      <line x1="940" y1="276" x2="916" y2="300" />
      <line x1="562" y1="380" x2="594" y2="392" />
      <line x1="1038" y1="380" x2="1006" y2="392" />
      <line x1="530" y1="500" x2="564" y2="500" />
      <line x1="1070" y1="500" x2="1036" y2="500" />
    </g>
    <circle cx="800" cy="${HORIZON}" r="226" fill="none" stroke="${SUN_DEEP}" stroke-width="3" opacity="0.55" />
    <circle cx="800" cy="${HORIZON}" r="172" fill="${SUN}" />
    <circle cx="800" cy="${HORIZON}" r="138" fill="none" stroke="${SKY_TOP}" stroke-width="3" opacity="0.5" />
  </g>
  <!-- the sea -->
  <rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#sea)" />
  <!-- sun glitter on the water -->
  <g fill="${SUN_LIGHT}" opacity="0.8">
    <rect x="770" y="532" width="60" height="5" />
    <rect x="752" y="548" width="96" height="5" />
    <rect x="778" y="566" width="44" height="6" />
    <rect x="744" y="588" width="112" height="6" />
    <rect x="786" y="612" width="28" height="7" />
    <rect x="760" y="640" width="80" height="7" />
    <rect x="730" y="676" width="140" height="8" />
    <rect x="792" y="716" width="16" height="8" />
    <rect x="748" y="760" width="104" height="9" />
  </g>
  <!-- swell -->
  <g stroke="${WHITEWASH}" stroke-width="2" fill="none" opacity="0.32">
    <path d="${wave(590, 4, 140)}" />
    <path d="${wave(650, 5, 170)}" />
    <path d="${wave(720, 6, 200)}" />
    <path d="${wave(800, 7, 240)}" />
  </g>
  <!-- a dhow standing off, far side of the roads -->
  ${dhow(360, HORIZON + 6, 0.42)}
  <!-- Founders' Point: the headland -->
  <path fill="${ROCK}" d="M1070,${HORIZON} C1120,500 1170,462 1240,446 C1310,430 1400,426 1470,432 C1530,437 1570,452 1620,462 L1620,596 C1540,584 1460,590 1380,588 C1280,586 1180,580 1070,566 Z" />
  <path fill="${SEA_DEEP}" opacity="0.5" d="M1070,566 C1180,580 1280,586 1380,588 C1460,590 1540,584 1620,596 L1620,620 C1540,606 1460,612 1380,610 C1280,608 1180,602 1070,590 Z" />
  <!-- the lighthouse: beam, tower, bands, gallery, lantern, roof -->
  <polygon fill="${SUN_LIGHT}" opacity="0.2" points="1346,268 980,190 980,330" />
  <polygon fill="${SUN_LIGHT}" opacity="0.12" points="1374,268 1620,210 1620,330" />
  <polygon fill="${WHITEWASH}" points="1330,446 1390,446 1378,296 1342,296" />
  <polygon fill="${CORAL_STONE}" points="1378,446 1390,446 1378,296 1370,296" />
  <polygon fill="${SUN}" points="1338,350 1382,350 1383,364 1337,364" />
  <polygon fill="${SUN}" points="1335,394 1385,394 1386,408 1334,408" />
  <rect x="1332" y="288" width="56" height="8" fill="${ROCK}" />
  <rect x="1346" y="262" width="28" height="26" fill="${SUN_LIGHT}" />
  <rect x="1344" y="260" width="32" height="30" fill="none" stroke="${ROCK}" stroke-width="3" />
  <polygon fill="${ROCK}" points="1340,260 1380,260 1360,234" />
  <circle cx="1360" cy="230" r="4" fill="${SUN}" />
  ${rules}
</svg>`

/**
 * Banner 2 — "The Harbour Mole": the newly completed breakwater sweeping out
 * from the whitewashed waterfront of Port Azania to a beacon at its tip,
 * with dhows riding in the roads beyond and Founders' Point on the horizon.
 */
const SHORE = 400

const buildings = [
  { x: 0, y: 332, w: 92, h: 60 },
  { x: 92, y: 310, w: 70, h: 82 },
  { x: 162, y: 340, w: 108, h: 52 },
  { x: 270, y: 292, w: 82, h: 100 },
  { x: 352, y: 326, w: 92, h: 66 },
  { x: 444, y: 346, w: 100, h: 46 },
]

/**
 * Whitewashed houses on the sea wall: a shaded east face, rows of small
 * shuttered windows, and a doorway under a saffron or coral awning at the
 * quay — a market street seen from the water.
 */
const waterfront = buildings
  .map((b, i) => {
    const rows = b.h > 80 ? [14, 44] : [14]
    const windows = rows
      .flatMap((dy) => {
        const count = Math.max(2, Math.floor((b.w - 16) / 30))
        const gap = (b.w - 8 - 8 * count) / (count + 1)
        return Array.from({ length: count }, (_, k) => {
          const wx = b.x + gap + k * (8 + gap)
          return `<rect x="${wx.toFixed(1)}" y="${b.y + dy}" width="8" height="12" fill="${ROCK}" />`
        })
      })
      .join('')
    const doorX = b.x + (b.w - 8) / 2 - 7
    const awning = i % 2 === 0 ? SUN : CORAL
    return `
    <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${WHITEWASH}" />
    <rect x="${b.x + b.w - 8}" y="${b.y}" width="8" height="${b.h}" fill="${CORAL_STONE}" />
    ${windows}
    <rect x="${doorX}" y="${b.y + b.h - 22}" width="14" height="22" fill="${ROCK}" />
    <rect x="${doorX - 7}" y="${b.y + b.h - 27}" width="28" height="5" fill="${awning}" />`
  })
  .join('')

const harbourSvg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SKY_TOP}" />
      <stop offset="1" stop-color="${SAND}" />
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SEA_LIGHT}" />
      <stop offset="1" stop-color="${SEA_DEEP}" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${SHORE}" fill="url(#sky)" />
  <!-- a pale morning sun -->
  <circle cx="1380" cy="150" r="96" fill="none" stroke="${SUN_DEEP}" stroke-width="3" opacity="0.3" />
  <circle cx="1380" cy="150" r="68" fill="${SKY_GLOW}" />
  <!-- Founders' Point, far off on the horizon -->
  <polygon fill="${ROCK}" points="1420,${SHORE} 1490,372 1560,366 1600,374 1600,${SHORE}" />
  <rect x="1521" y="338" width="12" height="30" fill="${WHITEWASH}" />
  <rect x="1519" y="332" width="16" height="6" fill="${SUN}" />
  <!-- the sea -->
  <rect x="0" y="${SHORE}" width="${W}" height="${H - SHORE}" fill="url(#sea)" />
  <g stroke="${WHITEWASH}" stroke-width="2" fill="none" opacity="0.3">
    <path d="${wave(470, 4, 140, 620)}" />
    <path d="${wave(560, 5, 170, 760)}" />
    <path d="${wave(680, 6, 200, 900)}" />
    <path d="${wave(820, 7, 240, 1040)}" />
  </g>
  <!-- the waterfront of Port Azania: whitewashed houses on the sea wall -->
  ${waterfront}
  <rect x="270" y="286" width="82" height="8" fill="${CORAL_STONE}" />
  <rect x="0" y="392" width="560" height="28" fill="${CORAL_STONE}" />
  <rect x="0" y="420" width="560" height="10" fill="${CORAL_STONE_SHADE}" />
  <!-- a dhow moored inside, sail furled along the yard -->
  <g>
    <polygon fill="${ROCK}" points="382,486 470,486 458,504 394,504" />
    <line x1="420" y1="486" x2="428" y2="420" stroke="${ROCK}" stroke-width="4" stroke-linecap="round" />
    <line x1="398" y1="446" x2="466" y2="418" stroke="${WHITEWASH}" stroke-width="9" stroke-linecap="round" />
    <line x1="394" y1="448" x2="470" y2="416" stroke="${ROCK}" stroke-width="3" stroke-linecap="round" />
  </g>
  <!-- the mole: shadowed face, then the paved top, then the joints -->
  <path d="M-40,920 C200,774 420,652 700,612 C860,590 980,588 1060,578" fill="none" stroke="${CORAL_STONE_SHADE}" stroke-width="58" stroke-linecap="round" />
  <path d="M-40,900 C200,754 420,632 700,592 C860,570 980,568 1060,558" fill="none" stroke="${CORAL_STONE}" stroke-width="46" stroke-linecap="round" />
  <path d="M-40,900 C200,754 420,632 700,592 C860,570 980,568 1060,558" fill="none" stroke="${CORAL_STONE_SHADE}" stroke-width="2" stroke-dasharray="26 20" opacity="0.7" />
  <!-- the beacon at the tip -->
  <rect x="1044" y="488" width="32" height="70" fill="${WHITEWASH}" />
  <rect x="1068" y="488" width="8" height="70" fill="${CORAL_STONE}" />
  <rect x="1040" y="478" width="40" height="12" fill="${ROCK}" />
  <circle cx="1060" cy="470" r="10" fill="${SUN}" />
  <polygon fill="${CORAL}" points="1060,462 1060,440 1092,451" />
  <!-- ships in the roads -->
  ${dhow(1190, 448, 0.36)}
  ${dhow(1430, 534, 0.62)}
  ${dhow(1270, 640, 0.95)}
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
  harbour: SeedBanner
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

  const [foundingDayPath, harbourPath] = await Promise.all([
    render(foundingDaySvg, 'founding-day-banner.png'),
    render(harbourSvg, 'harbour-mole-banner.png'),
  ])

  return {
    foundingDay: {
      filePath: foundingDayPath,
      alt: 'Dawn over the sea at Founders’ Point: a saffron sun rising from the horizon beside the whitewashed lighthouse on its headland, its beam across the water and a lone dhow standing off, under the AZANIA wordmark — the Founding Day banner',
    },
    harbour: {
      filePath: harbourPath,
      alt: 'The new harbour mole at Port Azania: a curved coral-stone breakwater sweeping out from the whitewashed waterfront to a beacon at its tip, with three lateen-sailed dhows riding in the roads beyond and Founders’ Point on the horizon',
    },
  }
}
