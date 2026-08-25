import Anthropic, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { PlanSchema, SingleStopSchema } from './planSchema.mjs'
import { buildSystemPrompt, buildPlanPrompt, buildStopPrompt } from './prompt.mjs'
import { normalizePlan, normalizeStop } from './normalize.mjs'

const DEFAULT_MODEL = 'claude-opus-5'
const MAX_BODY_BYTES = 512 * 1024

let client = null
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) {
    client = new Anthropic({
      // Plan generation runs with adaptive thinking, so give it room to finish.
      timeout: 5 * 60 * 1000,
      maxRetries: 2,
    })
  }
  return client
}

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
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

/**
 * Turns SDK failures into something the UI can act on. The client falls back to
 * the offline planner for every `retryable`/`unavailable` case, so the couple
 * always ends up with a plan.
 */
function describeError(error) {
  // Schema validation failures surface as plain errors from the parse helper.
  // They are a bad *response*, not a broken server, so the client should fall
  // back to the offline planner rather than show a hard failure.
  if (/parse structured output/i.test(error?.message || '')) {
    return { status: 502, code: 'unparseable', message: 'The planner returned a plan that did not match the expected shape.' }
  }
  if (error instanceof AuthenticationError) {
    return { status: 502, code: 'bad_key', message: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.' }
  }
  if (error instanceof RateLimitError) {
    return { status: 503, code: 'rate_limited', message: 'The AI planner is rate limited right now.' }
  }
  if (error instanceof APIConnectionError) {
    return { status: 503, code: 'unreachable', message: 'Could not reach the AI planner.' }
  }
  if (error instanceof APIError) {
    return { status: 502, code: 'api_error', message: error.message }
  }
  return { status: 500, code: 'unknown', message: error?.message || 'Plan generation failed.' }
}

async function generate({ system, prompt, schema, model }) {
  const anthropic = getClient()
  const response = await anthropic.messages.parse({
    model: model || process.env.DATE_NIGHT_MODEL || DEFAULT_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: zodOutputFormat(schema) },
  })

  if (response.stop_reason === 'refusal') {
    const err = new Error('The planner declined this request.')
    err.code = 'refused'
    throw err
  }
  if (!response.parsed_output) {
    const err = new Error('The planner returned a response that did not match the plan format.')
    err.code = 'unparseable'
    throw err
  }
  return { data: response.parsed_output, model: response.model, usage: response.usage }
}

export async function handlePlanRequest(req, res) {
  if (req.method === 'GET') {
    return send(res, 200, { ai: Boolean(process.env.ANTHROPIC_API_KEY), model: process.env.DATE_NIGHT_MODEL || DEFAULT_MODEL })
  }
  if (req.method !== 'POST') {
    return send(res, 405, { error: { code: 'method_not_allowed', message: 'Use POST.' } })
  }
  if (!getClient()) {
    return send(res, 503, {
      error: { code: 'no_key', message: 'No ANTHROPIC_API_KEY is configured on the server. Using the offline planner instead.' },
    })
  }

  let body
  try {
    body = await readBody(req)
  } catch {
    return send(res, 400, { error: { code: 'bad_request', message: 'Could not read the request body.' } })
  }

  const { mode = 'plan', profile = {}, model } = body
  const system = buildSystemPrompt(profile)

  try {
    if (mode === 'stop') {
      if (!body.plan || typeof body.stopIndex !== 'number') {
        return send(res, 400, { error: { code: 'bad_request', message: 'A stop regeneration needs `plan` and `stopIndex`.' } })
      }
      const result = await generate({
        system,
        prompt: buildStopPrompt({ plan: body.plan, stopIndex: body.stopIndex, instruction: body.instruction }),
        schema: SingleStopSchema,
        model,
      })
      const fallbackTime = body.plan.stops?.[body.stopIndex]?.startTime || '19:00'
      return send(res, 200, { stop: normalizeStop(result.data.stop, fallbackTime), model: result.model })
    }

    if (!body.theme || !String(body.theme).trim()) {
      return send(res, 400, { error: { code: 'bad_request', message: 'Tell the planner a theme first.' } })
    }

    const result = await generate({
      system,
      prompt: buildPlanPrompt({
        theme: String(body.theme).slice(0, 600),
        date: body.date,
        startTime: body.startTime,
        durationHours: body.durationHours,
        wishlist: body.wishlist,
        recentPlans: body.recentPlans,
        extraNotes: body.extraNotes,
      }),
      schema: PlanSchema,
      model,
    })
    const plan = normalizePlan(result.data, {
      startTime: body.startTime || profile.defaultStartTime || '19:00',
      currency: profile.currency || 'ILS',
    })
    return send(res, 200, { plan, model: result.model })
  } catch (error) {
    if (error?.code === 'refused' || error?.code === 'unparseable') {
      return send(res, 502, { error: { code: error.code, message: error.message } })
    }
    const described = describeError(error)
    return send(res, described.status, { error: { code: described.code, message: described.message } })
  }
}

export default handlePlanRequest
