/**
 * ZUGÄNGE — eigene Passwörter der Mitarbeiter, getrennt von den Stammdaten.
 *
 * Warum kein Feld an `Mitarbeiter`: `data/stammdaten.generated.ts` wird aus
 * `Cramer-Stammdaten.xlsx` ERZEUGT, und alles darin läuft über den Excel-Export mit —
 * Passwörter hätten dann in einer Datei gestanden, die per Mail herumgeht. Der Zugang
 * gehört zum Konto, nicht zum Stammsatz.
 *
 * SUPABASE IST DIE QUELLE (09/2026): Die Hashes liegen in `benutzer_zugaenge` und sind
 * über den öffentlichen ANON-Key NICHT lesbar — geprüft wird in der Datenbank
 * (`zugang_pruefen`), der Browser erfährt nur „ok", „falsch" oder „kein eigenes
 * Passwort". Hier im Speicher liegt lediglich, WER ein eigenes Passwort hat und seit
 * wann; das braucht die Benutzerverwaltung für ihre Anzeige.
 *
 * Wer kein eigenes Passwort hat, meldet sich mit dem Standard-Passwort an
 * (`data/consultants.ts`). Schlüssel ist die Personalnummer: Sie ist die Identität des
 * Mitarbeiters und ändert sich nicht — die E-Mail schon (Heirat, Namenskorrektur).
 */

import { hashPasswort } from './passwort.ts'
import {
  entferneZugangAufServer,
  ladeZugangsListe,
  meldeSchreibfehler,
  pruefeZugangAufServer,
  setzeZugangAufServer,
} from './supabaseSystem.ts'

export interface Zugang {
  /** ISO-Datum der letzten Vergabe — die Benutzerverwaltung zeigt es an. */
  gesetztAm: string
}

type ZugangKarte = Record<string, Zugang>

/*
  Die früheren, rein lokalen Speicher (v1, v2) enthielten Passwort-Hashes im Browser.
  Sie werden beim Start entfernt: Ein Hash, der nur auf einem Gerät gilt, ist genau der
  Zustand, den die Umstellung beenden soll.
*/
try {
  localStorage.removeItem('cramer-planer.zugaenge.v1')
  localStorage.removeItem('cramer-planer.zugaenge.v2')
} catch {
  /* best-effort */
}

let karte: ZugangKarte = {}
const hoerer = new Set<() => void>()

function melde() {
  hoerer.forEach((h) => h())
}

/** Für `useSyncExternalStore` — die Benutzerverwaltung hört mit. */
export function subscribeZugaenge(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

/** Lädt, wer ein eigenes Passwort hat (ohne Hashes). Von `systemSync.ts` aufgerufen. */
export async function ladeZugaengeVomServer(): Promise<void> {
  const liste = await ladeZugangsListe()
  karte = Object.fromEntries(liste.map((z) => [z.personalnr, { gesetztAm: String(z.gesetzt_am).slice(0, 10) }]))
  melde()
}

/** true ⇒ für diese Personalnummer ist ein EIGENES Passwort hinterlegt. */
export function hatZugang(personalnr: string): boolean {
  return Boolean(karte[personalnr])
}

export function getZugang(personalnr: string): Zugang | null {
  return karte[personalnr] ?? null
}

/** Vergibt bzw. ersetzt das eigene Passwort. Der Klartext verlässt diese Funktion nicht. */
export async function setzeZugang(personalnr: string, klartext: string): Promise<void> {
  await setzeZugangAufServer(personalnr, await hashPasswort(klartext))
  karte = { ...karte, [personalnr]: { gesetztAm: new Date().toISOString().slice(0, 10) } }
  melde()
}

/**
 * Löscht das eigene Passwort — danach gilt wieder das Standard-Passwort. Gesperrt wird
 * ein Konto über den Status „gesperrt" im Stammsatz, nicht hier.
 */
export async function entferneZugang(personalnr: string): Promise<void> {
  if (!karte[personalnr]) return
  const { [personalnr]: _weg, ...rest } = karte
  karte = rest
  melde()
  try {
    await entferneZugangAufServer(personalnr)
  } catch (error) {
    meldeSchreibfehler(`Passwort von ${personalnr}`, error)
  }
}

/**
 * Prüft ein eingegebenes Passwort in der Datenbank.
 *
 *   'ok'     eigenes Passwort, stimmt
 *   'falsch' eigenes Passwort, stimmt nicht — das Standard-Passwort gilt dann NICHT
 *   'kein'   kein eigenes Passwort hinterlegt — der Aufrufer prüft das Standard-Passwort
 *
 * Wirft bei Verbindungsfehlern: Ohne Antwort der Datenbank lässt sich nicht sagen, ob
 * das Standard-Passwort gelten darf.
 */
export async function pruefeZugang(personalnr: string, klartext: string): Promise<'ok' | 'falsch' | 'kein'> {
  return pruefeZugangAufServer(personalnr, await hashPasswort(klartext))
}
