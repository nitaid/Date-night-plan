import dns from 'node:dns/promises'
import net from 'node:net'

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAX_BYTES = 4 * 1024 * 1024
const TIMEOUT_MS = 12000

export function detectPlatform(url) {
  const host = new URL(url).hostname.replace(/^www\.|^m\./, '')
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok'
  if (/(^|\.)instagram\.com$/.test(host) || host === 'instagr.am') return 'instagram'
  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return 'youtube'
  if (/(^|\.)facebook\.com$/.test(host) || host === 'fb.watch') return 'facebook'
  return 'web'
}

/** Pulls the first http(s) URL out of whatever a share sheet handed us. */
export function findUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s<>"']+/i)
  return match ? match[0].replace(/[).,]+$/, '') : null
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  const lower = address.toLowerCase()
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:')
}

/** The server fetches URLs people paste in, so it must never be pointed at the internal network. */
async function assertPublic(url) {
  const parsed = new URL(url)
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('רק קישורי http/https נתמכים.')
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('כתובת לא נתמכת.')
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true })
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error('כתובת לא נתמכת.')
}

async function safeFetch(url, { accept = 'text/html,application/xhtml+xml,*/*;q=0.8' } = {}) {
  let current = url
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(current)
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': UA, accept, 'accept-language': 'he-IL,he;q=0.9,en;q=0.8' },
    })
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      current = new URL(response.headers.get('location'), current).toString()
      continue
    }
    const reader = response.body?.getReader()
    const chunks = []
    let size = 0
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > MAX_BYTES) {
          await reader.cancel()
          break
        }
        chunks.push(value)
      }
    }
    return { ok: response.ok, status: response.status, url: current, body: Buffer.concat(chunks).toString('utf8') }
  }
  throw new Error('יותר מדי הפניות.')
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function meta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1]
  return content ? decodeEntities(content).trim() : ''
}

function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipeNode(child)
      if (found) return found
    }
    return null
  }
  const type = node['@type']
  if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) return node
  return findRecipeNode(node['@graph']) || findRecipeNode(node.mainEntity) || null
}

function jsonLdRecipe(html) {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const block of blocks) {
    try {
      const found = findRecipeNode(JSON.parse(block[1].trim()))
      if (found) return found
    } catch {
      // Sites ship broken JSON-LD all the time; try the next block.
    }
  }
  return null
}

/** ISO-8601 durations ("PT1H15M") → minutes. */
export function isoMinutes(value) {
  const m = String(value || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i)
  if (!m) return 0
  return Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0)
}

function flattenInstructions(value) {
  if (!value) return []
  if (typeof value === 'string') return value.split(/\n+/).map((s) => decodeEntities(s.replace(/<[^>]+>/g, '')).trim()).filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(flattenInstructions)
  if (value.itemListElement) return flattenInstructions(value.itemListElement)
  if (value.text) return flattenInstructions(value.text)
  if (value.name) return flattenInstructions(value.name)
  return []
}

function firstImage(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return firstImage(value[0])
  return value.url || ''
}

/** Turns schema.org Recipe markup into the plain shape the rest of the server understands. */
export function fromJsonLd(ld) {
  const yieldText = Array.isArray(ld.recipeYield) ? ld.recipeYield.join(' ') : String(ld.recipeYield || '')
  const servings = Number(yieldText.match(/\d+/)?.[0]) || 4
  const author = Array.isArray(ld.author) ? ld.author[0]?.name : ld.author?.name || ld.author
  return {
    title: decodeEntities(ld.name || '').trim(),
    description: decodeEntities(String(ld.description || '').replace(/<[^>]+>/g, '')).trim(),
    image: firstImage(ld.image),
    author: typeof author === 'string' ? decodeEntities(author) : '',
    servings,
    prepMinutes: isoMinutes(ld.prepTime),
    cookMinutes: isoMinutes(ld.cookTime) || Math.max(0, isoMinutes(ld.totalTime) - isoMinutes(ld.prepTime)),
    ingredients: (ld.recipeIngredient || ld.ingredients || []).map((s) => decodeEntities(String(s).replace(/<[^>]+>/g, '')).trim()).filter(Boolean),
    steps: flattenInstructions(ld.recipeInstructions),
    cuisine: Array.isArray(ld.recipeCuisine) ? ld.recipeCuisine[0] || '' : ld.recipeCuisine || '',
  }
}

function visibleText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

async function oembed(endpoint) {
  try {
    const res = await safeFetch(endpoint, { accept: 'application/json' })
    return res.ok ? JSON.parse(res.body) : null
  } catch {
    return null
  }
}

function youtubeDescription(html) {
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
  if (!m) return ''
  try {
    return JSON.parse(`"${m[1]}"`)
  } catch {
    return ''
  }
}

/**
 * Gathers everything we can about a shared link: the platform, a caption or page
 * text, and schema.org recipe markup when the site has it. Never throws for a page
 * that merely has little on it — the caller decides whether that is enough.
 */
export async function gatherSource(rawUrl) {
  const url = new URL(rawUrl).toString()
  const platform = detectPlatform(url)
  const source = { url, platform, title: '', author: '', image: '', caption: '', pageText: '', ld: null }

  if (platform === 'tiktok') {
    const data = await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
    if (data) Object.assign(source, { caption: data.title || '', author: data.author_name || '', image: data.thumbnail_url || '' })
  }
  if (platform === 'youtube') {
    const data = await oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
    if (data) Object.assign(source, { title: data.title || '', author: data.author_name || '', image: data.thumbnail_url || '' })
  }

  let page = null
  try {
    page = await safeFetch(url)
  } catch (error) {
    if (!source.caption && !source.title) throw error
  }

  if (page?.body) {
    const html = page.body
    source.url = page.url
    source.title ||= meta(html, 'og:title') || decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim()
    source.image ||= meta(html, 'og:image')
    const description = meta(html, 'og:description') || meta(html, 'description')
    if (platform === 'youtube') source.caption = youtubeDescription(html) || description
    else if (platform !== 'web') source.caption ||= description
    else source.caption = description

    const ld = jsonLdRecipe(html)
    if (ld) source.ld = fromJsonLd(ld)
    if (platform === 'web' && !source.ld) source.pageText = visibleText(html).slice(0, 40000)
  }
  return source
}

/** How much recipe-ish text did we actually get? Used to decide whether to research further. */
export function sourceIsThin(source) {
  if (source.ld?.ingredients?.length) return false
  const text = `${source.caption}\n${source.pageText}`
  const lines = text.split(/\n/).filter((l) => /\d/.test(l)).length
  return text.trim().length < 250 || lines < 3
}
