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

const PAPIERKORB_KEY = 'cramer-planer.benutzer.papierkorb.v1'

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
    /* best-effort im Prototyp */
  }
  hoerer.forEach((h) => h())
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
  karte = { ...karte, [personalnr]: { ...daten, geloeschtAm: new Date().toISOString() } }
  sichern()
}

/** Nimmt einen Eintrag heraus — sowohl beim Wiederherstellen als auch beim endgültigen Löschen. */
export function ausPapierkorbNehmen(personalnr: string): void {
  if (!karte[personalnr]) return
  const { [personalnr]: _weg, ...rest } = karte
  karte = rest
  sichern()
}

/** Leert den gesamten Papierkorb — Teil der Vorführ-Bereinigung. */
export function leerePapierkorb(): void {
  karte = {}
  sichern()
}
