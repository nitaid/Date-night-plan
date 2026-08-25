import type { Plan } from '../types'
import { addMinutes, formatDate, formatMoney } from './format'
import { mapsUrl } from './calendar'

export function planAsText(plan: Plan, language: string): string {
  const lines: string[] = [
    `${plan.title}`,
    `${formatDate(plan.date, language, { weekday: 'long', day: 'numeric', month: 'long' })}`,
    '',
  ]
  if (plan.summary) lines.push(plan.summary, '')

  plan.stops.forEach((stop) => {
    lines.push(`${stop.startTime}–${addMinutes(stop.startTime, stop.durationMin)}  ${stop.venueName || stop.title}`)
    if (stop.area) lines.push(`   ${stop.area}`)
    if (stop.costPerPerson) lines.push(`   ~${formatMoney(stop.costPerPerson, plan.currency, language)} pp`)
    if (stop.booking.url) lines.push(`   ${stop.booking.url}`)
    else if (stop.mapsQuery) lines.push(`   ${mapsUrl(stop.mapsQuery)}`)
    lines.push('')
  })

  if (plan.totalCostPerPerson) {
    lines.push(`Roughly ${formatMoney(plan.totalCostPerPerson, plan.currency, language)} each.`)
  }
  if (plan.dressCode) lines.push(`Wear: ${plan.dressCode}`)
  return lines.join('\n').trim()
}

export async function sharePlan(plan: Plan, language: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = planAsText(plan, language)
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await (navigator as any).share({ title: plan.title, text })
      return 'shared'
    } catch (error: any) {
      // A user-cancelled share is not a failure worth reporting.
      if (error?.name === 'AbortError') return 'shared'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
