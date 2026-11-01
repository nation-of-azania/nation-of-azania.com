import { notFound, redirect } from 'next/navigation'

import { getHomePath } from '@/lib/site'

export const revalidate = 1800

/** The site root forwards to the first listed top-level context (Government). */
export default async function RootIndex() {
  const home = await getHomePath()
  if (!home) notFound()
  redirect(home)
}
