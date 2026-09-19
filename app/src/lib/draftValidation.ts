import type { Draft } from '../types'
import type { SchemaFeld } from '../types/schema.ts'
import { leseWert } from './schemaWerte.ts'

/** Feld-ID → Fehlermeldung. Ein leeres Objekt bedeutet „gültig". */
export type DraftFormErrors = Record<string, string>

/**
 * Pflichtprüfung der Entwurfsanlage — regelbasiert aus dem Konfigurator-Schema.
 *
 * Welche Felder Pflicht sind, stand bis zur Schema-Umstellung hier im Code (Kunde und
 * Filiale). Jetzt entscheidet das `pflicht`-Häkchen am Schemafeld, das der Administrator
 * setzt; diese Funktion prüft nur noch, ob ein als Pflicht markiertes Feld gefüllt ist.
 */
export function pruefeSchemaFelder(draft: Draft | null | undefined, felder: SchemaFeld[]): DraftFormErrors {
  const fehler: DraftFormErrors = {}
  if (!draft) return fehler

  for (const feld of felder) {
    if (!feld.pflicht || feld.quelle) continue
    if (leseWert(draft, feld).trim()) continue
    fehler[feld.id] =
      feld.typ === 'auswahl' ? `Bitte ${feld.label} wählen.` : `${feld.label} ist erforderlich.`
  }
  return fehler
}

export function istSchemaGueltig(draft: Draft | null | undefined, felder: SchemaFeld[]): boolean {
  return Object.keys(pruefeSchemaFelder(draft, felder)).length === 0
}
