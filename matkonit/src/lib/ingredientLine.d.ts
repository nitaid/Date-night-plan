export const UNIT_WORDS: Record<string, string[]>
export function canonicalUnit(raw: string | null | undefined): string
export function parseIngredientLine(line: string): { qty: number | null; unit: string; name: string; note: string }
