import catalogData from '../data/catalog.json'
import storeData from '../data/stores.json'
import { buildMatcher } from './catalogMatch.js'

export interface CatalogItem {
  id: string
  name: string
  aliases: string[]
  cat: string
  unit: 'g' | 'ml' | 'unit'
  pack: number
  price: number
  each?: number
  density?: number
  staple?: boolean
}

export interface Store {
  id: string
  name: string
  index: number
  online: boolean
  note?: string
}

export const CATALOG = catalogData.items as CatalogItem[]
export const CATALOG_BY_ID = new Map(CATALOG.map((item) => [item.id, item]))
export const STORES = storeData.stores as Store[]
export const storeById = (id: string) => STORES.find((s) => s.id === id) || STORES.find((s) => s.id === 'shufersal-deal')!

export const matchCatalog: (name: string) => string | null = buildMatcher(CATALOG)

export const CATEGORIES: { id: string; label: string; glyph: string }[] = [
  { id: 'produce', label: 'ירקות ופירות', glyph: '🥬' },
  { id: 'meat', label: 'בשר ועוף', glyph: '🍗' },
  { id: 'fish', label: 'דגים', glyph: '🐟' },
  { id: 'dairy', label: 'מוצרי חלב, ביצים וטופו', glyph: '🥚' },
  { id: 'bakery', label: 'לחם ומאפים', glyph: '🥖' },
  { id: 'dry', label: 'יבשים ואפייה', glyph: '🌾' },
  { id: 'canned', label: 'שימורים, רטבים וממרחים', glyph: '🥫' },
  { id: 'oil', label: 'שמנים', glyph: '🫒' },
  { id: 'spices', label: 'תבלינים', glyph: '🧂' },
  { id: 'frozen', label: 'קפואים', glyph: '🧊' },
  { id: 'drinks', label: 'משקאות ויין', glyph: '🍷' },
  { id: 'other', label: 'אחר', glyph: '🛒' },
]

export function packLabel(item: CatalogItem) {
  if (item.unit === 'unit') return item.pack === 1 ? "יח'" : `${item.pack} יח'`
  if (item.unit === 'g') return item.pack >= 1000 ? `${item.pack / 1000} ק"ג` : `${item.pack} גרם`
  return item.pack >= 1000 ? `${item.pack / 1000} ליטר` : `${item.pack} מ"ל`
}
