// Shared by the browser and the server (plain JS so Node can import it as-is).

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅕': 0.2 }

/** Canonical unit → words that mean it. Hebrew first; English for imported recipes. */
export const UNIT_WORDS = {
  'גרם': ['גרם', "ג'", 'גר', 'gr', 'g', 'gram', 'grams'],
  'ק"ג': ['ק"ג', 'קג', 'קילו', 'קילוגרם', 'kg', 'kilo', 'kilogram', 'kilograms'],
  'מ"ל': ['מ"ל', 'מל', 'ml', 'milliliter', 'milliliters', 'millilitre'],
  'ליטר': ['ליטר', 'ליטרים', 'l', 'liter', 'liters', 'litre', 'litres'],
  'כוס': ['כוס', 'כוסות', 'cup', 'cups'],
  'כף': ['כף', 'כפות', 'tbsp', 'tbs', 'tablespoon', 'tablespoons'],
  'כפית': ['כפית', 'כפיות', 'tsp', 'teaspoon', 'teaspoons'],
  "יח'": ["יח'", 'יחידה', 'יחידות', 'piece', 'pieces', 'whole'],
  'שן': ['שן', 'שיני', 'שיניים', 'clove', 'cloves'],
  'צרור': ['צרור', 'צרורות', 'bunch', 'bunches', 'handful', 'חופן'],
  'קופסה': ['קופסה', 'קופסת', 'קופסאות', 'פחית', 'can', 'cans', 'tin', 'tins'],
  'צנצנת': ['צנצנת', 'jar', 'jars'],
  'חבילה': ['חבילה', 'חבילת', 'אריזה', 'אריזת', 'package', 'packages', 'pack', 'packet'],
  'פרוסה': ['פרוסה', 'פרוסות', 'slice', 'slices'],
  'קורט': ['קורט', 'pinch', 'dash'],
  'לפי הטעם': ['לפי הטעם', 'to taste'],
  'oz': ['oz', 'ounce', 'ounces'],
  'lb': ['lb', 'lbs', 'pound', 'pounds'],
}

const WORD_TO_UNIT = new Map()
for (const [unit, words] of Object.entries(UNIT_WORDS)) for (const w of words) WORD_TO_UNIT.set(w.toLowerCase(), unit)

export function canonicalUnit(raw) {
  if (!raw) return "יח'"
  const key = String(raw).trim().toLowerCase().replace(/\.$/, '')
  return WORD_TO_UNIT.get(key) || String(raw).trim()
}

function parseNumber(token) {
  if (!token) return null
  if (FRACTIONS[token] != null) return FRACTIONS[token]
  const mixed = token.match(/^(\d+)([½¼¾⅓⅔⅛⅕])$/)
  if (mixed) return Number(mixed[1]) + FRACTIONS[mixed[2]]
  const frac = token.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null
  const range = token.match(/^(\d+(?:[.,]\d+)?)[-–](\d+(?:[.,]\d+)?)$/)
  if (range) return Number(range[2].replace(',', '.'))
  const n = Number(token.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * "2 כוסות קמח, מנופה" → { qty: 2, unit: 'כוס', name: 'קמח', note: 'מנופה' }.
 * Good enough for recipe-site markup; the AI path does the hard cases.
 */
export function parseIngredientLine(line) {
  let text = String(line || '').replace(/\s+/g, ' ').trim()
  let note = ''
  const paren = text.match(/\(([^)]*)\)/)
  if (paren) {
    note = paren[1].trim()
    text = text.replace(paren[0], ' ').replace(/\s+/g, ' ').trim()
  }
  const comma = text.indexOf(',')
  if (comma > 0) {
    note = [text.slice(comma + 1).trim(), note].filter(Boolean).join(', ')
    text = text.slice(0, comma).trim()
  }

  const tokens = text.split(' ')
  let qty = null
  let i = 0
  while (i < tokens.length) {
    const n = parseNumber(tokens[i])
    if (n == null) break
    qty = (qty || 0) + n
    i++
  }

  let unit = "יח'"
  if (i < tokens.length) {
    const two = `${tokens[i]} ${tokens[i + 1] || ''}`.trim().toLowerCase()
    if (WORD_TO_UNIT.has(two)) {
      unit = WORD_TO_UNIT.get(two)
      i += 2
    } else if (WORD_TO_UNIT.has(tokens[i].toLowerCase().replace(/\.$/, ''))) {
      unit = WORD_TO_UNIT.get(tokens[i].toLowerCase().replace(/\.$/, ''))
      i++
    }
  }
  let name = tokens.slice(i).join(' ').replace(/^(of|של)\s+/i, '').trim()

  const toTaste = /לפי הטעם|to taste/i
  if (toTaste.test(name)) {
    name = name.replace(toTaste, '').trim()
    unit = 'לפי הטעם'
    qty = null
  }
  if (!name) name = text
  if (qty == null && unit === "יח'" && /^(מלח|פלפל שחור|salt|pepper)/i.test(name)) unit = 'לפי הטעם'
  return { qty, unit, name, note }
}
