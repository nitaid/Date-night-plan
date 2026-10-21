import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { go } from '../lib/router'
import { recipeCost } from '../lib/pricing'
import { fromLibrary, totalMinutes } from '../lib/recipes'
import { LIBRARY } from '../data/library'
import { RecipeCard } from '../components/RecipeCard'
import { Button, Chip, Empty } from '../components/ui'
import { toast } from '../lib/toast'
import type { Recipe } from '../types'

type Filter = 'all' | 'fav' | 'quick' | 'meat' | 'dairy' | 'parve' | 'social'
type Sort = 'new' | 'fast' | 'cheap' | 'cooked'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'fav', label: '♥ מועדפים' },
  { id: 'quick', label: 'עד 30 דק\'' },
  { id: 'meat', label: 'בשרי' },
  { id: 'dairy', label: 'חלבי' },
  { id: 'parve', label: 'פרווה' },
  { id: 'social', label: 'מהרשתות' },
]

function matches(recipe: Recipe, query: string) {
  if (!query) return true
  const q = query.trim()
  return (
    recipe.title.includes(q) ||
    recipe.tags.some((t) => t.includes(q)) ||
    recipe.collections.some((c) => c.includes(q)) ||
    recipe.ingredients.some((i) => i.name.includes(q)) ||
    recipe.author.includes(q) ||
    recipe.title.toLowerCase().includes(q.toLowerCase())
  )
}

export default function Cookbook() {
  const { state, patchRecipe, saveRecipe } = useStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [collection, setCollection] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('new')
  const { storeId } = state.profile

  const costs = useMemo(
    () => new Map(state.recipes.map((r) => [r.id, recipeCost(r, r.servings, storeId, state.settings.priceOverrides).perServing])),
    [state.recipes, storeId, state.settings.priceOverrides],
  )

  const collections = useMemo(() => [...new Set(state.recipes.flatMap((r) => r.collections))].sort(), [state.recipes])

  const shown = useMemo(() => {
    const list = state.recipes.filter((r) => {
      if (!matches(r, query)) return false
      if (collection && !r.collections.includes(collection)) return false
      if (filter === 'fav') return r.favorite
      if (filter === 'quick') return totalMinutes(r) <= 30
      if (filter === 'meat' || filter === 'dairy' || filter === 'parve') return r.kashrut === filter
      if (filter === 'social') return ['tiktok', 'instagram', 'youtube', 'facebook'].includes(r.source)
      return true
    })
    const by: Record<Sort, (a: Recipe, b: Recipe) => number> = {
      new: (a, b) => b.createdAt.localeCompare(a.createdAt),
      fast: (a, b) => totalMinutes(a) - totalMinutes(b),
      cheap: (a, b) => (costs.get(a.id) || 0) - (costs.get(b.id) || 0),
      cooked: (a, b) => b.cookedCount - a.cookedCount,
    }
    return list.sort(by[sort])
  }, [state.recipes, query, filter, collection, sort, costs])

  const inspiration = LIBRARY.filter((lib) => !state.recipes.some((r) => r.id === `lib_${lib.key}`))

  return (
    <div className="screen">
      <header className="screen-head">
        <h1>ספר המתכונים</h1>
        <p className="sub">{state.recipes.length ? `${state.recipes.length} מתכונים שמורים` : 'כל המתכונים שלכם, במקום אחד'}</p>
      </header>

      <div className="themebox">
        <span aria-hidden>🔎</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם, מצרך או תגית" aria-label="חיפוש מתכונים" />
        {query ? (
          <button type="button" className="iconbtn" onClick={() => setQuery('')} aria-label="ניקוי">
            ✕
          </button>
        ) : null}
      </div>

      <div className="scroller">
        {FILTERS.map((f) => (
          <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
        {collections.map((c) => (
          <Chip key={c} tone="gold" on={collection === c} onClick={() => setCollection(collection === c ? null : c)}>
            📁 {c}
          </Chip>
        ))}
      </div>

      {state.recipes.length ? (
        <div className="row between">
          <span className="faint">{shown.length} תוצאות</span>
          <select className="select small" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="מיון">
            <option value="new">החדשים ביותר</option>
            <option value="fast">המהירים ביותר</option>
            <option value="cheap">הזולים ביותר</option>
            <option value="cooked">הכי הרבה בישולים</option>
          </select>
        </div>
      ) : null}

      {shown.length ? (
        <div className="recipe-grid">
          {shown.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              costPerServing={costs.get(recipe.id)}
              onOpen={() => go('recipe', recipe.id)}
              onFavorite={() => patchRecipe(recipe.id, { favorite: !recipe.favorite })}
            />
          ))}
        </div>
      ) : state.recipes.length ? (
        <Empty glyph="🤷" title="לא מצאנו" body="נסו מילה אחרת או נקו את הסינון." />
      ) : (
        <Empty
          glyph="🎬"
          title="ספר המתכונים ריק"
          body="ראיתם מתכון בטיקטוק או באינסטגרם? לחצו 'שיתוף' ובחרו 'מתכונית', או הדביקו כאן את הקישור."
          action={
            <Button variant="primary" onClick={() => go('import')}>
              הוספת מתכון ראשון
            </Button>
          }
        />
      )}

      {inspiration.length && !query && filter === 'all' ? (
        <section className="col">
          <h2>השראה מהמטבח הישראלי</h2>
          <div className="scroller cards">
            {inspiration.map((lib) => {
              const recipe = fromLibrary(lib)
              return (
                <RecipeCard
                  key={lib.key}
                  recipe={recipe}
                  costPerServing={recipeCost(recipe, recipe.servings, storeId, state.settings.priceOverrides).perServing}
                  onOpen={() => {
                    saveRecipe(recipe)
                    go('recipe', recipe.id)
                  }}
                  action={
                    <Button
                      size="small"
                      onClick={() => {
                        saveRecipe(recipe)
                        toast(`"${recipe.title}" נשמר בספר המתכונים`, 'good')
                      }}
                    >
                      + שמירה
                    </Button>
                  }
                />
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}
