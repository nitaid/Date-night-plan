import Anthropic, { APIConnectionError, APIError, AuthenticationError, RateLimitError } from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { ImportSchema, MealPlanSchema, SingleRecipeSchema } from './schema.mjs'
import {
  SYSTEM_PROMPT,
  RESEARCH_PROMPT,
  buildGeneratePrompt,
  buildImagePrompt,
  buildImportPrompt,
  buildMealPlanPrompt,
  buildSwapPrompt,
} from './prompt.mjs'
import { normalizeRecipe, recipeFromJsonLd } from './normalize.mjs'
import { findUrl, gatherSource, sourceIsThin } from './extract.mjs'

const DEFAULT_MODEL = 'claude-opus-5-5'
const MAX_BODY_BYTES = 12 * 1024 * 1024 // screenshots arrive as base64
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

let client = null
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  client ||= new Anthropic({ timeout: 5 * 60 * 1000, maxRetries: 2 })
  return client
}

const model = () => process.env.MATKONIT_MODEL || DEFAULT_MODEL

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function send(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

class UserFacingError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function describeError(error) {
  if (error instanceof UserFacingError) return { status: error.status, code: error.code, message: error.message }
  if (error instanceof AuthenticationError) return { status: 502, code: 'bad_key', message: 'מפתח ה-API של Anthropic נדחה. בדקו את ANTHROPIC_API_KEY.' }
  if (error instanceof RateLimitError) return { status: 503, code: 'rate_limited', message: 'יותר מדי בקשות כרגע. נסו שוב בעוד דקה.' }
  if (error instanceof APIConnectionError) return { status: 503, code: 'unreachable', message: 'אין חיבור לשירות ה-AI.' }
  if (error instanceof APIError) return { status: 502, code: 'api_error', message: error.message }
  if (error?.name === 'TimeoutError') return { status: 504, code: 'timeout', message: 'האתר לא ענה בזמן.' }
  if (error?.code === 'ENOTFOUND' || error?.message === 'fetch failed') {
    return { status: 502, code: 'unreachable_site', message: 'לא הצלחנו לפתוח את הקישור. בדקו שהוא נכון, או הדביקו את טקסט המתכון.' }
  }
  return { status: 500, code: 'unknown', message: error?.message || 'משהו השתבש.' }
}

/**
 * One structured call. Streams so long meal plans never hit an HTTP timeout, and
 * opts into server-side refusal fallbacks so a false-positive decline still
 * gets the user a recipe.
 */
async function generate({ content, schema, effort = 'medium', maxTokens = 16000 }) {
  const stream = getClient().beta.messages.stream({
    model: model(),
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') throw new UserFacingError(422, 'refused', 'ה-AI סירב לבקשה הזו.')
  if (message.stop_reason === 'max_tokens') throw new UserFacingError(502, 'truncated', 'התשובה נחתכה באמצע. נסו שוב.')
  if (!message.parsed_output) throw new UserFacingError(502, 'unparseable', 'התשובה לא הגיעה במבנה הצפוי.')
  return message.parsed_output
}

/**
 * When a caption is just "recipe in bio 👇", ask Claude to go look with web search
 * and fetch, then hand whatever it found to the structured import call.
 */
async function research(source) {
  const messages = [{ role: 'user', content: RESEARCH_PROMPT(source) }]
  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 },
  ]
  for (let turn = 0; turn < 4; turn++) {
    const message = await getClient()
      .beta.messages.stream({
        model: model(),
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        tools,
        messages,
      })
      .finalMessage()
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content })
      continue
    }
    const found = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
    return /^לא נמצא/.test(found) ? '' : found
  }
  return ''
}

function finishImport(result, extra) {
  if (!result.found) throw new UserFacingError(422, 'no_recipe', result.reason || 'לא מצאנו מתכון בתוכן הזה.')
  return { recipe: normalizeRecipe(result.recipe, extra), estimated: result.estimated }
}

async function importUrl(body) {
  const url = findUrl(body.url || body.text)
  if (!url) throw new UserFacingError(400, 'bad_request', 'לא מצאנו קישור.')
  const source = await gatherSource(url)
  const extra = { imageUrl: source.image || source.ld?.image, sourceUrl: source.url, author: source.ld?.author || source.author }

  if (!getClient()) {
    if (source.ld?.ingredients?.length) {
      return { recipe: recipeFromJsonLd(source.ld, source), platform: source.platform, ai: false }
    }
    throw new UserFacingError(503, 'no_key', 'בלי מפתח AI אפשר לייבא רק מאתרי מתכונים עם סימון מובנה. נסו להדביק את טקסט המתכון.')
  }

  if (sourceIsThin(source)) source.research = await research(source).catch(() => '')
  const result = await generate({ content: buildImportPrompt({ source, text: body.text && body.text !== url ? body.text : '' }), schema: ImportSchema })
  return { ...finishImport(result, extra), platform: source.platform, ai: true }
}

export async function handleAiRequest(req, res) {
  if (req.method === 'GET') return send(res, 200, { ai: Boolean(process.env.ANTHROPIC_API_KEY), model: model() })
  if (req.method !== 'POST') return send(res, 405, { error: { code: 'method_not_allowed', message: 'Use POST.' } })

  let body
  try {
    body = await readBody(req)
  } catch {
    return send(res, 400, { error: { code: 'bad_request', message: 'לא הצלחנו לקרוא את הבקשה.' } })
  }

  try {
    const mode = body.mode
    // Link import works without a key for sites with recipe markup; everything else needs the AI.
    if (mode !== 'import-url' && !getClient()) {
      throw new UserFacingError(503, 'no_key', 'לא הוגדר מפתח ANTHROPIC_API_KEY בשרת.')
    }

    if (mode === 'import-url') return send(res, 200, await importUrl(body))

    if (mode === 'import-text') {
      const text = String(body.text || '').slice(0, 30000)
      if (!text.trim()) throw new UserFacingError(400, 'bad_request', 'הדביקו טקסט של מתכון.')
      const result = await generate({ content: buildImportPrompt({ text }), schema: ImportSchema })
      return send(res, 200, { ...finishImport(result, { sourceUrl: findUrl(text) || '' }), ai: true })
    }

    if (mode === 'import-image') {
      const images = (Array.isArray(body.images) ? body.images : []).filter((i) => IMAGE_TYPES.has(i?.mediaType) && typeof i.data === 'string').slice(0, 6)
      if (!images.length) throw new UserFacingError(400, 'bad_request', 'צרפו צילום מסך של המתכון.')
      const content = [
        ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
        { type: 'text', text: buildImagePrompt() },
      ]
      const result = await generate({ content, schema: ImportSchema })
      return send(res, 200, { ...finishImport(result, {}), ai: true })
    }

    if (mode === 'generate') {
      const result = await generate({
        content: buildGeneratePrompt({ prompt: String(body.prompt || '').slice(0, 800), pantry: body.pantry, profile: body.profile }),
        schema: SingleRecipeSchema,
      })
      return send(res, 200, { recipe: normalizeRecipe(result.recipe), ai: true })
    }

    if (mode === 'mealplan') {
      const dates = (Array.isArray(body.dates) ? body.dates : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 7)
      if (!dates.length) throw new UserFacingError(400, 'bad_request', 'אין ימים לתכנון.')
      const result = await generate({
        content: buildMealPlanPrompt({ profile: body.profile, dates, cookbook: body.cookbook, keep: body.keep, recentTitles: body.recentTitles }),
        schema: MealPlanSchema,
        effort: 'high',
        maxTokens: 64000,
      })
      const known = new Set((body.cookbook || []).map((r) => r.id))
      const days = result.days
        .filter((d) => dates.includes(d.date))
        .map((d) => ({
          date: d.date,
          existingRecipeId: d.existingRecipeId && known.has(d.existingRecipeId) ? d.existingRecipeId : null,
          recipe: d.existingRecipeId && known.has(d.existingRecipeId) ? null : d.recipe ? normalizeRecipe(d.recipe) : null,
        }))
        .filter((d) => d.existingRecipeId || d.recipe)
      return send(res, 200, { note: result.note, days, ai: true })
    }

    if (mode === 'swap') {
      const result = await generate({
        content: buildSwapPrompt({ profile: body.profile, date: body.date, current: body.current, others: body.others, instruction: body.instruction }),
        schema: SingleRecipeSchema,
      })
      return send(res, 200, { recipe: normalizeRecipe(result.recipe), ai: true })
    }

    throw new UserFacingError(400, 'bad_request', `מצב לא מוכר: ${mode}`)
  } catch (error) {
    const described = describeError(error)
    return send(res, described.status, { error: { code: described.code, message: described.message } })
  }
}

export default handleAiRequest
