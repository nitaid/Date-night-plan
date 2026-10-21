import type { ExtraItem, Ingredient, MealPlan, Recipe, Settings, Shopping } from '../types'
import { CATALOG_BY_ID, STORES, storeById, type CatalogItem } from './catalog'
import { formatQty } from './format'

const MASS: Record<string, number> = { 'גרם': 1, 'ק"ג': 1000, oz: 28.35, lb: 453.6 }
const VOLUME: Record<string, number> = { 'מ"ל': 1, 'ליטר': 1000, 'כוס': 240, 'כף': 15, 'כפית': 5, 'קורט': 0.5 }
const PACKS = new Set(['קופסה', 'צנצנת', 'חבילה'])

/** How much of the catalog item's own unit (g / ml / pieces) a recipe line asks for. */
export function amountInCatalogUnit(qty: number | null, unit: string, item: CatalogItem): number {
  if (qty == null) return 0
  const density = item.density || 1
  if (MASS[unit] != null) {
    const grams = qty * MASS[unit]
    if (item.unit === 'g') return grams
    if (item.unit === 'ml') return grams / density
    return grams / (item.each || 100)
  }
  if (VOLUME[unit] != null) {
    const ml = qty * VOLUME[unit]
    if (item.unit === 'ml') return ml
    if (item.unit === 'g') return ml * density
    return ml / (item.each || 100)
  }
  if (PACKS.has(unit)) return qty * item.pack
  // Pieces: "2 בצלים", "4 שיני שום", "צרור פטרוזיליה".
  if (item.unit === 'unit') return qty
  return qty * (item.each || (unit === 'צרור' ? 50 : 100))
}

export function unitPrice(item: CatalogItem, storeId: string, overrides: Record<string, number> = {}) {
  return (overrides[item.id] ?? item.price) * storeById(storeId).index
}

/** What a recipe's ingredients cost to *use* (not to buy whole packs) — the "₪ per serving" figure. */
export function recipeCost(recipe: Recipe, servings: number, storeId: string, overrides: Record<string, number> = {}) {
  const factor = servings / (recipe.servings || 1)
  let total = 0
  let unpriced = 0
  for (const ing of recipe.ingredients) {
    const item = ing.catalogId ? CATALOG_BY_ID.get(ing.catalogId) : undefined
    if (!item) {
      unpriced++
      continue
    }
    total += (amountInCatalogUnit(ing.qty == null ? null : ing.qty * factor, ing.unit, item) / item.pack) * unitPrice(item, storeId, overrides)
  }
  return { total, perServing: total / Math.max(1, servings), unpriced }
}

export interface ListLine {
  key: string
  name: string
  catalogId: string | null
  cat: string
  /** Total needed, in the catalog unit; 0 for "to taste". */
  need: number
  /** Human summary of what the recipes call for. */
  amountText: string
  packs: number
  packPrice: number | null
  price: number | null
  staple: boolean
  extra: boolean
  recipes: string[]
}

interface Need {
  ing: Pick<Ingredient, 'name' | 'qty' | 'unit' | 'catalogId'>
  factor: number
  recipeTitle: string
  extra?: boolean
}

function displayAmount(need: number, item: CatalogItem) {
  if (!need) return 'לפי הטעם'
  if (item.unit === 'unit') return `${formatQty(need)} יח'`
  if (item.unit === 'g') return need >= 1000 ? `${formatQty(need / 1000)} ק"ג` : `${formatQty(need)} גרם`
  return need >= 1000 ? `${formatQty(need / 1000)} ליטר` : `${formatQty(need)} מ"ל`
}

function aggregate(needs: Need[], storeId: string, overrides: Record<string, number>): ListLine[] {
  const lines = new Map<string, ListLine & { raw: string[] }>()
  for (const { ing, factor, recipeTitle, extra } of needs) {
    const item = ing.catalogId ? CATALOG_BY_ID.get(ing.catalogId) : undefined
    const key = item ? item.id : `name:${ing.name.trim()}`
    const qty = ing.qty == null ? null : ing.qty * factor
    let line = lines.get(key)
    if (!line) {
      line = {
        key,
        name: item ? item.name : ing.name.trim(),
        catalogId: item?.id || null,
        cat: item?.cat || 'other',
        need: 0,
        amountText: '',
        packs: 0,
        packPrice: item ? unitPrice(item, storeId, overrides) : null,
        price: null,
        staple: Boolean(item?.staple),
        extra: Boolean(extra),
        recipes: [],
        raw: [],
      }
      lines.set(key, line)
    }
    if (item) line.need += amountInCatalogUnit(qty, ing.unit, item)
    else line.raw.push(qty == null ? ing.unit : `${formatQty(qty)} ${ing.unit}`)
    if (!extra && !line.recipes.includes(recipeTitle)) line.recipes.push(recipeTitle)
    if (!extra) line.extra = false
  }

  return [...lines.values()].map(({ raw, ...line }) => {
    const item = line.catalogId ? CATALOG_BY_ID.get(line.catalogId)! : null
    if (item) {
      // You buy whole packs; a 2% tolerance stops 1,010 g of flour from costing two bags.
      line.packs = Math.max(1, Math.ceil(line.need / item.pack - 0.02))
      line.price = line.packs * line.packPrice!
      line.amountText = displayAmount(line.need, item)
    } else {
      line.amountText = [...new Set(raw)].join(' + ')
      line.packs = 1
    }
    return line
  })
}

export function planNeeds(plan: MealPlan | null, recipes: Recipe[], extras: ExtraItem[]): Need[] {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const needs: Need[] = []
  for (const day of plan?.days || []) {
    const recipe = day.recipeId ? byId.get(day.recipeId) : undefined
    if (!recipe) continue
    const factor = day.servings / (recipe.servings || 1)
    for (const ing of recipe.ingredients) needs.push({ ing, factor, recipeTitle: recipe.title })
  }
  for (const extra of extras) needs.push({ ing: extra, factor: 1, recipeTitle: '', extra: true })
  return needs
}

export const isHave = (line: ListLine, shopping: Shopping) =>
  shopping.have.includes(line.key) || (line.staple && !line.extra && !shopping.need.includes(line.key))

export interface PricedList {
  lines: ListLine[]
  total: number
  saved: number
  unpriced: number
}

export function priceList(needs: Need[], storeId: string, shopping: Shopping, settings: Pick<Settings, 'priceOverrides'>): PricedList {
  const lines = aggregate(needs, storeId, settings.priceOverrides)
  let total = 0
  let saved = 0
  let unpriced = 0
  for (const line of lines) {
    if (line.price == null) {
      if (!isHave(line, shopping)) unpriced++
      continue
    }
    if (isHave(line, shopping)) saved += line.price
    else total += line.price
  }
  return { lines, total, saved, unpriced }
}

/** The same basket at every chain, cheapest first. */
export function compareStores(needs: Need[], shopping: Shopping, settings: Pick<Settings, 'priceOverrides'>) {
  return STORES.map((store) => ({ store, total: priceList(needs, store.id, shopping, settings).total })).sort((a, b) => a.total - b.total)
}
