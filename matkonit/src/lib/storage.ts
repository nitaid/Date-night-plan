import type { AppState, Profile, Settings, Shopping } from '../types'

const KEY = 'matkonit:state:v1'
export const STATE_VERSION = 1

export function defaultProfile(): Profile {
  return {
    householdSize: 3,
    city: '',
    storeId: 'shufersal-deal',
    weeklyBudget: 450,
    cookingDays: [0, 1, 2, 3, 5],
    diets: [],
    kosher: true,
    dislikes: [],
    maxMinutes: 60,
    onboarded: false,
  }
}

export const defaultSettings = (): Settings => ({ theme: 'system', priceOverrides: {}, cookFontScale: 1 })
export const defaultShopping = (): Shopping => ({ checked: [], have: [], need: [], extras: [] })

export function defaultState(): AppState {
  return { version: STATE_VERSION, profile: defaultProfile(), settings: defaultSettings(), recipes: [], plan: null, shopping: defaultShopping() }
}

/** Fills in anything an older or partial saved state is missing. */
export function hydrate(raw: unknown): AppState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const input = raw as Partial<AppState>
  return {
    version: STATE_VERSION,
    profile: { ...base.profile, ...(input.profile || {}) },
    settings: { ...base.settings, ...(input.settings || {}) },
    recipes: Array.isArray(input.recipes) ? input.recipes : [],
    plan: input.plan && Array.isArray(input.plan.days) ? input.plan : null,
    shopping: { ...base.shopping, ...(input.shopping || {}) },
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? hydrate(JSON.parse(raw)) : defaultState()
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    // Quota exceeded (usually huge image data) or storage disabled. Keep running in memory.
    return false
  }
}

export function exportBackup(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `matkonit-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
