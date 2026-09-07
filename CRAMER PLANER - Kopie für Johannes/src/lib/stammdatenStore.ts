/**
 * STAMMDATEN-STORE — die veränderbare Schicht über dem generierten Modul.
 *
 * `src/data/stammdaten.generated.ts` ist ein Build-Artefakt und damit unveränderlich.
 * Für die Bearbeitung in der Anwendung liegt dieser Store davor:
 *
 *     Cramer-Stammdaten.xlsx ──build──> stammdaten.generated.ts   (Grundstand)
 *                                              │
 *                                              ├── + Änderungen aus localStorage
 *                                              ▼
 *                                        stammdatenStore            (Arbeitsstand)
 *                                              │
 *                            ┌─────────────────┼──────────────────┐
 *                       preisLookup       stammdaten          Admin-UI
 *                            │                 │
 *                       kalkulation      Dropdowns/Serien
 *
 * Gespeichert wird bewusst NUR die Abweichung („Overlay"), nicht der ganze Datenbestand:
 * ein neuer Excel-Import bringt so alle unveränderten Zeilen frisch mit, und die eigenen
 * Änderungen bleiben als klar benennbare Liste erhalten — statt in 1509 kopierten Zeilen
 * unsichtbar zu werden. Was jemand geändert hat, ist damit jederzeit beantwortbar.
 *
 * Kein React: der Store ist einfaches Modul-State mit `subscribe()`, damit ihn auch die
 * Nicht-React-Schichten (Lookup, Kalkulation) lesen können. Die Anbindung an Komponenten
 * läuft über `useSyncExternalStore` in `useStammdaten()`.
 */

import {
  artikel as basisArtikel,
  filialen as basisFilialen,
  mitarbeiter as basisMitarbeiter,
  preise as basisPreise,
  type Artikel,
  type Filiale,
  type Mitarbeiter,
  type Preiszeile,
} from '../data/stammdaten.generated.ts'
import {
  basisOberflaechen,
  basisOberflaechenkategorien,
} from '../data/farbmatrix.ts'
import type { Oberflaeche, Oberflaechenkategorie } from '../types/index.ts'
import {
  pruefeArtikel,
  pruefeFiliale,
  pruefeKategorie,
  pruefeMitarbeiter,
  pruefeOberflaeche,
  pruefePreiszeile,
} from './stammdatenValidierung.ts'

/** Bereich der Verwaltung, in dem eine Änderung sichtbar ist (= Reiter + Gitter). */
export type AenderungsBereich = 'artikel' | 'preise' | 'oberflaechen' | 'berater' | 'filialen'

const OVERLAY_KEY = 'cramer-planer.stammdaten.overlay.v2'

/** Achsenwerte einer Preiszeile — fünf Spalten, wie im Preisblatt. */
export type Achsenwerte = [string, string, string, string, string]

/**
 * Die gespeicherte Abweichung vom generierten Grundstand.
 *
 * `geaendert*` überschreibt feldweise, `neu*` kommt hinzu, `geloescht*` blendet aus.
 * Vier Bereiche, überall dasselbe Muster — was für Artikel gilt, gilt auch für
 * Preiszeilen, Mitarbeiter und Filialen.
 */
export interface StammdatenOverlay {
  geaenderteArtikel: Record<string, Partial<Artikel>>
  neueArtikel: Artikel[]
  geloeschteArtikel: string[]
  geaendertePreise: Record<string, Partial<Preiszeile>>
  neuePreise: Preiszeile[]
  geloeschtePreise: string[]
  geaenderteMitarbeiter: Record<string, Partial<Mitarbeiter>>
  neueMitarbeiter: Mitarbeiter[]
  geloeschteMitarbeiter: string[]
  geaenderteFilialen: Record<string, Partial<Filiale>>
  neueFilialen: Filiale[]
  geloeschteFilialen: string[]
  /** Reiter „Oberflächen", Ebene 1 — Schlüssel ist die Kategorie-ID. */
  geaenderteKategorien: Record<string, Partial<Oberflaechenkategorie>>
  neueKategorien: Oberflaechenkategorie[]
  geloeschteKategorien: string[]
  /** Reiter „Oberflächen", Ebene 2 — Schlüssel ist `kategorie::id` (siehe `oberflaecheSchluessel`). */
  geaenderteOberflaechen: Record<string, Partial<Oberflaeche>>
  neueOberflaechen: Oberflaeche[]
  geloeschteOberflaechen: string[]
  /**
   * Aus Excel übernommene, aber regelwidrige Datensätze.
   *
   * Sie stehen im Bestand — der Import bricht nicht ab —, tragen aber eine Marke, damit
   * sie in der Verwaltung auffindbar bleiben und nachgearbeitet werden können. Ein still
   * verworfener Datensatz wäre schlimmer: Er fehlte im Angebot, ohne dass es jemandem
   * auffiele.
   */
  importProbleme: ImportProblem[]
}

/** Ein Datensatz aus dem Excel-Import, der die Regeln verletzt (siehe `lib/stammdatenValidierung.ts`). */
export interface ImportProblem {
  bereich: AenderungsBereich
  /** Zeilen-ID im Gitter des Bereichs — Sprungziel und Schlüssel der Marke. */
  zeilenId: string
  titel: string
  probleme: string[]
}

function leeresOverlay(): StammdatenOverlay {
  return {
    geaenderteArtikel: {},
    neueArtikel: [],
    geloeschteArtikel: [],
    geaendertePreise: {},
    neuePreise: [],
    geloeschtePreise: [],
    geaenderteMitarbeiter: {},
    neueMitarbeiter: [],
    geloeschteMitarbeiter: [],
    geaenderteFilialen: {},
    neueFilialen: [],
    geloeschteFilialen: [],
    geaenderteKategorien: {},
    neueKategorien: [],
    geloeschteKategorien: [],
    geaenderteOberflaechen: {},
    neueOberflaechen: [],
    geloeschteOberflaechen: [],
    importProbleme: [],
  }
}

/**
 * Stabiler Schlüssel einer Preiszeile.
 *
 * Artikel + Achsenwerte reichen NICHT: Artikel ohne Achsen führen mehrere Zeilen mit
 * identischen (leeren) Achsenwerten — `40-40-50-0004` etwa drei Staffelpreise 20/20/80.
 * Die würden auf denselben Schlüssel fallen, und eine Änderung träfe die falsche Zeile.
 *
 * Deshalb trägt der Schlüssel zusätzlich `ref`, die Zeilen-ID der Ursprungs-Extraktion —
 * eindeutig über alle 1509 importierten Zeilen. Neu angelegte Zeilen haben kein `ref`
 * und werden über ihre Achsenwerte unterschieden; das stellt `legePreiszeileAn()` sicher.
 *
 * Nebeneffekt: der Schlüssel bleibt beim Ändern von Achsenwerten stabil.
 */
export function preisSchluessel(zeile: Pick<Preiszeile, 'artikel' | 'a' | 'ref'>): string {
  return `${zeile.artikel}#${zeile.ref ?? ''}|${zeile.a.join('|')}`
}

/**
 * Stabiler Schlüssel einer Oberfläche.
 *
 * Seit die ID der Bezeichnung entspricht, wären die meisten IDs schon für sich eindeutig.
 * Der Schlüssel bleibt trotzdem zusammengesetzt: Zwei Kategorien dürfen dieselbe Farbe
 * führen (Furnier und Akustikpaneele haben beide „Eiche geölt"), und genau so adressieren
 * gespeicherte Entwürfe ihre Auswahl auch — `materialGroupId` + `optionId`.
 */
export function oberflaecheSchluessel(o: Pick<Oberflaeche, 'kategorie' | 'id'>): string {
  return `${o.kategorie}::${o.id}`
}

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

export interface Arbeitsstand {
  artikel: Artikel[]
  preise: Preiszeile[]
  mitarbeiter: Mitarbeiter[]
  filialen: Filiale[]
  /** Reiter „Oberflächen", Ebene 1 — nach `sortierung` geordnet. */
  oberflaechenkategorien: Oberflaechenkategorie[]
  /** Reiter „Oberflächen", Ebene 2 — nach Kategorie und `sortierung` geordnet. */
  oberflaechen: Oberflaeche[]
  /** Zählt jede Änderung hoch — Verbraucher bauen daran ihre Indizes neu auf. */
  version: number
}

let overlay: StammdatenOverlay = ladeOverlay()
let commitStand: StammdatenOverlay = ladeCommitStand()
let stand: Arbeitsstand = baueStand(overlay, 1)
const hoerer = new Set<() => void>()

function ladeOverlay(): StammdatenOverlay {
  try {
    const roh = localStorage.getItem(OVERLAY_KEY)
    if (!roh) return leeresOverlay()
    return { ...leeresOverlay(), ...(JSON.parse(roh) as Partial<StammdatenOverlay>) }
  } catch {
    // Unlesbares Overlay darf die Anwendung nicht blockieren – Grundstand genügt.
    return leeresOverlay()
  }
}

function speichereOverlay() {
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay))
  } catch {
    /* best-effort im Prototyp */
  }
}

// ---------------------------------------------------------------------------
// Bearbeitungsstand vs. gespeicherter Stand
// ---------------------------------------------------------------------------

/**
 * Der zuletzt über „Speichern" bestätigte Stand.
 *
 * Warum zwei Ebenen? Ein Editor schreibt seine Änderung sofort in den Arbeitsstand —
 * sonst wäre sie beim Reiterwechsel weg und ein Browser-Neustart verlöre die halbe
 * Sitzung. Verbindlich wird sie aber erst mit dem übergeordneten „Speichern" im Kopf.
 * Dazwischen liegen die AUSSTEHENDEN Änderungen: Was der Bearbeiter gesammelt, aber noch
 * nicht freigegeben hat. Ohne diese Unterscheidung hieße jede Zwischeneingabe „gespeichert",
 * und die Rückfrage im Kopf hätte nichts, worauf sie sich bezieht.
 */
const COMMIT_KEY = 'cramer-planer.stammdaten.commit.v2'

function ladeCommitStand(): StammdatenOverlay {
  try {
    const roh = localStorage.getItem(COMMIT_KEY)
    if (!roh) return leeresOverlay()
    return { ...leeresOverlay(), ...(JSON.parse(roh) as Partial<StammdatenOverlay>) }
  } catch {
    return leeresOverlay()
  }
}

function speichereCommitStand() {
  try {
    localStorage.setItem(COMMIT_KEY, JSON.stringify(commitStand))
  } catch {
    /* best-effort im Prototyp */
  }
}

/** Grundstand + Änderungen + Neuzugänge − Löschungen, für einen Datenbereich. */
function mische<T>(
  basis: readonly T[],
  schluessel: (eintrag: T) => string,
  geaendert: Record<string, Partial<T>>,
  neu: T[],
  geloescht: string[],
): T[] {
  const weg = new Set(geloescht)
  return [
    ...basis
      .filter((e) => !weg.has(schluessel(e)))
      .map((e) => {
        const patch = geaendert[schluessel(e)]
        return patch ? { ...e, ...patch } : e
      }),
    ...neu,
  ]
}

function baueStand(ov: StammdatenOverlay, version: number): Arbeitsstand {
  const kategorien = mische(
    basisOberflaechenkategorien,
    (k) => k.id,
    ov.geaenderteKategorien,
    ov.neueKategorien,
    ov.geloeschteKategorien,
  ).sort((a, b) => a.sortierung - b.sortierung || a.bezeichnung.localeCompare(b.bezeichnung))

  // Reihenfolge der Kategorien schlägt auf die Oberflächen durch — die Dropdowns sollen
  // in derselben Ordnung stehen wie das Gitter in der Verwaltung.
  const katPos = new Map(kategorien.map((k, i) => [k.id, i]))
  const oberflaechen = mische(
    basisOberflaechen,
    oberflaecheSchluessel,
    ov.geaenderteOberflaechen,
    ov.neueOberflaechen,
    ov.geloeschteOberflaechen,
  ).sort(
    (a, b) =>
      (katPos.get(a.kategorie) ?? 999) - (katPos.get(b.kategorie) ?? 999) ||
      a.sortierung - b.sortierung ||
      a.bezeichnung.localeCompare(b.bezeichnung),
  )

  return {
    artikel: mische(basisArtikel, (a) => a.artikelnummer, ov.geaenderteArtikel, ov.neueArtikel, ov.geloeschteArtikel),
    preise: mische(basisPreise, preisSchluessel, ov.geaendertePreise, ov.neuePreise, ov.geloeschtePreise),
    mitarbeiter: mische(basisMitarbeiter, (m) => m.personalnr, ov.geaenderteMitarbeiter, ov.neueMitarbeiter, ov.geloeschteMitarbeiter),
    filialen: mische(basisFilialen, (f) => f.filialnr, ov.geaenderteFilialen, ov.neueFilialen, ov.geloeschteFilialen),
    oberflaechenkategorien: kategorien,
    oberflaechen,
    version,
  }
}

function anwenden(aenderung: (ov: StammdatenOverlay) => void) {
  aenderung(overlay)
  stand = baueStand(overlay, stand.version + 1)
  speichereOverlay()
  for (const h of hoerer) h()
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export function getStammdatenStand(): Arbeitsstand {
  return stand
}

export function getArtikelListe(): Artikel[] {
  return stand.artikel
}

export function getPreisListe(): Preiszeile[] {
  return stand.preise
}

export function getMitarbeiterListe(): Mitarbeiter[] {
  return stand.mitarbeiter
}

export function getFilialenListe(): Filiale[] {
  return stand.filialen
}

/**
 * Oberflächen-Stammdaten. Beide Listen sind die EINZIGE Quelle für Material- und
 * Farb-Dropdowns; `config/materialMatrix.ts` setzt sie nur noch in die von Korpus und
 * Fronten erwartete Form um.
 */
export function getOberflaechenkategorien(): Oberflaechenkategorie[] {
  return stand.oberflaechenkategorien
}

export function getOberflaechen(): Oberflaeche[] {
  return stand.oberflaechen
}

/** Für `useSyncExternalStore` und für Indizes, die sich neu aufbauen müssen. */
export function subscribe(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

/** Identität einer Änderung über die Overlay-Stände hinweg. */
function aenderungsSchluessel(a: Aenderung): string {
  return `${a.bereich}|${a.art}|${a.zeilenId}`
}

/**
 * Alle Abweichungen vom Grundstand, jede mit der Marke `ausstehend`.
 *
 * Ausstehend ist, was der Bearbeitungsstand kennt, der zuletzt gespeicherte aber nicht —
 * oder was sich seither in seinen Feldern unterscheidet. Genau diese Menge bestätigt der
 * „Speichern"-Knopf im Kopf.
 */
export function listeAenderungen(): Aenderung[] {
  const aktuell = baueAenderungen(overlay)
  const gespeichert = new Map(
    baueAenderungen(commitStand).map((a) => [aenderungsSchluessel(a), a.felder.join('|')]),
  )
  return aktuell.map((a) => ({
    ...a,
    ausstehend: gespeichert.get(aenderungsSchluessel(a)) !== a.felder.join('|'),
  }))
}

/** Noch nicht bestätigte Änderungen — die Zahl im Kopf („3 Änderungen ausstehend"). */
export function zaehleAusstehendeAenderungen(): number {
  return listeAenderungen().filter((a) => a.ausstehend).length
}

/**
 * Übernimmt ALLE gesammelten Änderungen als gespeicherten Stand — global über alle Reiter.
 *
 * Der Arbeitsstand selbst ändert sich dabei nicht: Er ist längst wirksam, damit beim
 * Reiterwechsel oder Neuladen nichts verloren geht. Bestätigt wird, dass er so gelten soll.
 */
export function speichereAlleAenderungen(): number {
  const anzahl = zaehleAusstehendeAenderungen()
  commitStand = JSON.parse(JSON.stringify(overlay)) as StammdatenOverlay
  speichereCommitStand()
  speichereOverlay()
  // Version hochzaehlen, damit der Kopf die neue Ausstehend-Zahl sofort zeigt.
  stand = baueStand(overlay, stand.version + 1)
  for (const h of hoerer) h()
  return anzahl
}

/**
 * Anzahl der Abweichungen vom generierten Grundstand — für „x Änderungen".
 *
 * Zählt bewusst über `listeAenderungen()` und nicht über die Einträge des Overlays:
 * Die Editoren schreiben den ganzen Datensatz zurück, sodass ein Speichern ohne echte
 * Änderung sonst als Änderung gezählt würde. Zahl und aufklappbare Liste zeigen damit
 * immer dasselbe.
 */
export function zaehleAenderungen(): number {
  return listeAenderungen().length
}

export function istArtikelGeaendert(artikelnummer: string): boolean {
  return (
    artikelnummer in overlay.geaenderteArtikel ||
    overlay.neueArtikel.some((a) => a.artikelnummer === artikelnummer)
  )
}

export function istPreisGeaendert(schluessel: string): boolean {
  return (
    schluessel in overlay.geaendertePreise ||
    overlay.neuePreise.some((p) => preisSchluessel(p) === schluessel)
  )
}

export function istMitarbeiterGeaendert(personalnr: string): boolean {
  return (
    personalnr in overlay.geaenderteMitarbeiter ||
    overlay.neueMitarbeiter.some((m) => m.personalnr === personalnr)
  )
}

export function istFilialeGeaendert(filialnr: string): boolean {
  return filialnr in overlay.geaenderteFilialen || overlay.neueFilialen.some((f) => f.filialnr === filialnr)
}

export function istKategorieGeaendert(id: string): boolean {
  return id in overlay.geaenderteKategorien || overlay.neueKategorien.some((k) => k.id === id)
}

export function istOberflaecheGeaendert(schluessel: string): boolean {
  return (
    schluessel in overlay.geaenderteOberflaechen ||
    overlay.neueOberflaechen.some((o) => oberflaecheSchluessel(o) === schluessel)
  )
}

// ---------------------------------------------------------------------------
// Artikel
// ---------------------------------------------------------------------------

const NUMMERN_MUSTER = /^\d{2}-\d{2}-\d{2}-\d{4}$/

/** Ändert Felder eines Artikels. Die Artikelnummer selbst bleibt unveränderlich. */
export function aendereArtikel(artikelnummer: string, patch: Partial<Artikel>): void {
  const { artikelnummer: _ignoriert, ...felder } = patch
  anwenden((ov) => {
    const neuAngelegt = ov.neueArtikel.find((a) => a.artikelnummer === artikelnummer)
    if (neuAngelegt) {
      Object.assign(neuAngelegt, felder)
      return
    }
    ov.geaenderteArtikel[artikelnummer] = { ...ov.geaenderteArtikel[artikelnummer], ...felder }
  })
}

/**
 * Legt einen Artikel an. Eine doppelte Nummer würde Preiszeilen mehrdeutig machen —
 * „Nummer = Identität" (ARTIKELNUMMER-LOGIK.md).
 */
export function legeArtikelAn(neu: Artikel): string | null {
  if (!NUMMERN_MUSTER.test(neu.artikelnummer)) {
    return 'Die Artikelnummer muss dem Muster TT-PP-GG-NNNN entsprechen (z. B. 30-30-05-0016).'
  }
  if (stand.artikel.some((a) => a.artikelnummer === neu.artikelnummer)) {
    return `Die Artikelnummer ${neu.artikelnummer} ist bereits vergeben.`
  }
  if (!neu.bezeichnung.trim()) return 'Bitte eine Bezeichnung angeben.'
  anwenden((ov) => {
    ov.neueArtikel.push(neu)
  })
  return null
}

/** Entfernt einen Artikel samt seiner Preiszeilen — sie wären sonst unauffindbar. */
export function loescheArtikel(artikelnummer: string): void {
  anwenden((ov) => {
    const index = ov.neueArtikel.findIndex((a) => a.artikelnummer === artikelnummer)
    if (index >= 0) ov.neueArtikel.splice(index, 1)
    else if (!ov.geloeschteArtikel.includes(artikelnummer)) ov.geloeschteArtikel.push(artikelnummer)
    delete ov.geaenderteArtikel[artikelnummer]

    for (const zeile of stand.preise.filter((p) => p.artikel === artikelnummer)) {
      const s = preisSchluessel(zeile)
      const i = ov.neuePreise.findIndex((p) => preisSchluessel(p) === s)
      if (i >= 0) ov.neuePreise.splice(i, 1)
      else if (!ov.geloeschtePreise.includes(s)) ov.geloeschtePreise.push(s)
    }
  })
}

/**
 * Nächste freie Artikelnummer im selben Nummernkreis (`TT-PP-GG-` bleibt, `NNNN` zählt hoch).
 * Das folgt der Systematik aus ARTIKELNUMMER-LOGIK.md: die laufende Nummer ist fortlaufend,
 * die Klassifikationsblöcke bleiben unangetastet.
 */
export function naechsteFreieNummer(vorlage: string): string {
  const teile = vorlage.split('-')
  if (teile.length !== 4) return ''
  const praefix = teile.slice(0, 3).join('-')
  const vergeben = new Set(stand.artikel.map((a) => a.artikelnummer))
  for (let n = Number(teile[3]) + 1; n <= 9999; n++) {
    const kandidat = `${praefix}-${String(n).padStart(4, '0')}`
    if (!vergeben.has(kandidat)) return kandidat
  }
  return ''
}

/**
 * Dupliziert einen Artikel auf die nächste freie Nummer im selben Nummernkreis,
 * einschließlich seiner Preiszeilen. Gibt die neue Nummer zurück (oder eine Meldung).
 */
export function dupliziereArtikel(artikelnummer: string): { nummer: string } | { fehler: string } {
  const quelle = stand.artikel.find((a) => a.artikelnummer === artikelnummer)
  if (!quelle) return { fehler: `Artikel ${artikelnummer} nicht gefunden.` }

  const nummer = naechsteFreieNummer(artikelnummer)
  if (!nummer) return { fehler: `Im Nummernkreis von ${artikelnummer} ist keine Nummer mehr frei.` }

  const zeilen = stand.preise.filter((p) => p.artikel === artikelnummer)
  anwenden((ov) => {
    ov.neueArtikel.push({
      ...quelle,
      artikelnummer: nummer,
      kurzzeichen: '',
      quelle: `Kopie von ${artikelnummer}`,
    })
    // `ref` bewusst auf null: die Kopie stammt aus keiner Zeile der Ursprungs-Extraktion.
    for (const z of zeilen) ov.neuePreise.push({ ...z, artikel: nummer, a: [...z.a] as Achsenwerte, ref: null })
  })
  return { nummer }
}

// ---------------------------------------------------------------------------
// Preiszeilen
// ---------------------------------------------------------------------------

export function aenderePreiszeile(schluessel: string, patch: Partial<Preiszeile>): void {
  anwenden((ov) => {
    const neuAngelegt = ov.neuePreise.find((p) => preisSchluessel(p) === schluessel)
    if (neuAngelegt) {
      Object.assign(neuAngelegt, patch)
      return
    }
    ov.geaendertePreise[schluessel] = { ...ov.geaendertePreise[schluessel], ...patch }
  })
}

export function legePreiszeileAn(neu: Preiszeile): string | null {
  if (!stand.artikel.some((a) => a.artikelnummer === neu.artikel)) {
    return `Es gibt keinen Artikel ${neu.artikel} — eine Preiszeile ohne Artikel wäre nicht auffindbar.`
  }
  if (stand.preise.some((p) => preisSchluessel(p) === preisSchluessel(neu))) {
    return 'Für diese Achsenwerte existiert bereits eine Preiszeile.'
  }
  anwenden((ov) => {
    ov.neuePreise.push(neu)
  })
  return null
}

export function loeschePreiszeile(schluessel: string): void {
  anwenden((ov) => {
    const index = ov.neuePreise.findIndex((p) => preisSchluessel(p) === schluessel)
    if (index >= 0) {
      ov.neuePreise.splice(index, 1)
      return
    }
    delete ov.geaendertePreise[schluessel]
    if (!ov.geloeschtePreise.includes(schluessel)) ov.geloeschtePreise.push(schluessel)
  })
}

// ---------------------------------------------------------------------------
// Mitarbeiter & Filialen
// ---------------------------------------------------------------------------

export function aendereMitarbeiter(personalnr: string, patch: Partial<Mitarbeiter>): void {
  const { personalnr: _weg, ...felder } = patch
  anwenden((ov) => {
    const neuAngelegt = ov.neueMitarbeiter.find((m) => m.personalnr === personalnr)
    if (neuAngelegt) Object.assign(neuAngelegt, felder)
    else ov.geaenderteMitarbeiter[personalnr] = { ...ov.geaenderteMitarbeiter[personalnr], ...felder }
  })
}

export function legeMitarbeiterAn(neu: Mitarbeiter): string | null {
  if (!neu.personalnr.trim()) return 'Bitte eine Personalnummer angeben.'
  if (stand.mitarbeiter.some((m) => m.personalnr === neu.personalnr)) {
    return `Die Personalnummer ${neu.personalnr} ist bereits vergeben.`
  }
  if (!neu.name.trim()) return 'Bitte einen Namen angeben.'
  anwenden((ov) => {
    ov.neueMitarbeiter.push(neu)
  })
  return null
}

export function loescheMitarbeiter(personalnr: string): void {
  anwenden((ov) => {
    const i = ov.neueMitarbeiter.findIndex((m) => m.personalnr === personalnr)
    if (i >= 0) ov.neueMitarbeiter.splice(i, 1)
    else if (!ov.geloeschteMitarbeiter.includes(personalnr)) ov.geloeschteMitarbeiter.push(personalnr)
    delete ov.geaenderteMitarbeiter[personalnr]
  })
}

export function aendereFiliale(filialnr: string, patch: Partial<Filiale>): void {
  const { filialnr: _weg, ...felder } = patch
  anwenden((ov) => {
    const neuAngelegt = ov.neueFilialen.find((f) => f.filialnr === filialnr)
    if (neuAngelegt) Object.assign(neuAngelegt, felder)
    else ov.geaenderteFilialen[filialnr] = { ...ov.geaenderteFilialen[filialnr], ...felder }
  })
}

export function legeFilialeAn(neu: Filiale): string | null {
  if (!neu.filialnr.trim()) return 'Bitte eine Filialnummer angeben.'
  if (stand.filialen.some((f) => f.filialnr === neu.filialnr)) {
    return `Die Filialnummer ${neu.filialnr} ist bereits vergeben.`
  }
  if (!neu.name.trim()) return 'Bitte einen Namen angeben.'
  anwenden((ov) => {
    ov.neueFilialen.push(neu)
  })
  return null
}

/** Entfernt eine Filiale — nur, wenn kein Mitarbeiter mehr darauf verweist. */
export function loescheFiliale(filialnr: string): string | null {
  const verweise = stand.mitarbeiter.filter((m) => m.filiale === filialnr)
  if (verweise.length > 0) {
    return `${verweise.length} Mitarbeiter verweisen noch auf ${filialnr} (${verweise
      .map((m) => m.name)
      .join(', ')}). Bitte dort zuerst umtragen.`
  }
  anwenden((ov) => {
    const i = ov.neueFilialen.findIndex((f) => f.filialnr === filialnr)
    if (i >= 0) ov.neueFilialen.splice(i, 1)
    else if (!ov.geloeschteFilialen.includes(filialnr)) ov.geloeschteFilialen.push(filialnr)
    delete ov.geaenderteFilialen[filialnr]
  })
  return null
}

// ---------------------------------------------------------------------------
// Oberflächen — Ebene 1: Kategorien
// ---------------------------------------------------------------------------

/** ID-Muster für Kategorien und Oberflächen: kleingeschrieben, ohne Leerzeichen. */
const ID_MUSTER = /^[a-z0-9][a-z0-9-]*$/

/**
 * ID aus einer Bezeichnung („Schwarz RAL 9005" ⇒ `schwarz-ral-9005`).
 *
 * Seit 09/2026 die verbindliche Regel für Oberflächen: die ID entspricht der Bezeichnung.
 * Vorher hießen die IDs nur nach dem Farbnamen (`schwarz`) und waren damit über die
 * Kategorien hinweg mehrfach vergeben — „Schwarz" gab es in Decoboard, Mattlack und
 * Gläsern dreimal. Die Maske fragt sie deshalb nicht mehr ab, sondern bildet sie hier.
 *
 * Die ID ist eine MOMENTAUFNAHME der Bezeichnung beim Anlegen: Wird die Bezeichnung
 * später korrigiert, bleibt die ID stehen — genau das schützt bereits gespeicherte
 * Entwürfe davor, ihre Farbe zu verlieren.
 */
export function idVorschlag(bezeichnung: string): string {
  return bezeichnung
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/** Nächste freie Sortiernummer innerhalb einer Kategorie (bzw. für Kategorien selbst). */
export function naechsteSortierung(kategorie?: string): number {
  const werte =
    kategorie == null
      ? stand.oberflaechenkategorien.map((k) => k.sortierung)
      : stand.oberflaechen.filter((o) => o.kategorie === kategorie).map((o) => o.sortierung)
  return (werte.length ? Math.max(...werte) : 0) + 10
}

export function aendereKategorie(id: string, patch: Partial<Oberflaechenkategorie>): void {
  const { id: _unveraenderlich, ...felder } = patch
  anwenden((ov) => {
    const neuAngelegt = ov.neueKategorien.find((k) => k.id === id)
    if (neuAngelegt) Object.assign(neuAngelegt, felder)
    else ov.geaenderteKategorien[id] = { ...ov.geaenderteKategorien[id], ...felder }
  })
}

export function legeKategorieAn(neu: Oberflaechenkategorie): string | null {
  if (!ID_MUSTER.test(neu.id)) {
    return 'Die ID darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten (z. B. „mattlack").'
  }
  if (stand.oberflaechenkategorien.some((k) => k.id === neu.id)) {
    return `Die Kategorie-ID „${neu.id}" ist bereits vergeben.`
  }
  if (!neu.bezeichnung.trim()) return 'Bitte eine Bezeichnung angeben.'
  anwenden((ov) => {
    ov.neueKategorien.push(neu)
  })
  return null
}

/**
 * Entfernt eine Kategorie samt ihrer Oberflächen — eine Farbe ohne Kategorie hätte weder
 * Preisgruppe noch Dropdown, in dem sie erscheinen könnte (dieselbe Regel wie Artikel ⇢ Preiszeilen).
 */
export function loescheKategorie(id: string): void {
  anwenden((ov) => {
    const i = ov.neueKategorien.findIndex((k) => k.id === id)
    if (i >= 0) ov.neueKategorien.splice(i, 1)
    else if (!ov.geloeschteKategorien.includes(id)) ov.geloeschteKategorien.push(id)
    delete ov.geaenderteKategorien[id]

    for (const o of stand.oberflaechen.filter((x) => x.kategorie === id)) {
      const s = oberflaecheSchluessel(o)
      const j = ov.neueOberflaechen.findIndex((x) => oberflaecheSchluessel(x) === s)
      if (j >= 0) ov.neueOberflaechen.splice(j, 1)
      else if (!ov.geloeschteOberflaechen.includes(s)) ov.geloeschteOberflaechen.push(s)
      delete ov.geaenderteOberflaechen[s]
    }
  })
}

// ---------------------------------------------------------------------------
// Oberflächen — Ebene 2: konkrete Farben
// ---------------------------------------------------------------------------

export function aendereOberflaeche(schluessel: string, patch: Partial<Oberflaeche>): void {
  // ID und Kategorie bilden zusammen den Schlüssel und bleiben deshalb unveränderlich —
  // sonst zeigte eine gespeicherte Auswahl im Entwurf plötzlich ins Leere.
  const { id: _id, kategorie: _kategorie, ...felder } = patch
  anwenden((ov) => {
    const neuAngelegt = ov.neueOberflaechen.find((o) => oberflaecheSchluessel(o) === schluessel)
    if (neuAngelegt) Object.assign(neuAngelegt, felder)
    else ov.geaenderteOberflaechen[schluessel] = { ...ov.geaenderteOberflaechen[schluessel], ...felder }
  })
}

export function legeOberflaecheAn(neu: Oberflaeche): string | null {
  if (!ID_MUSTER.test(neu.id)) {
    return 'Die ID darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten (z. B. „schwarz").'
  }
  if (!neu.kategorie) return 'Bitte eine Oberflächenkategorie wählen.'
  if (!stand.oberflaechenkategorien.some((k) => k.id === neu.kategorie)) {
    return `Es gibt keine Kategorie „${neu.kategorie}" — eine Oberfläche ohne Kategorie hätte keine Preisgruppe.`
  }
  if (!neu.bezeichnung.trim()) return 'Bitte eine Bezeichnung angeben.'
  if (stand.oberflaechen.some((o) => oberflaecheSchluessel(o) === oberflaecheSchluessel(neu))) {
    return `In der Kategorie „${neu.kategorie}" gibt es bereits eine Oberfläche mit der ID „${neu.id}".`
  }
  anwenden((ov) => {
    ov.neueOberflaechen.push(neu)
  })
  return null
}

export function loescheOberflaeche(schluessel: string): void {
  anwenden((ov) => {
    const i = ov.neueOberflaechen.findIndex((o) => oberflaecheSchluessel(o) === schluessel)
    if (i >= 0) {
      ov.neueOberflaechen.splice(i, 1)
      return
    }
    delete ov.geaenderteOberflaechen[schluessel]
    if (!ov.geloeschteOberflaechen.includes(schluessel)) ov.geloeschteOberflaechen.push(schluessel)
  })
}

// ---------------------------------------------------------------------------
// Massen-Übernahme (Excel-Import) & Zurücksetzen
// ---------------------------------------------------------------------------

/**
 * Übernimmt einen kompletten Datensatz aus einem Excel-Import.
 *
 * Verglichen wird gegen den GRUNDSTAND, nicht gegen den Arbeitsstand: so entsteht ein
 * Overlay, das genau die Abweichungen zur Mappe beschreibt — auch dann, wenn vorher
 * schon von Hand geändert wurde. Zeilen, die im Import fehlen, gelten als gelöscht.
 */
export function uebernehmeImport(daten: {
  artikel?: Artikel[]
  preise?: Preiszeile[]
  mitarbeiter?: Mitarbeiter[]
  filialen?: Filiale[]
  oberflaechenkategorien?: Oberflaechenkategorie[]
  oberflaechen?: Oberflaeche[]
  /** Übernommene, aber regelwidrige Datensätze — werden im Gitter markiert. */
  probleme?: ImportProblem[]
}): { uebernommen: number; neu: number; geaendert: number; bereiche: string[] } {
  let uebernommen = 0
  let neu = 0
  let geaendert = 0
  const bereiche: string[] = []

  anwenden((ov) => {
    // Marken des vorigen Imports fallen weg — sie gehören zu Daten, die es so nicht mehr gibt.
    ov.importProbleme = daten.probleme ?? []
    if (daten.artikel) {
      ov.geaenderteArtikel = {}
      ov.neueArtikel = []
      ov.geloeschteArtikel = []
      const basis = new Map(basisArtikel.map((a) => [a.artikelnummer, a]))
      for (const a of daten.artikel) {
        const alt = basis.get(a.artikelnummer)
        if (!alt) { ov.neueArtikel.push(a); neu++ }
        else if (JSON.stringify(alt) !== JSON.stringify(a)) { ov.geaenderteArtikel[a.artikelnummer] = a; geaendert++ }
      }
      const drin = new Set(daten.artikel.map((a) => a.artikelnummer))
      ov.geloeschteArtikel = [...basis.keys()].filter((nr) => !drin.has(nr))
      uebernommen += daten.artikel.length
      bereiche.push(`${daten.artikel.length} Artikel`)
    }

    if (daten.preise) {
      ov.geaendertePreise = {}
      ov.neuePreise = []
      ov.geloeschtePreise = []
      const basis = new Map(basisPreise.map((p) => [preisSchluessel(p), p]))
      for (const p of daten.preise) {
        const s = preisSchluessel(p)
        const alt = basis.get(s)
        if (!alt) { ov.neuePreise.push(p); neu++ }
        else if (JSON.stringify(alt) !== JSON.stringify(p)) { ov.geaendertePreise[s] = p; geaendert++ }
      }
      const drin = new Set(daten.preise.map(preisSchluessel))
      ov.geloeschtePreise = [...basis.keys()].filter((s) => !drin.has(s))
      uebernommen += daten.preise.length
      bereiche.push(`${daten.preise.length} Preiszeilen`)
    }

    if (daten.mitarbeiter) {
      ov.geaenderteMitarbeiter = {}
      ov.neueMitarbeiter = []
      ov.geloeschteMitarbeiter = []
      const basis = new Map(basisMitarbeiter.map((m) => [m.personalnr, m]))
      for (const m of daten.mitarbeiter) {
        const alt = basis.get(m.personalnr)
        if (!alt) { ov.neueMitarbeiter.push(m); neu++ }
        else if (JSON.stringify(alt) !== JSON.stringify(m)) { ov.geaenderteMitarbeiter[m.personalnr] = m; geaendert++ }
      }
      uebernommen += daten.mitarbeiter.length
      bereiche.push(`${daten.mitarbeiter.length} Mitarbeiter`)
    }

    if (daten.oberflaechenkategorien) {
      ov.geaenderteKategorien = {}
      ov.neueKategorien = []
      ov.geloeschteKategorien = []
      const basis = new Map(basisOberflaechenkategorien.map((k) => [k.id, k]))
      for (const k of daten.oberflaechenkategorien) {
        const alt = basis.get(k.id)
        if (!alt) { ov.neueKategorien.push(k); neu++ }
        else if (JSON.stringify(alt) !== JSON.stringify(k)) { ov.geaenderteKategorien[k.id] = k; geaendert++ }
      }
      uebernommen += daten.oberflaechenkategorien.length
      bereiche.push(`${daten.oberflaechenkategorien.length} Oberflächenkategorien`)
    }

    if (daten.oberflaechen) {
      ov.geaenderteOberflaechen = {}
      ov.neueOberflaechen = []
      ov.geloeschteOberflaechen = []
      const basis = new Map(basisOberflaechen.map((o) => [oberflaecheSchluessel(o), o]))
      for (const o of daten.oberflaechen) {
        const sch = oberflaecheSchluessel(o)
        const alt = basis.get(sch)
        if (!alt) { ov.neueOberflaechen.push(o); neu++ }
        else if (JSON.stringify(alt) !== JSON.stringify(o)) { ov.geaenderteOberflaechen[sch] = o; geaendert++ }
      }
      uebernommen += daten.oberflaechen.length
      bereiche.push(`${daten.oberflaechen.length} Oberflächen`)
    }

    if (daten.filialen) {
      ov.geaenderteFilialen = {}
      ov.neueFilialen = []
      ov.geloeschteFilialen = []
      const basis = new Map(basisFilialen.map((f) => [f.filialnr, f]))
      for (const f of daten.filialen) {
        const alt = basis.get(f.filialnr)
        if (!alt) { ov.neueFilialen.push(f); neu++ }
        else if (JSON.stringify(alt) !== JSON.stringify(f)) { ov.geaenderteFilialen[f.filialnr] = f; geaendert++ }
      }
      uebernommen += daten.filialen.length
      bereiche.push(`${daten.filialen.length} Filialen`)
    }
  })

  return { uebernommen, neu, geaendert, bereiche }
}

/** Verwirft alle Änderungen und stellt den generierten Grundstand her. */
export function setzeAllesZurueck(): void {
  // Auch der gespeicherte Stand faellt zurueck – sonst blieben Aenderungen als
  // "bereits gespeichert" markiert, die es gar nicht mehr gibt.
  commitStand = leeresOverlay()
  speichereCommitStand()
  anwenden((ov) => Object.assign(ov, leeresOverlay()))
}

/** Aus Excel importierte Datensätze mit Regelverstoß — Marken im Gitter und Warnung im Kopf. */
export function getImportProbleme(): ImportProblem[] {
  return overlay.importProbleme ?? []
}

/**
 * Prüft einen Datensatz erneut und nimmt seine Import-Marke zurück, wenn er die Regeln
 * jetzt erfüllt. Nach jedem Speichern im Editor aufgerufen: Wer eine beanstandete Zeile
 * nacharbeitet, soll die Markierung verschwinden sehen, ohne sie von Hand quittieren zu
 * müssen — und sie soll bleiben, wenn das Problem noch besteht.
 */
export function pruefeImportMarke(bereich: AenderungsBereich, zeilenId: string): void {
  const problem = (overlay.importProbleme ?? []).find(
    (p) => p.bereich === bereich && p.zeilenId === zeilenId,
  )
  if (!problem) return

  let offen: string[] = []
  switch (bereich) {
    case 'artikel': {
      const a = stand.artikel.find((x) => x.artikelnummer === zeilenId)
      offen = a ? pruefeArtikel(a) : []
      break
    }
    case 'preise': {
      const z = stand.preise.find((x) => preisSchluessel(x) === zeilenId)
      offen = z ? pruefePreiszeile(z, new Set(stand.artikel.map((a) => a.artikelnummer))) : []
      break
    }
    case 'oberflaechen': {
      if (zeilenId.startsWith('kat:')) {
        const k = stand.oberflaechenkategorien.find((x) => x.id === zeilenId.slice(4))
        offen = k ? pruefeKategorie(k) : []
      } else {
        const o = stand.oberflaechen.find((x) => `obf:${oberflaecheSchluessel(x)}` === zeilenId)
        offen = o ? pruefeOberflaeche(o, new Set(stand.oberflaechenkategorien.map((k) => k.id))) : []
      }
      break
    }
    case 'berater': {
      const m = stand.mitarbeiter.find((x) => x.personalnr === zeilenId)
      offen = m ? pruefeMitarbeiter(m) : []
      break
    }
    case 'filialen': {
      const f = stand.filialen.find((x) => x.filialnr === zeilenId)
      offen = f ? pruefeFiliale(f) : []
      break
    }
  }

  if (offen.length === 0) loescheImportProblem(bereich, zeilenId)
  else if (offen.join('|') !== problem.probleme.join('|')) {
    // Teilweise nachgearbeitet: Marke bleibt, Begründung wird aktuell gehalten.
    anwenden((ov) => {
      ov.importProbleme = (ov.importProbleme ?? []).map((p) =>
        p.bereich === bereich && p.zeilenId === zeilenId ? { ...p, probleme: offen } : p,
      )
    })
  }
}

/**
 * Nimmt die Marke eines Datensatzes zurück — sobald er nachgearbeitet ist.
 * Aufgerufen von den Editoren nach dem Speichern; erfüllt der Datensatz die Regeln
 * wieder, verschwindet Zeilenmarkierung und Warnung von selbst.
 */
export function loescheImportProblem(bereich: AenderungsBereich, zeilenId: string): void {
  if (!(overlay.importProbleme ?? []).some((p) => p.bereich === bereich && p.zeilenId === zeilenId)) return
  anwenden((ov) => {
    ov.importProbleme = (ov.importProbleme ?? []).filter(
      (p) => !(p.bereich === bereich && p.zeilenId === zeilenId),
    )
  })
}

/** Das aktuelle Overlay — für Export und Diagnose. */
export function getOverlay(): StammdatenOverlay {
  return overlay
}

// ---------------------------------------------------------------------------
// Änderungsprotokoll — was genau weicht vom Grundstand ab?
// ---------------------------------------------------------------------------

export type AenderungsArt = 'geaendert' | 'neu' | 'geloescht'

export interface Aenderung {
  bereich: AenderungsBereich
  art: AenderungsArt
  /** Zeilen-ID im Gitter des Bereichs — Sprungziel für „zur Änderung". */
  zeilenId: string
  /** Kurzbezeichnung des Datensatzes, z. B. „30-30-05-0005 · Nr. 121". */
  titel: string
  /** Was sich geändert hat, feldweise: `Preis: 50,00 → 60,00`. Leer bei neu/gelöscht. */
  felder: string[]
  /** Noch nicht über „Speichern" im Kopf bestätigt. */
  ausstehend?: boolean
}

/** Ein Wert in lesbarer Form; leere Werte werden als „—" gezeigt. */
function alsText(wert: unknown): string {
  if (wert == null || wert === '') return '—'
  if (Array.isArray(wert)) return wert.filter((x) => x !== '').join(' · ') || '—'
  if (typeof wert === 'boolean') return wert ? 'ja' : 'nein'
  return String(wert)
}

/**
 * Feldweiser Vergleich Grundstand ↔ Patch. Nur tatsächlich abweichende Felder werden
 * gemeldet: Die Editoren schreiben den ganzen Datensatz zurück, sodass im Patch auch
 * Felder stehen, die niemand angefasst hat. Die ungefiltert anzuzeigen hieße, den
 * Benutzer suchen zu lassen, was er geändert hat — genau das soll die Liste ersparen.
 */
function feldDiff<T extends object>(basis: T | undefined, patch: Partial<T>): string[] {
  const zeilen: string[] = []
  for (const [feld, neu] of Object.entries(patch)) {
    const alt = basis ? (basis as Record<string, unknown>)[feld] : undefined
    if (alsText(alt) === alsText(neu)) continue
    zeilen.push(`${feld}: ${alsText(alt)} → ${alsText(neu)}`)
  }
  return zeilen
}

/**
 * Alle Abweichungen vom Grundstand, gruppierbar und anspringbar.
 *
 * Die Zahl im Kopf („12 geändert") beantwortet nur, DASS etwas anders ist. Wer eine
 * Mappe verantwortet, muss aber sehen, WAS anders ist — sonst bleibt vor dem Übergeben
 * an die AV nur „alles zurücksetzen" oder blindes Vertrauen. Deshalb liefert diese
 * Funktion je Änderung den Datensatz, die geänderten Felder mit Vorher/Nachher und die
 * Zeilen-ID, über die die Verwaltung direkt dorthin springt.
 */
function baueAenderungen(o: StammdatenOverlay): Aenderung[] {
  const liste: Aenderung[] = []

  const artikelBasis = new Map(basisArtikel.map((a) => [a.artikelnummer, a]))
  const preisBasis = new Map(basisPreise.map((p) => [preisSchluessel(p), p]))
  const mitarbeiterBasis = new Map(basisMitarbeiter.map((m) => [m.personalnr, m]))
  const filialBasis = new Map(basisFilialen.map((f) => [f.filialnr, f]))
  const kategorieBasis = new Map(basisOberflaechenkategorien.map((k) => [k.id, k]))
  const oberflaecheBasis = new Map(basisOberflaechen.map((x) => [oberflaecheSchluessel(x), x]))

  // --- Artikel ---
  for (const [nr, patch] of Object.entries(o.geaenderteArtikel)) {
    const basis = artikelBasis.get(nr)
    const felder = feldDiff(basis, patch)
    if (felder.length === 0) continue
    liste.push({ bereich: 'artikel', art: 'geaendert', zeilenId: nr, titel: `${nr} · ${basis?.bezeichnung ?? ''}`, felder })
  }
  for (const a of o.neueArtikel) {
    liste.push({ bereich: 'artikel', art: 'neu', zeilenId: a.artikelnummer, titel: `${a.artikelnummer} · ${a.bezeichnung}`, felder: [] })
  }
  for (const nr of o.geloeschteArtikel) {
    liste.push({ bereich: 'artikel', art: 'geloescht', zeilenId: nr, titel: `${nr} · ${artikelBasis.get(nr)?.bezeichnung ?? ''}`, felder: [] })
  }

  // --- Preiszeilen ---
  for (const [s, patch] of Object.entries(o.geaendertePreise)) {
    const basis = preisBasis.get(s)
    const felder = feldDiff(basis, patch)
    if (felder.length === 0) continue
    const achsen = (basis?.a ?? []).filter(Boolean).join(' · ') || 'ohne Achsenwerte'
    liste.push({ bereich: 'preise', art: 'geaendert', zeilenId: s, titel: `${basis?.artikel ?? s} · ${achsen}`, felder })
  }
  for (const p of o.neuePreise) {
    const achsen = p.a.filter(Boolean).join(' · ') || 'ohne Achsenwerte'
    liste.push({ bereich: 'preise', art: 'neu', zeilenId: preisSchluessel(p), titel: `${p.artikel} · ${achsen}`, felder: [] })
  }
  for (const s of o.geloeschtePreise) {
    const basis = preisBasis.get(s)
    const achsen = (basis?.a ?? []).filter(Boolean).join(' · ') || 'ohne Achsenwerte'
    liste.push({ bereich: 'preise', art: 'geloescht', zeilenId: s, titel: `${basis?.artikel ?? s} · ${achsen}`, felder: [] })
  }

  // --- Oberflächen: Kategorien und Farben teilen sich ein Gitter ---
  for (const [id, patch] of Object.entries(o.geaenderteKategorien)) {
    const felder = feldDiff(kategorieBasis.get(id), patch)
    if (felder.length === 0) continue
    liste.push({ bereich: 'oberflaechen', art: 'geaendert', zeilenId: `kat:${id}`, titel: `Kategorie ${kategorieBasis.get(id)?.bezeichnung ?? id}`, felder })
  }
  for (const k of o.neueKategorien) {
    liste.push({ bereich: 'oberflaechen', art: 'neu', zeilenId: `kat:${k.id}`, titel: `Kategorie ${k.bezeichnung}`, felder: [] })
  }
  for (const id of o.geloeschteKategorien) {
    liste.push({ bereich: 'oberflaechen', art: 'geloescht', zeilenId: `kat:${id}`, titel: `Kategorie ${kategorieBasis.get(id)?.bezeichnung ?? id}`, felder: [] })
  }
  for (const [s, patch] of Object.entries(o.geaenderteOberflaechen)) {
    const felder = feldDiff(oberflaecheBasis.get(s), patch)
    if (felder.length === 0) continue
    liste.push({ bereich: 'oberflaechen', art: 'geaendert', zeilenId: `obf:${s}`, titel: oberflaecheBasis.get(s)?.bezeichnung ?? s, felder })
  }
  for (const x of o.neueOberflaechen) {
    liste.push({ bereich: 'oberflaechen', art: 'neu', zeilenId: `obf:${oberflaecheSchluessel(x)}`, titel: `${x.bezeichnung} (${x.kategorie})`, felder: [] })
  }
  for (const s of o.geloeschteOberflaechen) {
    liste.push({ bereich: 'oberflaechen', art: 'geloescht', zeilenId: `obf:${s}`, titel: oberflaecheBasis.get(s)?.bezeichnung ?? s, felder: [] })
  }

  // --- Berater & Filialen ---
  for (const [nr, patch] of Object.entries(o.geaenderteMitarbeiter)) {
    const felder = feldDiff(mitarbeiterBasis.get(nr), patch)
    if (felder.length === 0) continue
    liste.push({ bereich: 'berater', art: 'geaendert', zeilenId: nr, titel: `${nr} · ${mitarbeiterBasis.get(nr)?.name ?? ''}`, felder })
  }
  for (const m of o.neueMitarbeiter) {
    liste.push({ bereich: 'berater', art: 'neu', zeilenId: m.personalnr, titel: `${m.personalnr} · ${m.name}`, felder: [] })
  }
  for (const nr of o.geloeschteMitarbeiter) {
    liste.push({ bereich: 'berater', art: 'geloescht', zeilenId: nr, titel: `${nr} · ${mitarbeiterBasis.get(nr)?.name ?? ''}`, felder: [] })
  }
  for (const [nr, patch] of Object.entries(o.geaenderteFilialen)) {
    const felder = feldDiff(filialBasis.get(nr), patch)
    if (felder.length === 0) continue
    liste.push({ bereich: 'filialen', art: 'geaendert', zeilenId: nr, titel: `${nr} · ${filialBasis.get(nr)?.name ?? ''}`, felder })
  }
  for (const f of o.neueFilialen) {
    liste.push({ bereich: 'filialen', art: 'neu', zeilenId: f.filialnr, titel: `${f.filialnr} · ${f.name}`, felder: [] })
  }
  for (const nr of o.geloeschteFilialen) {
    liste.push({ bereich: 'filialen', art: 'geloescht', zeilenId: nr, titel: `${nr} · ${filialBasis.get(nr)?.name ?? ''}`, felder: [] })
  }

  return liste
}
