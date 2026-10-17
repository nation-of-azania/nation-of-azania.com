import type { Metadata } from 'next'
import { Alegreya, Archivo, Marcellus, Source_Sans_3 } from 'next/font/google'
import type { ReactNode } from 'react'

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
      className={`${alegreya.variable} ${marcellus.variable} ${sourceSans.variable} ${archivo.variable}`}
    >
      <body className="font-body antialiased">{children}</body>
    </html>
  )
}
