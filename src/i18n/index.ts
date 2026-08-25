import { he } from './he'

export type Language = 'en' | 'he'

const DICTIONARIES: Record<Language, Record<string, string>> = { en: {}, he }

/**
 * Translate. The key *is* the English copy, so a missing translation degrades to
 * readable English rather than to a dangling identifier.
 * Supports `{name}` placeholders.
 */
export function translate(language: Language, text: string, vars?: Record<string, string | number>): string {
  const out = DICTIONARIES[language]?.[text] ?? text
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

export const isRtl = (language: Language): boolean => language === 'he'
