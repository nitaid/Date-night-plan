import { todayKey } from '../lib/format'
import { useStore } from '../state/store'
import { PlanMemory, PlanView } from '../components/PlanView'
import { Button } from '../components/ui'

export function PlanDetail({ planId, onBack }: { planId: string; onBack: () => void }) {
  const { t, state, updatePlan, updateStop, removeStop, addStop, replaceStop, removePlan, toast } = useStore()
  const plan = state.plans.find((item) => item.id === planId)

  if (!plan) {
    return (
      <div className="screen">
        <Button variant="ghost" onClick={onBack}>
          ← {t('Back')}
        </Button>
        <p className="muted">{t('That evening is not here any more.')}</p>
      </div>
    )
  }

  const isPast = plan.date < todayKey()

  return (
    <div className="screen">
      <PlanView
        plan={plan}
        editable
        header={
          <div className="row between">
            <Button variant="ghost" onClick={onBack}>
              ← {t('Back')}
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={() => {
                if (window.confirm(t('Delete "{title}"? This cannot be undone.', { title: plan.title }))) {
                  removePlan(plan.id)
                  toast(t('Deleted.'), 'info')
                  onBack()
                }
              }}
            >
              {t('Delete')}
            </Button>
          </div>
        }
        onChange={(patch) => updatePlan(plan.id, patch)}
        onStopChange={(stopId, patch) => updateStop(plan.id, stopId, patch)}
        onRemoveStop={(stopId) => removeStop(plan.id, stopId)}
        onAddStop={(stop) => addStop(plan.id, stop)}
        onReplaceStop={(stopId, stop) => replaceStop(plan.id, stopId, stop)}
        footer={isPast ? <PlanMemory plan={plan} onChange={(patch) => updatePlan(plan.id, patch)} /> : undefined}
      />
    </div>
  )
}
