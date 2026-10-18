import type { Metadata } from 'next'
import {
  Alegreya,
  Archivo,
  Fredoka,
  IBM_Plex_Mono,
  IBM_Plex_Serif,
  Marcellus,
  Source_Sans_3,
} from 'next/font/google'
import type { ReactNode } from 'react'

import { slotVars } from '@/components/styles/slots'

import './globals.css'

// Headings and article titles: a warm, calligraphic serif with a ledger-book
// feel — the voice of a trading coast's gazette.
const alegreya = Alegreya({
  subsets: ['latin'],
  variable: '--font-alegreya',
  display: 'swap',
})

// The wordmark: inscriptional Roman capitals, as cut on the lighthouse plinth.
const marcellus = Marcellus({
  subsets: ['latin'],
  variable: '--font-marcellus',
  display: 'swap',
  weight: '400',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
})

// The Azanian Times' voice: a strong grotesque for mastheads and headlines.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

// International's voice: a rational serif for record titles and its mono
// sibling for document numbers — the typography of a standards body, not of
// Azania. Not preloaded: the Gazette and the Times never set a glyph in them.
const plexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  variable: '--font-plex-serif',
  display: 'swap',
  weight: ['400', '500', '600'],
  preload: false,
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  display: 'swap',
  weight: ['400', '500'],
  preload: false,
})

// Cherry Blossom's voice (src/components/styles/blossom): a plump, rounded
// sans for GirlieTown's headlines and labels. Medium, SemiBold and Bold
// only, so a design's regular-weight headline (the Gazette's) falls to
// Medium, where Fredoka is bubbly rather than thin, and its black to Bold.
// Not preloaded: a plain page never sets a glyph in it.
const fredoka = Fredoka({
  subsets: ['latin'],
  variable: '--font-fredoka',
  display: 'swap',
  weight: ['500', '600', '700'],
  preload: false,
})

const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Azania',
    template: '%s · Azania',
  },
  description:
    'The Nation of Azania on the Rulercraft realm — the Azania Gazette, official record of the Chancellery, and the independent Azanian Times.',
  icons: { icon: '/favicon.ico' },
  openGraph: { siteName: 'Azania', type: 'website' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${alegreya.variable} ${marcellus.variable} ${sourceSans.variable} ${archivo.variable} ${plexSerif.variable} ${plexMono.variable} ${fredoka.variable}`}
    >
      {/* The site's base dress is the Gazette's (sign-in, the account): its slots sit on the body, and each design's shell sets its own. */}
      <body className="font-body antialiased" style={slotVars('gazette')}>
        {children}
      </body>
    </html>
  )
}
