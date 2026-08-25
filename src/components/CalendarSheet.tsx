import { useState } from 'react'
import type { Plan } from '../types'
import { downloadIcs, eventsForPlan, googleCalendarUrl, outlookCalendarUrl } from '../lib/calendar'
import { formatDate } from '../lib/format'
import { useStore } from '../state/store'
import { Button, Field, Sheet } from './ui'

const REMINDERS = [0, 30, 60, 120, 24 * 60]

export function CalendarSheet({ plan, onClose, onExported }: { plan: Plan; onClose: () => void; onExported: () => void }) {
  const { t, language, state, setSettings, toast } = useStore()
  const [reminder, setReminder] = useState(state.settings.reminderMinutes)
  const [buffers, setBuffers] = useState(state.settings.exportTravelBuffers)

  const events = eventsForPlan(plan, reminder, buffers)
  const wholeEvening = events.length
    ? {
        ...events[0],
        uid: `${plan.id}-all@date-night`,
        title: plan.title,
        description: [plan.summary, '', ...plan.stops.map((s) => `${s.startTime} ${s.venueName || s.title} (${s.area})`)].join('\n'),
        location: plan.stops[0]?.area || '',
        durationMin: Math.max(
          60,
          plan.stops.reduce((total, stop) => total + stop.durationMin + 15, 0),
        ),
      }
    : null

  const remember = () => {
    setSettings({ reminderMinutes: reminder, exportTravelBuffers: buffers })
    onExported()
  }

  const reminderLabel = (minutes: number) =>
    minutes === 0 ? t('None') : minutes >= 1440 ? t('1 day before') : minutes >= 60 ? t('{n}h before', { n: minutes / 60 }) : t('{n}m before', { n: minutes })

  return (
    <Sheet title={t('Add to your calendars')} onClose={onClose}>
      <p className="muted">
        {t('{count} events on {date}. Times are local — no timezone surprises.', {
          count: events.length,
          date: formatDate(plan.date, language, { weekday: 'long', day: 'numeric', month: 'long' }),
        })}
      </p>

      <Field label={t('Reminder before you set off')}>
        <div className="row wrap" style={{ gap: 6 }}>
          {REMINDERS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`chip ${reminder === minutes ? 'on' : ''}`}
              onClick={() => setReminder(minutes)}
            >
              {reminderLabel(minutes)}
            </button>
          ))}
        </div>
      </Field>

      <label className="checkline">
        <input type="checkbox" checked={buffers} onChange={(event) => setBuffers(event.target.checked)} />
        <span>{t('Block out the travel time between stops too')}</span>
      </label>

      <hr className="divider" />

      <h3>🍎 {t('Apple Calendar, and everything else')}</h3>
      <p className="faint">{t('Downloads one .ics file with every stop. Open it and your calendar app takes it from there.')}</p>
      <Button
        variant="primary"
        block
        onClick={() => {
          downloadIcs(events, `${plan.title}.ics`, plan.title)
          remember()
          toast(t('Calendar file downloaded — open it to add the evening.'), 'good')
        }}
      >
        ⬇️ {t('Download the whole evening')}
      </Button>

      <hr className="divider" />

      <h3>📅 {t('Google Calendar')}</h3>
      <p className="faint">{t('Google adds one event per link. Tap them in order — each opens a pre-filled event.')}</p>
      {wholeEvening ? (
        <a
          className="btn block"
          href={googleCalendarUrl(wholeEvening)}
          target="_blank"
          rel="noreferrer"
          onClick={remember}
        >
          {t('Add as one single event')}
        </a>
      ) : null}
      {events.map((event, index) => (
        <a
          key={event.uid}
          className="btn block"
          href={googleCalendarUrl(event)}
          target="_blank"
          rel="noreferrer"
          onClick={remember}
        >
          {index + 1}. {event.start} · {event.title}
        </a>
      ))}

      <hr className="divider" />

      <h3>📧 {t('Outlook')}</h3>
      {wholeEvening ? (
        <a className="btn block" href={outlookCalendarUrl(wholeEvening)} target="_blank" rel="noreferrer" onClick={remember}>
          {t('Add as one single event')}
        </a>
      ) : null}
    </Sheet>
  )
}
