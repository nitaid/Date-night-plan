import type { Partner, Plan, Profile, Stop, WishItem } from '../types'
import { nowIso, uid } from './format'
import { generateOfflinePlan, generateOfflineStop } from './offlinePlanner'
import type { GeneratedPlan, GeneratedStop } from './planTypes'

export interface PlanRequest {
  theme: string
  /** The plan is written in this language, matching the UI. */
  language: 'en' | 'he'
  date: string
  startTime?: string
  durationHours?: number
  extraNotes?: string
  profile: Profile
  wishlist: WishItem[]
  recentPlans: Plan[]
}

export interface PlanResult {
  plan: Plan
  source: 'ai' | 'offline'
  /** Set when the AI was tried and could not be used. */
  notice: string | null
}

const NETWORK_NOTICE: Record<string, string> = {
  no_key: 'No AI key is set up, so this plan came from the built-in planner.',
  bad_key: 'The Anthropic API key was rejected, so this plan came from the built-in planner.',
  rate_limited: 'The AI planner is busy right now, so this plan came from the built-in planner.',
  unreachable: 'Could not reach the AI planner, so this plan came from the built-in planner.',
  refused: 'The AI planner declined that request, so this plan came from the built-in planner.',
  unparseable: 'The AI planner returned something unusable, so this plan came from the built-in planner.',
  offline: 'You are offline, so this plan came from the built-in planner.',
}

function noticeFor(code: string | undefined): string {
  return NETWORK_NOTICE[code || ''] || NETWORK_NOTICE.unreachable
}

/** The offline planner only writes English, so flag that when the UI is Hebrew. */
function languageNote(language: 'en' | 'he'): string {
  return language === 'he' ? ' The built-in planner only writes in English.' : ''
}

/** Slim the couple's history down to what the model actually needs. */
function historyForPrompt(plans: Plan[]) {
  return plans
    .filter((plan) => plan.status === 'done' || plan.status === 'scheduled')
    .slice(-12)
    .map((plan) => ({
      title: plan.title,
      rating: plan.rating,
      stops: plan.stops.map((stop) => ({ venueName: stop.venueName })),
    }))
}

async function postPlan<T>(body: unknown): Promise<{ ok: true; data: T } | { ok: false; code: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, code: 'offline' }
  }
  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, code: payload?.error?.code || 'unreachable' }
    return { ok: true, data: payload as T }
  } catch {
    return { ok: false, code: 'unreachable' }
  }
}

export function attachStopFields(generated: GeneratedStop): Stop {
  return {
    ...generated,
    id: uid('stop'),
    bookingStatus: generated.booking.method === 'walk_in' ? 'not_needed' : 'todo',
    locked: false,
  }
}

export function materializePlan(
  generated: GeneratedPlan,
  meta: { theme: string; date: string; createdBy: Partner | 'unknown'; source: 'ai' | 'offline' | 'manual' },
): Plan {
  const timestamp = nowIso()
  return {
    id: uid('plan'),
    title: generated.title,
    summary: generated.summary,
    theme: meta.theme,
    vibeTags: generated.vibeTags,
    date: meta.date,
    stops: generated.stops.map(attachStopFields),
    currency: generated.currency,
    totalCostPerPerson: generated.totalCostPerPerson,
    dressCode: generated.dressCode,
    travelNotes: generated.travelNotes,
    weatherNote: generated.weatherNote,
    backupPlan: generated.backupPlan,
    bookingChecklist: generated.bookingChecklist,
    status: 'draft',
    source: meta.source,
    createdBy: meta.createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
    calendarExportedAt: null,
    rating: null,
    memoryNote: '',
    actualCostPerPerson: null,
    wouldRepeat: null,
  }
}

export async function requestPlan(request: PlanRequest, me: Partner): Promise<PlanResult> {
  const result = await postPlan<{ plan: GeneratedPlan }>({
    mode: 'plan',
    theme: request.theme,
    date: request.date,
    startTime: request.startTime,
    durationHours: request.durationHours,
    extraNotes: request.extraNotes,
    profile: { ...request.profile, language: request.language },
    wishlist: request.wishlist.filter((item) => item.status !== 'done').slice(0, 40),
    recentPlans: historyForPrompt(request.recentPlans),
  })

  if (result.ok && result.data?.plan?.stops?.length) {
    return {
      plan: materializePlan(result.data.plan, {
        theme: request.theme,
        date: request.date,
        createdBy: me,
        source: 'ai',
      }),
      source: 'ai',
      notice: null,
    }
  }

  const offline = generateOfflinePlan({
    theme: request.theme,
    date: request.date,
    startTime: request.startTime,
    profile: request.profile,
    wishlist: request.wishlist,
  })
  return {
    plan: materializePlan(offline, { theme: request.theme, date: request.date, createdBy: me, source: 'offline' }),
    source: 'offline',
    notice: noticeFor(result.ok ? 'unparseable' : result.code) + languageNote(request.language),
  }
}

export async function requestStop(
  plan: Plan,
  stopIndex: number,
  profile: Profile,
  language: 'en' | 'he',
  instruction?: string,
): Promise<{ stop: Stop; source: 'ai' | 'offline'; notice: string | null }> {
  const result = await postPlan<{ stop: GeneratedStop }>({
    mode: 'stop',
    profile: { ...profile, language },
    instruction,
    stopIndex,
    plan: {
      title: plan.title,
      date: plan.date,
      stops: plan.stops.map((stop) => ({
        title: stop.title,
        venueName: stop.venueName,
        area: stop.area,
        startTime: stop.startTime,
        durationMin: stop.durationMin,
      })),
    },
  })

  if (result.ok && result.data?.stop?.title) {
    return { stop: attachStopFields(result.data.stop), source: 'ai', notice: null }
  }

  const offline = generateOfflineStop(plan, stopIndex, profile, instruction)
  return {
    stop: attachStopFields(offline),
    source: 'offline',
    notice: noticeFor(result.ok ? 'unparseable' : result.code),
  }
}

/** Whether the server has an AI key configured, for the settings screen. */
export async function checkAiStatus(): Promise<{ ai: boolean; model: string } | null> {
  try {
    const response = await fetch('/api/plan')
    if (!response.ok) return null
    return (await response.json()) as { ai: boolean; model: string }
  } catch {
    return null
  }
}
