import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { go, takeSharedPayload, useRoute } from './lib/router'
import { onToast } from './lib/toast'
import { Toasts } from './components/ui'
import Cookbook from './screens/Cookbook'
import RecipeDetail from './screens/RecipeDetail'
import RecipeEditor from './screens/RecipeEditor'
import CookMode from './screens/CookMode'
import ImportScreen from './screens/Import'
import PlanScreen from './screens/Plan'
import ShoppingList from './screens/ShoppingList'
import Settings from './screens/Settings'
import Onboarding from './screens/Onboarding'

const TABS = [
  { id: '', label: 'מתכונים', glyph: '📖' },
  { id: 'plan', label: 'תפריט', glyph: '🗓️' },
  { id: 'import', label: 'הוספה', glyph: '＋', primary: true },
  { id: 'list', label: 'קניות', glyph: '🛒' },
  { id: 'settings', label: 'הגדרות', glyph: '⚙️' },
]

export default function App() {
  const { state } = useStore()
  const route = useRoute()
  const [shared] = useState(takeSharedPayload)
  const [toasts, setToasts] = useState<{ id: string; message: string; tone: string }[]>([])

  useEffect(
    () =>
      onToast((item) => {
        setToasts((list) => [...list, item])
        setTimeout(() => setToasts((list) => list.filter((t) => t.id !== item.id)), 4200)
      }),
    [],
  )

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      root.dataset.theme = state.settings.theme
      root.classList.toggle('prefers-dark', media.matches)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [state.settings.theme])

  const [page, id] = route
  if (!state.profile.onboarded && !shared && page !== 'import') return <Onboarding />

  if (page === 'cook' && id) return <CookMode id={id} />

  let screen
  if (page === 'recipe' && id) screen = <RecipeDetail id={id} />
  else if (page === 'edit') screen = <RecipeEditor id={id} />
  else if (page === 'import') screen = <ImportScreen shared={shared} />
  else if (page === 'plan') screen = <PlanScreen />
  else if (page === 'list') screen = <ShoppingList />
  else if (page === 'settings') screen = <Settings />
  else screen = <Cookbook />

  const active = page === 'recipe' || page === 'edit' ? '' : page || ''

  return (
    <div className="app">
      <main key={route.join('/')}>{screen}</main>
      <nav className="tabbar" aria-label="ניווט ראשי">
        <div className="inner">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab ${active === tab.id ? 'on' : ''} ${tab.primary ? 'primary' : ''}`}
              aria-current={active === tab.id ? 'page' : undefined}
              onClick={() => go(tab.id)}
            >
              <span className="glyph" aria-hidden>
                {tab.glyph}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <Toasts toasts={toasts} onDismiss={(tid) => setToasts((list) => list.filter((t) => t.id !== tid))} />
    </div>
  )
}
