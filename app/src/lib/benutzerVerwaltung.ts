/**
 * BENUTZERVERWALTUNG — eine Liste statt zweier.
 *
 * Vorher führte das Admin-Dashboard zwei getrennte Bestände: „Mitarbeiter (Verkäufer)"
 * aus einem eigenen `localStorage`-Topf und „Administratoren" aus einem zweiten, während
 * die Stammdatenverwaltung parallel das Blatt „40 Mitarbeiter" pflegte. Drei Orte für
 * dieselbe Person — genau daraus entstanden die doppelten und widersprüchlichen Konten.
 *
 * Jetzt gibt es EINEN Bestand: das Blatt „40 Mitarbeiter" im Stammdaten-Store. Beide
 * Oberflächen — Admin-Dashboard und Stammdatenverwaltung — lesen und schreiben dieselben
 * Datensätze, die Synchronisation ist damit keine Aufgabe mehr, sondern eine Eigenschaft.
 * Ob jemand Administrator ist, steht als `rolle` am selben Datensatz.
 *
 * Drei Speicher hängen an einer Person, jeder mit eigener Begründung:
 *
 *   STAMMSATZ   Blatt „40 Mitarbeiter" — Name, E-Mail, Rolle, Filiale, Status
 *   ZUGANG      `zugangStore.ts` — der Passwort-Hash. Gehört NICHT in die Mappe, die
 *               per Mail herumgeht (siehe die Begründung dort).
 *   PAPIERKORB  `benutzerPapierkorb.ts` — Löschzeitpunkt und 30-Tage-Frist.
 */

import {
  aendereMitarbeiter,
  getMitarbeiterListe,
  legeMitarbeiterAn,
  loescheMitarbeiter,
} from './stammdatenStore.ts'
import { entferneZugang, hatZugang } from './zugangStore.ts'
import {
  ausPapierkorbNehmen,
  getPapierkorbEintrag,
  istImPapierkorb,
  legeInPapierkorb,
  ueberfaellige,
  type PapierkorbEintrag,
} from './benutzerPapierkorb.ts'
import type { Mitarbeiter } from './stammdaten.ts'

/**
 * DAS UNANTASTBARE HAUPTADMIN-KONTO.
 *
 * Dieselbe Adresse wie der fest im Bundle verankerte Root-Zugang (`data/seedAdmin.ts`)
 * und wie Personalnummer M-900 im Blatt „40 Mitarbeiter" — bewusst dieselbe Person, nicht
 * zwei Konten. Diese Adresse lässt sich weder löschen, noch sperren, noch degradieren:
 * Ein System, in dem sich der letzte Administrator selbst aussperren kann, ist ein System
 * ohne Weg zurück.
 */
export const HAUPTADMIN_EMAIL = 'admin@cramer.de'

export const HAUPTADMIN_SPERRE =
  `Das Hauptadmin-Konto ${HAUPTADMIN_EMAIL} ist geschützt: Rolle, Status und Adresse ` +
  'lassen sich nicht ändern, und löschen lässt es sich nicht. Ohne diese Sperre könnte ' +
  'sich der letzte Administrator selbst aussperren.'

export interface Benutzer extends Mitarbeiter {
  /** true ⇒ ein Passwort ist hinterlegt, die Anmeldung ist möglich. */
  zugang: boolean
  /** true ⇒ das geschützte Hauptadmin-Konto. */
  hauptadmin: boolean
  /** Gesetzt, solange das Konto im Papierkorb liegt. */
  papierkorb: PapierkorbEintrag | null
}

function istHauptadminKonto(email: string): boolean {
  return email.trim().toLowerCase() === HAUPTADMIN_EMAIL
}

/**
 * WIE SICH DIESER BENUTZER ANMELDET — im Klartext, weil es vier Wege gibt.
 *
 * Ein schlichtes „Passwort hinterlegt: ja/nein" wäre hier eine falsche Auskunft. Der
 * Hauptadmin kommt über den fest im Bundle verankerten Zugang herein, ganz ohne Eintrag
 * im Zugangs-Speicher; ein Berater ohne eigenes Passwort kommt über das gemeinsame
 * Demo-Passwort des Prototyps herein (`data/consultants.ts`). Nur bei einem
 * Administrator OHNE eigenen Zugang stimmt „Anmeldung nicht möglich" wirklich.
 */
export function beschreibeAnmeldung(b: Benutzer): string {
  if (b.hauptadmin) return 'Hauptadmin — fest hinterlegter Zugang'
  if (b.status !== 'aktiv') return `Status „${b.status}" — Anmeldung gesperrt`
  if (b.zugang) return 'eigenes Passwort hinterlegt'
  if (b.rolle === 'berater') return 'noch kein eigenes Passwort — es gilt das Demo-Passwort'
  return 'kein Passwort — Anmeldung nicht möglich'
}

function anreichern(m: Mitarbeiter): Benutzer {
  return {
    ...m,
    zugang: hatZugang(m.personalnr),
    hauptadmin: istHauptadminKonto(m.email),
    papierkorb: getPapierkorbEintrag(m.personalnr),
  }
}

/** Alle aktiven Konten — alles, was nicht im Papierkorb liegt. */
export function listeBenutzer(): Benutzer[] {
  return getMitarbeiterListe()
    .filter((m) => !istImPapierkorb(m.personalnr))
    .map(anreichern)
    .sort((a, b) => {
      // Administratoren zuerst, darunter alphabetisch — die Liste wird gelesen, um zu
      // prüfen „wer darf was", und diese Frage beginnt oben.
      if (a.rolle !== b.rolle) return a.rolle === 'admin' ? -1 : 1
      return a.name.localeCompare(b.name, 'de')
    })
}

/** Konten im Papierkorb, zuletzt gelöschte zuerst. */
export function listeGeloeschteBenutzer(): Benutzer[] {
  return getMitarbeiterListe()
    .filter((m) => istImPapierkorb(m.personalnr))
    .map(anreichern)
    .sort((a, b) => (b.papierkorb?.geloeschtAm ?? '').localeCompare(a.papierkorb?.geloeschtAm ?? ''))
}

// ---------------------------------------------------------------------------
// Eindeutigkeit
// ---------------------------------------------------------------------------

/**
 * Prüft E-Mail und Name gegen ALLE Konten — auch gegen die im Papierkorb.
 *
 * Der Papierkorb zählt bewusst mit: Ein dort liegendes Konto kann jederzeit
 * wiederhergestellt werden, und es wäre keine Hilfe, die Dublette erst in diesem Moment
 * zu entdecken. `ausser` nimmt den gerade bearbeiteten Datensatz von der Prüfung aus —
 * sonst wäre jeder Datensatz seine eigene Dublette.
 *
 * Der Name wird mitgeprüft, weil er im Konfigurator als Berater-Kennung erscheint (in der
 * Entwurfsnummer, im Dashboard-Filter, auf dem AV-PDF). Zwei „Anna Berger" wären dort
 * nicht auseinanderzuhalten.
 */
export function pruefeEindeutigkeit(
  kandidat: { email?: string; name?: string },
  optionen: {
    /** Personalnummer des gerade bearbeiteten Datensatzes. */
    ausser?: string
    /** Zusätzliche Konten außerhalb der Stammdaten (Alt-Bestand des Admin-Dashboards). */
    weitere?: Array<{ id: string; username: string; email: string }>
  } = {},
): string | null {
  const email = kandidat.email?.trim().toLowerCase()
  const name = kandidat.name?.trim().toLowerCase()

  for (const m of getMitarbeiterListe()) {
    if (m.personalnr === optionen.ausser) continue
    if (email && m.email.trim().toLowerCase() === email) {
      return `Die E-Mail-Adresse ${kandidat.email} ist bereits an ${m.name} (${m.personalnr}) vergeben.`
    }
    if (name && m.name.trim().toLowerCase() === name) {
      return `Der Name „${kandidat.name}" ist bereits an ${m.personalnr} vergeben.`
    }
  }

  for (const a of optionen.weitere ?? []) {
    if (a.id === optionen.ausser) continue
    if (email && a.email.trim().toLowerCase() === email) {
      return `Die E-Mail-Adresse ${kandidat.email} ist bereits an das Administrator-Konto „${a.username}" vergeben.`
    }
    if (name && a.username.trim().toLowerCase() === name) {
      return `Der Benutzername „${kandidat.name}" ist bereits als Administrator-Konto vergeben.`
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Anlegen und Ändern
// ---------------------------------------------------------------------------

/** Nächste freie Personalnummer im Format M-0xx. */
export function naechstePersonalnummer(): string {
  const zahlen = getMitarbeiterListe()
    .map((m) => Number(m.personalnr.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n) && n < 900) // M-9xx bleibt der Systemverwaltung
  const hoechste = zahlen.length > 0 ? Math.max(...zahlen) : 0
  return `M-${String(hoechste + 1).padStart(3, '0')}`
}

export function legeBenutzerAn(
  neu: Omit<Mitarbeiter, 'personalnr'> & { personalnr?: string },
  weitere?: Array<{ id: string; username: string; email: string }>,
): { personalnr: string } | { fehler: string } {
  const fehler = pruefeEindeutigkeit({ email: neu.email, name: neu.name }, { weitere })
  if (fehler) return { fehler }
  const personalnr = neu.personalnr?.trim() || naechstePersonalnummer()
  const problem = legeMitarbeiterAn({ ...neu, personalnr })
  return problem ? { fehler: problem } : { personalnr }
}

export function aendereBenutzer(
  personalnr: string,
  patch: Partial<Mitarbeiter>,
  weitere?: Array<{ id: string; username: string; email: string }>,
): string | null {
  const vorher = getMitarbeiterListe().find((m) => m.personalnr === personalnr)
  if (!vorher) return 'Dieser Mitarbeiter existiert nicht (mehr).'

  const fehler = pruefeEindeutigkeit(
    { email: patch.email, name: patch.name },
    { ausser: personalnr, weitere },
  )
  if (fehler) return fehler

  // Das Hauptadmin-Konto behält Rolle, Status und Adresse — siehe HAUPTADMIN_EMAIL.
  if (istHauptadminKonto(vorher.email)) {
    if (patch.rolle && patch.rolle !== 'admin') return HAUPTADMIN_SPERRE
    if (patch.status && patch.status !== 'aktiv') return HAUPTADMIN_SPERRE
    if (patch.email && !istHauptadminKonto(patch.email)) return HAUPTADMIN_SPERRE
  }

  aendereMitarbeiter(personalnr, patch)
  return null
}

/** Vergibt oder entzieht Administrator-Rechte. */
export function setzeRolle(personalnr: string, rolle: 'admin' | 'berater'): string | null {
  const benutzer = getMitarbeiterListe().find((m) => m.personalnr === personalnr)
  if (!benutzer) return 'Dieser Mitarbeiter existiert nicht (mehr).'
  if (istHauptadminKonto(benutzer.email) && rolle !== 'admin') return HAUPTADMIN_SPERRE
  aendereMitarbeiter(personalnr, { rolle })
  return null
}

// ---------------------------------------------------------------------------
// Löschen in zwei Stufen
// ---------------------------------------------------------------------------

/** Stufe 1: ab in den Papierkorb. Der Stammsatz bleibt, die Anmeldung ist gesperrt. */
export function inPapierkorbLegen(personalnr: string): string | null {
  const benutzer = getMitarbeiterListe().find((m) => m.personalnr === personalnr)
  if (!benutzer) return 'Dieser Mitarbeiter existiert nicht (mehr).'
  if (istHauptadminKonto(benutzer.email)) return HAUPTADMIN_SPERRE

  legeInPapierkorb(personalnr, {
    name: benutzer.name,
    email: benutzer.email,
    vorherigerStatus: benutzer.status,
  })
  // Gesperrt, nicht gelöscht: `getBerater()` filtert auf „aktiv", damit verschwindet das
  // Konto sofort aus Anmeldung und Auswahllisten — bleibt aber wiederherstellbar.
  aendereMitarbeiter(personalnr, { status: 'gesperrt' })
  return null
}

export function ausPapierkorbWiederherstellen(personalnr: string): string | null {
  const eintrag = getPapierkorbEintrag(personalnr)
  if (!eintrag) return 'Dieses Konto liegt nicht im Papierkorb.'
  aendereMitarbeiter(personalnr, { status: eintrag.vorherigerStatus || 'aktiv' })
  ausPapierkorbNehmen(personalnr)
  return null
}

/**
 * Stufe 2: endgültig. Stammsatz UND Zugang verschwinden.
 *
 * Die Entwürfe des Beraters werden NICHT angefasst — sie liegen in Supabase und sind
 * Geschäftsvorfälle. `getMitarbeiter()` löst gelöschte Personalnummern bewusst ohne
 * Statusfilter auf, damit der Name auf einem alten Angebot lesbar bleibt; ist der
 * Stammsatz ganz weg, zeigt die Oberfläche die Personalnummer.
 */
export function endgueltigLoeschen(personalnr: string): string | null {
  const benutzer = getMitarbeiterListe().find((m) => m.personalnr === personalnr)
  if (benutzer && istHauptadminKonto(benutzer.email)) return HAUPTADMIN_SPERRE
  entferneZugang(personalnr)
  loescheMitarbeiter(personalnr)
  ausPapierkorbNehmen(personalnr)
  return null
}

/**
 * Räumt Konten, deren 30 Tage abgelaufen sind.
 *
 * Ohne Server gibt es keinen nächtlichen Lauf; geräumt wird deshalb, wenn jemand die
 * Verwaltung öffnet. Für eine Aufbewahrungsfrist ist das ausreichend genau — sie ist
 * eine Zusage „mindestens 30 Tage", keine Stoppuhr.
 */
export function raeumeUeberfaelligeBenutzer(): number {
  const faellige = ueberfaellige()
  for (const personalnr of faellige) endgueltigLoeschen(personalnr)
  return faellige.length
}
