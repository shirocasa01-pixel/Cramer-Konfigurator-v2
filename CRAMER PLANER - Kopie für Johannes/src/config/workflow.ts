/**
 * Schritte des Konfigurations-Workflows – als Daten gehalten, damit weitere
 * Schritte ohne Code-Umbau ergänzt werden können (Fortschritts-/Schritt-Anzeige).
 */
export interface WorkflowStep {
  key: string
  label: string
  /** Zugehörige Phase(n) laut Spezifikation – nur zur Orientierung. */
  phase: string
  /** Route für den klickbaren Schritt-Indikator (Phase 10). */
  route: string
  /** Nur für die Serie Refugium relevant (wird für andere Serien ausgeblendet). */
  refugiumOnly?: boolean
}

export const workflowSteps: WorkflowStep[] = [
  { key: 'draft', label: 'Entwurf', phase: '2', route: '/new' },
  { key: 'product', label: 'Produkt', phase: '3', route: '/products' },
  { key: 'korpus', label: 'Korpus', phase: '4', route: '/korpus' },
  { key: 'masse', label: 'Maße', phase: '4.5', route: '/dimensions' },
  // Schritt 6 (Refugium): Ausstattung-Vorauswahl – vor den Fronten, filtert Schritt 8.
  { key: 'ausstattung', label: 'Ausstattung', phase: '6', route: '/ausstattung', refugiumOnly: true },
  { key: 'fronten', label: 'Fronten', phase: '5', route: '/fronts' },
  { key: 'summary', label: 'Abschluss', phase: '6', route: '/summary' },
]

/** Sichtbare Schritte je Serie (Refugium-only-Schritte nur bei Refugium). */
export function visibleWorkflowSteps(seriesId: string | undefined): WorkflowStep[] {
  return workflowSteps.filter((step) => !step.refugiumOnly || seriesId === 'refugium')
}
