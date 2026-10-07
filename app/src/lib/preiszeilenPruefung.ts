/**
 * PREISZEILEN EINES ARTIKELS VOR DEM SPEICHERN PRÜFEN.
 *
 * Zwei Preiszeilen mit denselben Achsenwerten machen den Lookup mehrdeutig: Die
 * Kalkulation könnte nicht entscheiden, welcher Preis gilt. Der Artikeldialog prüft das
 * deshalb, bevor er irgendetwas übernimmt — und zeigt es schon während der Eingabe an.
 *
 * Verglichen werden nur die Spalten, die der Artikel als Achsen führt: Ein Festpreis ohne
 * Achsen hat damit genau eine gültige Preiszeile.
 *
 * Bestehende Mehrdeutigkeiten aus der Mappe (z. B. die Tavolo-Massivplatten) blockieren
 * das Speichern nicht — gemeldet wird nur, woran eine neue oder geänderte Zeile beteiligt
 * ist. Sonst ließe sich ein solcher Artikel gar nicht mehr bearbeiten.
 */

export interface ZeileZurPruefung {
  a: readonly string[]
  /** true für neu angelegte oder in ihren Achsenwerten geänderte Zeilen. */
  neuOderGeaendert: boolean
}

export interface DoppelteZeilen {
  /** Zeilennummern im Dialog, ab 1. */
  nummern: number[]
  /** Die gemeinsamen Achsenwerte, lesbar. */
  werte: string
}

const schluesselVon = (a: readonly string[], achsenAnzahl: number) =>
  a.slice(0, achsenAnzahl).map((w) => (w ?? '').trim().toLowerCase()).join('|')

export function doppelteAchsenwerte(zeilen: readonly ZeileZurPruefung[], achsenAnzahl: number): DoppelteZeilen[] {
  const gruppen = new Map<string, number[]>()
  zeilen.forEach((z, i) => {
    const k = schluesselVon(z.a, achsenAnzahl)
    gruppen.set(k, [...(gruppen.get(k) ?? []), i])
  })
  return [...gruppen.values()]
    .filter((idx) => idx.length > 1 && idx.some((i) => zeilen[i].neuOderGeaendert))
    .map((idx) => ({
      nummern: idx.map((i) => i + 1),
      werte:
        zeilen[idx[0]].a
          .slice(0, achsenAnzahl)
          .map((w) => w.trim())
          .filter(Boolean)
          .join(' · ') || 'ohne Achsenwerte',
    }))
}

function aufzaehlung(n: number[]): string {
  return n.length <= 1 ? String(n[0] ?? '') : `${n.slice(0, -1).join(', ')} und ${n[n.length - 1]}`
}

/** Die Meldung für den Dialog — sagt, was los ist und was zu tun ist. */
export function doppelteZeilenMeldung(doppelt: readonly DoppelteZeilen[], achsenAnzahl: number): string | null {
  if (doppelt.length === 0) return null
  if (achsenAnzahl === 0) {
    return (
      'Ohne Achsen trägt ein Artikel genau eine Preiszeile — mehrere Zeilen wären nicht zu unterscheiden. ' +
      'Für mehrere Preise oben unter „Achsen dieses Artikels" eine Achse wählen (z. B. Breite) und die Zeilen ' +
      'darin unterscheiden, sonst die überzählige Zeile entfernen.'
    )
  }
  return (
    doppelt.map((d) => `Zeilen ${aufzaehlung(d.nummern)} haben dieselben Achsenwerte (${d.werte}).`).join(' ') +
    ' Die Kalkulation könnte nicht entscheiden, welcher Preis gilt — bitte die Achsenwerte unterscheiden oder eine Zeile entfernen.'
  )
}
