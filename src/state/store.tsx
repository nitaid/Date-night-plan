import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppState, Partner, Plan, Profile, Settings, Stop, SyncStatus, WishItem } from '../types'
import { nowIso, uid } from '../lib/format'
import { defaultState, loadLocal, mergeStates, saveLocal, shareableState } from '../lib/storage'
import { translate, type Language } from '../i18n'
import * as cloud from '../lib/sync'

interface Toast {
  id: string
  message: string
  tone: 'info' | 'good' | 'error'
}

interface StoreValue {
  state: AppState
  me: Partner
  t: (text: string, vars?: Record<string, string | number>) => string
  language: Language
  toasts: Toast[]
  toast: (message: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void

  setProfile: (patch: Partial<Profile>) => void
  setSettings: (patch: Partial<Settings>) => void

  addWish: (item: Partial<WishItem> & { title: string }) => WishItem
  updateWish: (id: string, patch: Partial<WishItem>) => void
  removeWish: (id: string) => void
  toggleHeart: (id: string) => void

  savePlan: (plan: Plan) => void
  updatePlan: (id: string, patch: Partial<Plan>) => void
  updateStop: (planId: string, stopId: string, patch: Partial<Stop>) => void
  replaceStop: (planId: string, stopId: string, stop: Stop) => void
  removeStop: (planId: string, stopId: string) => void
  addStop: (planId: string, stop: Stop) => void
  removePlan: (id: string) => void

  sync: SyncStatus
  signIn: (email: string) => Promise<void>
  signOutOfCloud: () => Promise<void>
  joinWithCode: (code: string) => Promise<void>
  importState: (incoming: AppState) => void
}

const StoreContext = createContext<StoreValue | null>(null)

const CLOUD_OFF: SyncStatus = {
  mode: 'local',
  state: 'off',
  email: null,
  coupleId: null,
  inviteCode: null,
  message: '',
}

/** Recomputes the plan total whenever stops change. */
function withTotals(plan: Plan): Plan {
  return {
    ...plan,
    totalCostPerPerson: plan.stops.reduce((sum, stop) => sum + (stop.costPerPerson || 0), 0),
    updatedAt: nowIso(),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => (typeof window === 'undefined' ? defaultState() : loadLocal()))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sync, setSync] = useState<SyncStatus>(CLOUD_OFF)

  /**
   * Serialized snapshot of the last state that came *from* the cloud. Comparing
   * against it is what stops a remote update from bouncing straight back as a
   * push — more reliable than an "applying remote" flag, which can get stuck if
   * a merge happens to produce an identical state and skips the effect.
   */
  const lastRemote = useRef<string | null>(null)
  const coupleId = useRef<string | null>(null)
  const pushTimer = useRef<number | null>(null)

  const language = state.settings.language
  const t = useCallback(
    (text: string, vars?: Record<string, string | number>) => translate(language, text, vars),
    [language],
  )

  const toast = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const item = { id: uid('toast'), message, tone }
    setToasts((current) => [...current, item])
    window.setTimeout(() => setToasts((current) => current.filter((x) => x.id !== item.id)), 4200)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((x) => x.id !== id))
  }, [])

  const mutate = useCallback((fn: (draft: AppState) => AppState) => {
    setState((current) => ({ ...fn(current), updatedAt: nowIso() }))
  }, [])

  // ------------------------------------------------------------- persistence
  useEffect(() => {
    saveLocal(state)
    if (!coupleId.current) return

    const payload = JSON.stringify(shareableState(state))
    if (payload === lastRemote.current) return

    if (pushTimer.current) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => {
      lastRemote.current = payload
      cloud
        .pushState(coupleId.current!, shareableState(state))
        .catch((error) => setSync((s) => ({ ...s, state: 'error', message: String(error.message || error) })))
    }, 900)
  }, [state])

  // ------------------------------------------------------------------ theme
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = state.settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : state.settings.theme
      document.documentElement.setAttribute('data-theme', resolved)
      document.documentElement.style.colorScheme = resolved
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [state.settings.theme])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr'
  }, [language])

  // ------------------------------------------------------------- cloud sync
  const connect = useCallback(
    async (session: cloud.CloudSession) => {
      setSync({ mode: 'cloud', state: 'connecting', email: session.email, coupleId: null, inviteCode: null, message: '' })
      try {
        const ref = await cloud.ensureCouple()
        coupleId.current = ref.coupleId

        const remote = await cloud.pullState(ref.coupleId)
        if (remote) {
          setState((current) => {
            const merged = mergeStates(current, remote)
            lastRemote.current = JSON.stringify(shareableState(merged))
            return merged
          })
        }
        await cloud.pushState(ref.coupleId, shareableState(remote ? mergeStates(loadLocal(), remote) : loadLocal()))

        const unsubscribe = await cloud.subscribeToState(ref.coupleId, (incoming) => {
          setState((current) => {
            const merged = mergeStates(current, incoming)
            lastRemote.current = JSON.stringify(shareableState(merged))
            return merged
          })
        })

        setSync({
          mode: 'cloud',
          state: 'live',
          email: session.email,
          coupleId: ref.coupleId,
          inviteCode: ref.inviteCode,
          message: '',
        })
        return unsubscribe
      } catch (error: any) {
        setSync({
          mode: 'cloud',
          state: 'error',
          email: session.email,
          coupleId: null,
          inviteCode: null,
          message: String(error?.message || error),
        })
        return () => {}
      }
    },
    [],
  )

  useEffect(() => {
    if (!cloud.isCloudConfigured()) return
    let unsubscribeState: (() => void) | null = null
    let unsubscribeAuth: (() => void) | null = null
    let cancelled = false

    ;(async () => {
      const session = await cloud.currentSession().catch(() => null)
      if (cancelled) return
      if (session) unsubscribeState = await connect(session)
      else setSync({ ...CLOUD_OFF, mode: 'cloud', state: 'signed_out' })

      unsubscribeAuth = await cloud.onAuthChange(async (next) => {
        unsubscribeState?.()
        unsubscribeState = null
        coupleId.current = null
        if (next) unsubscribeState = await connect(next)
        else setSync({ ...CLOUD_OFF, mode: 'cloud', state: 'signed_out' })
      })
    })()

    return () => {
      cancelled = true
      unsubscribeState?.()
      unsubscribeAuth?.()
    }
  }, [connect])

  // ---------------------------------------------------------------- actions
  const value = useMemo<StoreValue>(() => {
    const stamp = () => nowIso()

    const patchPlan = (id: string, fn: (plan: Plan) => Plan) =>
      mutate((draft) => ({
        ...draft,
        plans: draft.plans.map((plan) => (plan.id === id ? fn(plan) : plan)),
      }))

    return {
      state,
      me: state.settings.me,
      t,
      language,
      toasts,
      toast,
      dismissToast,

      setProfile: (patch) => mutate((draft) => ({ ...draft, profile: { ...draft.profile, ...patch } })),
      setSettings: (patch) => mutate((draft) => ({ ...draft, settings: { ...draft.settings, ...patch } })),

      addWish: (item) => {
        const wish: WishItem = {
          id: uid('wish'),
          title: item.title,
          notes: item.notes ?? '',
          tags: item.tags ?? [],
          estCost: item.estCost ?? null,
          location: item.location ?? '',
          url: item.url ?? '',
          addedBy: item.addedBy ?? state.settings.me,
          hearts: item.hearts ?? [state.settings.me],
          status: item.status ?? 'idea',
          createdAt: stamp(),
          updatedAt: stamp(),
          plannedPlanId: null,
        }
        mutate((draft) => ({ ...draft, wishlist: [wish, ...draft.wishlist] }))
        return wish
      },

      updateWish: (id, patch) =>
        mutate((draft) => ({
          ...draft,
          wishlist: draft.wishlist.map((item) => (item.id === id ? { ...item, ...patch, updatedAt: stamp() } : item)),
        })),

      removeWish: (id) =>
        mutate((draft) => ({
          ...draft,
          wishlist: draft.wishlist.filter((item) => item.id !== id),
          deleted: { ...draft.deleted, [id]: stamp() },
        })),

      toggleHeart: (id) =>
        mutate((draft) => ({
          ...draft,
          wishlist: draft.wishlist.map((item) => {
            if (item.id !== id) return item
            const me = draft.settings.me
            const hearts = item.hearts.includes(me) ? item.hearts.filter((p) => p !== me) : [...item.hearts, me]
            return { ...item, hearts, updatedAt: stamp() }
          }),
        })),

      savePlan: (plan) =>
        mutate((draft) => {
          const exists = draft.plans.some((p) => p.id === plan.id)
          const next = { ...plan, updatedAt: stamp() }
          return {
            ...draft,
            plans: exists ? draft.plans.map((p) => (p.id === plan.id ? next : p)) : [next, ...draft.plans],
          }
        }),

      updatePlan: (id, patch) => patchPlan(id, (plan) => ({ ...plan, ...patch, updatedAt: stamp() })),

      updateStop: (planId, stopId, patch) =>
        patchPlan(planId, (plan) =>
          withTotals({ ...plan, stops: plan.stops.map((stop) => (stop.id === stopId ? { ...stop, ...patch } : stop)) }),
        ),

      replaceStop: (planId, stopId, stop) =>
        patchPlan(planId, (plan) =>
          withTotals({ ...plan, stops: plan.stops.map((existing) => (existing.id === stopId ? stop : existing)) }),
        ),

      removeStop: (planId, stopId) =>
        patchPlan(planId, (plan) => withTotals({ ...plan, stops: plan.stops.filter((stop) => stop.id !== stopId) })),

      addStop: (planId, stop) => patchPlan(planId, (plan) => withTotals({ ...plan, stops: [...plan.stops, stop] })),

      removePlan: (id) =>
        mutate((draft) => ({
          ...draft,
          plans: draft.plans.filter((plan) => plan.id !== id),
          deleted: { ...draft.deleted, [id]: stamp() },
        })),

      sync,
      signIn: async (email) => {
        await cloud.sendMagicLink(email)
      },
      signOutOfCloud: async () => {
        await cloud.signOut()
        coupleId.current = null
      },
      joinWithCode: async (code) => {
        const ref = await cloud.joinCouple(code)
        coupleId.current = ref.coupleId
        const remote = await cloud.pullState(ref.coupleId)
        if (remote) {
          setState((current) => {
            const merged = mergeStates(current, remote)
            lastRemote.current = JSON.stringify(shareableState(merged))
            return merged
          })
        }
        setSync((s) => ({ ...s, state: 'live', coupleId: ref.coupleId, inviteCode: ref.inviteCode, message: '' }))
      },
      importState: (incoming) => {
        setState((current) => ({ ...mergeStates(current, incoming), updatedAt: nowIso() }))
      },
    }
  }, [state, t, language, toasts, toast, dismissToast, mutate, sync])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
