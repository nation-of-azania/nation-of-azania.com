import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { hasRole } from '@/access'
import { cn } from '@/blocks/components/shared'
import { MemberHeader } from '@/components/members/MemberHeader'
import { BylineAvatar } from '@/components/site/BylineAvatar'
import { LinkButton } from '@/components/site/LinkButton'
import { DoubleRule } from '@/components/site/SectionHeading'
import { articleHref, formatDate, resolveByline } from '@/components/site/format'
import type { Article, Profile } from '@/payload-types'

export const metadata: Metadata = { title: 'Your Register' }
// Reads the session cookie, so it must never be statically cached.
export const dynamic = 'force-dynamic'

/**
 * Access levels say what an account may do in the Registry. They are not
 * roles in Azania — those ("Chancellor", "Harbour Correspondent") live on
 * byline profiles — so the labels here match the admin panel's and describe
 * permissions only.
 */
const ACCESS = {
  resident: {
    label: 'Resident',
    note: 'You can follow the record from here. To write for the Gazette or the Times, ask an administrator for access.',
  },
  editor: {
    label: 'Can publish',
    note: 'You may edit and publish anything in the Gazette and the Times.',
  },
  admin: {
    label: 'Admin',
    note: 'You may publish anything, and manage the accounts of residents.',
  },
} as const

const PUBLICATION_LABEL: Record<Profile['publication'], string> = {
  government: 'The Azania Gazette',
  times: 'The Azanian Times',
  both: 'Gazette & Times',
}

function StatusBadge({ status }: { status?: Article['_status'] }) {
  const published = status === 'published'
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
        published ? 'bg-sea-800 text-sand-50' : 'border border-saffron-500/50 text-saffron-600',
      )}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

export default async function AccountPage() {
  const payload = await getPayload({ config })
  const { user } = await payload
    .auth({ headers: await nextHeaders() })
    .catch(() => ({ user: null }))
  if (!user) redirect('/login?next=/account')

  const access = ACCESS[(user.role ?? 'resident') as keyof typeof ACCESS]
  const isStaff = hasRole(user, 'editor', 'admin')
  const displayName = user.name ?? user.username ?? 'Resident'
  // The resident as the site would credit them without a profile: display
  // name, and their head if the account has a Minecraft name.
  const self = resolveByline({ author: user, byline: null }) ?? { name: displayName }

  // The resident's own articles. overrideAccess:false + user means Payload's
  // access control applies — a resident sees only their own (drafts included).
  let myArticles: Article[] = []
  try {
    const res = await payload.find({
      collection: 'articles',
      where: { author: { equals: user.id } },
      sort: '-updatedAt',
      depth: 0,
      limit: 24,
      overrideAccess: false,
      user,
    })
    myArticles = res.docs
  } catch {
    myArticles = []
  }

  // Their byline profiles — the hats they write under. depth 1 populates an
  // uploaded avatar so the credit renders exactly as it does on an article.
  let myProfiles: Profile[] = []
  try {
    const res = await payload.find({
      collection: 'profiles',
      where: { owner: { equals: user.id } },
      sort: 'createdAt',
      depth: 1,
      limit: 12,
      overrideAccess: false,
      user,
    })
    myProfiles = res.docs
  } catch {
    myProfiles = []
  }

  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-ink-900">
      <MemberHeader name={displayName} byline={self} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:py-16">
        <p className="text-[11px] uppercase tracking-[0.24em] text-saffron-600">Residents’ Register</p>
        <h1 className="mt-3 font-display text-4xl text-sea-950 md:text-5xl">Welcome, {displayName}</h1>
        <DoubleRule className="mt-6" />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-6 md:col-span-1">
            {/* Standing */}
            <section className="border border-sand-300 bg-sand-50 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-saffron-600">Your standing</h2>
              <div className="mt-4 flex items-center gap-4">
                <BylineAvatar byline={self} size={64} tone="gazette" />
                <div className="min-w-0">
                  <p className="truncate font-display text-xl leading-tight text-sea-950">
                    {displayName}
                  </p>
                  <p className="mt-1 truncate text-xs text-ink-400">
                    {user.minecraftName ? (
                      <>
                        <span className="text-ink-500">{user.minecraftName}</span> on Rulercraft
                      </>
                    ) : (
                      'No Minecraft name on record'
                    )}
                  </p>
                </div>
              </div>
              <dl className="mt-5 flex flex-col gap-3 border-t border-sand-300 pt-5 text-sm">
                <div>
                  <dt className="text-ink-400">Username</dt>
                  <dd className="text-ink-900">{user.username ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-ink-400">Access level</dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center border border-sea-700/30 bg-sea-100/50 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-sea-800">
                      {access.label}
                    </span>
                  </dd>
                  <dd className="mt-2 text-xs leading-relaxed text-ink-500">{access.note}</dd>
                </div>
              </dl>
              {isStaff ? (
                <div className="mt-6 border-t border-sand-300 pt-5">
                  <p className="text-sm leading-relaxed text-ink-500">
                    You hold publishing rights to the record.
                  </p>
                  <LinkButton href="/admin" prefetch={false} variant="primary" className="mt-3 w-full">
                    Open the Publishing Desk
                  </LinkButton>
                </div>
              ) : null}
            </section>

            {/* Bylines */}
            <section className="border border-sand-300 bg-sand-50 p-6">
              <h2 className="text-[11px] uppercase tracking-[0.2em] text-saffron-600">Your bylines</h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">
                Your roles in Azania, as the papers credit you. Access levels say what you may do
                here; bylines say who you are there.
              </p>
              {myProfiles.length === 0 ? (
                <div className="mt-4 flex items-center gap-3 border-t border-sand-300 pt-4">
                  <BylineAvatar byline={self} size={32} tone="gazette" />
                  <p className="text-sm leading-snug text-ink-700">
                    {self.name}
                    <span className="block text-xs text-ink-400">
                      Credited by name, without a role
                    </span>
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-sand-300 border-t border-sand-300">
                  {myProfiles.map((profile) => {
                    const byline = resolveByline({ author: user, byline: profile })
                    if (!byline) return null
                    return (
                      <li key={profile.id} className="flex items-center gap-3 py-3">
                        <BylineAvatar byline={byline} size={32} tone="gazette" />
                        <p
                          className={cn(
                            'min-w-0 text-sm leading-snug text-ink-700',
                            profile.active === false && 'text-ink-400 line-through decoration-sand-300',
                          )}
                        >
                          <span className="font-medium text-ink-900">{byline.name}</span>
                          {byline.title ? `, ${byline.title}` : null}
                          <span className="block text-xs text-ink-400">
                            {PUBLICATION_LABEL[profile.publication]}
                            {profile.active === false ? ' · retired' : ''}
                          </span>
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
              {isStaff ? (
                <p className="mt-4 text-xs text-ink-400">
                  Bylines are kept under{' '}
                  <Link
                    href="/admin/collections/profiles"
                    prefetch={false}
                    className="font-medium text-sea-700 hover:text-sea-900"
                  >
                    Profiles
                  </Link>{' '}
                  in the Publishing Desk.
                </p>
              ) : (
                <p className="mt-4 text-xs text-ink-400">
                  To write under a role, ask an editor to add a byline for you.
                </p>
              )}
            </section>
          </div>

          {/* Writings */}
          <section className="md:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl text-sea-950">Your writings</h2>
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-400">
                {myArticles.length} in all
              </span>
            </div>
            <div className="mt-5 border-t border-sand-300">
              {myArticles.length === 0 ? (
                <p className="border-x border-b border-sand-300 bg-sand-100/50 px-6 py-12 text-center text-sm text-ink-500">
                  You have not written anything yet.
                </p>
              ) : (
                <ul>
                  {myArticles.map((article) => (
                    <li
                      key={article.id}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-x border-b border-sand-300 bg-sand-50 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg text-sea-950">{article.title}</p>
                        <p className="mt-0.5 text-[12px] uppercase tracking-[0.14em] text-ink-400">
                          {article.section === 'times' ? 'The Azanian Times' : 'The Azania Gazette'}
                          {formatDate(article.updatedAt) ? ` · ${formatDate(article.updatedAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={article._status} />
                        {article._status === 'published' ? (
                          <Link
                            href={articleHref(article)}
                            className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sea-700 hover:text-sea-900"
                          >
                            View →
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
