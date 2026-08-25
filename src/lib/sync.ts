import type { AppState } from '../types'
import { hydrate } from './storage'

/**
 * Optional cloud sync. When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set,
 * both partners sign in by email link and share one state document, kept live
 * over a realtime subscription. Without them, the app is purely local and none
 * of this code is even loaded.
 */

type SupabaseClient = any

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isCloudConfigured = (): boolean => Boolean(URL && ANON)

let clientPromise: Promise<SupabaseClient> | null = null

async function getClient(): Promise<SupabaseClient> {
  if (!isCloudConfigured()) throw new Error('Cloud sync is not configured.')
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL!, ANON!, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    )
  }
  return clientPromise
}

export interface CloudSession {
  userId: string
  email: string | null
}

export async function currentSession(): Promise<CloudSession | null> {
  const client = await getClient()
  const { data } = await client.auth.getSession()
  if (!data.session) return null
  return { userId: data.session.user.id, email: data.session.user.email ?? null }
}

export async function onAuthChange(cb: (session: CloudSession | null) => void): Promise<() => void> {
  const client = await getClient()
  const { data } = client.auth.onAuthStateChange((_event: string, session: any) => {
    cb(session ? { userId: session.user.id, email: session.user.email ?? null } : null)
  })
  return () => data.subscription.unsubscribe()
}

export async function sendMagicLink(email: string): Promise<void> {
  const client = await getClient()
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const client = await getClient()
  await client.auth.signOut()
}

export interface CoupleRef {
  coupleId: string
  inviteCode: string
}

/** The couple this account belongs to, creating one on first sign-in. */
export async function ensureCouple(): Promise<CoupleRef> {
  const client = await getClient()
  const { data, error } = await client.rpc('create_couple')
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Could not set up your shared space.')
  return { coupleId: row.couple_id, inviteCode: row.invite_code }
}

export async function joinCouple(code: string): Promise<CoupleRef> {
  const client = await getClient()
  const { data, error } = await client.rpc('join_couple', { p_code: code.trim().toUpperCase() })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('That invite code did not match anything.')
  return { coupleId: row.couple_id, inviteCode: row.invite_code }
}

export async function pullState(coupleId: string): Promise<AppState | null> {
  const client = await getClient()
  const { data, error } = await client.from('couple_state').select('state').eq('couple_id', coupleId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.state || !Object.keys(data.state).length) return null
  return hydrate(data.state)
}

export async function pushState(coupleId: string, state: AppState): Promise<void> {
  const client = await getClient()
  const { data: session } = await client.auth.getSession()
  const { error } = await client
    .from('couple_state')
    .upsert(
      {
        couple_id: coupleId,
        state,
        updated_at: new Date().toISOString(),
        updated_by: session.session?.user.id ?? null,
      },
      { onConflict: 'couple_id' },
    )
  if (error) throw new Error(error.message)
}

/** Fires whenever the other device writes. Returns an unsubscribe function. */
export async function subscribeToState(coupleId: string, cb: (state: AppState) => void): Promise<() => void> {
  const client = await getClient()
  const channel = client
    .channel(`couple_state:${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couple_state', filter: `couple_id=eq.${coupleId}` },
      (payload: any) => {
        const next = payload?.new?.state
        if (next && Object.keys(next).length) cb(hydrate(next))
      },
    )
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}
