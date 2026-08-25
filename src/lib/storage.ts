import type { AppState, Plan, Profile, Settings, WishItem } from '../types'
import { nowIso } from './format'

const KEY = 'date-night:state:v1'
export const STATE_VERSION = 1

export function defaultProfile(): Profile {
  return {
    coupleName: '',
    partnerAName: '',
    partnerBName: '',
    anniversary: '',
    homeCity: '',
    radiusKm: 30,
    budget: 'moderate',
    currency: 'ILS',
    transport: 'transit',
    interests: [],
    avoid: [],
    dietary: [],
    accessibility: [],
    languages: [],
    defaultStartTime: '19:30',
    defaultDurationHours: 4,
    notes: '',
    onboarded: false,
  }
}

export function defaultSettings(): Settings {
  return {
    theme: 'system',
    language: 'en',
    reminderMinutes: 120,
    exportTravelBuffers: false,
    cadenceDays: 14,
    lastNudgeDismissed: null,
    me: 'a',
  }
}

export function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    profile: defaultProfile(),
    settings: defaultSettings(),
    wishlist: [],
    plans: [],
    deleted: {},
    updatedAt: nowIso(),
  }
}

/** Fills in anything a older/partial saved state is missing. */
export function hydrate(raw: unknown): AppState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<AppState>
  return {
    version: STATE_VERSION,
    profile: { ...base.profile, ...(input.profile || {}) },
    settings: { ...base.settings, ...(input.settings || {}) },
    wishlist: Array.isArray(input.wishlist) ? input.wishlist : [],
    plans: Array.isArray(input.plans) ? input.plans : [],
    deleted: input.deleted && typeof input.deleted === 'object' ? input.deleted : {},
    updatedAt: input.updatedAt || base.updatedAt,
  }
}

export function loadLocal(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? hydrate(JSON.parse(raw)) : defaultState()
  } catch {
    return defaultState()
  }
}

export function saveLocal(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private browsing or a full quota — the app keeps working in memory.
  }
}

function newer(a: string | undefined, b: string | undefined): boolean {
  return (a || '') > (b || '')
}

function mergeList<T extends { id: string; updatedAt: string }>(
  mine: T[],
  theirs: T[],
  deleted: Record<string, string>,
): T[] {
  const byId = new Map<string, T>()
  for (const item of mine) byId.set(item.id, item)
  for (const item of theirs) {
    const existing = byId.get(item.id)
    if (!existing || newer(item.updatedAt, existing.updatedAt)) byId.set(item.id, item)
  }
  // A tombstone wins over any edit made before the delete.
  return [...byId.values()].filter((item) => !(deleted[item.id] && !newer(item.updatedAt, deleted[item.id])))
}

/**
 * Merges two copies of the state entity by entity. Each wishlist item and plan
 * carries its own `updatedAt`, so two people editing different things at the
 * same time never overwrite each other — only edits to the *same* item resolve
 * last-write-wins.
 */
export function mergeStates(mine: AppState, theirs: AppState): AppState {
  const deleted = { ...theirs.deleted, ...mine.deleted }
  for (const [id, at] of Object.entries(theirs.deleted)) {
    if (newer(at, deleted[id])) deleted[id] = at
  }

  return {
    version: STATE_VERSION,
    // Profile and settings are small and rarely conflict; whole-object LWW is fine.
    profile: newer(theirs.updatedAt, mine.updatedAt) ? { ...mine.profile, ...theirs.profile } : mine.profile,
    settings: mine.settings,
    wishlist: mergeList<WishItem>(mine.wishlist, theirs.wishlist, deleted),
    plans: mergeList<Plan>(mine.plans, theirs.plans, deleted),
    deleted,
    updatedAt: newer(theirs.updatedAt, mine.updatedAt) ? theirs.updatedAt : mine.updatedAt,
  }
}

/** Everything except device-local settings, for cloud sync and file export. */
export function shareableState(state: AppState): AppState {
  return { ...state, settings: { ...state.settings, me: 'a' } }
}

export function exportStateFile(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `date-night-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function readStateFile(file: File): Promise<AppState> {
  const text = await file.text()
  return hydrate(JSON.parse(text))
}
