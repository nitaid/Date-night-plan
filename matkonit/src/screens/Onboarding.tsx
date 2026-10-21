import { useState } from 'react'
import { useStore } from '../state/store'
import { BudgetFields, DietFields, HouseholdFields, StorePicker } from '../components/ProfileFields'
import { Button } from '../components/ui'
import { LIBRARY } from '../data/library'
import { fromLibrary } from '../lib/recipes'
import type { Profile } from '../types'

const STEPS = ['welcome', 'household', 'store', 'budget', 'diet'] as const

export default function Onboarding() {
  const { state, update } = useStore()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<Profile>(state.profile)
  const [starter, setStarter] = useState(true)
  const patch = (p: Partial<Profile>) => setProfile((current) => ({ ...current, ...p }))

  const finish = () =>
    update((s) => ({
      ...s,
      profile: { ...profile, onboarded: true },
      recipes: starter && !s.recipes.length ? LIBRARY.slice(0, 8).map(fromLibrary) : s.recipes,
    }))

  const name = STEPS[step]
  return (
    <div className="app">
      <div className="screen onboarding">
        <div className="progress" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? 'on' : ''} />
          ))}
        </div>

        {name === 'welcome' ? (
          <div className="col" style={{ gap: 16 }}>
            <div className="hero">
              <div style={{ fontSize: '3rem' }}>🍳</div>
              <h1>מתכונית</h1>
              <p className="muted">מהסרטון לצלחת, ובמחיר שידוע מראש.</p>
            </div>
            <ul className="feature-list">
              <li>
                <b>שומרים כל מתכון</b> — משתפים סרטון מטיקטוק, אינסטגרם או יוטיוב, או קישור לאתר, ומקבלים מתכון מסודר בעברית עם כמויות ושלבים.
              </li>
              <li>
                <b>ספר מתכונים אחד</b> — הכל במקום אחד, עם חיפוש, ולא בצילומי מסך שהולכים לאיבוד.
              </li>
              <li>
                <b>תפריט שבועי בתקציב</b> — בוחרים רשת, תקציב וערבים, ומקבלים שבוע ארוחות ורשימת קניות מתומחרת.
              </li>
              <li>
                <b>מצב בישול</b> — שלב אחרי שלב, עם טיימרים, ובלי שהמסך ייכבה לכם באמצע.
              </li>
            </ul>
          </div>
        ) : null}

        {name === 'household' ? (
          <div className="col" style={{ gap: 16 }}>
            <h2>מי אוכל אצלכם?</h2>
            <HouseholdFields profile={profile} onChange={patch} />
          </div>
        ) : null}

        {name === 'store' ? (
          <div className="col" style={{ gap: 16 }}>
            <h2>איפה אתם עושים קניות?</h2>
            <p className="muted">רשימת הקניות תתומחר לפי הרשת שתבחרו. אפשר להשוות לרשתות אחרות בכל רגע.</p>
            <StorePicker profile={profile} onChange={patch} />
          </div>
        ) : null}

        {name === 'budget' ? (
          <div className="col" style={{ gap: 16 }}>
            <h2>תקציב וזמנים</h2>
            <BudgetFields profile={profile} onChange={patch} />
          </div>
        ) : null}

        {name === 'diet' ? (
          <div className="col" style={{ gap: 16 }}>
            <h2>העדפות אוכל</h2>
            <DietFields profile={profile} onChange={patch} />
            <label className="checkline">
              <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
              <span>להתחיל עם 8 מתכונים ישראליים קלאסיים בספר המתכונים</span>
            </label>
          </div>
        ) : null}

        <div className="spacer" />
        <div className="row">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              חזרה
            </Button>
          ) : null}
          <Button variant="primary" block onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))} disabled={name === 'budget' && !profile.cookingDays.length}>
            {step === 0 ? 'בואו נתחיל' : step === STEPS.length - 1 ? 'סיום' : 'המשך'}
          </Button>
        </div>
      </div>
    </div>
  )
}
