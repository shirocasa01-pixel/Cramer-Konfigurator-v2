/**
 * ZUGÄNGE DER BERATER — Passwort-Hashes, getrennt von den Stammdaten.
 *
 * Warum ein eigener Speicher und kein Feld an `Mitarbeiter`:
 * `data/stammdaten.generated.ts` wird aus `Cramer-Stammdaten.xlsx` ERZEUGT. Ein Feld
 * dort wäre bei jedem `npm run data:build` wieder überschrieben, und es liefe über den
 * Excel-Export mit — Passwörter hätten dann in einer Datei gestanden, die per Mail
 * herumgeht. Der Zugang gehört zum Konto, nicht zum Stammsatz.
 *
 * Schlüssel ist die Personalnummer: sie ist die Identität des Mitarbeiters und nach dem
 * Anlegen nicht mehr änderbar. Die E-Mail dagegen ändert sich (Heirat, Namenskorrektur),
 * und ein daran gebundener Zugang wäre bei jeder Korrektur verloren.
 *
 * Prototyp-Grenze: der Speicher liegt im Browser. Wer den Rechner wechselt, nimmt seine
 * Zugänge nicht mit. Mit dem Backend zieht dieser Store an den Server; die Schnittstelle
 * unten (`hatZugang`/`setzeZugang`/`pruefeAnmeldung`) bleibt dieselbe.
 */

import { hashPasswort, passwortStimmt } from './passwort.ts'

const ZUGANG_KEY = 'cramer-planer.zugaenge.v1'

export interface Zugang {
  /** SHA-256-Hex. Klartext wird nirgends gespeichert. */
  passwortHash: string
  /** ISO-Datum der letzten Vergabe — die Berateransicht zeigt es an. */
  gesetztAm: string
}

type ZugangKarte = Record<string, Zugang>

function lade(): ZugangKarte {
  try {
    const roh = localStorage.getItem(ZUGANG_KEY)
    if (!roh) return {}
    const geparst = JSON.parse(roh) as ZugangKarte
    return geparst && typeof geparst === 'object' ? geparst : {}
  } catch {
    return {}
  }
}

let karte: ZugangKarte = lade()
const hoerer = new Set<() => void>()

function sichern() {
  try {
    localStorage.setItem(ZUGANG_KEY, JSON.stringify(karte))
  } catch {
    /* best-effort im Prototyp */
  }
  hoerer.forEach((h) => h())
}

/** Für `useSyncExternalStore` — die Berateransicht hört mit. */
export function subscribeZugaenge(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

/** true ⇒ für diese Personalnummer ist ein Passwort hinterlegt. */
export function hatZugang(personalnr: string): boolean {
  return Boolean(karte[personalnr]?.passwortHash)
}

export function getZugang(personalnr: string): Zugang | null {
  return karte[personalnr] ?? null
}

/** Vergibt bzw. ersetzt das Passwort. Der Klartext verlässt diese Funktion nicht. */
export async function setzeZugang(personalnr: string, klartext: string): Promise<void> {
  const passwortHash = await hashPasswort(klartext)
  karte = { ...karte, [personalnr]: { passwortHash, gesetztAm: new Date().toISOString().slice(0, 10) } }
  sichern()
}

/** Entzieht den Zugang — der Stammsatz bleibt, die Anmeldung ist damit gesperrt. */
export function entferneZugang(personalnr: string): void {
  if (!karte[personalnr]) return
  const { [personalnr]: _weg, ...rest } = karte
  karte = rest
  sichern()
}

/** Prüft ein eingegebenes Passwort gegen den hinterlegten Hash. */
export async function pruefeZugang(personalnr: string, klartext: string): Promise<boolean> {
  const zugang = karte[personalnr]
  return zugang ? passwortStimmt(klartext, zugang.passwortHash) : false
}
