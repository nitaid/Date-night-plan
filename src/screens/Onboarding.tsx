import { useState } from 'react'
import type { Budget, Transport } from '../types'
import { useStore } from '../state/store'
import { Button, Field, Segmented, TagInput } from '../components/ui'

const INTERESTS = ['food', 'live music', 'art', 'theatre', 'hiking', 'beach', 'board games', 'film', 'dancing', 'markets', 'wine', 'sport']
const DIETARY = ['vegetarian', 'vegan', 'kosher', 'halal', 'gluten free', 'nut allergy', 'no alcohol']

/** Three quick screens. Everything here can be changed later in Settings. */
export function Onboarding() {
  const { t, state, setProfile, setSettings } = useStore()
  const { profile } = state
  const [step, setStep] = useState(0)

  const next = () => setStep((s) => s + 1)

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      {step === 0 ? (
        <div className="col" style={{ gap: 18 }}>
          <div className="center col" style={{ gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: '3rem' }}>💘</div>
            <h1>{t('Date Night')}</h1>
            <p className="muted">{t('Tell it the kind of night you want. It builds the whole evening, you tweak it, then it goes in both your calendars.')}</p>
          </div>
          <div className="card">
            <div className="row wrap" style={{ gap: 8 }}>
              <Field label={t('One of you')}>
                <input
                  className="input"
                  autoFocus
                  value={profile.partnerAName}
                  onChange={(e) => setProfile({ partnerAName: e.target.value })}
                  placeholder={t('Your name')}
                />
              </Field>
              <Field label={t('The other')}>
                <input
                  className="input"
                  value={profile.partnerBName}
                  onChange={(e) => setProfile({ partnerBName: e.target.value })}
                  placeholder={t('Their name')}
                />
              </Field>
            </div>
            <Field label={t('Which one is this phone?')}>
              <Segmented
                value={state.settings.me}
                onChange={(me) => setSettings({ me })}
                options={[
                  { value: 'a', label: profile.partnerAName || t('Partner one') },
                  { value: 'b', label: profile.partnerBName || t('Partner two') },
                ]}
              />
            </Field>
          </div>
          <Button variant="primary" block onClick={next}>
            {t('Next')}
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="col" style={{ gap: 18 }}>
          <div className="screen-head">
            <h1>{t('Where are you based?')}</h1>
            <span className="sub">{t('Plans start from here unless you say otherwise.')}</span>
          </div>
          <div className="card">
            <Field label={t('Home base')}>
              <input
                className="input"
                autoFocus
                value={profile.homeCity}
                placeholder={t('Tel Aviv')}
                onChange={(e) => setProfile({ homeCity: e.target.value })}
              />
            </Field>
            <Field label={t('Currency')}>
              <input className="input" maxLength={3} value={profile.currency} onChange={(e) => setProfile({ currency: e.target.value.toUpperCase() })} />
            </Field>
            <Field label={t('Getting around')}>
              <select className="select" value={profile.transport} onChange={(e) => setProfile({ transport: e.target.value as Transport })}>
                <option value="walking">{t('On foot')}</option>
                <option value="transit">{t('Public transport')}</option>
                <option value="car">{t('We drive')}</option>
                <option value="taxi">{t('Taxis and ride-shares')}</option>
                <option value="bike">{t('Bikes or scooters')}</option>
              </select>
            </Field>
            <Field label={t('Usual budget')}>
              <select className="select" value={profile.budget} onChange={(e) => setProfile({ budget: e.target.value as Budget })}>
                <option value="shoestring">{t('Shoestring — cheap and cheerful')}</option>
                <option value="moderate">{t('Moderate — a normal night out')}</option>
                <option value="generous">{t('Generous — treat ourselves')}</option>
                <option value="splurge">{t('Splurge — special occasion')}</option>
              </select>
            </Field>
          </div>
          <div className="row">
            <Button variant="ghost" onClick={() => setStep(0)}>
              {t('Back')}
            </Button>
            <Button variant="primary" block onClick={next}>
              {t('Next')}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="col" style={{ gap: 18 }}>
          <div className="screen-head">
            <h1>{t('Last bit')}</h1>
            <span className="sub">{t('Skip anything — you can fill it in later.')}</span>
          </div>
          <div className="card">
            <Field label={t('Things you both enjoy')}>
              <TagInput value={profile.interests} onChange={(interests) => setProfile({ interests })} suggestions={INTERESTS} placeholder={t('Add something you love')} />
            </Field>
            <Field label={t('Food needs')} hint={t('Treated as hard rules when planning.')}>
              <TagInput value={profile.dietary} onChange={(dietary) => setProfile({ dietary })} suggestions={DIETARY} placeholder={t('Add a dietary need')} />
            </Field>
          </div>
          <div className="row">
            <Button variant="ghost" onClick={() => setStep(1)}>
              {t('Back')}
            </Button>
            <Button variant="primary" block onClick={() => setProfile({ onboarded: true })}>
              {t('Start planning')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
