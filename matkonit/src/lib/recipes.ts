import type { Ingredient, Recipe, Source } from '../types'
import type { LibraryRecipe } from '../data/library'
import { matchCatalog } from './catalog'
import { canonicalUnit } from './ingredientLine.js'
import { nowIso, uid } from './format'

/** Server responses and editor drafts → a complete Recipe with ids and bookkeeping. */
export function makeRecipe(draft: Omit<Partial<Recipe>, 'ingredients'> & { ingredients?: Partial<Ingredient>[] }, source: Source): Recipe {
  const now = nowIso()
  return {
    id: uid('r_'),
    title: draft.title || 'מתכון חדש',
    description: draft.description || '',
    imageUrl: draft.imageUrl || '',
    sourceUrl: draft.sourceUrl || '',
    source,
    author: draft.author || '',
    servings: draft.servings || 4,
    prepMinutes: draft.prepMinutes ?? 15,
    cookMinutes: draft.cookMinutes ?? 30,
    ingredients: (draft.ingredients || []).map((ing) => ({
      id: uid('i_'),
      name: ing.name || '',
      qty: ing.qty ?? null,
      unit: ing.unit || "יח'",
      note: ing.note || '',
      group: ing.group || '',
      catalogId: ing.catalogId === undefined ? matchCatalog(ing.name || '') : ing.catalogId,
    })),
    steps: draft.steps || [],
    tags: draft.tags || [],
    kashrut: draft.kashrut || 'parve',
    cuisine: draft.cuisine || '',
    difficulty: draft.difficulty || 'easy',
    tips: draft.tips || [],
    caloriesPerServing: draft.caloriesPerServing ?? null,
    favorite: false,
    collections: draft.collections || [],
    notes: '',
    rating: null,
    cookedCount: 0,
    lastCookedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function fromLibrary(lib: LibraryRecipe): Recipe {
  const recipe = makeRecipe(
    {
      ...lib,
      ingredients: lib.ingredients.map(([name, qty, unit, catalogId, note]) => ({ name, qty, unit: canonicalUnit(unit), catalogId, note: note || '' })),
    },
    'library',
  )
  return { ...recipe, id: `lib_${lib.key}` }
}

export const totalMinutes = (r: Pick<Recipe, 'prepMinutes' | 'cookMinutes'>) => (r.prepMinutes || 0) + (r.cookMinutes || 0)

export const KASHRUT_LABEL = { meat: 'בשרי', dairy: 'חלבי', parve: 'פרווה' } as const
export const DIFFICULTY_LABEL = { easy: 'קל', medium: 'בינוני', hard: 'מאתגר' } as const
export const SOURCE_LABEL: Record<Source, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  web: 'אתר',
  ai: 'נוצר ב-AI',
  manual: 'הוזן ידנית',
  photo: 'מצילום',
  text: 'מטקסט',
  library: 'ספריית מתכונית',
}

/** "אופים 25 דקות" → [25 * 60]. Feeds the one-tap timers in cook mode. */
export function detectTimers(step: string): { label: string; seconds: number }[] {
  const found: { label: string; seconds: number }[] = []
  const re = /(\d+(?:[.,]\d+)?|חצי|רבע)(?:\s*[-–]\s*(\d+))?\s*(דקות|דקה|דק'|שעות|שעה|שניות|minutes?|mins?|hours?|hrs?)/gi
  for (const m of step.matchAll(re)) {
    const raw = m[2] || m[1]
    const n = raw === 'חצי' ? 0.5 : raw === 'רבע' ? 0.25 : Number(raw.replace(',', '.'))
    const unit = m[3].toLowerCase()
    const seconds = /שע|hour|hr/.test(unit) ? n * 3600 : /שני/.test(unit) ? n : n * 60
    if (seconds > 0 && seconds <= 24 * 3600) found.push({ label: m[0], seconds: Math.round(seconds) })
  }
  if (/^שעה\b|\bשעה\b/.test(step) && !found.length) found.push({ label: 'שעה', seconds: 3600 })
  return found
}

export function scaleFactor(recipe: Recipe, servings: number) {
  return servings / (recipe.servings || 1)
}

export function recipeToText(recipe: Recipe, servings = recipe.servings) {
  const factor = scaleFactor(recipe, servings)
  const fmt = (q: number | null) => (q == null ? '' : `${Math.round(q * factor * 100) / 100} `)
  return [
    recipe.title,
    recipe.description,
    `${servings} מנות`,
    '',
    'מצרכים:',
    ...recipe.ingredients.map((i) => `• ${fmt(i.qty)}${i.qty == null && i.unit === 'לפי הטעם' ? '' : `${i.unit} `}${i.name}${i.note ? ` (${i.note})` : ''}${i.qty == null && i.unit === 'לפי הטעם' ? ' — לפי הטעם' : ''}`),
    '',
    'אופן ההכנה:',
    ...recipe.steps.map((s, n) => `${n + 1}. ${s}`),
    recipe.sourceUrl ? `\nמקור: ${recipe.sourceUrl}` : '',
  ]
    .filter((line) => line !== undefined)
    .join('\n')
    .trim()
}
