import Link from 'next/link'

import { Crest } from '@/components/site/Crest'

import { SignOutButton } from './SignOutButton'

/**
 * Chrome for the resident area — the national pine-and-ribbon header (matching
 * the Gazette's Nav), with the signed-in resident's name and a sign-out control.
 * Deliberately lighter than the Gazette Nav: this is a private desk, not a
 * publication, so it carries no section links.
 */
export function MemberHeader({ name }: { name: string }) {
  return (
    <header className="border-b border-gold-400/70 bg-pine-900 text-parchment-100">
      <div className="h-[3px] bg-flag-brown" aria-hidden />
      <div className="h-px bg-flag-gold" aria-hidden />
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Crest className="h-9 w-auto text-gold-300" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-semibold uppercase tracking-[0.3em]">Condoria</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-parchment-200">Residents’ Register</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-[13px] text-parchment-200 sm:inline">{name}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
