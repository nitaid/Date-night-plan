import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { go } from '../lib/router'
import { CATALOG_BY_ID, CATEGORIES, STORES, matchCatalog, packLabel, storeById } from '../lib/catalog'
import { compareStores, isHave, planNeeds, priceList, type ListLine } from '../lib/pricing'
import { parseIngredientLine } from '../lib/ingredientLine.js'
import { formatDay, shekel, uid } from '../lib/format'
import { copyText, shareText } from '../lib/share'
import { Button, Empty, IconButton, Sheet } from '../components/ui'
import type { Shopping } from '../types'

const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key])

export default function ShoppingList() {
  const { state, update } = useStore()
  const { profile, settings, shopping, plan } = state
  const [draft, setDraft] = useState('')
  const [showCompare, setShowCompare] = useState(false)
  const [showHave, setShowHave] = useState(false)
  const [editing, setEditing] = useState<ListLine | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const store = storeById(profile.storeId)

  const needs = useMemo(() => planNeeds(plan, state.recipes, shopping.extras), [plan, state.recipes, shopping.extras])
  const priced = useMemo(() => priceList(needs, profile.storeId, shopping, settings), [needs, profile.storeId, shopping, settings])
  const comparison = useMemo(() => (showCompare ? compareStores(needs, shopping, settings) : []), [showCompare, needs, shopping, settings])

  const setShopping = (change: (s: Shopping) => Shopping) => update((st) => ({ ...st, shopping: change(st.shopping) }))

  const toBuy = priced.lines.filter((l) => !isHave(l, shopping))
  const atHome = priced.lines.filter((l) => isHave(l, shopping))
  const remaining = toBuy.filter((l) => !shopping.checked.includes(l.key))

  const setHave = (line: ListLine, have: boolean) =>
    setShopping((s) => {
      if (line.staple && !line.extra) return { ...s, need: have ? s.need.filter((k) => k !== line.key) : [...new Set([...s.need, line.key])], have: s.have.filter((k) => k !== line.key) }
      return { ...s, have: have ? [...new Set([...s.have, line.key])] : s.have.filter((k) => k !== line.key) }
    })

  const addExtra = () => {
    const text = draft.trim()
    if (!text) return
    const parsed = parseIngredientLine(text)
    const hasQty = parsed.qty != null
    setShopping((s) => ({
      ...s,
      extras: [...s.extras, { id: uid('x_'), name: parsed.name, qty: hasQty ? parsed.qty : 1, unit: hasQty ? parsed.unit : 'חבילה', catalogId: matchCatalog(parsed.name) }],
    }))
    setDraft('')
  }

  const listText = () => {
    const lines = [`🛒 רשימת קניות — ${store.name}`, '']
    for (const cat of CATEGORIES) {
      const items = toBuy.filter((l) => l.cat === cat.id)
      if (!items.length) continue
      lines.push(`${cat.glyph} ${cat.label}`)
      for (const l of items) lines.push(`${shopping.checked.includes(l.key) ? '✅' : '⬜'} ${l.name} — ${l.amountText}${l.price != null ? ` (${shekel(l.price)})` : ''}`)
      lines.push('')
    }
    lines.push(`סה"כ משוער: ${shekel(priced.total)}`)
    return lines.join('\n')
  }

  const planDays = plan?.days.filter((d) => d.recipeId) || []

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>רשימת קניות</h1>
        <p className="sub">{planDays.length ? `ל-${planDays.length} ארוחות · מ${formatDay(planDays[0].date)}` : 'מצרכים מהתפריט ופריטים שהוספתם'}</p>
      </header>

      <section className="card budget">
        <div className="row between">
          <div>
            <label className="faint" htmlFor="store-select">
              מחיר משוער ב
            </label>
            <select
              id="store-select"
              className="select inline"
              value={profile.storeId}
              onChange={(e) => update((s) => ({ ...s, profile: { ...s.profile, storeId: e.target.value } }))}
            >
              {STORES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="big-num">{shekel(priced.total)}</div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div className="faint">נשארו</div>
            <div className="strong">
              {remaining.length} מתוך {toBuy.length}
            </div>
          </div>
        </div>
        <div className="faint">
          {priced.saved ? `${shekel(priced.saved)} לא נספרו — מוצרים שכבר יש בבית. ` : ''}
          {priced.unpriced ? `${priced.unpriced} פריטים בלי מחיר. ` : ''}
          המחיר לפי אריזות שלמות.
        </div>
        <Button size="small" variant="ghost" onClick={() => setShowCompare(!showCompare)}>
          {showCompare ? 'הסתרת ההשוואה' : '⚖️ השוואה בין רשתות'}
        </Button>
        {showCompare ? (
          <div className="compare">
            {comparison.map(({ store: s, total }, i) => (
              <button
                key={s.id}
                type="button"
                className={`compare-row ${s.id === store.id ? 'on' : ''}`}
                onClick={() => update((st) => ({ ...st, profile: { ...st.profile, storeId: s.id } }))}
              >
                <span>
                  {i === 0 ? '🏆 ' : ''}
                  {s.name}
                </span>
                <span className="mono">{shekel(total)}</span>
              </button>
            ))}
            <p className="faint tiny">הערכה לפי רמת מחירים ממוצעת של כל רשת. מחירים בסניף ובמבצעים משתנים — אפשר לתקן מחיר של כל פריט בלחיצה עליו.</p>
          </div>
        ) : null}
      </section>

      <form
        className="themebox"
        onSubmit={(e) => {
          e.preventDefault()
          addExtra()
        }}
      >
        <span aria-hidden>➕</span>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="הוספת פריט: חלב, 2 ק״ג תפוחים…" aria-label="הוספת פריט" />
        {draft ? (
          <Button size="small" variant="primary" type="submit">
            הוספה
          </Button>
        ) : null}
      </form>

      {!priced.lines.length ? (
        <Empty
          glyph="🧺"
          title="הרשימה ריקה"
          body="בנו תפריט שבועי והמצרכים יופיעו כאן אוטומטית, מסודרים לפי מחלקות בסופר."
          action={
            <Button variant="primary" onClick={() => go('plan')}>
              לתפריט השבועי
            </Button>
          }
        />
      ) : null}

      {CATEGORIES.map((cat) => {
        const lines = toBuy.filter((l) => l.cat === cat.id)
        if (!lines.length) return null
        return (
          <section key={cat.id} className="col" style={{ gap: 4 }}>
            <h3 className="aisle">
              {cat.glyph} {cat.label}
            </h3>
            {lines.map((line) => {
              const done = shopping.checked.includes(line.key)
              const item = line.catalogId ? CATALOG_BY_ID.get(line.catalogId) : undefined
              return (
                <div key={line.key} className={`list-line ${done ? 'done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={done}
                    aria-label={line.name}
                    onChange={() => setShopping((s) => ({ ...s, checked: toggle(s.checked, line.key) }))}
                  />
                  <div className="grow" onClick={() => setShopping((s) => ({ ...s, checked: toggle(s.checked, line.key) }))}>
                    <div className="strong">{line.name}</div>
                    <div className="faint tiny">
                      {line.amountText}
                      {item ? ` · ${line.packs} × ${packLabel(item)}` : ''}
                      {line.recipes.length ? ` · ל${line.recipes.join(', ')}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="price-btn"
                    disabled={!item}
                    onClick={() => {
                      setEditing(line)
                      setPriceDraft(String(Math.round((line.packPrice || 0) * 100) / 100))
                    }}
                  >
                    {line.price != null ? shekel(line.price, line.price < 10 ? 1 : 0) : '—'}
                  </button>
                  <IconButton label="יש בבית" onClick={() => setHave(line, true)}>
                    🏠
                  </IconButton>
                </div>
              )
            })}
          </section>
        )
      })}

      {atHome.length ? (
        <section className="col" style={{ gap: 4 }}>
          <button type="button" className="aisle-toggle" onClick={() => setShowHave(!showHave)}>
            🏠 כבר יש בבית ({atHome.length}) {showHave ? '▴' : '▾'}
          </button>
          {showHave
            ? atHome.map((line) => (
                <div key={line.key} className="list-line have">
                  <div className="grow">
                    <div>{line.name}</div>
                    <div className="faint tiny">{line.amountText}</div>
                  </div>
                  <Button size="small" onClick={() => setHave(line, false)}>
                    צריך לקנות
                  </Button>
                </div>
              ))
            : null}
          <p className="faint tiny">מלח, שמן ותבלינים נחשבים "יש בבית" כברירת מחדל ולא נכנסים לסכום.</p>
        </section>
      ) : null}

      {priced.lines.length ? (
        <div className="col">
          <div className="row">
            <Button block onClick={() => shareText('רשימת קניות', listText())}>
              💬 שליחה בוואטסאפ
            </Button>
            <Button block onClick={() => copyText(listText())}>
              📋 העתקה
            </Button>
          </div>
          <div className="row">
            <Button block variant="ghost" onClick={() => setShopping((s) => ({ ...s, checked: [] }))}>
              ביטול כל הסימונים
            </Button>
            {shopping.extras.length ? (
              <Button block variant="ghost" onClick={() => setShopping((s) => ({ ...s, extras: [] }))}>
                מחיקת פריטים שהוספתי
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {editing && editing.catalogId ? (
        <Sheet title={`מחיר: ${editing.name}`} onClose={() => setEditing(null)}>
          <form
            className="col"
            onSubmit={(e) => {
              e.preventDefault()
              const value = Number(priceDraft.replace(',', '.'))
              if (!(value > 0)) return
              const id = editing.catalogId!
              // Store the correction at the base (index 1.0) price so it carries across chains.
              update((s) => ({ ...s, settings: { ...s.settings, priceOverrides: { ...s.settings.priceOverrides, [id]: value / store.index } } }))
              setEditing(null)
            }}
          >
            <p className="muted">
              כמה עולה {packLabel(CATALOG_BY_ID.get(editing.catalogId)!)} ב{store.name} שלכם?
            </p>
            <input className="input" inputMode="decimal" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} autoFocus />
            <Button variant="primary" type="submit">
              שמירת המחיר
            </Button>
            {settings.priceOverrides[editing.catalogId] != null ? (
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  const id = editing.catalogId!
                  update((s) => {
                    const { [id]: _removed, ...rest } = s.settings.priceOverrides
                    return { ...s, settings: { ...s.settings, priceOverrides: rest } }
                  })
                  setEditing(null)
                }}
              >
                חזרה למחיר המשוער
              </Button>
            ) : null}
          </form>
        </Sheet>
      ) : null}
    </div>
  )
}
