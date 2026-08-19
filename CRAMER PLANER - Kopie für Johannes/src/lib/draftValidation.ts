import type { Draft } from '../types'

/**
 * Pflichtfelder der Entwurfsanlage (Schritt 2). Auftrags- & Artikelnummer sind
 * bewusst NICHT enthalten – sie werden erst später (spätestens vor der AV-Übergabe)
 * befüllt. Pflicht bleiben Kunde & Filiale zur eindeutigen Zuordnung des Entwurfs.
 */
export type DraftFormFields = Pick<Draft, 'customerName' | 'branchId'>

export interface DraftFormErrors {
  customerName?: string
  branchId?: string
}

/**
 * Regelbasierte Validierung der Entwurfsanlage. Liefert feldbezogene Fehler;
 * ein leeres Objekt bedeutet „gültig“. Wird in Echtzeit bei jeder Eingabe genutzt.
 */
export function validateDraftForm(fields: DraftFormFields): DraftFormErrors {
  const errors: DraftFormErrors = {}
  if (!fields.customerName.trim()) errors.customerName = 'Kundenname ist erforderlich.'
  if (!fields.branchId) errors.branchId = 'Bitte eine Filiale wählen.'
  return errors
}

export function isDraftFormValid(fields: DraftFormFields): boolean {
  return Object.keys(validateDraftForm(fields)).length === 0
}
