import type { Draft } from '../types/index.ts'
import { formatMassZahl } from './format.ts'

/**
 * Maß-Darstellung.
 *
 * Punkt 7.16 — Dietmar: „Grundsätzlich bevorzuge ich immer ca. Maße."
 *
 * Damit ist die frühere Fallunterscheidung entfallen: Es gibt keine Fixmaß-Häkchen
 * mehr (Punkt 4.7), und jedes Maß wird als „ca."-Maß ausgewiesen — in der Oberfläche
 * und im AV-PDF gleichermaßen. Was mm-genau einzuhalten ist, schreibt der Berater
 * in das Freitextfeld „Fixmaße / Sondermaße" (Punkt 4.11).
 *
 * Die Funktionen bleiben als eine zentrale Stelle bestehen: Sollte später doch wieder
 * zwischen ca.- und Fixmaß unterschieden werden, ändert sich genau diese Datei.
 */

/** Präfix vor jedem Maß. */
export function caPrefix(): string {
  return 'ca. '
}

/**
 * Maßzahl in deutscher Schreibweise.
 *
 * Die Werte im Entwurf sind MASCHINENWERTE (`"298.1"`, weil sie mit `Number()`
 * weiterverarbeitet werden). Erst hier werden sie zur Anzeige umgesetzt — sonst
 * stünde im Angebot „298.1 cm" statt „298,1 cm". Was sich nicht als Zahl lesen
 * lässt (Freitext des Beraters), bleibt unverändert stehen.
 */
function massZahl(raw: string): string {
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? formatMassZahl(n) : raw
}

/**
 * Formatiert einen einzelnen Maßwert mit Präfix und Einheit.
 * Leerer Wert → „—" (ohne Präfix).
 */
export function formatMass(value: string | number | undefined, unit = 'cm'): string {
  const raw = value == null ? '' : String(value).trim()
  if (!raw) return '—'
  return `${caPrefix()}${massZahl(raw)} ${unit}`
}

/** Formatiert die Gesamtmaße als eine Zeile, z. B. „ca. 300 × 220 × 60 cm". */
export function formatDimensions(dimensions: Draft['dimensions']): string {
  if (!dimensions) return '—'
  const w = dimensions.widthCm?.trim()
  const h = dimensions.heightCm?.trim()
  const d = dimensions.depthCm?.trim()
  if (!w && !h && !d) return '—'
  const zeige = (v: string | undefined) => (v ? massZahl(v) : '?')
  return `${caPrefix()}${zeige(w)} × ${zeige(h)} × ${zeige(d)} cm`
}
