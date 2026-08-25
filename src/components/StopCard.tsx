import { useState } from 'react'
import type { Alternative, BookingStatus, Plan, Stop } from '../types'
import { addMinutes, formatDuration, formatMoney } from '../lib/format'
import { mapsUrl, stopHeadline, wazeUrl } from '../lib/calendar'
import { useStore } from '../state/store'
import { Button, Chip, Field, IconButton, Sheet } from './ui'

const KIND_GLYPH: Record<string, string> = {
  food: '🍽️',
  drinks: '🍸',
  dessert: '🍨',
  activity: '🎳',
  show: '🎭',
  outdoors: '🌆',
  sightseeing: '🖼️',
  travel: '🚕',
  chill: '🛋️',
  surprise: '🎁',
}

const BOOKING_LABEL: Record<string, string> = {
  walk_in: 'Just turn up',
  reservation_recommended: 'Booking recommended',
  reservation_required: 'Booking required',
  phone: 'Book by phone',
  website: 'Book online',
  app: 'Book in their app',
  tickets: 'Tickets needed',
}

const STATUS_ORDER: BookingStatus[] = ['todo', 'booked', 'confirmed', 'not_needed']
const STATUS_LABEL: Record<BookingStatus, string> = {
  todo: 'To book',
  booked: 'Booked',
  confirmed: 'Confirmed',
  not_needed: 'No booking',
}

export function StopCard({
  stop,
  plan,
  index,
  editable,
  onChange,
  onRemove,
  onRegenerate,
  regenerating,
}: {
  stop: Stop
  plan: Plan
  index: number
  editable: boolean
  onChange: (patch: Partial<Stop>) => void
  onRemove: () => void
  onRegenerate: (instruction?: string) => void
  regenerating: boolean
}) {
  const { t, language } = useStore()
  const [expanded, setExpanded] = useState(index === 0)
  const [editing, setEditing] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [ask, setAsk] = useState('')

  const endTime = addMinutes(stop.startTime, stop.durationMin)
  const status = stop.bookingStatus

  const cycleStatus = () => {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length]
    onChange({ bookingStatus: next })
  }

  const applyAlternative = (alt: Alternative) => {
    onChange({
      venueName: alt.venueName,
      area: alt.area,
      address: '',
      why: alt.why,
      mapsQuery: alt.mapsQuery,
      costPerPerson: alt.costPerPerson || stop.costPerPerson,
      booking: { ...stop.booking, url: alt.url, phone: '' },
      bookingStatus: 'todo',
      alternatives: [
        ...stop.alternatives.filter((a) => a.venueName !== alt.venueName),
        {
          venueName: stop.venueName,
          area: stop.area,
          why: stop.why,
          mapsQuery: stop.mapsQuery,
          url: stop.booking.url,
          costPerPerson: stop.costPerPerson,
        },
      ].slice(0, 3),
    })
    setSwapping(false)
  }

  return (
    <div className="stop">
      <div className="rail">
        <span className="time mono">{stop.startTime}</span>
        <span className="dot" />
        <span className="line" />
      </div>

      <div className="body">
        <div className={`stop-card ${stop.locked ? 'locked' : ''}`}>
          <div className="row top between">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{ background: 'none', border: 0, padding: 0, textAlign: 'start', cursor: 'pointer', flex: 1, minWidth: 0 }}
              aria-expanded={expanded}
            >
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: '1.15rem' }}>{KIND_GLYPH[stop.kind] || '📍'}</span>
                <div className="grow">
                  <h3 className="truncate">{stop.venueName || stop.title}</h3>
                  <span className="faint truncate" style={{ display: 'block' }}>
                    {[
                      stopHeadline(stop) === stop.venueName ? null : stop.title,
                      stop.area,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              </div>
            </button>
            {editable ? (
              <IconButton
                label={stop.locked ? t('Unlock this stop') : t('Lock this stop')}
                on={stop.locked}
                onClick={() => onChange({ locked: !stop.locked })}
              >
                {stop.locked ? '🔒' : '🔓'}
              </IconButton>
            ) : null}
          </div>

          <div className="row wrap" style={{ gap: 6 }}>
            <Chip tone="plain">
              {stop.startTime}–{endTime} · {formatDuration(stop.durationMin, language)}
            </Chip>
            {stop.costPerPerson > 0 ? (
              <Chip tone="plain">{formatMoney(stop.costPerPerson, plan.currency, language)} {t('pp')}</Chip>
            ) : (
              <Chip tone="good">{t('Free')}</Chip>
            )}
            <Chip
              tone={status === 'confirmed' ? 'good' : status === 'booked' ? 'gold' : undefined}
              onClick={editable ? cycleStatus : undefined}
            >
              {t(STATUS_LABEL[status])}
            </Chip>
          </div>

          {expanded ? (
            <>
              {stop.description ? <p className="muted">{stop.description}</p> : null}
              {stop.why ? (
                <p className="muted" style={{ fontStyle: 'italic' }}>
                  {stop.why}
                </p>
              ) : null}
              {stop.tips ? (
                <div className="kv">
                  <span className="k">💡</span>
                  <span>{stop.tips}</span>
                </div>
              ) : null}
              {stop.address ? (
                <div className="kv">
                  <span className="k">📍</span>
                  <span>{stop.address}</span>
                </div>
              ) : null}
              <div className="kv">
                <span className="k">🎟️</span>
                <span>
                  {t(BOOKING_LABEL[stop.booking.method] || 'Just turn up')}
                  {stop.booking.leadTime && stop.booking.method !== 'walk_in' ? ` · ${stop.booking.leadTime}` : ''}
                  {stop.booking.notes ? ` — ${stop.booking.notes}` : ''}
                </span>
              </div>

              <div className="row wrap" style={{ gap: 6 }}>
                {stop.mapsQuery ? (
                  <a className="btn small" href={mapsUrl(stop.mapsQuery)} target="_blank" rel="noreferrer">
                    🗺️ {t('Map')}
                  </a>
                ) : null}
                {stop.mapsQuery ? (
                  <a className="btn small" href={wazeUrl(stop.mapsQuery)} target="_blank" rel="noreferrer">
                    🚗 {t('Waze')}
                  </a>
                ) : null}
                {stop.booking.phone ? (
                  <a className="btn small" href={`tel:${stop.booking.phone.replace(/\s/g, '')}`}>
                    📞 {t('Call')}
                  </a>
                ) : null}
                {stop.booking.url ? (
                  <a className="btn small primary" href={stop.booking.url} target="_blank" rel="noreferrer">
                    🔗 {t('Book')}
                  </a>
                ) : null}
              </div>

              {editable ? (
                <div className="row wrap" style={{ gap: 6 }}>
                  <Button size="small" onClick={() => setEditing(true)}>
                    ✏️ {t('Edit')}
                  </Button>
                  {stop.alternatives.length ? (
                    <Button size="small" onClick={() => setSwapping(true)}>
                      🔀 {t('Swap')} ({stop.alternatives.length})
                    </Button>
                  ) : null}
                  <Button size="small" busy={regenerating} onClick={() => setAskOpen(true)}>
                    ✨ {t('Something else')}
                  </Button>
                  <Button size="small" variant="danger" onClick={onRemove}>
                    {t('Remove')}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {editing ? (
        <StopEditor
          stop={stop}
          currency={plan.currency}
          onClose={() => setEditing(false)}
          onSave={(patch) => {
            onChange(patch)
            setEditing(false)
          }}
        />
      ) : null}

      {swapping ? (
        <Sheet title={t('Swap this stop')} onClose={() => setSwapping(false)}>
          <p className="muted">{t('These are in the same area and fit the same slot.')}</p>
          {stop.alternatives.map((alt) => (
            <div key={alt.venueName} className="alt">
              <strong>{alt.venueName}</strong>
              <span className="faint">{alt.area}</span>
              <span className="muted">{alt.why}</span>
              <div className="row wrap" style={{ gap: 6 }}>
                <Button size="small" variant="primary" onClick={() => applyAlternative(alt)}>
                  {t('Use this one')}
                </Button>
                {alt.mapsQuery ? (
                  <a className="btn small" href={mapsUrl(alt.mapsQuery)} target="_blank" rel="noreferrer">
                    🗺️ {t('Map')}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </Sheet>
      ) : null}

      {askOpen ? (
        <Sheet
          title={t('Something else here')}
          onClose={() => setAskOpen(false)}
          footer={
            <Button
              variant="primary"
              block
              onClick={() => {
                onRegenerate(ask.trim() || undefined)
                setAsk('')
                setAskOpen(false)
              }}
            >
              ✨ {t('Find another option')}
            </Button>
          }
        >
          <Field label={t('What would you rather do here?')} hint={t('Leave blank for anything different.')}>
            <input
              className="input"
              value={ask}
              onChange={(event) => setAsk(event.target.value)}
              placeholder={t('e.g. somewhere quieter, or vegetarian')}
            />
          </Field>
        </Sheet>
      ) : null}
    </div>
  )
}

function StopEditor({
  stop,
  currency,
  onClose,
  onSave,
}: {
  stop: Stop
  currency: string
  onClose: () => void
  onSave: (patch: Partial<Stop>) => void
}) {
  const { t } = useStore()
  const [draft, setDraft] = useState({
    title: stop.title,
    venueName: stop.venueName,
    area: stop.area,
    address: stop.address,
    startTime: stop.startTime,
    durationMin: stop.durationMin,
    costPerPerson: stop.costPerPerson,
    description: stop.description,
    tips: stop.tips,
    phone: stop.booking.phone,
    url: stop.booking.url,
    notes: stop.booking.notes,
  })

  const set = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }))

  return (
    <Sheet
      title={t('Edit stop')}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          block
          onClick={() =>
            onSave({
              title: draft.title.trim() || stop.title,
              venueName: draft.venueName.trim(),
              area: draft.area.trim(),
              address: draft.address.trim(),
              startTime: draft.startTime,
              durationMin: Math.max(10, Number(draft.durationMin) || 60),
              costPerPerson: Math.max(0, Number(draft.costPerPerson) || 0),
              description: draft.description,
              tips: draft.tips,
              mapsQuery: draft.venueName.trim() || stop.mapsQuery,
              booking: { ...stop.booking, phone: draft.phone.trim(), url: draft.url.trim(), notes: draft.notes },
            })
          }
        >
          {t('Save changes')}
        </Button>
      }
    >
      <Field label={t('Venue or place')}>
        <input className="input" value={draft.venueName} onChange={(e) => set({ venueName: e.target.value })} />
      </Field>
      <Field label={t('What is this stop')}>
        <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <div className="row">
        <Field label={t('Starts')}>
          <input className="input" type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} />
        </Field>
        <Field label={t('Minutes')}>
          <input
            className="input"
            type="number"
            min={10}
            step={5}
            value={draft.durationMin}
            onChange={(e) => set({ durationMin: Number(e.target.value) })}
          />
        </Field>
        <Field label={`${t('Cost')} (${currency})`}>
          <input
            className="input"
            type="number"
            min={0}
            step={5}
            value={draft.costPerPerson}
            onChange={(e) => set({ costPerPerson: Number(e.target.value) })}
          />
        </Field>
      </div>
      <Field label={t('Area')}>
        <input className="input" value={draft.area} onChange={(e) => set({ area: e.target.value })} />
      </Field>
      <Field label={t('Address')}>
        <input className="input" value={draft.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <Field label={t('What you do here')}>
        <textarea className="textarea" value={draft.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label={t('Tip')}>
        <input className="input" value={draft.tips} onChange={(e) => set({ tips: e.target.value })} />
      </Field>
      <div className="row">
        <Field label={t('Phone')}>
          <input className="input" inputMode="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label={t('Booking link')}>
          <input className="input" inputMode="url" value={draft.url} onChange={(e) => set({ url: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Booking notes')}>
        <input className="input" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </Sheet>
  )
}
