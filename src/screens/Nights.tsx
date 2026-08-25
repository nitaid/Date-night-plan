import { useMemo, useState } from 'react'
import { formatDate, formatMoney, relativeDays, todayKey } from '../lib/format'
import { useStore } from '../state/store'
import { Chip, Empty, Segmented, Stars } from '../components/ui'

export function Nights({ onOpenPlan, onPlan }: { onOpenPlan: (id: string) => void; onPlan: () => void }) {
  const { t, language, state } = useStore()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const today = todayKey()

  const { upcoming, past } = useMemo(() => {
    const sorted = [...state.plans].filter((plan) => plan.status !== 'cancelled')
    return {
      upcoming: sorted.filter((plan) => plan.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
      past: sorted.filter((plan) => plan.date < today).sort((a, b) => b.date.localeCompare(a.date)),
    }
  }, [state.plans, today])

  const list = tab === 'upcoming' ? upcoming : past

  const spent = past.reduce((sum, plan) => sum + (plan.actualCostPerPerson ?? plan.totalCostPerPerson), 0) * 2
  const rated = past.filter((plan) => plan.rating)
  const average = rated.length ? rated.reduce((sum, plan) => sum + (plan.rating || 0), 0) / rated.length : null

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>{t('Your nights')}</h1>
        <span className="sub">{t('{upcoming} coming up, {past} behind you.', { upcoming: upcoming.length, past: past.length })}</span>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: t('Coming up') },
          { value: 'past', label: t('Been there') },
        ]}
      />

      {tab === 'past' && past.length ? (
        <div className="card tight">
          <div className="row wrap between">
            <span className="muted">💸 {formatMoney(spent, state.profile.currency, language)} {t('all in')}</span>
            {average ? (
              <span className="muted">
                ⭐ {average.toFixed(1)} {t('average')}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {list.length ? (
        <div className="col">
          {list.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className="card tight"
              onClick={() => onOpenPlan(plan.id)}
              style={{ textAlign: 'start', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
            >
              <div className="row between top">
                <div className="grow">
                  <h3>{plan.title}</h3>
                  <span className="faint">
                    {formatDate(plan.date, language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {relativeDays(plan.date, language)}
                  </span>
                </div>
                {plan.rating ? <Stars value={plan.rating} readOnly /> : null}
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                {plan.stops.slice(0, 3).map((stop) => (
                  <Chip key={stop.id} tone="plain">
                    {stop.venueName || stop.title}
                  </Chip>
                ))}
                {plan.stops.length > 3 ? <Chip tone="plain">+{plan.stops.length - 3}</Chip> : null}
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <Chip tone="plain">{formatMoney(plan.totalCostPerPerson, plan.currency, language)} {t('pp')}</Chip>
                {plan.calendarExportedAt ? <Chip tone="good">📆 {t('In your calendar')}</Chip> : null}
                {plan.stops.some((stop) => stop.bookingStatus === 'todo') ? <Chip tone="gold">{t('Needs booking')}</Chip> : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          glyph={tab === 'upcoming' ? '🗓️' : '📷'}
          title={tab === 'upcoming' ? t('Nothing planned') : t('No nights logged yet')}
          body={tab === 'upcoming' ? t('Plan one and it will show up here.') : t('Once a night has passed you can rate it and write down what happened.')}
          action={
            tab === 'upcoming' ? (
              <button type="button" className="btn primary" onClick={onPlan}>
                ✨ {t('Plan a night')}
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
