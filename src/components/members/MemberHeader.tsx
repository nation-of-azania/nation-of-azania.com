import Link from 'next/link'

import { BylineAvatar } from '@/components/site/BylineAvatar'
import { Crest } from '@/components/site/Crest'
import type { ResolvedByline } from '@/components/site/format'

import { SignOutButton } from './SignOutButton'

type Props = {
  name: string
  /** The signed-in resident as a byline, for their head beside the name. */
  byline?: Pick<ResolvedByline, 'name' | 'avatar'>
}

/**
 * Chrome for the resident area — the national sea-and-ribbon header (matching
 * the Gazette's Nav), with the signed-in resident's name and a sign-out control.
 * Deliberately lighter than the Gazette Nav: this is a private desk, not a
 * publication, so it carries no section links.
 */
export function MemberHeader({ name, byline }: Props) {
  return (
    <header className="border-b border-saffron-400/70 bg-sea-900 text-sand-100">
      <div className="h-[3px] bg-flag-saffron" aria-hidden />
      <div className="h-px bg-flag-coral" aria-hidden />
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Crest className="h-9 w-auto text-saffron-300" />
          <span className="flex flex-col leading-tight">
            <span className="font-mark text-lg uppercase tracking-[0.32em]">Azania</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-sand-200">Residents’ Register</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden items-center gap-2.5 text-[13px] text-sand-200 sm:flex">
            {byline?.avatar ? (
              <BylineAvatar
                byline={byline}
                size={24}
                tone="gazette"
                className="border-sea-700 bg-sea-800"
              />
            ) : null}
            {name}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
