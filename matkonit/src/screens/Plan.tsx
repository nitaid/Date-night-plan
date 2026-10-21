import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { go } from '../lib/router'
import { addDays, DAY_NAMES, formatMinutes, nowIso, parseDate, shekel, today, weekStartOf } from '../lib/format'
import { ApiError, aiMealPlan, aiStatus, aiSwap } from '../lib/api'
import { cookbookSummaries, defaultWeekStart, emptyPlan, fitsProfile, offlinePlan, planDates, setDay, weekDays } from '../lib/planner'
import { compareStores, planNeeds, priceList, recipeCost } from '../lib/pricing'
import { storeById } from '../lib/catalog'
import { fromLibrary, makeRecipe, totalMinutes } from '../lib/recipes'
import { LIBRARY } from '../data/library'
import { toast } from '../lib/toast'
import { RecipeThumb } from '../components/RecipeCard'
import { Button, Empty, IconButton, Segmented, Sheet } from '../components/ui'
import type { MealPlan, PlanDay, Recipe } from '../types'

export default function PlanScreen() {
  const { state, update, recipe: find } = useStore()
  const { profile, settings } = state
  const thisWeek = defaultWeekStart()
  const [weekStart, setWeekStart] = useState(state.plan && state.plan.weekStart >= weekStartOf(today()) ? state.plan.weekStart : thisWeek)
  const [busy, setBusy] = useState<string | null>(null)
  const [ai, setAi] = useState(false)
  const [picker, setPicker] = useState<PlanDay | null>(null)
  const [swapDay, setSwapDay] = useState<PlanDay | null>(null)
  const [instruction, setInstruction] = useState('')
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    aiStatus().then((s) => setAi(s.ai))
  }, [])

  const plan = state.plan?.weekStart === weekStart ? state.plan : null
  const days = weekDays(plan, weekStart, profile.householdSize)
  const store = storeById(profile.storeId)

  const needs = useMemo(() => planNeeds(plan, state.recipes, []), [plan, state.recipes])
  const priced = useMemo(() => priceList(needs, profile.storeId, state.shopping, settings), [needs, profile.storeId, state.shopping, settings])
  const cheapest = useMemo(() => (needs.length ? compareStores(needs, state.shopping, settings)[0] : null), [needs, state.shopping, settings])
  const over = priced.total - profile.weeklyBudget

  const commit = (next: MealPlan, newRecipes: Recipe[] = []) =>
    update((s) => ({
      ...s,
      plan: next,
      recipes: [...newRecipes.filter((r) => !s.recipes.some((own) => own.id === r.id)), ...s.recipes],
      // A new week means a new trolley.
      shopping: s.plan?.weekStart === next.weekStart ? s.shopping : { ...s.shopping, checked: [] },
    }))

  const generate = async () => {
    const locked = days.filter((d) => d.locked && d.recipeId)
    const dates = planDates(profile, weekStart).filter((d) => !locked.some((l) => l.date === d))
    if (!dates.length) {
      toast('אין ערבי בישול פנויים בשבוע הזה. אפשר לשנות ערבים בהגדרות.', 'error')
      return
    }
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    setBusy('week')
    try {
      if (ai) {
        const result = await aiMealPlan(
          {
            profile,
            dates,
            cookbook: cookbookSummaries(state),
            keep: locked.map((l) => ({ date: l.date, title: find(l.recipeId)?.title || '' })),
            recentTitles: state.recipes.filter((r) => r.lastCookedAt && Date.now() - Date.parse(r.lastCookedAt) < 10 * 864e5).map((r) => r.title),
          },
          ctrl.signal,
        )
        const created: Recipe[] = []
        const newDays: PlanDay[] = result.days.map((d) => {
          let recipeId = d.existingRecipeId
          if (!recipeId && d.recipe) {
            const recipe = makeRecipe(d.recipe, 'ai')
            created.push({ ...recipe, collections: ['מהתפריט השבועי'] })
            recipeId = recipe.id
          }
          return { date: d.date, recipeId, servings: profile.householdSize, locked: false }
        })
        commit({ weekStart, days: [...locked, ...newDays].sort((a, b) => a.date.localeCompare(b.date)), generatedBy: 'ai', note: result.note, updatedAt: nowIso() }, created)
        toast('התפריט מוכן', 'good')
      } else {
        const result = offlinePlan(state, weekStart, locked)
        commit(
          { weekStart, days: [...locked, ...result.days].sort((a, b) => a.date.localeCompare(b.date)), generatedBy: 'offline', note: '', updatedAt: nowIso() },
          result.newRecipes,
        )
        toast('התפריט מוכן (מתכנן מובנה, בלי AI)', 'good')
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      // The AI path failed — never leave the family without dinners.
      const result = offlinePlan(state, weekStart, locked)
      commit({ weekStart, days: [...locked, ...result.days].sort((a, b) => a.date.localeCompare(b.date)), generatedBy: 'offline', note: '', updatedAt: nowIso() }, result.newRecipes)
      toast(`${e instanceof ApiError ? e.message : 'ה-AI לא זמין'} — בנינו תפריט מהספרייה המובנית.`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const putDay = (day: PlanDay, newRecipes: Recipe[] = []) => commit(setDay(state.plan, weekStart, day), newRecipes)

  const swap = async (day: PlanDay) => {
    setSwapDay(null)
    setBusy(day.date)
    const current = find(day.recipeId)
    const others = days.filter((d) => d.date !== day.date && d.recipeId).map((d) => find(d.recipeId)?.title || '')
    try {
      if (!ai) throw new ApiError('offline', 'no_key')
      const result = await aiSwap({ profile, date: day.date, current: current?.title, others, instruction })
      const recipe = { ...makeRecipe(result.recipe, 'ai'), collections: ['מהתפריט השבועי'] }
      putDay({ ...day, recipeId: recipe.id, locked: false }, [recipe])
    } catch (e) {
      // Offline swap: the cheapest-fitting recipe not already on the menu.
      const used = new Set(days.map((d) => d.recipeId))
      const pool = [...state.recipes, ...LIBRARY.map(fromLibrary).filter((l) => !state.recipes.some((r) => r.id === l.id))]
        .filter((r) => !used.has(r.id) && fitsProfile(r, profile))
        .sort(() => Math.random() - 0.5)
      const pick = pool[0]
      if (pick) putDay({ ...day, recipeId: pick.id, locked: false }, [pick])
      if (ai && !(e instanceof ApiError && e.code === 'no_key')) toast('ה-AI לא זמין, הוחלף ממתכון קיים', 'error')
    } finally {
      setInstruction('')
      setBusy(null)
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>התפריט השבועי</h1>
        <p className="sub">
          {profile.householdSize} סועדים · {store.name} · תקציב {shekel(profile.weeklyBudget)}
        </p>
      </header>

      <Segmented
        value={weekStart}
        onChange={setWeekStart}
        options={[
          { value: weekStartOf(today()), label: 'השבוע' },
          { value: addDays(weekStartOf(today()), 7), label: 'שבוע הבא' },
        ]}
      />

      <section className={`card budget ${over > 0 ? 'over' : ''}`}>
        <div className="row between">
          <div>
            <div className="faint">סל הקניות ב{store.name}</div>
            <div className="big-num">{shekel(priced.total)}</div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div className="faint">{over > 0 ? 'מעל התקציב' : 'נשאר בתקציב'}</div>
            <div className={`strong ${over > 0 ? 'bad' : 'good-ink'}`}>{shekel(Math.abs(over))}</div>
          </div>
        </div>
        <div className="meter" aria-hidden>
          <span style={{ width: `${Math.min(100, (priced.total / Math.max(1, profile.weeklyBudget)) * 100)}%` }} />
        </div>
        <div className="faint">
          {priced.saved ? `${shekel(priced.saved)} לא נספרו כי זה כבר בבית · ` : ''}
          {priced.unpriced ? `${priced.unpriced} פריטים בלי מחיר · ` : ''}
          {cheapest && cheapest.store.id !== store.id && cheapest.total < priced.total - 5 ? `ב${cheapest.store.name} זה ${shekel(cheapest.total)}` : 'מחירים משוערים'}
        </div>
      </section>

      {plan?.note ? <div className="banner">💡 {plan.note}</div> : null}
      {plan?.days.some((d) => d.locked) ? <p className="faint tiny">ימים נעולים 🔒 נשארים כשבונים תפריט חדש.</p> : null}

      {busy === 'week' ? (
        <div className="card thinking">
          <div className="pulse">🗓️</div>
          <p className="strong">{ai ? 'בונים תפריט ובודקים מחירים…' : 'בונים תפריט…'}</p>
          <p className="faint">{ai ? 'עד דקה או שתיים — מתכננים מנות, מנצלים מצרכים בין ימים ושומרים על התקציב' : ''}</p>
          <Button variant="ghost" onClick={() => controller.current?.abort()}>
            ביטול
          </Button>
        </div>
      ) : (
        <div className="row">
          <Button variant="primary" block onClick={generate}>
            {plan?.days.length ? '🔄 תפריט חדש' : '✨ בניית תפריט לשבוע'}
          </Button>
          {plan?.days.length ? (
            <Button onClick={() => go('list')}>🛒 לרשימה</Button>
          ) : null}
        </div>
      )}

      <div className="col" style={{ gap: 10 }}>
        {days.map((day) => {
          const recipe = find(day.recipeId)
          const dow = parseDate(day.date).getDay()
          const past = day.date < today()
          const cooking = profile.cookingDays.includes(dow)
          if (!recipe && (!cooking || past)) {
            return (
              <div key={day.date} className="day-row off">
                <span className="day-label">
                  {DAY_NAMES[dow]} <span className="faint">{parseDate(day.date).getDate()}/{parseDate(day.date).getMonth() + 1}</span>
                </span>
                <span className="faint grow">{past ? 'עבר' : 'לא מבשלים'}</span>
                {!past ? (
                  <Button size="small" variant="ghost" onClick={() => setPicker(day)}>
                    + הוספה
                  </Button>
                ) : null}
              </div>
            )
          }
          return (
            <div key={day.date} className={`card tight day-card ${day.locked ? 'locked' : ''}`}>
              <div className="row between">
                <span className="day-label">
                  {DAY_NAMES[dow]} <span className="faint">{parseDate(day.date).getDate()}/{parseDate(day.date).getMonth() + 1}</span>
                </span>
                {recipe ? (
                  <div className="row" style={{ gap: 2 }}>
                    <IconButton label={day.locked ? 'שחרור נעילה' : 'נעילה'} on={day.locked} onClick={() => putDay({ ...day, locked: !day.locked })}>
                      {day.locked ? '🔒' : '🔓'}
                    </IconButton>
                    <IconButton label="החלפה" onClick={() => setSwapDay(day)} disabled={busy === day.date}>
                      {busy === day.date ? <span className="spinner" /> : '🔄'}
                    </IconButton>
                    <IconButton label="הסרה" onClick={() => putDay({ ...day, recipeId: null, locked: false })}>
                      ✕
                    </IconButton>
                  </div>
                ) : null}
              </div>
              {recipe ? (
                <div className="row" style={{ cursor: 'pointer' }} onClick={() => go('recipe', recipe.id)}>
                  <RecipeThumb recipe={recipe} size="row" />
                  <div className="grow">
                    <div className="strong clamp2">{recipe.title}</div>
                    <div className="faint">
                      {formatMinutes(totalMinutes(recipe))} · {shekel(recipeCost(recipe, day.servings, profile.storeId, settings.priceOverrides).total)} ל-{day.servings}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row">
                  <span className="faint grow">עוד לא נבחר</span>
                  <Button size="small" onClick={() => setPicker(day)}>
                    בחירה מהספר
                  </Button>
                </div>
              )}
              {recipe ? (
                <div className="row between">
                  <div className="stepper small">
                    <button type="button" className="iconbtn" aria-label="פחות סועדים" onClick={() => putDay({ ...day, servings: Math.max(1, day.servings - 1) })}>
                      −
                    </button>
                    <span className="faint">{day.servings} סועדים</span>
                    <button type="button" className="iconbtn" aria-label="יותר סועדים" onClick={() => putDay({ ...day, servings: day.servings + 1 })}>
                      +
                    </button>
                  </div>
                  <Button size="small" variant="ghost" onClick={() => setPicker(day)}>
                    בחירה אחרת
                  </Button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {!plan?.days.length && !busy ? (
        <Empty glyph="🍽️" title="עוד אין תפריט לשבוע הזה" body="לחצו על 'בניית תפריט' ונבנה שבוע ארוחות ערב בתקציב שלכם, או בחרו מתכונים לכל יום בעצמכם." />
      ) : null}

      {plan?.days.length ? (
        <Button variant="ghost" onClick={() => confirm('לנקות את כל התפריט של השבוע?') && commit(emptyPlan(weekStart))}>
          ניקוי התפריט
        </Button>
      ) : null}

      {picker ? (
        <Sheet title={`מה אוכלים ביום ${DAY_NAMES[parseDate(picker.date).getDay()]}?`} onClose={() => setPicker(null)}>
          <div className="col" style={{ gap: 6 }}>
            {!state.recipes.length ? <p className="muted">ספר המתכונים ריק. הוסיפו מתכונים או בנו תפריט אוטומטי.</p> : null}
            {[...state.recipes]
              .sort((a, b) => Number(b.favorite) - Number(a.favorite))
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="list-button"
                  onClick={() => {
                    putDay({ ...picker, recipeId: r.id, servings: picker.servings || profile.householdSize })
                    setPicker(null)
                  }}
                >
                  <span className="strong truncate">
                    {r.favorite ? '♥ ' : ''}
                    {r.title}
                  </span>
                  <span className="faint">
                    {formatMinutes(totalMinutes(r))} · {shekel(recipeCost(r, profile.householdSize, profile.storeId, settings.priceOverrides).total)}
                  </span>
                </button>
              ))}
          </div>
        </Sheet>
      ) : null}

      {swapDay ? (
        <Sheet title="להחליף את המנה?" onClose={() => setSwapDay(null)}>
          <div className="col">
            {ai ? (
              <input className="input" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="משהו מסוים? (צמחוני, דג, מהיר יותר…)" autoFocus />
            ) : (
              <p className="muted">נחליף במתכון אחר מהספר או מהספרייה המובנית.</p>
            )}
            <Button variant="primary" block onClick={() => swap(swapDay)}>
              🔄 החלפה
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}
