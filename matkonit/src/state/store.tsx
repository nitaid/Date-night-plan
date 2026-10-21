import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppState, Recipe } from '../types'
import { loadState, saveState } from '../lib/storage'
import { nowIso } from '../lib/format'

interface Store {
  state: AppState
  update: (change: (state: AppState) => AppState) => void
  saveRecipe: (recipe: Recipe) => void
  patchRecipe: (id: string, patch: Partial<Recipe>) => void
  deleteRecipe: (id: string) => void
  recipe: (id: string | null | undefined) => Recipe | undefined
  saveFailed: boolean
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)
  const [saveFailed, setSaveFailed] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaveFailed(!saveState(state))
  }, [state])

  // Another tab (or the share sheet opening a second window) changed the data.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith('matkonit:state')) setState(loadState())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((change: (s: AppState) => AppState) => setState((s) => change(s)), [])

  const value = useMemo<Store>(
    () => ({
      state,
      update,
      saveFailed,
      saveRecipe: (recipe) =>
        update((s) => {
          const stamped = { ...recipe, updatedAt: nowIso() }
          const exists = s.recipes.some((r) => r.id === recipe.id)
          return { ...s, recipes: exists ? s.recipes.map((r) => (r.id === recipe.id ? stamped : r)) : [stamped, ...s.recipes] }
        }),
      patchRecipe: (id, patch) =>
        update((s) => ({ ...s, recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: nowIso() } : r)) })),
      deleteRecipe: (id) =>
        update((s) => ({
          ...s,
          recipes: s.recipes.filter((r) => r.id !== id),
          plan: s.plan ? { ...s.plan, days: s.plan.days.map((d) => (d.recipeId === id ? { ...d, recipeId: null, locked: false } : d)) } : s.plan,
        })),
      recipe: (id) => (id ? state.recipes.find((r) => r.id === id) : undefined),
    }),
    [state, update, saveFailed],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}
