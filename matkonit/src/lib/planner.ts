import type { AppState, MealPlan, PlanDay, Profile, Recipe } from '../types'
import { LIBRARY } from '../data/library'
import { addDays, nowIso, parseDate, today, weekStartOf } from './format'
import { fromLibrary, totalMinutes } from './recipes'
import { planNeeds, priceList, recipeCost } from './pricing'
import type { CookbookSummary } from './api'

/** The nights this household cooks in the week starting `weekStart`, skipping days already gone. */
export function planDates(profile: Profile, weekStart: string) {
  const now = today()
  return [0, 1, 2, 3, 4, 5, 6]
    .map((offset) => addDays(weekStart, offset))
    .filter((date) => profile.cookingDays.includes(parseDate(date).getDay()) && date >= now)
}

const GLUTEN = new Set(['pasta', 'ptitim', 'flour', 'bread', 'pita', 'couscous', 'bulgur', 'breadcrumbs', 'puff-pastry', 'tortilla', 'challah'])
const CARBS = new Set(['pasta', 'ptitim', 'rice', 'potato', 'bread', 'pita', 'couscous', 'tortilla', 'challah', 'frozen-fries'])
const ANIMAL = new Set(['eggs', 'salmon', 'white-fish', 'tuna-can', 'honey'])
const FISH = new Set(['salmon', 'white-fish', 'tuna-can'])
const NUTS = new Set(['nuts', 'pine-nuts'])
const HOT = new Set(['chili', 'harissa', 'chili-flakes'])

export function fitsProfile(recipe: Recipe, profile: Profile) {
  const ids = new Set(recipe.ingredients.map((i) => i.catalogId).filter(Boolean) as string[])
  const has = (set: Set<string>) => [...ids].some((id) => set.has(id))
  for (const diet of profile.diets) {
    if (diet === 'vegetarian' && (recipe.kashrut === 'meat' || has(FISH))) return false
    if (diet === 'vegan' && (recipe.kashrut !== 'parve' || has(ANIMAL))) return false
    if (diet === 'dairy-free' && recipe.kashrut === 'dairy') return false
    if (diet === 'gluten-free' && has(GLUTEN)) return false
    if (diet === 'low-carb' && has(CARBS)) return false
    if (diet === 'nut-free' && has(NUTS)) return false
    if (diet === 'kids' && has(HOT)) return false
  }
  const text = `${recipe.title} ${recipe.ingredients.map((i) => i.name).join(' ')}`
  if (profile.dislikes.some((word) => word.trim() && text.includes(word.trim()))) return false
  return true
}

/** The "main protein" of a dish, so the planner doesn't serve chicken three nights running. */
function protein(recipe: Recipe) {
  const ids = recipe.ingredients.map((i) => i.catalogId || '')
  if (ids.some((id) => id.startsWith('chicken') || id === 'whole-chicken' || id === 'ground-chicken')) return 'chicken'
  if (ids.some((id) => ['ground-beef', 'beef-stew', 'entrecote', 'sausage'].includes(id))) return 'beef'
  if (ids.some((id) => FISH.has(id))) return 'fish'
  if (ids.includes('eggs') && recipe.kashrut !== 'meat') return 'eggs'
  return recipe.kashrut
}

export function cookbookSummaries(state: AppState): CookbookSummary[] {
  return state.recipes.map((r) => ({
    id: r.id,
    title: r.title,
    kashrut: r.kashrut,
    minutes: totalMinutes(r),
    tags: r.tags,
    favorite: r.favorite,
    costPerServing: Math.round(recipeCost(r, r.servings, state.profile.storeId, state.settings.priceOverrides).perServing * 10) / 10 || null,
  }))
}

export function weekTotal(state: AppState, days: PlanDay[], recipes: Recipe[]) {
  const plan: MealPlan = { weekStart: '', days, generatedBy: 'manual', note: '', updatedAt: '' }
  return priceList(planNeeds(plan, recipes, []), state.profile.storeId, { ...state.shopping, have: [], need: [] }, state.settings).total
}

/**
 * No-AI planner: picks from the household's cookbook plus the built-in library,
 * respecting diet, time and variety, then swaps the priciest nights for cheaper
 * ones until the whole basket fits the weekly budget (or nothing cheaper is left).
 */
export function offlinePlan(state: AppState, weekStart: string, locked: PlanDay[]) {
  const { profile } = state
  const dates = planDates(profile, weekStart).filter((d) => !locked.some((l) => l.date === d))
  const library = LIBRARY.map(fromLibrary).filter((lib) => !state.recipes.some((r) => r.id === lib.id))
  const pool = [...state.recipes, ...library].filter((r) => fitsProfile(r, profile))
  const recentlyCooked = new Set(state.recipes.filter((r) => r.lastCookedAt && Date.now() - Date.parse(r.lastCookedAt) < 10 * 864e5).map((r) => r.id))
  const usedIds = new Set(locked.map((l) => l.recipeId))

  const score = (r: Recipe, date: string) => {
    const friday = parseDate(date).getDay() === 5
    let s = Math.random() * 2
    if (r.favorite) s += 3
    if (r.rating) s += r.rating - 3
    if (state.recipes.some((own) => own.id === r.id)) s += 1.5
    if (recentlyCooked.has(r.id)) s -= 4
    if (!friday && totalMinutes(r) > profile.maxMinutes) s -= 6
    if (friday && (r.tags.includes('שבת') || totalMinutes(r) > 60)) s += 2
    s -= recipeCost(r, profile.householdSize, profile.storeId, state.settings.priceOverrides).perServing / 8
    return s
  }

  const days: PlanDay[] = []
  let lastProtein = ''
  for (const date of dates) {
    const ranked = pool
      .filter((r) => !usedIds.has(r.id))
      .map((r) => ({ r, s: score(r, date) - (protein(r) === lastProtein ? 3 : 0) }))
      .sort((a, b) => b.s - a.s)
    const pick = ranked[0]?.r
    if (!pick) break
    usedIds.add(pick.id)
    lastProtein = protein(pick)
    days.push({ date, recipeId: pick.id, servings: profile.householdSize, locked: false })
  }

  // Budget pass: replace the most expensive night with the cheapest unused option.
  const all = [...state.recipes, ...library]
  const byId = new Map(all.map((r) => [r.id, r]))
  const costOf = (id: string | null) => (id ? recipeCost(byId.get(id)!, profile.householdSize, profile.storeId, state.settings.priceOverrides).total : 0)
  for (let round = 0; round < 10 && weekTotal(state, [...locked, ...days], all) > profile.weeklyBudget; round++) {
    const priciest = [...days].sort((a, b) => costOf(b.recipeId) - costOf(a.recipeId))[0]
    if (!priciest) break
    const cheaper = pool
      .filter((r) => !usedIds.has(r.id) && costOf(r.id) < costOf(priciest.recipeId))
      .sort((a, b) => costOf(a.id) - costOf(b.id))[0]
    if (!cheaper) break
    usedIds.delete(priciest.recipeId)
    usedIds.add(cheaper.id)
    priciest.recipeId = cheaper.id
  }

  const newRecipes = library.filter((lib) => days.some((d) => d.recipeId === lib.id))
  return { days, newRecipes }
}

export function emptyPlan(weekStart: string): MealPlan {
  return { weekStart, days: [], generatedBy: 'manual', note: '', updatedAt: nowIso() }
}

/** Thursday night onwards, people are planning next week, not the two days left of this one. */
export function defaultWeekStart() {
  const now = today()
  const day = parseDate(now).getDay()
  return day >= 4 ? addDays(weekStartOf(now), 7) : weekStartOf(now)
}

/** All seven dates of a plan week, with an empty slot for every day the plan does not cover yet. */
export function weekDays(plan: MealPlan | null, weekStart: string, householdSize: number): PlanDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const date = addDays(weekStart, offset)
    return plan?.days.find((d) => d.date === date) || { date, recipeId: null, servings: householdSize, locked: false }
  })
}

export function setDay(plan: MealPlan | null, weekStart: string, day: PlanDay): MealPlan {
  const base = plan && plan.weekStart === weekStart ? plan : emptyPlan(weekStart)
  const days = base.days.filter((d) => d.date !== day.date)
  if (day.recipeId) days.push(day)
  return { ...base, days: days.sort((a, b) => a.date.localeCompare(b.date)), updatedAt: nowIso() }
}
