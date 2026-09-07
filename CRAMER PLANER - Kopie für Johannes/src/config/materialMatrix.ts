import {
  getOberflaechen,
  getOberflaechenkategorien,
  getStammdatenStand,
} from '../lib/stammdatenStore.ts'
import { oberflaechenAltIds } from '../data/oberflaechenAltIds.ts'
import type { MaterialGroup, MaterialOption, Oberflaeche } from '../types/index.ts'

/** Sonderfall-IDs für Material-Auswahlen (kein echter Matrix-Eintrag). */
export const MATERIAL_CUSTOM_ID = 'anders'
export const MATERIAL_NONE_ID = 'keine'

/**
 * ZENTRALE MATERIAL-, FARB- & PREISGRUPPENMATRIX ("das Gehirn").
 *
 * Diese Datei enthält seit dem Oberflächen-Modul KEINE Farben mehr, sondern setzt die
 * Stammdaten in die Form um, die Korpus- und Front-Dropdowns erwarten:
 *
 *     data/farbmatrix.ts (Grundstand)
 *              │
 *              +── Overlay aus dem Reiter „Oberflächen"      → lib/stammdatenStore.ts
 *              ▼
 *     Oberflaechenkategorie[] + Oberflaeche[]
 *              │  (diese Datei)
 *              ▼
 *     MaterialGroup[] mit verschachtelten MaterialOption[]
 *              │
 *              ▼
 *     MaterialSelect · Korpus-Bereiche · Front-Stil-Linien · Preisgruppen-Auflösung
 *
 * Damit gilt die Grundregel: JEDE Material- und Farbauswahl im Konfigurator kommt aus den
 * Stammdaten. Wer in der Verwaltung eine Farbe anlegt, sieht sie ohne Neuladen im Dropdown —
 * React hängt über `useStammdaten()` am selben Store.
 *
 * Was hier NICHT steht: welche Kategorien eine Stil-Linie oder ein Korpus-Bereich zulässt.
 * Das ist eine Regel, keine Farbe, und bleibt in `config/frontCatalog.ts` bzw.
 * `config/korpus.ts`.
 */

/** Gesperrte Datensätze verschwinden aus den Dropdowns, bleiben aber in der Verwaltung. */
const istAktiv = (e: { status: string }) => e.status === 'aktiv'

function alsOption(o: Oberflaeche): MaterialOption {
  return {
    id: o.id,
    label: o.bezeichnung,
    // Leeres Feld ⇒ die Preisgruppe der Kategorie greift (siehe `resolvePriceGroup`).
    ...(o.preisgruppe ? { priceGroup: o.preisgruppe } : {}),
    ...(o.freitext ? { requiresFreeText: true } : {}),
    ...(o.freitext && o.freitextLabel ? { freeTextLabel: o.freitextLabel } : {}),
  }
}

/**
 * Aufbereitete Sicht, einmal je Stammdaten-Version gerechnet.
 *
 * Die Umformung läuft bei jedem Tastendruck in einem Dropdown durch — `getMaterialGroup`
 * wird pro Render mehrfach aufgerufen. Der Zwischenspeicher hängt an `stand.version`,
 * die der Store bei jeder Änderung hochzählt; eine Bearbeitung in der Verwaltung baut
 * ihn deshalb sofort neu auf, ein bloßes Rendern nicht.
 */
let cache: { version: number; gruppen: MaterialGroup[] } | null = null

function baueGruppen(): MaterialGroup[] {
  const oberflaechen = getOberflaechen().filter(istAktiv)
  return getOberflaechenkategorien()
    .filter(istAktiv)
    .map((k) => ({
      id: k.id,
      label: k.bezeichnung,
      ...(k.preisgruppe ? { priceGroup: k.preisgruppe } : {}),
      options: oberflaechen.filter((o) => o.kategorie === k.id).map(alsOption),
    }))
}

/** Alle aktiven Materialgruppen mit ihren Farben — aus den Stammdaten. */
export function getMaterialGroups(): MaterialGroup[] {
  const version = getStammdatenStand().version
  if (!cache || cache.version !== version) cache = { version, gruppen: baueGruppen() }
  return cache.gruppen
}

/** Materialgruppe per ID. */
export function getMaterialGroup(id: string | undefined): MaterialGroup | undefined {
  return id ? getMaterialGroups().find((group) => group.id === id) : undefined
}

/**
 * Konkrete Option innerhalb einer Materialgruppe.
 *
 * Greift der Schlüssel nicht, wird er über die Alt-ID-Tabelle nachgeschlagen: Entwürfe
 * von vor der ID-Umstellung (09/2026) tragen noch `schwarz` statt `schwarz-ral-9005`.
 * Ohne diesen zweiten Versuch verlöre ein altes Angebot beim Öffnen seine Ausführung —
 * sichtbar in Zusammenfassung und AV-PDF, spürbar in der Preisgruppe.
 */
export function getMaterialOption(
  groupId: string | undefined,
  optionId: string | undefined,
): MaterialOption | undefined {
  const group = getMaterialGroup(groupId)
  if (!group || !optionId) return undefined
  const treffer = group.options.find((option) => option.id === optionId)
  if (treffer) return treffer
  const alt = oberflaechenAltIds.find((a) => a.kategorie === group.id && a.altId === optionId)
  return alt ? group.options.find((option) => option.id === alt.neuId) : undefined
}

/**
 * Die HEUTE gültige Options-ID zu einem gespeicherten Schlüssel.
 *
 * Nötig überall dort, wo ein `<select>` seinen Wert gegen die Options-IDs bindet: Ein
 * Entwurf von vor der ID-Umstellung trägt `schwarzgrau`, die Liste kennt nur noch
 * `schwarzgrau-ral-7021`. Ohne Auflösung findet das Dropdown seinen Wert nicht und zeigt
 * stillschweigend den ersten Eintrag — der Berater sähe eine andere Farbe, als im Angebot
 * steht, und der nächste Klick würde sie festschreiben.
 */
export function aktuelleOptionId(
  groupId: string | undefined,
  optionId: string | undefined,
): string | undefined {
  return getMaterialOption(groupId, optionId)?.id
}

/**
 * Kategorien mit dem Stammdaten-Flag `standardauswahl` — die „normale" Materialauswahl.
 * Sonderwerkstoffe (nur über „anders") und Akustikpaneele stehen dort auf `false`.
 */
export function getStandardMaterialGroupIds(): string[] {
  return getOberflaechenkategorien()
    .filter((k) => istAktiv(k) && k.standardauswahl)
    .map((k) => k.id)
}

/**
 * Platzhalter in einer `materialGroupIds`-Liste: „alle Kategorien der Standardauswahl".
 *
 * Ohne ihn müsste jede Stelle, die heute Decoboard/Mattlack/Furnier/Glas/Xtreme Plus
 * aufzählt, bei einer NEUEN Kategorie aus der Verwaltung nachgezogen werden — und genau
 * das soll das Oberflächen-Modul überflüssig machen. Stil-Linien und Korpus-Bereiche mit
 * ENGERER Regel (nur Glas, kein Glas bei Curve …) zählen weiter auf: das ist eine
 * Konstruktionsvorgabe, keine Farbliste.
 */
export const ALLE_MATERIALGRUPPEN = '*'

/**
 * Löst den Platzhalter gegen die Stammdaten auf. Zusätzlich genannte Kategorien bleiben
 * erhalten (z. B. `[ALLE_MATERIALGRUPPEN, 'akustikpaneele']`), Doppelte fallen weg.
 */
export function aufloeseMaterialGroupIds(ids: readonly string[]): string[] {
  if (!ids.includes(ALLE_MATERIALGRUPPEN)) return [...ids]
  const rest = ids.filter((id) => id !== ALLE_MATERIALGRUPPEN)
  return [...new Set([...getStandardMaterialGroupIds(), ...rest])]
}

/**
 * ALLE „Rauchglas"-Optionen der Glas-Gruppe – dynamisch aus den Stammdaten ermittelt
 * (Treffer per ID ODER Bezeichnung), damit jede – auch künftig angelegte – Rauchglas-Variante
 * automatisch erfasst wird. Werden z. B. für die Abdeckplatte vollständig ausgeschlossen.
 */
export function getRauchglasOptionIds(): string[] {
  return (getMaterialGroup('glas')?.options ?? [])
    .filter((option) => /rauchglas/i.test(option.id) || /rauchglas/i.test(option.label))
    .map((option) => option.id)
}
