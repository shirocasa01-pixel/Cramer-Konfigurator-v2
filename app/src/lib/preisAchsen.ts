/**
 * ACHSENWERTE DER PREISZEILEN — lesen, vergleichen, einordnen.
 *
 * Eine Preiszelle ist über ihre Achsenwerte A1–A5 adressiert; was eine Achse bedeutet UND
 * wie ihr Wert zu lesen ist, steht im Achsen-Katalog (`achsen` in den Stammdaten).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WARUM DIE WERTE SEIT DER REFORM ANDERS AUSSEHEN
 *
 * Früher stand in der Breitenspalte, was die gedruckte Preisliste dort führte — und das
 * waren sieben verschiedene Dinge: `50er`, `bis 60cm`, `T50-51`, `18R`, `Seite (2,0cm)`,
 * `bis 9Raster (120cm)`, `140cm`. Drei davon waren gar keine Breite: `18R` ist eine
 * Rasterhöhe, `bis 9Raster (120cm)` eine Korpushöhenklasse, `T50-51` beides zugleich.
 * Und dieselbe Zahl bedeutete je nach Artikel etwas anderes — 18 Raster sind beim
 * Refugium-Korpus 235,0 cm und bei der Drehtür 230 cm.
 *
 * Seit der Reform trägt jede Maßachse den Zentimeter-Schwellenwert selbst:
 *
 *     „60 cm | 60er"      Schwellenwert 60 cm, in der Preisliste „60er" genannt
 *     „235 cm | 18R"      Schwellenwert 235 cm, in der Preisliste „18 Raster"
 *     „60 cm"             Tiefe braucht kein Etikett
 *
 * Damit rechnet der Lookup in Zentimetern — der einzigen Größe, die über alle Artikel
 * dasselbe bedeutet — und die gedruckte Bezeichnung bleibt trotzdem am Wert hängen.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Die alten Schreibweisen werden weiterhin gelesen: Ein Artikel, den jemand von Hand in
 * der alten Form pflegt, verliert dadurch nicht seinen Preis.
 */

/** Ein zerlegter Achsenwert einer Maß- oder Stufenachse. */
export interface StufenWert {
  /** Originaltext der Zelle. */
  raw: string
  /** Zentimeter-Schwellenwert; `null` = nicht einzuordnen. */
  cm: number | null
  /** Gedruckte Bezeichnung der Stufe („60er", „18R", „Seite"). */
  etikett: string
}

/**
 * TOLERANZ FÜR AUF GANZE ZENTIMETER GERUNDETE NENNMASSE.
 *
 * Rasterhöhen werden überall als gerundete Zentimeterwerte angezeigt — „21 Raster
 * (~274 cm)" steht so im Auswahlfeld, rechnerisch sind es 273,4 cm. Ohne Toleranz
 * fiele genau dieses Nennmaß auf die nächste Stufe, für die es keine Preiszeile gibt:
 * Das Möbel verlöre seinen Preis, obwohl der Berater die Standardhöhe gewählt hat.
 *
 * Ein Zentimeter deckt jede solche Rundung ab und kann keine echte Stufe überspringen:
 * Der kleinste Abstand zwischen zwei bepreisten Stufen im gesamten Stamm liegt bei
 * 6,4 cm (ein halbes Raster).
 */
export const STUFEN_TOLERANZ_CM = 1

/**
 * Zahl aus einem Zellwert. Akzeptiert Punkt und Komma als Dezimaltrenner —
 * die Mappe führt beides („1.5" in den Rasterwerten, „49,5 cm" in den Stufen).
 */
export function parseZahl(raw: unknown): number | null {
  if (raw == null) return null
  const text = String(raw).trim()
  if (!text) return null
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Zerlegt einen Listenwert. Auf der Achse PG ist das Komma eine AUFZÄHLUNG, kein
 * Dezimaltrenner: `„PG3,PG4"` meint beide Preisgruppen.
 */
export function parseListe(raw: unknown): string[] {
  return String(raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Zentimeter in deutscher Schreibweise, ohne überflüssige Nullen. */
export function cmText(cm: number): string {
  return String(Math.round(cm * 10) / 10).replace('.', ',')
}

/** Baut den kanonischen Achsenwert aus Schwellenwert und Etikett. */
export function baueStufenwert(cm: number | null, etikett: string): string {
  const rechts = etikett.trim()
  if (cm == null) return rechts
  return rechts ? `${cmText(cm)} cm | ${rechts}` : `${cmText(cm)} cm`
}

/**
 * Liest einen Achsenwert einer Maß- oder Stufenachse.
 *
 * Erst die kanonische Form der Reform, dann — als Rückfall — die gedruckten
 * Schreibweisen der Preisliste. Der Rückfall ist kein Altlastenträger, sondern die
 * Eingabehilfe: Wer „50er" tippt, bekommt 50 cm, ohne die Schreibweise zu kennen.
 */
export function parseStufe(raw: unknown): StufenWert {
  const text = String(raw ?? '').trim()
  if (!text) return { raw: text, cm: null, etikett: '' }

  // Kanonisch: „60 cm | 60er" · „60 cm"
  if (text.includes('|') || /^[\d.,]+\s*cm$/i.test(text)) {
    const [links, ...rest] = text.split('|')
    return { raw: text, cm: parseZahl(links.replace(/cm/i, '')), etikett: rest.join('|').trim() }
  }

  // T50-51 · T60-230 — Katalog-Code der Drehtür: Nennbreite, dahinter die Türhöhe.
  const code = /^T(\d+)-(\d+)$/i.exec(text)
  if (code) return { raw: text, cm: Number(code[1]), etikett: `${code[1]}er` }

  // 18R · 1,5R — Rasterstufe ohne Zentimeterangabe. Ohne Artikelbezug ist daraus KEIN
  // Maß abzuleiten (Korpus und Front rechnen verschieden), deshalb bewusst ohne cm.
  const raster = /^([\d.,]+)\s*R$/i.exec(text)
  if (raster) return { raw: text, cm: null, etikett: `${raster[1].replace('.', ',')}R` }

  // bis 9Raster (120cm) — Höhenklasse mit gedruckter Obergrenze.
  const rasterKlasse = /^bis\s*([\d.,]+)\s*Raster\s*\(([\d.,]+)\s*cm\)$/i.exec(text)
  if (rasterKlasse) {
    return { raw: text, cm: parseZahl(rasterKlasse[2]), etikett: `${rasterKlasse[1].replace('.', ',')}R` }
  }

  // Seite · Seite (2,0cm) — der Preis gilt je Bauteilseite.
  if (/^Seite\b/i.test(text)) {
    return { raw: text, cm: parseZahl(/\(([\d.,]+)\s*cm\)/i.exec(text)?.[1]) ?? 2, etikett: 'Seite' }
  }

  // bis 60cm · bis 75cm Breite · -140cm — die gedruckte Obergrenze IST der Schwellenwert.
  const obergrenze = /^(?:bis\s*|-)\s*([\d.,]+)\s*cm\b/i.exec(text)
  if (obergrenze) return { raw: text, cm: parseZahl(obergrenze[1]), etikett: '' }

  // 50er · 60er (59,5cm) — Schwellenwert ist das NENNMASS, nicht das Fertigungsmaß.
  const nominal = /^(\d+)(?:\/(\d+))?\s*er\b/i.exec(text)
  if (nominal) {
    return {
      raw: text,
      cm: Number(nominal[1]),
      etikett: nominal[2] ? `${nominal[1]}/${nominal[2]}er` : `${nominal[1]}er`,
    }
  }

  // Nacktes Maß („140", „25,5")
  const zahl = parseZahl(text)
  if (zahl != null) return { raw: text, cm: zahl, etikett: '' }

  return { raw: text, cm: null, etikett: text }
}

/**
 * Wählt aus einer Liste von Stufenwerten den **kleinsten, der das verlangte Maß noch
 * abdeckt** — die Preislisten-Regel „Preis des nächstgrößeren Maßes".
 *
 * Liegt die Anforderung über dem größten bepreisten Wert, kommt bewusst `null` zurück:
 * Das ist ein Sondermaß für die Arbeitsvorbereitung, kein Fall für einen Schätzwert.
 */
export function waehleStufe(
  werte: readonly StufenWert[],
  gesuchtCm: number,
): { treffer: StufenWert | null; aufgerundet: boolean } {
  const sortierbar = werte
    .filter((w): w is StufenWert & { cm: number } => w.cm != null)
    .sort((a, b) => a.cm - b.cm)
  if (sortierbar.length === 0) return { treffer: null, aufgerundet: false }

  const treffer = sortierbar.find((w) => w.cm >= gesuchtCm - STUFEN_TOLERANZ_CM) ?? null
  return { treffer, aufgerundet: treffer != null && treffer.cm > gesuchtCm + STUFEN_TOLERANZ_CM }
}

/**
 * Vergleicht einen Merkmals-Achsenwert (PG, LINIE+PG, AUSFÜHRUNG) mit einer Anforderung.
 * `listenAchse` schaltet die Aufzählungs-Semantik des Kommas frei (PG).
 */
export function achsenwertPasst(
  zellwert: string,
  gesucht: string,
  opts: { listenAchse?: boolean } = {},
): boolean {
  const soll = gesucht.trim()
  if (!soll) return true // nicht angefragt ⇒ Achse ist kein Filter
  const kandidaten = opts.listenAchse ? parseListe(zellwert) : [String(zellwert ?? '').trim()]
  return kandidaten.some((k) => k.toLowerCase() === soll.toLowerCase())
}

// ---------------------------------------------------------------------------
// PREISART — worauf sich der Betrag bezieht
// ---------------------------------------------------------------------------

/**
 * Bezugsgrößen der Achse PREISART.
 *
 * Sie ersetzen die früheren Preislogiken PRO_LFM, PRO_QM und GRUND_PLUS_QM: Statt einer
 * eigenen Rechenart je Artikel steht neben dem Betrag, worauf er sich bezieht. Ein
 * Artikel mit Grundpreis UND Quadratmeterpreis führt damit einfach zwei Preiszeilen —
 * eine „Fixpreis", eine „€/m²" — und die Position zeigt beide als Teilpositionen.
 */
export const PREISARTEN = {
  FIX: 'Fixpreis',
  CM: '€/cm',
  M: '€/m',
  QM: '€/m²',
} as const

export type Preisart = (typeof PREISARTEN)[keyof typeof PREISARTEN]

/** Liest einen PREISART-Zellwert; unbekannt oder leer ⇒ Fixpreis. */
export function parsePreisart(raw: unknown): Preisart {
  const text = String(raw ?? '').trim().toLowerCase().replace('eur', '€')
  switch (text) {
    case '€/cm':
    case '€/cm²':
      return PREISARTEN.CM
    case '€/m':
    case '€/lfm':
    case '€/lfd.m':
      return PREISARTEN.M
    case '€/m²':
    case '€/qm':
      return PREISARTEN.QM
    default:
      return PREISARTEN.FIX
  }
}

/** Anzeigeeinheit eines Betrags dieser Preisart („€", „€/m²"). */
export function preisartEinheit(art: Preisart): string {
  return art === PREISARTEN.FIX ? '€' : art
}
