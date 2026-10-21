import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { back, go } from '../lib/router'
import { formatDay, formatMinutes, formatQty, nowIso, shekel, today, uid } from '../lib/format'
import { DIFFICULTY_LABEL, KASHRUT_LABEL, SOURCE_LABEL, recipeToText, scaleFactor, totalMinutes } from '../lib/recipes'
import { recipeCost } from '../lib/pricing'
import { storeById } from '../lib/catalog'
import { defaultWeekStart, setDay, weekDays } from '../lib/planner'
import { shareText } from '../lib/share'
import { toast } from '../lib/toast'
import { RecipeThumb } from '../components/RecipeCard'
import { Button, Chip, Empty, IconButton, Sheet, Stars, TagInput } from '../components/ui'
import type { Ingredient } from '../types'

export function ingredientText(ing: Ingredient, factor: number) {
  if (ing.qty == null) return ing.unit === 'לפי הטעם' ? '' : ing.unit
  const unit = ing.unit === "יח'" ? '' : ing.unit
  return `${formatQty(ing.qty * factor)} ${unit}`.trim()
}

export default function RecipeDetail({ id }: { id: string }) {
  const { state, recipe: find, patchRecipe, deleteRecipe, update } = useStore()
  const recipe = find(id)
  const [servings, setServings] = useState(recipe?.servings || state.profile.householdSize)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [sheet, setSheet] = useState<null | 'plan' | 'more'>(null)

  const cost = useMemo(
    () => (recipe ? recipeCost(recipe, servings, state.profile.storeId, state.settings.priceOverrides) : null),
    [recipe, servings, state.profile.storeId, state.settings.priceOverrides],
  )

  if (!recipe) {
    return (
      <div className="screen">
        <Empty glyph="🫥" title="המתכון לא נמצא" action={<Button onClick={() => go('')}>לספר המתכונים</Button>} />
      </div>
    )
  }

  const factor = scaleFactor(recipe, servings)
  const groups = [...new Set(recipe.ingredients.map((i) => i.group))]
  const weekStart = state.plan && state.plan.weekStart >= defaultWeekStart() ? state.plan.weekStart : defaultWeekStart()
  const store = storeById(state.profile.storeId)

  const addToList = () => {
    update((s) => ({
      ...s,
      shopping: {
        ...s.shopping,
        extras: [
          ...s.shopping.extras,
          ...recipe.ingredients.map((i) => ({ id: uid('x_'), name: i.name, qty: i.qty == null ? null : i.qty * factor, unit: i.unit, catalogId: i.catalogId })),
        ],
      },
    }))
    toast('המצרכים נוספו לרשימת הקניות', 'good')
  }

  const remove = () => {
    if (!confirm(`למחוק את "${recipe.title}"?`)) return
    deleteRecipe(recipe.id)
    go('')
  }

  return (
    <div className="screen recipe-page">
      <div className="row between">
        <IconButton label="חזרה" onClick={() => back('')}>
          →
        </IconButton>
        <div className="row" style={{ gap: 6 }}>
          <IconButton label={recipe.favorite ? 'הסרה מהמועדפים' : 'הוספה למועדפים'} on={recipe.favorite} onClick={() => patchRecipe(recipe.id, { favorite: !recipe.favorite })}>
            {recipe.favorite ? '♥' : '♡'}
          </IconButton>
          <IconButton label="שיתוף" onClick={() => shareText(recipe.title, recipeToText(recipe, servings))}>
            ⤴
          </IconButton>
          <IconButton label="עריכה" onClick={() => go('edit', recipe.id)}>
            ✎
          </IconButton>
          <IconButton label="עוד" onClick={() => setSheet('more')}>
            ⋯
          </IconButton>
        </div>
      </div>

      <RecipeThumb recipe={recipe} size="hero" />

      <header className="col" style={{ gap: 8 }}>
        <h1>{recipe.title}</h1>
        {recipe.description ? <p className="muted">{recipe.description}</p> : null}
        <div className="row wrap" style={{ gap: 6 }}>
          <Chip>{KASHRUT_LABEL[recipe.kashrut]}</Chip>
          <Chip>⏱ {formatMinutes(totalMinutes(recipe))}</Chip>
          <Chip>{DIFFICULTY_LABEL[recipe.difficulty]}</Chip>
          {recipe.caloriesPerServing ? <Chip>{recipe.caloriesPerServing} קק"ל למנה</Chip> : null}
          {recipe.tags.map((tag) => (
            <Chip key={tag} tone="plain">
              {tag}
            </Chip>
          ))}
        </div>
        <div className="faint">
          {SOURCE_LABEL[recipe.source]}
          {recipe.author ? ` · ${recipe.author}` : ''}
          {recipe.sourceUrl ? (
            <>
              {' · '}
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer noopener">
                למקור
              </a>
            </>
          ) : null}
        </div>
      </header>

      <div className="row">
        <Button variant="primary" block onClick={() => go('cook', recipe.id)}>
          👩‍🍳 מצב בישול
        </Button>
        <Button block onClick={() => setSheet('plan')}>
          🗓️ לתפריט
        </Button>
      </div>

      <section className="card">
        <div className="row between">
          <h2>מצרכים</h2>
          <div className="stepper">
            <button type="button" className="iconbtn" aria-label="פחות מנות" onClick={() => setServings(Math.max(1, servings - 1))}>
              −
            </button>
            <span className="pill-num">{servings} מנות</span>
            <button type="button" className="iconbtn" aria-label="יותר מנות" onClick={() => setServings(servings + 1)}>
              +
            </button>
          </div>
        </div>
        {groups.map((group) => (
          <div key={group || 'main'} className="col" style={{ gap: 0 }}>
            {group ? <h3 className="group-title">{group}</h3> : null}
            {recipe.ingredients
              .filter((i) => i.group === group)
              .map((ing) => (
                <label key={ing.id} className={`checkline ingredient ${checked.has(ing.id) ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked.has(ing.id)}
                    onChange={() =>
                      setChecked((set) => {
                        const next = new Set(set)
                        if (next.has(ing.id)) next.delete(ing.id)
                        else next.add(ing.id)
                        return next
                      })
                    }
                  />
                  <span className="grow">
                    <span className="qty">{ingredientText(ing, factor)}</span> {ing.name}
                    {ing.note ? <span className="faint"> · {ing.note}</span> : null}
                    {ing.qty == null && ing.unit === 'לפי הטעם' ? <span className="faint"> · לפי הטעם</span> : null}
                  </span>
                </label>
              ))}
          </div>
        ))}
        {cost && cost.total > 0 ? (
          <div className="cost-line">
            ≈ {shekel(cost.total)} ב{store.name} · {shekel(cost.perServing, 1)} למנה
            {cost.unpriced ? <span className="faint"> (בלי {cost.unpriced} מצרכים ללא מחיר)</span> : null}
          </div>
        ) : null}
        <Button size="small" onClick={addToList}>
          + הוספת המצרכים לרשימת הקניות
        </Button>
      </section>

      <section className="card">
        <h2>אופן ההכנה</h2>
        <ol className="steps">
          {recipe.steps.map((step, n) => (
            <li key={n}>{step}</li>
          ))}
        </ol>
        {!recipe.steps.length ? <p className="muted">אין שלבים. אפשר להוסיף בעריכה.</p> : null}
      </section>

      {recipe.tips.length ? (
        <section className="card accent">
          <h2>טיפים</h2>
          <ul className="tips">
            {recipe.tips.map((tip, n) => (
              <li key={n}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <h2>שלי</h2>
        <div className="row between">
          <span className="muted">{recipe.cookedCount ? `בישלתם ${recipe.cookedCount} פעמים` : 'עוד לא בישלתם'}</span>
          <Stars value={recipe.rating} onChange={(rating) => patchRecipe(recipe.id, { rating })} />
        </div>
        <textarea className="textarea" placeholder="הערות: פחות מלח, כפול רוטב…" value={recipe.notes} onChange={(e) => patchRecipe(recipe.id, { notes: e.target.value })} />
        <TagInput value={recipe.collections} onChange={(collections) => patchRecipe(recipe.id, { collections })} placeholder="הוספה לאוסף (שבת, ארוחות ילדים…)" />
        <Button size="small" onClick={() => patchRecipe(recipe.id, { cookedCount: recipe.cookedCount + 1, lastCookedAt: nowIso() })}>
          ✓ בישלתי היום
        </Button>
      </section>

      {sheet === 'plan' ? (
        <Sheet title="הוספה לתפריט" onClose={() => setSheet(null)}>
          <div className="col" style={{ gap: 6 }}>
            {weekDays(state.plan?.weekStart === weekStart ? state.plan : null, weekStart, state.profile.householdSize)
              .filter((d) => d.date >= today())
              .map((day) => {
                const current = find(day.recipeId)
                return (
                  <button
                    key={day.date}
                    type="button"
                    className="list-button"
                    onClick={() => {
                      update((s) => ({ ...s, plan: setDay(s.plan, weekStart, { ...day, recipeId: recipe.id, servings: s.profile.householdSize }) }))
                      setSheet(null)
                      toast(`נוסף ל${formatDay(day.date)}`, 'good')
                    }}
                  >
                    <span className="strong">{formatDay(day.date)}</span>
                    <span className="faint truncate">{current ? `במקום: ${current.title}` : 'פנוי'}</span>
                  </button>
                )
              })}
          </div>
        </Sheet>
      ) : null}

      {sheet === 'more' ? (
        <Sheet title={recipe.title} onClose={() => setSheet(null)}>
          <div className="col">
            <Button block onClick={() => navigator.clipboard?.writeText(recipeToText(recipe, servings)).then(() => toast('המתכון הועתק', 'good'))}>
              העתקת המתכון
            </Button>
            <Button block onClick={() => window.print()}>
              הדפסה
            </Button>
            <Button block variant="danger" onClick={remove}>
              מחיקת המתכון
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}
