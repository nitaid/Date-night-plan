export type Kashrut = 'meat' | 'dairy' | 'parve'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type Source = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'web' | 'ai' | 'manual' | 'photo' | 'text' | 'library'

export interface Ingredient {
  id: string
  name: string
  /** null for "to taste" / "a pinch". */
  qty: number | null
  unit: string
  note: string
  /** Section heading inside the recipe, e.g. "לרוטב". Empty for the main list. */
  group: string
  /** Matching product in catalog.json, for pricing. null when nothing fits. */
  catalogId: string | null
}

export interface Recipe {
  id: string
  title: string
  description: string
  imageUrl: string
  sourceUrl: string
  source: Source
  author: string
  servings: number
  prepMinutes: number
  cookMinutes: number
  ingredients: Ingredient[]
  steps: string[]
  tags: string[]
  kashrut: Kashrut
  cuisine: string
  difficulty: Difficulty
  tips: string[]
  caloriesPerServing: number | null
  favorite: boolean
  collections: string[]
  notes: string
  rating: number | null
  cookedCount: number
  lastCookedAt: string | null
  createdAt: string
  updatedAt: string
}

export type Diet = 'vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'low-carb' | 'nut-free' | 'kids'

export interface Profile {
  householdSize: number
  city: string
  storeId: string
  weeklyBudget: number
  /** 0 = Sunday … 6 = Saturday — the nights you actually cook. */
  cookingDays: number[]
  diets: Diet[]
  kosher: boolean
  dislikes: string[]
  maxMinutes: number
  onboarded: boolean
}

export interface PlanDay {
  date: string
  recipeId: string | null
  servings: number
  locked: boolean
}

export interface MealPlan {
  weekStart: string
  days: PlanDay[]
  generatedBy: 'ai' | 'offline' | 'manual'
  note: string
  updatedAt: string
}

export interface ExtraItem {
  id: string
  name: string
  qty: number | null
  unit: string
  catalogId: string | null
}

export interface Shopping {
  /** Keys of aggregated lines that are already in the cart. */
  checked: string[]
  /** Keys the household already has at home — removed from the total. */
  have: string[]
  /** Pantry staples (salt, oil…) are assumed to be at home unless listed here. */
  need: string[]
  extras: ExtraItem[]
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  /** Per-catalog-item price corrections the user typed in (ILS per pack, before the store index). */
  priceOverrides: Record<string, number>
  cookFontScale: number
}

export interface AppState {
  version: number
  profile: Profile
  settings: Settings
  recipes: Recipe[]
  plan: MealPlan | null
  shopping: Shopping
}
