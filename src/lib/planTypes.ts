import type { Alternative, Booking, Plan, Stop, StopKind } from '../types'

/** The plan shape the generator returns, before app-level fields are attached. */
export interface GeneratedStop {
  title: string
  kind: StopKind
  venueName: string
  area: string
  address: string
  description: string
  why: string
  startTime: string
  durationMin: number
  costPerPerson: number
  mapsQuery: string
  tips: string
  booking: Booking
  alternatives: Alternative[]
}

export interface GeneratedPlan {
  title: string
  summary: string
  vibeTags: string[]
  stops: GeneratedStop[]
  totalCostPerPerson: number
  currency: string
  dressCode: string
  travelNotes: string
  weatherNote: string
  backupPlan: string
  bookingChecklist: string[]
}

export type { Plan, Stop }
