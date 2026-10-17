import type { Metadata } from 'next'
import { headers as nextHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { hasRole } from '@/access'
import { cn } from '@/blocks/components/shared'
import { MemberHeader } from '@/components/members/MemberHeader'
import { LinkButton } from '@/components/site/LinkButton'
import { DoubleRule } from '@/components/site/SectionHeading'
import { articleHref, formatDate } from '@/components/site/format'
import type { Article } from '@/payload-types'

export const metadata: Metadata = { title: 'Your Register' }
// Reads the session cookie, so it must never be statically cached.
export const dynamic = 'force-dynamic'

const ROLE_LABEL = { resident: 'Resident', editor: 'Editor', admin: 'Administrator' } as const

function StatusBadge({ status }: { status?: Article['_status'] }) {
  const published = status === 'published'
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
        published ? 'bg-pine-800 text-parchment-50' : 'border border-gold-500/50 text-gold-600',
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

  const role = (user.role ?? 'resident') as keyof typeof ROLE_LABEL
  const isStaff = hasRole(user, 'editor', 'admin')
  const displayName = user.name ?? user.username ?? 'Resident'

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

  return (
    <div className="flex min-h-screen flex-col bg-parchment-50 text-ink-900">
      <MemberHeader name={displayName} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:py-16">
        <p className="text-[11px] uppercase tracking-[0.24em] text-gold-600">Residents’ Register</p>
        <h1 className="mt-3 font-display text-4xl text-pine-950 md:text-5xl">Welcome, {displayName}</h1>
        <DoubleRule className="mt-6" />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Standing */}
          <section className="border border-parchment-300 bg-parchment-50 p-6 md:col-span-1">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-gold-600">Your standing</h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-ink-400">Name</dt>
                <dd className="text-ink-900">{user.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Username</dt>
                <dd className="text-ink-900">{user.username ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Role</dt>
                <dd>
                  <span className="inline-flex items-center border border-pine-700/30 bg-pine-100/50 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-pine-800">
                    {ROLE_LABEL[role]}
                  </span>
                </dd>
              </div>
            </dl>
            {isStaff ? (
              <div className="mt-6 border-t border-parchment-300 pt-5">
                <p className="text-sm leading-relaxed text-ink-500">
                  You hold publishing rights to the record.
                </p>
                <LinkButton href="/admin" prefetch={false} variant="primary" className="mt-3 w-full">
                  Open the Publishing Desk
                </LinkButton>
              </div>
            ) : (
              <p className="mt-6 border-t border-parchment-300 pt-5 text-sm leading-relaxed text-ink-500">
                As a resident you may draft articles for the Gazette. An editor reviews each one before it
                enters the record.
              </p>
            )}
          </section>

          {/* Writings */}
          <section className="md:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl text-pine-950">Your writings</h2>
              <span className="text-[12px] uppercase tracking-[0.16em] text-ink-400">
                {myArticles.length} in all
              </span>
            </div>
            <div className="mt-5 border-t border-parchment-300">
              {myArticles.length === 0 ? (
                <p className="border-x border-b border-parchment-300 bg-parchment-100/50 px-6 py-12 text-center text-sm text-ink-500">
                  You have not written anything yet.
                </p>
              ) : (
                <ul>
                  {myArticles.map((article) => (
                    <li
                      key={article.id}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-x border-b border-parchment-300 bg-parchment-50 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg text-pine-950">{article.title}</p>
                        <p className="mt-0.5 text-[12px] uppercase tracking-[0.14em] text-ink-400">
                          {article.section === 'times' ? 'Condor Times' : 'Government Gazette'}
                          {formatDate(article.updatedAt) ? ` · ${formatDate(article.updatedAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={article._status} />
                        {article._status === 'published' ? (
                          <Link
                            href={articleHref(article)}
                            className="text-[12px] font-semibold uppercase tracking-[0.14em] text-pine-700 hover:text-pine-900"
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
