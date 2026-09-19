/**
 * SCHEMAFELD ↔ ENTWURF — lesen, schreiben, anzeigen.
 *
 * Die einzige Stelle, die weiß, wo der Wert eines Schemafeldes im Entwurf liegt. Maske,
 * Zusammenfassung und PDF fragen hier — dadurch kann ein neues Feld nicht an einer der
 * drei Stellen vergessen werden.
 */

import { getBranch, getBranches } from '../config/branches.ts'
import { dropdowns as alleDropdowns } from '../data/stammdaten.generated.ts'
import { describeMaterialSelection } from './materialFormat.ts'
import { dropdownEintraege } from './stammdaten.ts'
import type { Draft, MaterialSelection } from '../types'
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

/**
 * Auswahlmöglichkeiten eines Feldes vom Typ `auswahl`.
 *
 * Trägt das Feld einen Dropdown-Code (Ebene 3), kommen die Einträge aus der
 * Artikelverwaltung (Ebene 4) — gefiltert über die laufende Serie, also genau die Liste,
 * die auch die Kalkulation kennt. Ein selbst angelegtes Dropdown-Modul ist damit ein
 * vollwertiges Auswahlfeld und keine leere Hülle.
 *
 * Gespeichert wird die ARTIKELNUMMER. Sie ist der Schlüssel des Systems; eine
 * Bezeichnung könnte sich in der Mappe ändern und der Entwurf zeigte danach ins Leere.
 */
export function optionenFuer(
  feld: SchemaFeld,
  serieId?: string,
): Array<{ value: string; label: string }> {
  if (feld.optionen === 'filialen') {
    return getBranches().map((b) => ({ value: b.id, label: b.name }))
  }
  if (feld.dropdownCode) {
    const dd = alleDropdowns.find((d) => d.nr === feld.dropdownCode)
    if (!dd) return []
    return dropdownEintraege(dd.code, serieId).map((a) => ({
      value: a.artikelnummer,
      label: a.bezeichnung || a.artikelnummer,
    }))
  }
  return []
}

/**
 * MATERIAL-MODULE IM SCHEMA.
 *
 * Ein Material-Baustein hält eine `MaterialSelection` — Gruppe, Ausführung, Preisgruppe —
 * und damit ein Objekt, während `zusatzfelder` Zeichenketten speichert. Statt eine zweite
 * Ablage neben `zusatzfelder` aufzumachen (und sie in Entwurfsverwaltung, Duplizieren,
 * Supabase und PDF nachzuziehen), wird die Auswahl als JSON abgelegt. Die beiden
 * Funktionen hier sind die einzige Stelle, die das weiß.
 *
 * Fehlerhafter Inhalt liefert `undefined` statt eines Absturzes: Ein Entwurf aus einer
 * Zeit, in der das Feld noch ein Textfeld war, soll sich weiterhin öffnen lassen.
 */
export function leseMaterial(draft: Draft | null | undefined, feld: SchemaFeld): MaterialSelection | undefined {
  const roh = draft?.zusatzfelder?.[feld.id]
  if (!roh) return undefined
  try {
    const wert = JSON.parse(roh) as MaterialSelection
    return typeof wert?.materialGroupId === 'string' ? wert : undefined
  } catch {
    return undefined
  }
}

export function schreibeMaterial(draft: Draft, feld: SchemaFeld, wahl: MaterialSelection): Partial<Draft> {
  return { zusatzfelder: { ...(draft.zusatzfelder ?? {}), [feld.id]: JSON.stringify(wahl) } }
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

  // Material-Module halten ein Objekt; die Zusammenfassung und das PDF bekommen daraus
  // denselben Klartext wie überall sonst im Konfigurator.
  if (feld.typ === 'material') {
    const wahl = leseMaterial(draft, feld)
    return wahl ? describeMaterialSelection(wahl) : ''
  }

  const roh = leseWert(draft, feld)
  if (feld.typ === 'checkbox') return roh === 'true' ? 'Ja' : roh === 'false' ? 'Nein' : ''

  // Auswahlfelder aus der Artikelverwaltung speichern die Artikelnummer — angezeigt wird
  // die Bezeichnung, sonst stünde im PDF „40-014-0001" statt „Einlegeboden".
  if (feld.typ === 'auswahl' && feld.dropdownCode && roh) {
    return optionenFuer(feld, draft.seriesId).find((o) => o.value === roh)?.label ?? roh
  }

  return roh
}

/** true ⇒ das Feld soll auf dieser Fläche erscheinen (beachtet `nurWennGefuellt`). */
export function zeigeFeld(draft: Draft, feld: SchemaFeld, optionen: { lang?: boolean } = {}): boolean {
  if (!feld.nurWennGefuellt) return true
  return anzeigeWert(draft, feld, optionen).trim().length > 0
}
