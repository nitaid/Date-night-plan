// Shared by the browser and the server: map a free-text ingredient name to a catalog product.

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/["'״׳`.,;:()\-–_/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strips the Hebrew definite article and common plural endings so "העגבניות" meets "עגבניה". */
function stem(word) {
  let w = word
  if (w.length > 3 && w.startsWith('ה')) w = w.slice(1)
  for (const suffix of ['ים', 'ות', 'יה', 'ה', 's']) {
    if (w.length > 3 && w.endsWith(suffix)) return w.slice(0, -suffix.length)
  }
  return w
}

const DESCRIPTORS = new Set(['טרי', 'טריים', 'טרייה', 'קצוץ', 'קצוצה', 'קצוצים', 'גדול', 'גדולה', 'גדולים', 'קטן', 'קטנה', 'קטנים', 'בינוני', 'בינונית', 'fresh', 'chopped', 'large', 'small', 'medium', 'minced', 'diced', 'sliced', 'ground'])

export function buildMatcher(items) {
  const entries = items.map((item) => ({
    id: item.id,
    phrases: [item.name, ...(item.aliases || [])].map((p) => norm(p)).filter(Boolean),
  }))
  const byId = new Map(items.map((item) => [item.id, item]))

  return function match(name) {
    const n = norm(name)
    if (!n) return null
    const words = n.split(' ').filter((w) => !DESCRIPTORS.has(w))
    const stems = words.map(stem)
    const joined = words.join(' ')
    let best = null
    let bestScore = 0

    for (const entry of entries) {
      for (const phrase of entry.phrases) {
        let score = 0
        if (phrase === joined) score = 100
        else if (joined.includes(phrase)) score = 60 + phrase.length
        else {
          const pStems = phrase.split(' ').map(stem)
          const hits = pStems.filter((p) => stems.includes(p)).length
          if (hits === pStems.length) score = 40 + phrase.length
          else if (hits > 0 && pStems.length > 1) score = 10 * hits
        }
        if (score > bestScore) {
          bestScore = score
          best = entry.id
        }
      }
    }
    return bestScore >= 40 ? byId.get(best).id : null
  }
}
