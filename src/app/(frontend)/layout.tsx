import type { Metadata } from 'next'
import { Archivo, Fraunces, Public_Sans } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz'],
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-public-sans',
  display: 'swap',
})

// The Condor Times' voice: a strong grotesque for mastheads and headlines.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Condoria',
    template: '%s · Condoria',
  },
  description:
    'The Nation of Condoria on the Rulercraft realm — the state Gazette and the independent Condor Times.',
  icons: { icon: '/favicon.ico' },
  openGraph: { siteName: 'Condoria', type: 'website' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${publicSans.variable} ${archivo.variable}`}
    >
      <body className="font-body antialiased">{children}</body>
    </html>
  )
}
