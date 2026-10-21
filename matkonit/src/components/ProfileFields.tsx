import type { Diet, Profile } from '../types'
import { STORES } from '../lib/catalog'
import { DAY_SHORT } from '../lib/format'
import { Chip, Field, TagInput } from './ui'

export const DIETS: { id: Diet; label: string }[] = [
  { id: 'vegetarian', label: 'צמחוני' },
  { id: 'vegan', label: 'טבעוני' },
  { id: 'gluten-free', label: 'ללא גלוטן' },
  { id: 'dairy-free', label: 'ללא חלב' },
  { id: 'low-carb', label: 'דל פחמימות' },
  { id: 'nut-free', label: 'ללא אגוזים' },
  { id: 'kids', label: 'ידידותי לילדים' },
]

type Props = { profile: Profile; onChange: (patch: Partial<Profile>) => void }

export function HouseholdFields({ profile, onChange }: Props) {
  return (
    <>
      <Field label="כמה סועדים בארוחת ערב?">
        <div className="stepper">
          <button type="button" className="iconbtn" aria-label="פחות" onClick={() => onChange({ householdSize: Math.max(1, profile.householdSize - 1) })}>
            −
          </button>
          <span className="pill-num">{profile.householdSize}</span>
          <button type="button" className="iconbtn" aria-label="יותר" onClick={() => onChange({ householdSize: Math.min(14, profile.householdSize + 1) })}>
            +
          </button>
        </div>
      </Field>
      <Field label="עיר" hint="עוזר להתאים רשתות וסניפים באזור שלכם">
        <input className="input" value={profile.city} placeholder="למשל: חיפה" onChange={(e) => onChange({ city: e.target.value })} />
      </Field>
    </>
  )
}

export function StorePicker({ profile, onChange }: Props) {
  return (
    <div className="store-grid" role="radiogroup" aria-label="רשת שיווק">
      {STORES.map((store) => (
        <button
          key={store.id}
          type="button"
          role="radio"
          aria-checked={profile.storeId === store.id}
          className={`store-tile ${profile.storeId === store.id ? 'on' : ''}`}
          onClick={() => onChange({ storeId: store.id })}
        >
          <span className="strong">{store.name}</span>
          <span className="faint">{store.index < 0.95 ? 'זול' : store.index > 1.05 ? 'יקר' : 'בינוני'}{store.online ? ' · אונליין' : ''}</span>
        </button>
      ))}
    </div>
  )
}

export function BudgetFields({ profile, onChange }: Props) {
  return (
    <>
      <Field label={`תקציב שבועי לארוחות ערב: ₪${profile.weeklyBudget}`}>
        <input
          type="range"
          min={150}
          max={1500}
          step={25}
          value={profile.weeklyBudget}
          onChange={(e) => onChange({ weeklyBudget: Number(e.target.value) })}
          className="range"
        />
      </Field>
      <Field label="באילו ערבים מבשלים?">
        <div className="row wrap" style={{ gap: 6 }}>
          {DAY_SHORT.map((label, day) => (
            <Chip
              key={day}
              on={profile.cookingDays.includes(day)}
              onClick={() =>
                onChange({
                  cookingDays: profile.cookingDays.includes(day) ? profile.cookingDays.filter((d) => d !== day) : [...profile.cookingDays, day].sort(),
                })
              }
            >
              {label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label={`זמן הכנה מקסימלי בערב רגיל: ${profile.maxMinutes} דקות`}>
        <input type="range" min={15} max={120} step={5} value={profile.maxMinutes} onChange={(e) => onChange({ maxMinutes: Number(e.target.value) })} className="range" />
      </Field>
    </>
  )
}

export function DietFields({ profile, onChange }: Props) {
  return (
    <>
      <label className="checkline">
        <input type="checkbox" checked={profile.kosher} onChange={(e) => onChange({ kosher: e.target.checked })} />
        <span>
          <span className="strong">שומרים כשרות</span>
          <br />
          <span className="faint">בלי בשר וחלב באותה מנה, ובלי טרף</span>
        </span>
      </label>
      <Field label="העדפות">
        <div className="row wrap" style={{ gap: 6 }}>
          {DIETS.map((diet) => (
            <Chip
              key={diet.id}
              on={profile.diets.includes(diet.id)}
              onClick={() => onChange({ diets: profile.diets.includes(diet.id) ? profile.diets.filter((d) => d !== diet.id) : [...profile.diets, diet.id] })}
            >
              {diet.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="מה לא אוכלים?" hint="מצרכים שהתפריט ידלג עליהם">
        <TagInput value={profile.dislikes} onChange={(dislikes) => onChange({ dislikes })} placeholder="כוסברה, חצילים…" suggestions={['כוסברה', 'חצילים', 'פטריות', 'דגים', 'חריף']} />
      </Field>
    </>
  )
}
