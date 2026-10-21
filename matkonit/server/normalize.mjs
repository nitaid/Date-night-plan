import catalog from '../src/data/catalog.json' with { type: 'json' }
import { buildMatcher } from '../src/lib/catalogMatch.js'
import { canonicalUnit, parseIngredientLine } from '../src/lib/ingredientLine.js'

const matchCatalog = buildMatcher(catalog.items)
const catalogIds = new Set(catalog.items.map((item) => item.id))

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max)

const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ''))
    return /^https?:$/.test(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function normalizeIngredient(raw) {
  const name = text(raw?.name, 200)
  const qty = raw?.qty == null || !Number.isFinite(Number(raw.qty)) || Number(raw.qty) <= 0 ? null : Math.round(Number(raw.qty) * 1000) / 1000
  const catalogId = raw?.catalogId && catalogIds.has(raw.catalogId) ? raw.catalogId : matchCatalog(name)
  return {
    name,
    qty,
    unit: qty == null && !raw?.unit ? 'לפי הטעם' : canonicalUnit(raw?.unit),
    note: text(raw?.note, 200),
    group: text(raw?.group, 80),
    catalogId,
  }
}

const KASHRUT = new Set(['meat', 'dairy', 'parve'])
const DIFFICULTY = new Set(['easy', 'medium', 'hard'])

/** Defensive cleanup of whatever the model (or a recipe site) gave us. */
export function normalizeRecipe(raw, extra = {}) {
  const ingredients = (Array.isArray(raw?.ingredients) ? raw.ingredients : []).map(normalizeIngredient).filter((i) => i.name)
  return {
    title: text(raw?.title, 160) || 'מתכון ללא שם',
    description: text(raw?.description, 600),
    servings: clampInt(raw?.servings, 1, 40, 4),
    prepMinutes: clampInt(raw?.prepMinutes, 0, 1440, 15),
    cookMinutes: clampInt(raw?.cookMinutes, 0, 2880, 30),
    ingredients,
    steps: (Array.isArray(raw?.steps) ? raw.steps : []).map((s) => text(s, 1200)).filter(Boolean),
    tags: [...new Set((Array.isArray(raw?.tags) ? raw.tags : []).map((t) => text(t, 30)).filter(Boolean))].slice(0, 8),
    kashrut: KASHRUT.has(raw?.kashrut) ? raw.kashrut : guessKashrut(ingredients),
    cuisine: text(raw?.cuisine, 40),
    difficulty: DIFFICULTY.has(raw?.difficulty) ? raw.difficulty : 'easy',
    tips: (Array.isArray(raw?.tips) ? raw.tips : []).map((s) => text(s, 400)).filter(Boolean).slice(0, 6),
    caloriesPerServing: raw?.caloriesPerServing == null ? null : clampInt(raw.caloriesPerServing, 0, 5000, null),
    imageUrl: safeUrl(extra.imageUrl),
    sourceUrl: safeUrl(extra.sourceUrl),
    author: text(extra.author, 120),
  }
}

const MEAT = new Set(['chicken-breast', 'chicken-thigh', 'chicken-drumstick', 'whole-chicken', 'chicken-schnitzel', 'ground-beef', 'ground-chicken', 'beef-stew', 'entrecote', 'sausage'])
const DAIRY = new Set(['milk', 'butter', 'cream', 'cooking-cream', 'sour-cream', 'yogurt', 'white-cheese', 'yellow-cheese', 'feta', 'parmesan', 'labaneh'])

export function guessKashrut(ingredients) {
  if (ingredients.some((i) => MEAT.has(i.catalogId))) return 'meat'
  if (ingredients.some((i) => DAIRY.has(i.catalogId))) return 'dairy'
  return 'parve'
}

/** No-AI import: schema.org markup is structured enough to use as-is (it stays in its original language). */
export function recipeFromJsonLd(ld, source) {
  return normalizeRecipe(
    {
      title: ld.title,
      description: ld.description,
      servings: ld.servings,
      prepMinutes: ld.prepMinutes,
      cookMinutes: ld.cookMinutes,
      ingredients: ld.ingredients.map((line) => parseIngredientLine(line)),
      steps: ld.steps,
      tags: [],
      cuisine: ld.cuisine,
    },
    { imageUrl: ld.image || source.image, sourceUrl: source.url, author: ld.author || source.author },
  )
}
