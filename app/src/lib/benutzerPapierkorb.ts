/**
 * PAPIERKORB FÜR BENUTZERKONTEN — der zweistufige Löschweg.
 *
 * „Löschen" im Drei-Punkte-Menü entfernt einen Berater NICHT, sondern legt ihn hier ab.
 * Erst im Papierkorb, nach ausdrücklicher Rückfrage, verschwindet das Konto wirklich.
 * Ein Fehlklick in einer Liste kostet damit keinen Zugang mehr.
 *
 * WARUM EIN EIGENER SPEICHER und kein Feld am Stammsatz — dieselbe Begründung wie bei
 * `zugangStore.ts`: `data/stammdaten.generated.ts` wird aus der Excel-Mappe ERZEUGT. Ein
 * Feld dort wäre bei jedem `npm run data:build` überschrieben und liefe über den
 * Excel-Export mit. Wann ein Konto gelöscht wurde, gehört zum Konto-Lebenslauf, nicht in
 * die Mappe.
 *
 * Geschlüsselt über die Personalnummer, weil die die Identität des Mitarbeiters ist und
 * sich nicht ändert — die E-Mail dagegen schon (Heirat, Namenskorrektur).
 *
 * WAS BLEIBT: Nur der ZUGANG verschwindet. Aufträge und Entwürfe des Beraters bleiben
 * vollständig in Supabase — sie sind Geschäftsvorfälle und haben mit dem Konto nichts zu
 * tun. Genau das sagt auch der Bestätigungstext vor dem endgültigen Löschen.
 */

/** Aufbewahrungsfrist, nach der ein Konto von selbst verschwindet. */
export const AUFBEWAHRUNG_TAGE = 30

/*
  SUPABASE IST DIE QUELLE (09/2026): Der Papierkorb liegt als Dokument
  `benutzer_papierkorb` in `system_daten`. Jede Änderung wird auf dem aktuellen
  Serverstand ausgeführt (`aendereDokument`) — zwei Administratoren, die gleichzeitig je
  ein Konto löschen, verlieren keinen der beiden Einträge. Der localStorage ist nur
  Zwischenspeicher für einen schnellen Start.
*/
import { aendereDokument, meldeSchreibfehler } from './supabaseSystem.ts'

export const PAPIERKORB_DOKUMENT = 'benutzer_papierkorb'
const PAPIERKORB_KEY = 'cramer-planer.benutzer.papierkorb.cache.v2'

export interface PapierkorbEintrag {
  /** ISO-Zeitpunkt der Verschiebung in den Papierkorb. */
  geloeschtAm: string
  /** Name zum Zeitpunkt des Löschens — der Stammsatz kann zwischenzeitlich verschwinden. */
  name: string
  email: string
  /** Status, den das Konto vorher hatte — damit „Wiederherstellen" ihn zurückgibt. */
  vorherigerStatus: string
}

type Karte = Record<string, PapierkorbEintrag>

const TAG_MS = 24 * 60 * 60 * 1000

function lade(): Karte {
  try {
    const roh = localStorage.getItem(PAPIERKORB_KEY)
    if (!roh) return {}
    const geparst = JSON.parse(roh) as Karte
    return geparst && typeof geparst === 'object' ? geparst : {}
  } catch {
    return {}
  }
}

let karte: Karte = lade()
const hoerer = new Set<() => void>()

function sichern() {
  try {
    localStorage.setItem(PAPIERKORB_KEY, JSON.stringify(karte))
  } catch {
    /* best-effort */
  }
  hoerer.forEach((h) => h())
}

/** Übernimmt den Serverstand — von `systemSync.ts` aufgerufen. */
export function uebernehmePapierkorbVomServer(wert: unknown): void {
  const neu = wert && typeof wert === 'object' ? (wert as Karte) : {}
  if (JSON.stringify(neu) === JSON.stringify(karte)) return
  karte = neu
  sichern()
}

/** Wendet eine Änderung lokal sofort an und auf dem aktuellen Serverstand in Supabase. */
function aendere(aenderung: (k: Karte) => Karte, was: string) {
  karte = aenderung(karte)
  sichern()
  aendereDokument<Karte>(PAPIERKORB_DOKUMENT, (server) => aenderung(server ?? {})).then(
    (serverStand) => {
      if (serverStand) uebernehmePapierkorbVomServer(serverStand)
    },
    (error) => meldeSchreibfehler(was, error),
  )
}

export function subscribeBenutzerPapierkorb(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

/** Verbleibende Tage bis zur automatischen Löschung; 0 ⇒ überfällig. */
export function verbleibendeTage(eintrag: PapierkorbEintrag): number {
  const geloescht = new Date(eintrag.geloeschtAm).getTime()
  if (Number.isNaN(geloescht)) return AUFBEWAHRUNG_TAGE
  const vergangen = (Date.now() - geloescht) / TAG_MS
  return Math.max(0, Math.ceil(AUFBEWAHRUNG_TAGE - vergangen))
}

/**
 * Konten, deren Frist abgelaufen ist.
 *
 * Getrennt vom eigentlichen Löschen, weil das Entfernen des Stammsatzes NICHT hier
 * passieren darf: Dieser Speicher kennt nur Personalnummern und Fristen. Wer räumt,
 * steht in `benutzerVerwaltung.ts` — dort liegt der Zugriff auf Stammdaten und Zugänge.
 */
export function ueberfaellige(): string[] {
  return Object.entries(karte)
    .filter(([, eintrag]) => verbleibendeTage(eintrag) <= 0)
    .map(([personalnr]) => personalnr)
}

export function istImPapierkorb(personalnr: string): boolean {
  return Boolean(karte[personalnr])
}

export function getPapierkorbEintrag(personalnr: string): PapierkorbEintrag | null {
  return karte[personalnr] ?? null
}

/** Alle Einträge, zuletzt gelöschte zuerst. */
export function listePapierkorb(): Array<PapierkorbEintrag & { personalnr: string }> {
  return Object.entries(karte)
    .map(([personalnr, eintrag]) => ({ personalnr, ...eintrag }))
    .sort((a, b) => b.geloeschtAm.localeCompare(a.geloeschtAm))
}

export function legeInPapierkorb(
  personalnr: string,
  daten: Omit<PapierkorbEintrag, 'geloeschtAm'>,
): void {
  const eintrag = { ...daten, geloeschtAm: new Date().toISOString() }
  aendere((k) => ({ ...k, [personalnr]: eintrag }), `Papierkorb (${personalnr})`)
}

/** Nimmt einen Eintrag heraus — sowohl beim Wiederherstellen als auch beim endgültigen Löschen. */
export function ausPapierkorbNehmen(personalnr: string): void {
  if (!karte[personalnr]) return
  aendere((k) => {
    const { [personalnr]: _weg, ...rest } = k
    return rest
  }, `Papierkorb (${personalnr})`)
}

/** Leert den gesamten Papierkorb — Teil der Vorführ-Bereinigung. */
export function leerePapierkorb(): void {
  aendere(() => ({}), 'Papierkorb')
}
