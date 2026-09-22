/**
 * REGELWERK DER STAMMDATEN — was ein Datensatz erfüllen muss, um vollständig zu sein.
 *
 * Eine Quelle für zwei Aufrufer:
 *   • den Excel-Import, der jede eingelesene Zeile prüft, und
 *   • die Verwaltung, die nach dem Bearbeiten erneut prüft und die Marke wieder entfernt.
 *
 * Die Regeln lesen ihre zulässigen Werte aus den Stammdaten selbst (Teilearten,
 * Dropdowns, Preislogiken, Oberflächenkategorien) — ein neues Dropdown in der Mappe
 * ist damit sofort gültig, ohne Code-Änderung.
 *
 * GRUNDSATZ: Prüfen heißt hier NICHT ablehnen. Ein unvollständiger Datensatz wird
 * übernommen und markiert. Ein Import, der bei der ersten krummen Zeile abbricht,
 * zwingt sonst dazu, 1.500 Zeilen in Excel zu suchen, statt sie in der Verwaltung
 * nachzuarbeiten.
 */

import {
  dropdowns,
  preislogiken,
  teilearten,
  type Artikel,
  type Filiale,
  type Mitarbeiter,
  type Preiszeile,
} from '../data/stammdaten.generated.ts'
import type { Oberflaeche, Oberflaechenkategorie } from '../types/index.ts'
import { istAlterCode, pruefePreisart } from './preisarten.ts'

/** Artikelnummer-Muster laut ARTIKELNUMMER-LOGIK.md: TT-DDD-NNNN. */
const ARTIKELNUMMER = /^\d{2}-\d{3}-\d{4}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PLZ = /^\d{4,5}$/
const PREISGRUPPEN = ['', 'PG1', 'PG2', 'PG3', 'PG4']
const ARTIKEL_STATUS = ['aktiv', 'gesperrt', 'entwurf']
const PREIS_STATUS = ['fixed', 'note', 'on-request']
const DATENSATZ_STATUS = ['aktiv', 'gesperrt']
const ROLLEN = ['berater', 'admin']

const leer = (v: string | undefined | null) => !v || !String(v).trim()

function pruefeAuswahl(
  wert: string | undefined,
  erlaubt: readonly string[],
  feld: string,
  probleme: string[],
) {
  if (leer(wert)) {
    probleme.push(`${feld} fehlt.`)
  } else if (!erlaubt.includes(String(wert))) {
    probleme.push(`${feld} „${wert}" ist unbekannt (erlaubt: ${erlaubt.filter(Boolean).join(', ')}).`)
  }
}

/** Pflichtangaben und Wertebereiche eines Artikels. */
export function pruefeArtikel(a: Artikel): string[] {
  const probleme: string[] = []
  if (leer(a.artikelnummer)) probleme.push('Artikelnummer fehlt.')
  else if (!ARTIKELNUMMER.test(a.artikelnummer.trim())) {
    probleme.push(`Artikelnummer „${a.artikelnummer}" folgt nicht dem Muster TT-DDD-NNNN.`)
  }
  if (leer(a.bezeichnung)) probleme.push('Bezeichnung fehlt.')
  pruefeAuswahl(a.teileart, teilearten.map((t) => t.code), 'Teileart', probleme)
  pruefeAuswahl(a.dropdown, dropdowns.map((d) => d.code), 'Dropdown', probleme)
  // Frühere Codes (MATRIX aus alten Exporten) sind kein Fehler: Die Kalkulation leitet die
  // Preisart aus den Preiszeilen ab, der Artikeldialog übernimmt sie beim nächsten Speichern.
  if (leer(a.preislogik) || !istAlterCode(a.preislogik)) {
    pruefeAuswahl(a.preislogik, preislogiken.map((p) => p.code), 'Preisart', probleme)
  }
  // Ein Aufschlag braucht keine Preiszeilen, aber Satz, Einheit und Preisbasis.
  if (a.preislogik === 'AUFSCHLAG') probleme.push(...pruefePreisart(a, []))
  pruefeAuswahl(a.status, ARTIKEL_STATUS, 'Status', probleme)
  if (leer(a.modus)) probleme.push('Modus fehlt — ohne ihn ist der Artikel für keine Serie freigegeben.')
  return probleme
}

/** Pflichtangaben einer Preiszeile. `artikelnummern` prüft den Verweis mit. */
export function pruefePreiszeile(p: Preiszeile, artikelnummern?: Set<string>): string[] {
  const probleme: string[] = []
  if (leer(p.artikel)) probleme.push('Artikelnummer fehlt.')
  else if (artikelnummern && !artikelnummern.has(p.artikel.trim())) {
    probleme.push(`Artikel „${p.artikel}" steht nicht im Artikelstamm — die Zeile wäre nicht auffindbar.`)
  }
  pruefeAuswahl(p.status, PREIS_STATUS, 'Status', probleme)
  if (p.preis == null && p.status !== 'on-request') {
    probleme.push('Kein Preis hinterlegt (nur bei Status „on-request" zulässig).')
  }
  if (p.preis != null && p.preis < 0) probleme.push('Preis ist negativ.')
  return probleme
}

export function pruefeMitarbeiter(m: Mitarbeiter): string[] {
  const probleme: string[] = []
  if (leer(m.personalnr)) probleme.push('Personalnummer fehlt.')
  if (leer(m.name)) probleme.push('Name fehlt.')
  if (leer(m.email)) probleme.push('E-Mail fehlt.')
  else if (!EMAIL.test(m.email.trim())) probleme.push(`E-Mail „${m.email}" ist keine gültige Adresse.`)
  pruefeAuswahl(m.rolle, ROLLEN, 'Rolle', probleme)
  pruefeAuswahl(m.status, DATENSATZ_STATUS, 'Status', probleme)
  return probleme
}

export function pruefeFiliale(f: Filiale): string[] {
  const probleme: string[] = []
  if (leer(f.filialnr)) probleme.push('Filialnummer fehlt.')
  if (leer(f.name)) probleme.push('Name fehlt.')
  if (!leer(f.plz) && !PLZ.test(f.plz.trim())) probleme.push(`PLZ „${f.plz}" ist keine gültige Postleitzahl.`)
  if (!leer(f.email) && !EMAIL.test(f.email.trim())) probleme.push(`E-Mail „${f.email}" ist keine gültige Adresse.`)
  pruefeAuswahl(f.status, DATENSATZ_STATUS, 'Status', probleme)
  return probleme
}

export function pruefeKategorie(k: Oberflaechenkategorie): string[] {
  const probleme: string[] = []
  if (leer(k.id)) probleme.push('ID fehlt.')
  if (leer(k.bezeichnung)) probleme.push('Bezeichnung fehlt.')
  if (!PREISGRUPPEN.includes(k.preisgruppe ?? '')) {
    probleme.push(`Preisgruppe „${k.preisgruppe}" ist unbekannt (erlaubt: PG1–PG4 oder leer).`)
  }
  pruefeAuswahl(k.status, DATENSATZ_STATUS, 'Status', probleme)
  return probleme
}

/** `kategorien` prüft, ob die zugewiesene Oberflächenkategorie existiert. */
export function pruefeOberflaeche(o: Oberflaeche, kategorien?: Set<string>): string[] {
  const probleme: string[] = []
  if (leer(o.id)) probleme.push('ID fehlt.')
  if (leer(o.bezeichnung)) probleme.push('Bezeichnung fehlt.')
  if (leer(o.kategorie)) probleme.push('Oberflächenkategorie fehlt.')
  else if (kategorien && !kategorien.has(o.kategorie.trim())) {
    probleme.push(`Oberflächenkategorie „${o.kategorie}" gibt es nicht — ohne sie hat die Farbe keine Preisgruppe.`)
  }
  if (!PREISGRUPPEN.includes(o.preisgruppe ?? '')) {
    probleme.push(`Abweichende Preisgruppe „${o.preisgruppe}" ist unbekannt (erlaubt: PG1–PG4 oder leer).`)
  }
  pruefeAuswahl(o.status, DATENSATZ_STATUS, 'Status', probleme)
  return probleme
}

// ---------------------------------------------------------------------------
// Schema eines Tabellenblatts
// ---------------------------------------------------------------------------

/**
 * Fehlen einem Blatt Spalten, die der Import zwingend braucht?
 *
 * Geprüft wird auf ÜBERSCHRIFTEN, nicht auf Positionen — wer in Excel eine Hilfsspalte
 * einfügt oder Spalten umsortiert, bricht damit nichts. Zusätzliche Spalten sind erlaubt
 * und werden ignoriert.
 */
export function pruefeBlattSchema(
  blattName: string,
  vorhandeneSpalten: readonly string[],
  pflichtSpalten: readonly string[],
): string | null {
  const da = new Set(vorhandeneSpalten.map((s) => s.trim()))
  const fehlend = pflichtSpalten.filter((s) => !da.has(s))
  if (fehlend.length === 0) return null
  return `Blatt „${blattName}": Pflichtspalte(n) fehlen — ${fehlend.join(', ')}. Blatt übersprungen.`
}
