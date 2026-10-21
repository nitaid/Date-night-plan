import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { aiStatus } from '../lib/api'
import { exportBackup, hydrate } from '../lib/storage'
import { CATALOG_BY_ID } from '../lib/catalog'
import { shekel } from '../lib/format'
import { toast } from '../lib/toast'
import { BudgetFields, DietFields, HouseholdFields, StorePicker } from '../components/ProfileFields'
import { Button, Segmented } from '../components/ui'
import type { Profile } from '../types'

export default function Settings() {
  const { state, update, saveFailed } = useStore()
  const [status, setStatus] = useState<{ ai: boolean; model?: string; reachable: boolean } | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const patch = (p: Partial<Profile>) => update((s) => ({ ...s, profile: { ...s.profile, ...p } }))

  useEffect(() => {
    aiStatus().then(setStatus)
  }, [])

  const overrides = Object.entries(state.settings.priceOverrides)

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>הגדרות</h1>
      </header>

      {saveFailed ? <div className="banner error">הזיכרון של הדפדפן מלא — שינויים אחרונים לא נשמרו. כדאי לייצא גיבוי.</div> : null}

      <section className="card">
        <h2>משק הבית</h2>
        <HouseholdFields profile={state.profile} onChange={patch} />
      </section>

      <section className="card">
        <h2>הסופר שלי</h2>
        <StorePicker profile={state.profile} onChange={patch} />
      </section>

      <section className="card">
        <h2>תקציב וזמנים</h2>
        <BudgetFields profile={state.profile} onChange={patch} />
      </section>

      <section className="card">
        <h2>תזונה וכשרות</h2>
        <DietFields profile={state.profile} onChange={patch} />
      </section>

      {overrides.length ? (
        <section className="card">
          <h2>מחירים שתיקנתם</h2>
          {overrides.map(([id, price]) => (
            <div key={id} className="row between">
              <span>{CATALOG_BY_ID.get(id)?.name || id}</span>
              <span className="row" style={{ gap: 8 }}>
                <span className="mono">{shekel(price, 1)}</span>
                <Button
                  size="small"
                  variant="ghost"
                  onClick={() =>
                    update((s) => {
                      const { [id]: _removed, ...rest } = s.settings.priceOverrides
                      return { ...s, settings: { ...s.settings, priceOverrides: rest } }
                    })
                  }
                >
                  איפוס
                </Button>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="card">
        <h2>תצוגה</h2>
        <Segmented
          value={state.settings.theme}
          onChange={(theme) => update((s) => ({ ...s, settings: { ...s.settings, theme } }))}
          options={[
            { value: 'system', label: 'אוטומטי' },
            { value: 'light', label: 'בהיר' },
            { value: 'dark', label: 'כהה' },
          ]}
        />
      </section>

      <section className="card">
        <h2>AI</h2>
        {status == null ? (
          <p className="muted">בודקים…</p>
        ) : status.ai ? (
          <div className="banner good">מחובר. ייבוא מסרטונים, מצילומים, יצירת מתכונים ותפריט חכם פעילים.</div>
        ) : status.reachable ? (
          <div className="banner">
            לא הוגדר מפתח AI בשרת. עובד בלעדיו: ייבוא מאתרי מתכונים, הזנה ידנית, ספריית המתכונים, תכנון תפריט מובנה ורשימת קניות. להפעלה: ANTHROPIC_API_KEY בקובץ .env.
          </div>
        ) : (
          <div className="banner">אין חיבור לשרת. ספר המתכונים, התפריט ורשימת הקניות עובדים גם בלי אינטרנט.</div>
        )}
      </section>

      <section className="card">
        <h2>גיבוי</h2>
        <p className="muted">הכל נשמר במכשיר הזה. כדאי לייצא גיבוי מדי פעם או כדי לעבור לטלפון אחר.</p>
        <div className="row">
          <Button block onClick={() => exportBackup(state)}>
            ⬇️ ייצוא
          </Button>
          <Button block onClick={() => file.current?.click()}>
            ⬆️ שחזור
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                const restored = hydrate(JSON.parse(await f.text()))
                if (!confirm(`לשחזר ${restored.recipes.length} מתכונים? זה יחליף את מה שיש עכשיו.`)) return
                update(() => restored)
                toast('הגיבוי שוחזר', 'good')
              } catch {
                toast('הקובץ לא נראה כמו גיבוי של מתכונית', 'error')
              }
            }}
          />
        </div>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm('למחוק את כל המתכונים, התפריט והרשימה? אי אפשר לבטל.')) {
              localStorage.clear()
              location.reload()
            }
          }}
        >
          מחיקת כל הנתונים
        </Button>
      </section>

      <p className="faint center tiny">המחירים הם הערכה לפי רמת המחירים של כל רשת, לא מחירון רשמי.</p>
    </div>
  )
}
