/**
 * SCHEMAFELD ↔ ENTWURF — lesen, schreiben, anzeigen.
 *
 * Die einzige Stelle, die weiß, wo der Wert eines Schemafeldes im Entwurf liegt. Maske,
 * Zusammenfassung und PDF fragen hier — dadurch kann ein neues Feld nicht an einer der
 * drei Stellen vergessen werden.
 */

import { getBranch, getBranches } from '../config/branches.ts'
import type { Draft } from '../types'
import type { SchemaFeld } from '../types/schema.ts'

const datumFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
/** Das AV-PDF nennt zusätzlich die Uhrzeit — es ist der Übergabebeleg an die Arbeitsvorbereitung. */
const datumZeitFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Auswahlmöglichkeiten eines Feldes vom Typ `auswahl`. */
export function optionenFuer(feld: SchemaFeld): Array<{ value: string; label: string }> {
  if (feld.optionen === 'filialen') {
    return getBranches().map((b) => ({ value: b.id, label: b.name }))
  }
  return []
}

/**
 * Der bearbeitbare Rohwert eines Feldes. Abgeleitete Felder (`quelle`) haben keinen —
 * sie werden nur angezeigt.
 */
export function leseWert(draft: Draft | null | undefined, feld: SchemaFeld): string {
  if (!draft || feld.quelle) return ''
  if (feld.bindung) {
    const wert = draft[feld.bindung]
    return typeof wert === 'string' ? wert : ''
  }
  return draft.zusatzfelder?.[feld.id] ?? ''
}

/**
 * Der Patch, mit dem ein Wert in den Entwurf zurückgeschrieben wird.
 *
 * Gebundene Felder schreiben auf ihre typisierte Eigenschaft, freie Felder in
 * `zusatzfelder`. Dort bleibt der bisherige Inhalt erhalten, sonst löschte jede Eingabe
 * die übrigen selbst angelegten Felder.
 */
export function schreibeWert(draft: Draft, feld: SchemaFeld, wert: string): Partial<Draft> {
  if (feld.quelle) return {}
  if (feld.bindung) return { [feld.bindung]: wert } as Partial<Draft>
  return { zusatzfelder: { ...(draft.zusatzfelder ?? {}), [feld.id]: wert } }
}

/**
 * Der Wert, wie ihn Zusammenfassung und PDF zeigen.
 *
 * `lang` betrifft nur die Filiale: Das PDF nennt sie mit Postleitzahl und Ort, die
 * Zusammenfassung kommt mit dem Namen aus.
 */
export function anzeigeWert(draft: Draft, feld: SchemaFeld, optionen: { lang?: boolean } = {}): string {
  switch (feld.quelle) {
    case 'berater':
      return draft.consultant.name
    case 'datum': {
      const zeitpunkt = new Date(draft.finalizedAt ?? draft.createdAt)
      return optionen.lang ? datumZeitFormat.format(zeitpunkt) : datumFormat.format(zeitpunkt)
    }
    case 'entwurfsnummer':
      return draft.id
    case 'variante':
      return draft.variantLabel?.trim() || (draft.variantOf ? 'Variante' : '')
    default:
      break
  }

  if (feld.bindung === 'branchId') {
    const filiale = getBranch(draft.branchId)
    if (!filiale) return ''
    return optionen.lang ? `${filiale.name}, ${filiale.postalCode} ${filiale.city}` : filiale.name
  }

  const roh = leseWert(draft, feld)
  if (feld.typ === 'checkbox') return roh === 'true' ? 'Ja' : roh === 'false' ? 'Nein' : ''
  return roh
}

/** true ⇒ das Feld soll auf dieser Fläche erscheinen (beachtet `nurWennGefuellt`). */
export function zeigeFeld(draft: Draft, feld: SchemaFeld, optionen: { lang?: boolean } = {}): boolean {
  if (!feld.nurWennGefuellt) return true
  return anzeigeWert(draft, feld, optionen).trim().length > 0
}
