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

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

export interface Arbeitsstand {
  artikel: Artikel[]
  preise: Preiszeile[]
  mitarbeiter: Mitarbeiter[]
  filialen: Filiale[]
  /** Zählt jede Änderung hoch — Verbraucher bauen daran ihre Indizes neu auf. */
  version: number
}

let overlay: StammdatenOverlay = ladeOverlay()
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
  return {
    artikel: mische(basisArtikel, (a) => a.artikelnummer, ov.geaenderteArtikel, ov.neueArtikel, ov.geloeschteArtikel),
    preise: mische(basisPreise, preisSchluessel, ov.geaendertePreise, ov.neuePreise, ov.geloeschtePreise),
    mitarbeiter: mische(basisMitarbeiter, (m) => m.personalnr, ov.geaenderteMitarbeiter, ov.neueMitarbeiter, ov.geloeschteMitarbeiter),
    filialen: mische(basisFilialen, (f) => f.filialnr, ov.geaenderteFilialen, ov.neueFilialen, ov.geloeschteFilialen),
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

/** Für `useSyncExternalStore` und für Indizes, die sich neu aufbauen müssen. */
export function subscribe(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

/** Anzahl der Abweichungen vom generierten Grundstand — für „x Änderungen". */
export function zaehleAenderungen(): number {
  const o = overlay
  return (
    Object.keys(o.geaenderteArtikel).length + o.neueArtikel.length + o.geloeschteArtikel.length +
    Object.keys(o.geaendertePreise).length + o.neuePreise.length + o.geloeschtePreise.length +
    Object.keys(o.geaenderteMitarbeiter).length + o.neueMitarbeiter.length + o.geloeschteMitarbeiter.length +
    Object.keys(o.geaenderteFilialen).length + o.neueFilialen.length + o.geloeschteFilialen.length
  )
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
}): { uebernommen: number; bereiche: string[] } {
  let uebernommen = 0
  const bereiche: string[] = []

  anwenden((ov) => {
    if (daten.artikel) {
      ov.geaenderteArtikel = {}
      ov.neueArtikel = []
      ov.geloeschteArtikel = []
      const basis = new Map(basisArtikel.map((a) => [a.artikelnummer, a]))
      for (const a of daten.artikel) {
        const alt = basis.get(a.artikelnummer)
        if (!alt) ov.neueArtikel.push(a)
        else if (JSON.stringify(alt) !== JSON.stringify(a)) ov.geaenderteArtikel[a.artikelnummer] = a
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
        if (!alt) ov.neuePreise.push(p)
        else if (JSON.stringify(alt) !== JSON.stringify(p)) ov.geaendertePreise[s] = p
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
        if (!alt) ov.neueMitarbeiter.push(m)
        else if (JSON.stringify(alt) !== JSON.stringify(m)) ov.geaenderteMitarbeiter[m.personalnr] = m
      }
      uebernommen += daten.mitarbeiter.length
      bereiche.push(`${daten.mitarbeiter.length} Mitarbeiter`)
    }

    if (daten.filialen) {
      ov.geaenderteFilialen = {}
      ov.neueFilialen = []
      ov.geloeschteFilialen = []
      const basis = new Map(basisFilialen.map((f) => [f.filialnr, f]))
      for (const f of daten.filialen) {
        const alt = basis.get(f.filialnr)
        if (!alt) ov.neueFilialen.push(f)
        else if (JSON.stringify(alt) !== JSON.stringify(f)) ov.geaenderteFilialen[f.filialnr] = f
      }
      uebernommen += daten.filialen.length
      bereiche.push(`${daten.filialen.length} Filialen`)
    }
  })

  return { uebernommen, bereiche }
}

/** Verwirft alle Änderungen und stellt den generierten Grundstand her. */
export function setzeAllesZurueck(): void {
  anwenden((ov) => Object.assign(ov, leeresOverlay()))
}

/** Das aktuelle Overlay — für Export und Diagnose. */
export function getOverlay(): StammdatenOverlay {
  return overlay
}
