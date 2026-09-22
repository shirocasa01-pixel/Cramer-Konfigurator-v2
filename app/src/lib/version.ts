/**
 * VERSIONSSTAND DES KONFIGURATORS.
 *
 * Eine Version entsteht NICHT beim Speichern, sondern beim Veröffentlichen. Das ist der
 * ganze Unterschied zwischen den beiden Knöpfen im Bearbeitungsmodus:
 *
 *   SPEICHERN        schreibt in den Entwurf des Administrators — nur er sieht es
 *   VERÖFFENTLICHEN  macht den Entwurf gültig UND zählt die Version hoch
 *
 * NUMMERNKREIS, wie abgestimmt:
 *   v1.01 … v1.99   Text-, Preis- und Formularänderungen (die Regel)
 *   v2.00           Baukasten-Umbauten, Major Release (die Ausnahme)
 *
 * Die zweistellige Minor-Stelle ist Absicht: `v1.2` und `v1.20` wären in einer Liste
 * nicht unterscheidbar, `v1.02` und `v1.20` schon. Läuft die Minor-Stelle über (nach
 * v1.99), springt die Zählung von selbst auf die nächste Hauptversion.
 *
 * SUPABASE IST DIE QUELLE (09/2026): Die Historie liegt als Dokument `versionen` in
 * `system_daten` und ist damit auf allen Geräten gleich. Die neue Nummer wird auf dem
 * aktuellen Serverstand vergeben — veröffentlichen zwei Administratoren gleichzeitig,
 * bekommen sie zwei aufeinanderfolgende Nummern statt zweimal dieselbe. Der localStorage
 * hält nur einen Zwischenspeicher und den persönlichen Gelesen-Stand.
 */
import { aendereDokument, meldeSchreibfehler } from './supabaseSystem.ts'

export const VERSIONEN_DOKUMENT = 'versionen'
const VERSIONEN_KEY = 'cramer-planer.versionen.cache.v2'
const GELESEN_KEY = 'cramer-planer.versionen.gelesen.v1'

/** Womit ein frisches System startet — und wohin die Bereinigung zurücksetzt. */
export const STARTVERSION = '1.00'

export interface Versionsstand {
  /** Zweistellige Minor-Stelle, z. B. „1.02". Ohne führendes „v" — das setzt die Anzeige. */
  version: string
  /** ISO-Zeitpunkt der Veröffentlichung. */
  veroeffentlichtAm: string
  /** Name des Administrators, der veröffentlicht hat. */
  von?: string
  /** Was sich geändert hat — eine Zeile, vom Administrator beim Veröffentlichen erfasst. */
  notiz?: string
}

function lade(): Versionsstand[] {
  try {
    const roh = localStorage.getItem(VERSIONEN_KEY)
    if (!roh) return []
    const geparst = JSON.parse(roh) as Versionsstand[]
    return Array.isArray(geparst) ? geparst.filter((v) => typeof v?.version === 'string') : []
  } catch {
    return []
  }
}

/**
 * Neueste zuerst. Ist noch nie veröffentlicht worden, steht hier trotzdem ein Eintrag:
 * Ein System „ohne Version" gibt es nicht, und die Anmeldeseite braucht etwas anzuzeigen.
 */
let versionen: Versionsstand[] = lade()

const hoerer = new Set<() => void>()

function melde() {
  hoerer.forEach((h) => h())
}

function sichere() {
  try {
    localStorage.setItem(VERSIONEN_KEY, JSON.stringify(versionen))
  } catch {
    /* best-effort */
  }
  melde()
}

function nurGueltige(wert: unknown): Versionsstand[] {
  return Array.isArray(wert) ? (wert as Versionsstand[]).filter((v) => typeof v?.version === 'string') : []
}

/** Übernimmt den Serverstand — von `systemSync.ts` aufgerufen. */
export function uebernehmeVersionenVomServer(wert: unknown): void {
  const neu = nurGueltige(wert)
  if (JSON.stringify(neu) === JSON.stringify(versionen)) return
  versionen = neu
  sichere()
}

export function subscribeVersionen(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

/*
  Tab-übergreifender Gleichlauf: Veröffentlicht der Administrator in einem Tab, sollen
  die übrigen Tabs desselben Browsers die Mitteilung bekommen, ohne neu zu laden. Das
  `storage`-Ereignis feuert überall AUSSER im auslösenden Tab — dort meldet `sichere()`
  bereits selbst.
*/
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== VERSIONEN_KEY && event.key !== GELESEN_KEY) return
    if (event.key === VERSIONEN_KEY) versionen = lade()
    melde()
  })
}

/** Die Versionshistorie, neueste zuerst. */
export function getVersionen(): Versionsstand[] {
  return versionen
}

/** Der aktuell veröffentlichte Stand. Vor der ersten Veröffentlichung die Startversion. */
export function getAktuelleVersion(): Versionsstand {
  return versionen[0] ?? { version: STARTVERSION, veroeffentlichtAm: '' }
}

/**
 * Die nächste Nummer — ohne sie zu vergeben.
 *
 * Getrennt von `veroeffentliche()`, weil der Bestätigungsdialog sie ANZEIGEN muss
 * („wird als v1.03 veröffentlicht"), bevor irgendetwas geschrieben wird.
 */
export function naechsteVersion(major = false, liste: Versionsstand[] = versionen): string {
  const [hauptText, nebenText] = (liste[0]?.version ?? STARTVERSION).split('.')
  const haupt = Number(hauptText) || 1
  const neben = Number(nebenText) || 0

  if (major) return `${haupt + 1}.00`
  // Überlauf der Minor-Stelle: nach 1.99 kommt 2.00, nicht 1.100.
  if (neben >= 99) return `${haupt + 1}.00`
  return `${haupt}.${String(neben + 1).padStart(2, '0')}`
}

/** Trägt eine neue Version ein und liefert sie zurück. */
export function veroeffentliche(opts: { von?: string; notiz?: string; major?: boolean } = {}): Versionsstand {
  const eintrag: Versionsstand = {
    version: naechsteVersion(opts.major),
    veroeffentlichtAm: new Date().toISOString(),
    von: opts.von,
    notiz: opts.notiz?.trim() || undefined,
  }
  versionen = [eintrag, ...versionen]
  sichere()
  // Auf dem Serverstand nummerieren: Hat inzwischen ein anderer Administrator
  // veröffentlicht, bekommt dieser Eintrag die Nummer danach.
  aendereDokument<Versionsstand[]>(VERSIONEN_DOKUMENT, (server) => {
    const liste = nurGueltige(server)
    return [{ ...eintrag, version: naechsteVersion(opts.major, liste) }, ...liste]
  }).then(
    (serverStand) => uebernehmeVersionenVomServer(serverStand),
    (error) => meldeSchreibfehler(`Version ${eintrag.version}`, error),
  )
  return eintrag
}

// ---------------------------------------------------------------------------
// Gelesen-Stand (Mitteilungen 🔔)
// ---------------------------------------------------------------------------

/**
 * Gespeichert wird die zuletzt GELESENE Version, nicht die Zahl der ungelesenen.
 *
 * Ein Zähler müsste bei jedem Ereignis mitgepflegt werden und liefe irgendwann
 * auseinander; aus „welche habe ich zuletzt gesehen" lässt sich die Zahl dagegen jederzeit
 * neu ausrechnen — auch nach einem verpassten Ereignis oder einem Gerätewechsel.
 */
function ladeGelesen(): string | null {
  try {
    return localStorage.getItem(GELESEN_KEY)
  } catch {
    return null
  }
}

/** Wie viele Versionen seit dem letzten Öffnen der Mitteilungen dazugekommen sind. */
export function ungeleseneVersionen(): number {
  const gelesen = ladeGelesen()
  if (!gelesen) {
    // Wer noch nie hingesehen hat, bekommt nicht die ganze Historie als „ungelesen"
    // vorgesetzt — nur was NACH der Startversion kam, ist eine echte Neuigkeit.
    return versionen.length
  }
  const index = versionen.findIndex((v) => v.version === gelesen)
  return index < 0 ? versionen.length : index
}

export function markiereVersionenAlsGelesen(): void {
  try {
    const aktuell = getAktuelleVersion().version
    localStorage.setItem(GELESEN_KEY, aktuell)
  } catch {
    /* best-effort im Prototyp */
  }
  melde()
}

/**
 * Setzt Historie und Gelesen-Stand zurück — Teil der Vorführ-Bereinigung.
 * Danach startet das System wieder bei `STARTVERSION`.
 */
export function setzeVersionenZurueck(): void {
  versionen = []
  try {
    localStorage.removeItem(GELESEN_KEY)
  } catch {
    /* best-effort */
  }
  sichere()
  aendereDokument<Versionsstand[]>(VERSIONEN_DOKUMENT, () => []).catch((error) =>
    meldeSchreibfehler('Versionshistorie', error),
  )
}

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

const datumZeit = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** „Version 1.02 · 22.09.2026, 14:30 Uhr" — die Zeile für die Anmeldeseite. */
export function beschreibeVersion(stand: Versionsstand = getAktuelleVersion()): string {
  if (!stand.veroeffentlichtAm) return `Version ${stand.version}`
  const zeitpunkt = new Date(stand.veroeffentlichtAm)
  if (Number.isNaN(zeitpunkt.getTime())) return `Version ${stand.version}`
  return `Version ${stand.version} · ${datumZeit.format(zeitpunkt)} Uhr`
}

/** Nur Datum und Uhrzeit — für die Liste in den Mitteilungen. */
export function beschreibeZeitpunkt(iso: string): string {
  const zeitpunkt = new Date(iso)
  return Number.isNaN(zeitpunkt.getTime()) ? '—' : `${datumZeit.format(zeitpunkt)} Uhr`
}
