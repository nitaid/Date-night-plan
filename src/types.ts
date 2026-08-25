export type BookingMethod =
  | 'walk_in'
  | 'reservation_recommended'
  | 'reservation_required'
  | 'phone'
  | 'website'
  | 'app'
  | 'tickets'

export type StopKind =
  | 'food'
  | 'drinks'
  | 'dessert'
  | 'activity'
  | 'show'
  | 'outdoors'
  | 'sightseeing'
  | 'travel'
  | 'chill'
  | 'surprise'

export type BookingStatus = 'todo' | 'booked' | 'confirmed' | 'not_needed'
export type PlanStatus = 'draft' | 'scheduled' | 'done' | 'cancelled'
export type WishStatus = 'idea' | 'planned' | 'done'
export type Budget = 'shoestring' | 'moderate' | 'generous' | 'splurge'
export type Transport = 'walking' | 'transit' | 'car' | 'taxi' | 'bike'
export type Partner = 'a' | 'b'

export interface Alternative {
  venueName: string
  area: string
  why: string
  mapsQuery: string
  url: string
  costPerPerson: number
}

export interface Booking {
  method: BookingMethod
  url: string
  phone: string
  notes: string
  leadTime: string
}

/** One part of an evening. Fields above `id` mirror the AI plan schema exactly. */
export interface Stop {
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

  id: string
  bookingStatus: BookingStatus
  /** Locked stops survive a regenerate. */
  locked: boolean
}

export interface Plan {
  id: string
  title: string
  summary: string
  theme: string
  vibeTags: string[]
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  stops: Stop[]
  currency: string
  totalCostPerPerson: number
  dressCode: string
  travelNotes: string
  weatherNote: string
  backupPlan: string
  bookingChecklist: string[]

  status: PlanStatus
  source: 'ai' | 'offline' | 'manual'
  createdBy: Partner | 'unknown'
  createdAt: string
  updatedAt: string
  calendarExportedAt: string | null

  /** Filled in after the evening happens. */
  rating: number | null
  memoryNote: string
  actualCostPerPerson: number | null
  wouldRepeat: boolean | null
}

export interface WishItem {
  id: string
  title: string
  notes: string
  tags: string[]
  estCost: number | null
  location: string
  url: string
  addedBy: Partner | 'unknown'
  /** Each partner independently hearts an idea. Two hearts means do it soon. */
  hearts: Partner[]
  status: WishStatus
  createdAt: string
  updatedAt: string
  plannedPlanId: string | null
}

export interface Profile {
  coupleName: string
  partnerAName: string
  partnerBName: string
  anniversary: string
  homeCity: string
  radiusKm: number
  budget: Budget
  currency: string
  transport: Transport
  interests: string[]
  avoid: string[]
  dietary: string[]
  accessibility: string[]
  languages: string[]
  defaultStartTime: string
  defaultDurationHours: number
  notes: string
  onboarded: boolean
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  language: 'en' | 'he'
  /** Minutes before each stop to set a calendar alarm. 0 disables alarms. */
  reminderMinutes: number
  /** Add a travel buffer event between stops when exporting to a calendar. */
  exportTravelBuffers: boolean
  /** How often you want a date night, used for the nudge on the home screen. */
  cadenceDays: number
  lastNudgeDismissed: string | null
  me: Partner
}

export interface AppState {
  version: number
  profile: Profile
  settings: Settings
  wishlist: WishItem[]
  plans: Plan[]
  /** Entity-level clocks so two devices can merge without losing edits. */
  deleted: Record<string, string>
  updatedAt: string
}

export interface SyncStatus {
  mode: 'local' | 'cloud'
  state: 'off' | 'signed_out' | 'connecting' | 'live' | 'error'
  email: string | null
  coupleId: string | null
  inviteCode: string | null
  message: string
}
