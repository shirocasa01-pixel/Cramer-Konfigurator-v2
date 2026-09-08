/**
 * ACHSENWERTE DER PREISZEILEN — lesen, vergleichen, einordnen.
 *
 * Eine Preiszelle ist über ihre Achsenwerte A1–A5 adressiert; was eine Achse bedeutet,
 * steht im Artikel (`Artikel.achsen`). Die Werte selbst stammen aus einer gedruckten
 * Preisliste und sind entsprechend heterogen — allein die Breite kommt in sieben Formen:
 *
 *   50er · 60er (59,5cm) · 50/60er (49,5/59,5cm)   Nennmaß, teils mit Fertigungsmaß
 *   bis 60cm · -140cm · bis 75cm Breite            Obergrenze
 *   T50-51 · T60-230                               Katalog-Code (Nennbreite + Rasterschlüssel)
 *   18R · 21R                                      Raster in der Breitenspalte
 *   Seite (2,0cm)                                  Bauteilseite
 *   bis 9Raster (120cm)                            Höhenklasse (Beleuchtung)
 *   140cm                                          nacktes Maß
 *
 * Dieses Modul führt sie auf einen gemeinsamen Sortierwert in cm zurück. Darauf setzt die
 * Preislisten-Regel „Preis des nächstgrößeren Maßes" auf: gesucht wird der kleinste
 * Achsenwert, der die Anforderung noch abdeckt.
 *
 * Geprüft gegen die 1184 bereits normalisierten Breiten der Vorgänger-Extraktion
 * (`npm run data:test`) — dieselbe Einordnung, Wert für Wert.
 */

/** Wie ein Breitenwert gelesen wurde. */
export type BreitenArt = 'nominal' | 'obergrenze' | 'code' | 'raster' | 'seite' | 'mass' | 'unbekannt'

export interface BreitenWert {
  /** Originaltext aus der Zelle. */
  raw: string
  art: BreitenArt
  /** Nennmaß („50er" → 50). */
  nominalCm?: number
  /** Zweites Nennmaß bei kombinierten Angaben („50/60er"). */
  nominalCm2?: number
  /** Fertigungsmaß in Klammern („50er (49,5cm)" → 49,5). */
  actualCm?: number
  /** Obergrenze („bis 60cm", „-140cm"). */
  obergrenzeCm?: number
  /** Rasteranzahl („18R", „bis 9Raster"). */
  rasterAnzahl?: number
  /** Rasterschlüssel im Katalog-Code („T50-51" → 51). */
  rasterCode?: number
  /** Kanonischer Vergleichswert für die Nächstgrößer-Regel; `null` = nicht einzuordnen. */
  sortCm: number | null
}

/**
 * Zahl aus einem Zellwert. Akzeptiert Punkt und Komma als Dezimaltrenner —
 * die Mappe führt beides („1.5" in 110 Zeilen, „49,5cm" in den Klammerzusätzen).
 */
export function parseZahl(raw: unknown): number | null {
  if (raw == null) return null
  const text = String(raw).trim()
  if (!text) return null
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Zerlegt einen Listenwert. Die Mappe nutzt das Komma als AUFZÄHLUNG, nicht als
 * Dezimaltrenner: `TIEFE "25,30"` meint die Tiefen 25 und 30, `PG "PG3,PG4"` beide
 * Preisgruppen. Nur dort anwenden, wo die Achse tatsächlich Listen führt.
 */
export function parseListe(raw: unknown): string[] {
  return String(raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Liest einen Breitenwert in seine Bestandteile. */
export function parseBreite(raw: unknown): BreitenWert {
  const text = String(raw ?? '').trim()
  const leer: BreitenWert = { raw: text, art: 'unbekannt', sortCm: null }
  if (!text) return leer

  // T50-51 · T60-230 — Katalog-Code: Nennbreite + Rasterschlüssel
  const code = /^T(\d+)-(\d+)$/i.exec(text)
  if (code) {
    const nominalCm = Number(code[1])
    return { raw: text, art: 'code', nominalCm, rasterCode: Number(code[2]), sortCm: nominalCm }
  }

  // 18R · 21R — Rasterstufe steht in der Breitenspalte (Mittelseite, Außenset)
  const raster = /^(\d+)\s*R$/i.exec(text)
  if (raster) {
    const rasterAnzahl = Number(raster[1])
    return { raw: text, art: 'raster', rasterAnzahl, sortCm: rasterAnzahl }
  }

  // Seite · Seite (2,0cm)
  if (/^Seite\b/i.test(text)) {
    const actualCm = parseZahl(/\(([\d.,]+)\s*cm\)/i.exec(text)?.[1]) ?? undefined
    return { raw: text, art: 'seite', actualCm, sortCm: actualCm ?? 2 }
  }

  // bis 9Raster (120cm) — Höhenklasse der Kleiderschrankbeleuchtung
  const rasterKlasse = /^bis\s*(\d+)\s*Raster\s*\(([\d.,]+)\s*cm\)$/i.exec(text)
  if (rasterKlasse) {
    const obergrenzeCm = parseZahl(rasterKlasse[2]) ?? undefined
    return {
      raw: text,
      art: 'obergrenze',
      rasterAnzahl: Number(rasterKlasse[1]),
      obergrenzeCm,
      sortCm: obergrenzeCm ?? null,
    }
  }

  // bis 60cm · bis 75cm Breite · -140cm
  const obergrenze = /^(?:bis\s*|-)\s*([\d.,]+)\s*cm\b/i.exec(text)
  if (obergrenze) {
    const obergrenzeCm = parseZahl(obergrenze[1]) ?? undefined
    return { raw: text, art: 'obergrenze', obergrenzeCm, sortCm: obergrenzeCm ?? null }
  }

  // 50er · 60er (59,5cm) · 50/60er (49,5/59,5cm)
  const nominal = /^(\d+)(?:\/(\d+))?\s*er\b/i.exec(text)
  if (nominal) {
    const nominalCm = Number(nominal[1])
    const klammer = /\(([^)]*)\)/.exec(text)?.[1]
    const actualCm = klammer ? parseZahl(klammer.split('/')[0].replace(/cm/i, '')) ?? undefined : undefined
    return {
      raw: text,
      art: 'nominal',
      nominalCm,
      nominalCm2: nominal[2] ? Number(nominal[2]) : undefined,
      actualCm,
      sortCm: nominalCm,
    }
  }

  // 140cm — nacktes Maß
  const mass = /^([\d.,]+)\s*cm$/i.exec(text)
  if (mass) {
    const nominalCm = parseZahl(mass[1]) ?? undefined
    return { raw: text, art: 'mass', nominalCm, sortCm: nominalCm ?? null }
  }

  return leer
}

/**
 * Wählt aus einer Liste von Breitenwerten den **kleinsten, der die verlangte Breite noch
 * abdeckt** — die Preislisten-Regel „Preis des nächstgrößeren Maßes".
 *
 * Liegt die Anforderung über dem größten bepreisten Wert, kommt bewusst `null` zurück:
 * das ist ein Sondermaß für die Arbeitsvorbereitung, kein Fall für einen Schätzwert.
 */
export function waehleBreite(
  werte: readonly BreitenWert[],
  gesuchtCm: number,
): { treffer: BreitenWert | null; aufgerundet: boolean } {
  const sortierbar = werte
    .filter((w): w is BreitenWert & { sortCm: number } => w.sortCm != null)
    .sort((a, b) => a.sortCm - b.sortCm)
  if (sortierbar.length === 0) return { treffer: null, aufgerundet: false }

  const treffer = sortierbar.find((w) => w.sortCm >= gesuchtCm - 0.001) ?? null
  return { treffer, aufgerundet: treffer != null && treffer.sortCm > gesuchtCm + 0.001 }
}

/**
 * Vergleicht einen Achsenwert der Preiszeile mit einer Anforderung.
 *
 * `listenAchse` schaltet die Aufzählungs-Semantik des Kommas frei (TIEFE, PG);
 * `numerisch` vergleicht als Zahl, damit „1.5", „1,5" und „1.50" dasselbe treffen.
 */
export function achsenwertPasst(
  zellwert: string,
  gesucht: string,
  opts: { listenAchse?: boolean; numerisch?: boolean } = {},
): boolean {
  const soll = gesucht.trim()
  if (!soll) return true // nicht angefragt ⇒ Achse ist kein Filter
  const kandidaten = opts.listenAchse ? parseListe(zellwert) : [String(zellwert ?? '').trim()]

  if (opts.numerisch) {
    const sollZahl = parseZahl(soll)
    if (sollZahl == null) return false
    return kandidaten.some((k) => {
      const z = parseZahl(k)
      return z != null && Math.abs(z - sollZahl) < 0.001
    })
  }
  return kandidaten.some((k) => k.toLowerCase() === soll.toLowerCase())
}
