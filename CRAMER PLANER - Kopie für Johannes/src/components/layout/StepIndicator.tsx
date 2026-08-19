import { useNavigate } from 'react-router-dom'
import { visibleWorkflowSteps } from '../../config/workflow'
import { useDraft } from '../../context/DraftContext'
import styles from './StepIndicator.module.css'

/**
 * Fortschritts-Anzeige des Konfigurations-Workflows – Phase 10: voll interaktiv.
 * Jeder Schritt ist klickbar und springt (ohne Zustandsverlust) zur zugehörigen
 * Route; die vorhandenen Routen-Weichen sichern die Konsistenz der Eingaben.
 * Serien-abhängig: Refugium zeigt den zusätzlichen Schritt „Ausstattung" (Schritt 6).
 */
export function StepIndicator({ activeKey }: { activeKey: string }) {
  const navigate = useNavigate()
  const { draft } = useDraft()
  const steps = visibleWorkflowSteps(draft?.seriesId)
  const activeIndex = steps.findIndex((step) => step.key === activeKey)

  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => {
        const state = step.key === activeKey ? 'active' : index < activeIndex ? 'done' : undefined
        return (
          <li
            key={step.key}
            className={[styles.step, state ? styles[state] : ''].filter(Boolean).join(' ')}
          >
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => navigate(step.route)}
              aria-current={step.key === activeKey ? 'step' : undefined}
              title={`Zu Schritt ${index + 1}: ${step.label}`}
            >
              <span className={styles.no}>{index + 1}</span>
              <span className={styles.label}>{step.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
