export function buildMatcher(items: { id: string; name: string; aliases?: string[] }[]): (name: string) => string | null
