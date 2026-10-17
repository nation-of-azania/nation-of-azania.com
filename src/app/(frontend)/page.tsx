import { redirect } from 'next/navigation'

/**
 * The site root forwards to the government Gazette. The two publications live
 * at /gov (the state Gazette) and /times (the independent Condor Times).
 */
export default function RootIndex() {
  redirect('/gov')
}
