/**
 * Anzeigenamen der Preisarten — aus Blatt „34 Preislogiken", damit eine Umbenennung in
 * der Mappe überall ankommt. Fehlt ein Code dort, gilt die Vorgabe aus `preisarten.ts`.
 */
import { preislogiken } from '../data/stammdaten.generated.ts'
import { PREISART_CODES, PREISART_KATALOG, istPreisartCode, type PreisartCode } from './preisarten.ts'

const AUS_MAPPE = new Map(preislogiken.map((p) => [p.code as string, p]))

export function preisartTitel(code: string | undefined): string {
  if (!code) return '—'
  return AUS_MAPPE.get(code)?.bezeichnung || (istPreisartCode(code) ? PREISART_KATALOG[code].titel : code)
}

export function preisartKurz(code: string | undefined): string {
  if (!code) return ''
  return AUS_MAPPE.get(code)?.bedeutung || (istPreisartCode(code) ? PREISART_KATALOG[code].kurz : '')
}

/** Die sechs Preisarten in der Reihenfolge der Verwaltung, mit Namen und Kurztext. */
export const PREISART_AUSWAHL: ReadonlyArray<{ code: PreisartCode; titel: string; kurz: string }> = PREISART_CODES.map(
  (code) => ({ code, titel: preisartTitel(code), kurz: preisartKurz(code) }),
)
