import type { Profile, Recipe } from '../types'

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
  }
}

export type RecipeDraft = Omit<Partial<Recipe>, 'ingredients'> & {
  ingredients: { name: string; qty: number | null; unit: string; note: string; group: string; catalogId: string | null }[]
}

async function call<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError('אין חיבור לשרת. בדקו את החיבור לאינטרנט.', 'offline')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new ApiError(data?.error?.message || `שגיאת שרת (${response.status})`, data?.error?.code || 'http')
  return data as T
}

export async function aiStatus(): Promise<{ ai: boolean; model?: string; reachable: boolean }> {
  try {
    const response = await fetch('/api/ai', { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return { ai: false, reachable: false }
    return { ...(await response.json()), reachable: true }
  } catch {
    return { ai: false, reachable: false }
  }
}

type ImportResult = { recipe: RecipeDraft; platform?: string; estimated?: boolean; ai: boolean }

export const importUrl = (url: string, text?: string, signal?: AbortSignal) => call<ImportResult>({ mode: 'import-url', url, text }, signal)
export const importText = (text: string, signal?: AbortSignal) => call<ImportResult>({ mode: 'import-text', text }, signal)
export const importImages = (images: { mediaType: string; data: string }[], signal?: AbortSignal) =>
  call<ImportResult>({ mode: 'import-image', images }, signal)
export const generateRecipe = (prompt: string, pantry: string[], profile: Profile, signal?: AbortSignal) =>
  call<{ recipe: RecipeDraft }>({ mode: 'generate', prompt, pantry, profile }, signal)

export interface CookbookSummary {
  id: string
  title: string
  kashrut: string
  minutes: number
  tags: string[]
  favorite: boolean
  costPerServing: number | null
}

export const aiMealPlan = (
  body: { profile: Profile; dates: string[]; cookbook: CookbookSummary[]; keep: { date: string; title: string }[]; recentTitles: string[] },
  signal?: AbortSignal,
) => call<{ note: string; days: { date: string; existingRecipeId: string | null; recipe: RecipeDraft | null }[] }>({ mode: 'mealplan', ...body }, signal)

export const aiSwap = (body: { profile: Profile; date: string; current?: string; others: string[]; instruction?: string }, signal?: AbortSignal) =>
  call<{ recipe: RecipeDraft }>({ mode: 'swap', ...body }, signal)

/** Shrinks a photo before upload: screenshots are huge and the model does not need 4K. */
export async function imageToBase64(file: File, maxSide = 1600): Promise<{ mediaType: string; data: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { mediaType: 'image/jpeg', data: dataUrl.split(',')[1] }
}
