import { useCallback, useEffect, useState } from 'react'
import { useStore } from './state/store'
import { Home } from './screens/Home'
import { Ideas } from './screens/Ideas'
import { Planner } from './screens/Planner'
import { Nights } from './screens/Nights'
import { PlanDetail } from './screens/PlanDetail'
import { Settings } from './screens/Settings'
import { Onboarding } from './screens/Onboarding'
import { Toasts } from './components/ui'

type Tab = 'home' | 'ideas' | 'plan' | 'nights' | 'settings'

const TABS: { id: Tab; glyph: string; label: string }[] = [
  { id: 'home', glyph: '🏠', label: 'Home' },
  { id: 'ideas', glyph: '💡', label: 'Ideas' },
  { id: 'plan', glyph: '✨', label: 'Plan' },
  { id: 'nights', glyph: '🗓️', label: 'Nights' },
  { id: 'settings', glyph: '⚙️', label: 'Us' },
]

export default function App() {
  const { t, state, toasts, dismissToast } = useStore()
  const [tab, setTab] = useState<Tab>('home')
  const [openPlanId, setOpenPlanId] = useState<string | null>(null)
  const [seedTheme, setSeedTheme] = useState<string | null>(null)

  // Deep-link a plan straight into the Planner from anywhere in the app.
  const planWith = useCallback((theme: string) => {
    setSeedTheme(theme)
    setOpenPlanId(null)
    setTab('plan')
  }, [])

  const openPlan = useCallback((id: string) => {
    setOpenPlanId(id)
    setTab('nights')
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, openPlanId])

  if (!state.profile.onboarded) {
    return (
      <div className="app">
        <Onboarding />
        <Toasts toasts={toasts} onDismiss={dismissToast} />
      </div>
    )
  }

  return (
    <div className="app">
      {tab === 'home' ? <Home onOpenPlan={openPlan} onPlanWith={planWith} onGoIdeas={() => setTab('ideas')} /> : null}
      {tab === 'ideas' ? <Ideas onPlanWith={planWith} /> : null}
      {tab === 'plan' ? <Planner key={seedTheme ?? 'blank'} seedTheme={seedTheme} onOpenPlan={openPlan} /> : null}
      {tab === 'nights' ? (
        openPlanId ? (
          <PlanDetail planId={openPlanId} onBack={() => setOpenPlanId(null)} />
        ) : (
          <Nights onOpenPlan={setOpenPlanId} onPlan={() => setTab('plan')} />
        )
      ) : null}
      {tab === 'settings' ? <Settings /> : null}

      <nav className="tabbar">
        <div className="inner">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tab ${tab === item.id ? 'on' : ''}`}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => {
                if (item.id === 'plan' && tab !== 'plan') setSeedTheme(null)
                if (item.id === 'nights') setOpenPlanId(null)
                setTab(item.id)
              }}
            >
              <span className="glyph">{item.glyph}</span>
              <span>{t(item.label)}</span>
            </button>
          ))}
        </div>
      </nav>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
