import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { LoginForm } from '@/components/members/LoginForm'
import { safeNextPath } from '@/components/members/safeNext'
import { Crest } from '@/components/site/Crest'
import { FlagTick } from '@/components/site/FlagTick'
import { DoubleRule } from '@/components/site/SectionHeading'

export const metadata: Metadata = { title: 'Residents’ Entrance' }
// Reads the session cookie, so it must never be statically cached.
export const dynamic = 'force-dynamic'

/** Only a path on this site is followed after sign-in (no open redirects); the form applies the same rule. */
const safeNext = (value: string | string[] | undefined): string =>
  safeNextPath(Array.isArray(value) ? value[0] : value)

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const payload = await getPayload({ config })
  const { user } = await payload
    .auth({ headers: await nextHeaders() })
    .catch(() => ({ user: null }))
  // Already signed in: straight on to where they were going, e.g. back to /maps.
  if (user) redirect(safeNext((await searchParams).next))

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-sand-50 px-6 py-16 text-ink-900">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Crest className="h-14 w-auto text-sea-900" />
          <p className="mt-6 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.24em] text-saffron-600">
            <FlagTick />
            The Nation of Azania
          </p>
          <h1 className="mt-4 font-display text-3xl text-sea-950 md:text-4xl">Residents’ Entrance</h1>
          <DoubleRule className="mt-5 w-20" />
          <p className="mt-5 text-sm leading-relaxed text-ink-500">
            Sign in with the resident credentials issued to you by the Registry.
          </p>
        </div>

        <div className="mt-8 border border-sand-300 bg-sand-100/50 p-6 md:p-8">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-400">
          Forgotten your password? An administrator can reset it for you.
        </p>
        <p className="mt-4 text-center">
          <Link href="/" className="text-xs uppercase tracking-[0.18em] text-sea-700 hover:text-sea-900">
            ← Return to Azania
          </Link>
        </p>
      </div>
    </main>
  )
}
