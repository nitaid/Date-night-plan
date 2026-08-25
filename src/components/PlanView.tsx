import { useMemo, useState } from 'react'
import type { Plan, Stop, WishItem } from '../types'
import { addMinutes, eveningMinutes, formatDate, formatDuration, formatMoney } from '../lib/format'
import { blankStop, requestStop } from '../lib/planApi'
import { sharePlan } from '../lib/share'
import { useStore } from '../state/store'
import { CalendarSheet } from './CalendarSheet'
import { StopCard } from './StopCard'
import { Button, Chip, Empty, Field, Sheet, Stars } from './ui'

export function PlanView({
  plan,
  editable,
  onChange,
  onStopChange,
  onRemoveStop,
  onAddStop,
  onReplaceStop,
  header,
  footer,
}: {
  plan: Plan
  editable: boolean
  onChange: (patch: Partial<Plan>) => void
  onStopChange: (stopId: string, patch: Partial<Stop>) => void
  onRemoveStop: (stopId: string) => void
  onAddStop: (stop: Stop) => void
  onReplaceStop: (stopId: string, stop: Stop) => void
  header?: React.ReactNode
  footer?: React.ReactNode
}) {
  const { t, language, state, toast } = useStore()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)

  const stops = useMemo(
    () => [...plan.stops].sort((a, b) => eveningMinutes(a.startTime) - eveningMinutes(b.startTime)),
    [plan.stops],
  )

  const totalMinutes = stops.length
    ? eveningMinutes(addMinutes(stops[stops.length - 1].startTime, stops[stops.length - 1].durationMin)) -
      eveningMinutes(stops[0].startTime)
    : 0

  const toBook = stops.filter((stop) => stop.bookingStatus === 'todo').length

  const regenerate = async (stop: Stop, instruction?: string) => {
    setRegenerating(stop.id)
    try {
      const index = stops.findIndex((s) => s.id === stop.id)
      const result = await requestStop(plan, index, state.profile, language, instruction)
      onReplaceStop(stop.id, { ...result.stop, startTime: stop.startTime, durationMin: stop.durationMin })
      if (result.notice) toast(t(result.notice), 'info')
      else toast(t('Swapped in something new.'), 'good')
    } catch {
      toast(t('Could not find another option just now.'), 'error')
    } finally {
      setRegenerating(null)
    }
  }

  const unplanned = state.wishlist.filter((item) => item.status !== 'done')

  const addFromWish = (item: WishItem) => {
    const last = stops[stops.length - 1]
    const start = last ? addMinutes(last.startTime, last.durationMin + 15) : plan.stops[0]?.startTime || '19:00'
    onAddStop({
      ...blankStop(start),
      title: item.title,
      venueName: item.title,
      area: item.location || state.profile.homeCity,
      description: item.notes,
      why: t('From your ideas list.'),
      costPerPerson: item.estCost ?? 0,
      mapsQuery: `${item.title} ${item.location || state.profile.homeCity}`.trim(),
      booking: { method: 'walk_in', url: item.url, phone: '', notes: '', leadTime: '' },
    })
    setAddOpen(false)
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      {header}

      <div className="hero">
        {renaming && editable ? (
          <input
            className="input"
            autoFocus
            value={plan.title}
            onChange={(event) => onChange({ title: event.target.value })}
            onBlur={() => setRenaming(false)}
            onKeyDown={(event) => event.key === 'Enter' && setRenaming(false)}
            style={{ color: 'var(--ink)' }}
          />
        ) : (
          <h1 onClick={() => editable && setRenaming(true)} style={{ cursor: editable ? 'text' : 'default' }}>
            {plan.title}
          </h1>
        )}
        <p className="muted">{plan.summary}</p>
        <div className="row wrap" style={{ gap: 6 }}>
          {plan.vibeTags.map((tag) => (
            <span key={tag} className="chip" style={{ background: 'rgb(255 255 255 / 0.18)', borderColor: 'transparent', color: '#fff' }}>
              {tag}
            </span>
          ))}
        </div>
        <div className="row wrap between" style={{ gap: 8 }}>
          <span className="muted">
            📅 {formatDate(plan.date, language, { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <span className="muted">
            💸 {formatMoney(plan.totalCostPerPerson, plan.currency, language)} {t('pp')}
            {totalMinutes > 0 ? ` · ⏱️ ${formatDuration(totalMinutes, language)}` : ''}
          </span>
        </div>
        {editable ? (
          <div className="row wrap" style={{ gap: 8 }}>
            <input
              className="input"
              type="date"
              value={plan.date}
              onChange={(event) => onChange({ date: event.target.value })}
              style={{ maxWidth: 180, color: 'var(--ink)' }}
            />
            <Button variant="onhero" onClick={() => setCalendarOpen(true)}>
              📆 {t('Add to calendar')}
            </Button>
            <Button
              variant="onhero"
              onClick={async () => {
                const result = await sharePlan(plan, language)
                if (result === 'copied') toast(t('Plan copied to your clipboard.'), 'good')
                if (result === 'failed') toast(t('Could not share this plan.'), 'error')
              }}
            >
              📤 {t('Share')}
            </Button>
          </div>
        ) : null}
      </div>

      {plan.calendarExportedAt ? (
        <div className="banner good">✅ {t('Added to your calendar.')}</div>
      ) : null}

      {toBook > 0 ? (
        <div className="banner">
          📋 {t('{n} stops still need booking.', { n: toBook })}
        </div>
      ) : null}

      <div className="timeline">
        {stops.map((stop, index) => (
          <StopCard
            key={stop.id}
            stop={stop}
            plan={plan}
            index={index}
            editable={editable}
            regenerating={regenerating === stop.id}
            onChange={(patch) => onStopChange(stop.id, patch)}
            onRemove={() => onRemoveStop(stop.id)}
            onRegenerate={(instruction) => regenerate(stop, instruction)}
          />
        ))}
        {!stops.length ? <Empty glyph="🗓️" title={t('No stops yet')} body={t('Add one to start building the evening.')} /> : null}
      </div>

      {editable ? (
        <Button block onClick={() => setAddOpen(true)}>
          ＋ {t('Add a stop')}
        </Button>
      ) : null}

      {plan.bookingChecklist.length ? (
        <div className="card">
          <h3>📋 {t('Before the night')}</h3>
          {plan.bookingChecklist.map((item, index) => (
            <span key={index} className="muted">
              · {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="card">
        {plan.dressCode ? (
          <div className="kv">
            <span className="k">👗</span>
            <span>{plan.dressCode}</span>
          </div>
        ) : null}
        {plan.travelNotes ? (
          <div className="kv">
            <span className="k">🚶</span>
            <span>{plan.travelNotes}</span>
          </div>
        ) : null}
        {plan.weatherNote ? (
          <div className="kv">
            <span className="k">🌦️</span>
            <span>{plan.weatherNote}</span>
          </div>
        ) : null}
        {plan.backupPlan ? (
          <div className="kv">
            <span className="k">🛟</span>
            <span>{plan.backupPlan}</span>
          </div>
        ) : null}
        <span className="tiny faint">
          {plan.source === 'ai'
            ? t('Planned by Claude. Always double-check opening hours before you go.')
            : plan.source === 'manual'
              ? t('You built this one yourself.')
              : t('Built by the offline planner. Pick the exact venue from the map links.')}
        </span>
      </div>

      {footer}

      {calendarOpen ? (
        <CalendarSheet
          plan={plan}
          onClose={() => setCalendarOpen(false)}
          onExported={() => onChange({ calendarExportedAt: new Date().toISOString(), status: 'scheduled' })}
        />
      ) : null}

      {addOpen ? (
        <Sheet title={t('Add a stop')} onClose={() => setAddOpen(false)}>
          <Button
            variant="primary"
            block
            onClick={() => {
              const last = stops[stops.length - 1]
              onAddStop(blankStop(last ? addMinutes(last.startTime, last.durationMin + 15) : '19:00'))
              setAddOpen(false)
            }}
          >
            ✏️ {t('Blank stop I fill in myself')}
          </Button>
          {unplanned.length ? (
            <>
              <hr className="divider" />
              <h3>{t('From your ideas')}</h3>
              {unplanned.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="alt"
                  style={{ textAlign: 'start', cursor: 'pointer' }}
                  onClick={() => addFromWish(item)}
                >
                  <strong>{item.title}</strong>
                  {item.notes ? <span className="muted">{item.notes}</span> : null}
                </button>
              ))}
            </>
          ) : null}
        </Sheet>
      ) : null}
    </div>
  )
}

/** The after-the-fact half: rating, what it actually cost, what you remember. */
export function PlanMemory({ plan, onChange }: { plan: Plan; onChange: (patch: Partial<Plan>) => void }) {
  const { t } = useStore()
  return (
    <div className="card">
      <h3>💭 {t('How was it?')}</h3>
      <div className="row between">
        <span className="muted">{t('Rating')}</span>
        <Stars value={plan.rating} onChange={(rating) => onChange({ rating, status: 'done' })} />
      </div>
      <Field label={t('What actually happened')}>
        <textarea
          className="textarea"
          value={plan.memoryNote}
          placeholder={t('The bit you want to remember in a year.')}
          onChange={(event) => onChange({ memoryNote: event.target.value })}
        />
      </Field>
      <Field label={`${t('What it actually cost each')} (${plan.currency})`}>
        <input
          className="input"
          type="number"
          min={0}
          value={plan.actualCostPerPerson ?? ''}
          onChange={(event) => onChange({ actualCostPerPerson: event.target.value === '' ? null : Number(event.target.value) })}
        />
      </Field>
      <div className="row wrap" style={{ gap: 6 }}>
        <Chip on={plan.wouldRepeat === true} onClick={() => onChange({ wouldRepeat: true })}>
          👍 {t('Do it again')}
        </Chip>
        <Chip on={plan.wouldRepeat === false} onClick={() => onChange({ wouldRepeat: false })}>
          👎 {t('Once was enough')}
        </Chip>
      </div>
    </div>
  )
}
