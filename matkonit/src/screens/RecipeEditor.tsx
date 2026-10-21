import { useState } from 'react'
import { useStore } from '../state/store'
import { back, go } from '../lib/router'
import { makeRecipe } from '../lib/recipes'
import { CATALOG, matchCatalog } from '../lib/catalog'
import { UNIT_WORDS, parseIngredientLine } from '../lib/ingredientLine.js'
import { uid } from '../lib/format'
import { toast } from '../lib/toast'
import { Button, Field, IconButton, Segmented, TagInput } from '../components/ui'
import type { Ingredient, Recipe } from '../types'

const UNITS = Object.keys(UNIT_WORDS).filter((u) => u !== 'oz' && u !== 'lb')

export default function RecipeEditor({ id }: { id?: string }) {
  const { recipe: find, saveRecipe } = useStore()
  const existing = find(id)
  const [draft, setDraft] = useState<Recipe>(() => existing || { ...makeRecipe({ ingredients: [], steps: [''] }, 'manual'), title: '' })
  const [bulk, setBulk] = useState('')
  const patch = (p: Partial<Recipe>) => setDraft((d) => ({ ...d, ...p }))
  const patchIng = (ingId: string, p: Partial<Ingredient>) =>
    setDraft((d) => ({ ...d, ingredients: d.ingredients.map((i) => (i.id === ingId ? { ...i, ...p } : i)) }))

  const addLines = (text: string) => {
    const lines = text.split(/\n+/).map((l) => l.replace(/^[-•*\d.)\s]+(?=\D)/, '').trim()).filter(Boolean)
    const parsed = lines.map((line) => {
      const p = parseIngredientLine(line)
      return { id: uid('i_'), ...p, group: '', catalogId: matchCatalog(p.name) }
    })
    setDraft((d) => ({ ...d, ingredients: [...d.ingredients, ...parsed] }))
    setBulk('')
  }

  const save = () => {
    const clean: Recipe = {
      ...draft,
      title: draft.title.trim() || 'מתכון ללא שם',
      ingredients: draft.ingredients.filter((i) => i.name.trim()),
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
      tips: draft.tips.map((s) => s.trim()).filter(Boolean),
    }
    saveRecipe(clean)
    toast('נשמר', 'good')
    if (existing) back(`recipe/${clean.id}`)
    else go('recipe', clean.id)
  }

  return (
    <div className="screen">
      <div className="row between">
        <IconButton label="ביטול" onClick={() => back('')}>
          ✕
        </IconButton>
        <h2>{existing ? 'עריכת מתכון' : 'מתכון חדש'}</h2>
        <Button variant="primary" size="small" onClick={save}>
          שמירה
        </Button>
      </div>

      <section className="card">
        <Field label="שם המתכון">
          <input className="input" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="למשל: הקציצות של אמא" />
        </Field>
        <Field label="תיאור">
          <textarea className="textarea" rows={2} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
        </Field>
        <div className="grid3">
          <Field label="מנות">
            <input className="input" type="number" min={1} inputMode="numeric" value={draft.servings} onChange={(e) => patch({ servings: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <Field label="הכנה (דק')">
            <input className="input" type="number" min={0} inputMode="numeric" value={draft.prepMinutes} onChange={(e) => patch({ prepMinutes: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="בישול (דק')">
            <input className="input" type="number" min={0} inputMode="numeric" value={draft.cookMinutes} onChange={(e) => patch({ cookMinutes: Number(e.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="כשרות">
          <Segmented
            value={draft.kashrut}
            onChange={(kashrut) => patch({ kashrut })}
            options={[
              { value: 'parve', label: 'פרווה' },
              { value: 'dairy', label: 'חלבי' },
              { value: 'meat', label: 'בשרי' },
            ]}
          />
        </Field>
        <Field label="רמת קושי">
          <Segmented
            value={draft.difficulty}
            onChange={(difficulty) => patch({ difficulty })}
            options={[
              { value: 'easy', label: 'קל' },
              { value: 'medium', label: 'בינוני' },
              { value: 'hard', label: 'מאתגר' },
            ]}
          />
        </Field>
        <Field label="תגיות">
          <TagInput value={draft.tags} onChange={(tags) => patch({ tags })} suggestions={['מהיר', 'ילדים', 'שבת', 'טבעוני', 'ללא גלוטן', 'זול', 'אירוח']} />
        </Field>
      </section>

      <section className="card">
        <h2>מצרכים</h2>
        {draft.ingredients.map((ing) => {
          return (
            <div key={ing.id} className="ing-row">
              <input
                className="input qty-input"
                inputMode="decimal"
                aria-label="כמות"
                value={ing.qty ?? ''}
                onChange={(e) => patchIng(ing.id, { qty: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) || null })}
              />
              <select className="select unit-input" aria-label="יחידה" value={ing.unit} onChange={(e) => patchIng(ing.id, { unit: e.target.value })}>
                {!UNITS.includes(ing.unit) ? <option value={ing.unit}>{ing.unit}</option> : null}
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input
                className="input grow"
                aria-label="מצרך"
                value={ing.name}
                placeholder="מצרך"
                onChange={(e) => patchIng(ing.id, { name: e.target.value, catalogId: matchCatalog(e.target.value) })}
              />
              <IconButton label="הסרה" onClick={() => setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((i) => i.id !== ing.id) }))}>
                ✕
              </IconButton>
              <input className="input note-input" aria-label="הערה" value={ing.note} placeholder="הערה (קצוץ, מגורר…)" onChange={(e) => patchIng(ing.id, { note: e.target.value })} />
              <select
                className="select note-input"
                aria-label="מוצר בסופר לתמחור"
                value={ing.catalogId || ''}
                onChange={(e) => patchIng(ing.id, { catalogId: e.target.value || null })}
              >
                <option value="">— בלי תמחור —</option>
                {CATALOG.map((c) => (
                  <option key={c.id} value={c.id}>
                    🛒 {c.name}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
        <Button
          size="small"
          onClick={() => setDraft((d) => ({ ...d, ingredients: [...d.ingredients, { id: uid('i_'), name: '', qty: null, unit: "יח'", note: '', group: '', catalogId: null }] }))}
        >
          + מצרך
        </Button>
        <Field label="או הדביקו כמה שורות בבת אחת">
          <textarea className="textarea" rows={3} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'500 גרם בשר טחון\n2 בצלים\nמלח לפי הטעם'} />
        </Field>
        {bulk.trim() ? (
          <Button size="small" onClick={() => addLines(bulk)}>
            הוספת השורות
          </Button>
        ) : null}
      </section>

      <section className="card">
        <h2>שלבי הכנה</h2>
        {draft.steps.map((step, n) => (
          <div key={n} className="row top">
            <span className="step-num">{n + 1}</span>
            <textarea
              className="textarea grow"
              rows={2}
              value={step}
              onChange={(e) => setDraft((d) => ({ ...d, steps: d.steps.map((s, i) => (i === n ? e.target.value : s)) }))}
            />
            <div className="col" style={{ gap: 4 }}>
              <IconButton
                label="למעלה"
                disabled={n === 0}
                onClick={() => setDraft((d) => {
                  const steps = [...d.steps]
                  ;[steps[n - 1], steps[n]] = [steps[n], steps[n - 1]]
                  return { ...d, steps }
                })}
              >
                ↑
              </IconButton>
              <IconButton label="הסרה" onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((_, i) => i !== n) }))}>
                ✕
              </IconButton>
            </div>
          </div>
        ))}
        <Button size="small" onClick={() => setDraft((d) => ({ ...d, steps: [...d.steps, ''] }))}>
          + שלב
        </Button>
      </section>

      <section className="card">
        <Field label="טיפים (שורה לכל טיפ)">
          <textarea className="textarea" rows={3} value={draft.tips.join('\n')} onChange={(e) => patch({ tips: e.target.value.split('\n') })} />
        </Field>
        <Field label="קישור לתמונה">
          <input className="input" dir="ltr" value={draft.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} placeholder="https://…" />
        </Field>
        <Field label="קישור למקור">
          <input className="input" dir="ltr" value={draft.sourceUrl} onChange={(e) => patch({ sourceUrl: e.target.value })} placeholder="https://…" />
        </Field>
      </section>

      <Button variant="primary" block onClick={save}>
        שמירה
      </Button>
    </div>
  )
}
