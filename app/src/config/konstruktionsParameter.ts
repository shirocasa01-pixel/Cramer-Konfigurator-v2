/**
 * PARAMETER DER 2D-KONSTRUKTIONSANSICHT (Refugium).
 *
 * Alles, was die Skizze an Maßen und Platzierungsregeln braucht, steht HIER — nicht verstreut
 * in der Zeichnung. Jeder Wert nennt seine Quelle. Was Cramer noch nicht festgelegt hat, ist
 * als `annahme: true` markiert; die Skizze rechnet damit, bis eine Vorgabe kommt (Rückfragen
 * in `UEBERARBEITUNG-10.md`). Werte in Millimetern.
 *
 * Diese Werte steuern ausschließlich die ZEICHNUNG. Preise, Rasterbelegung und Prüfungen
 * hängen nicht daran.
 */

export interface GriffhoehenRegel {
  /**
   * `festMm`: Griffmitte in dieser Höhe über dem Fußboden — liegt sie außerhalb der Tür, die
   * Türmitte. `tuermitte`: immer die Mitte der Tür.
   */
  modus: 'festMm' | 'tuermitte'
  mm: number
  annahme?: boolean
}

export const KONSTRUKTION = {
  // --- Korpus (Preisliste 06.2026, S. 6 Programmvergleich + S. 26) -----------------------
  /** Seiten 2 cm (Programmvergleich Refugium). */
  seiteMm: 20,
  /** Mittelseite 2 cm (S. 26 „Mittelseite (2cm)"). */
  mittelseiteMm: 20,
  /** Einlegeböden 28 mm (S. 26 „Alle Einlegeböden sind 28mm stark"). */
  einlegebodenMm: 28,
  /** Glasboden Klarglas 8 mm (S. 26). */
  glasbodenMm: 8,
  /** Rückwand (Zeichenwert). */
  rueckwandMm: 8,
  /**
   * Oberkante Bodenplatte über dem Fußboden. Abgeleitet aus den Planungsmaßen S. 27
   * (Pos. 2 = 34,0 cm, Pos. 4 = 59,6 cm → Pos. 1 ≈ 21,2 cm) und Überarbeitung 9, S. 3
   * („1 Raster ist ca. 10 cm über Bodenplatte") → 212 − 100 = 112 mm.
   */
  bodenplatteOberkanteMm: 112,
  /** Raster 1 über der Bodenplatte (Überarbeitung 9, S. 3). */
  raster1UeberBodenplatteMm: 100,
  /** Rastermaß 12,8 cm. */
  rasterMm: 128,
  /** Oberkante Abschlussboden liegt 2 cm unter der Korpushöhe (S. 27: 235 → 233,0 cm). */
  abschlussbodenUnterOberkanteMm: 20,
  /** Abschlussboden (oberer Konstruktionsboden), Zeichenwert. */
  abschlussbodenMm: 20,
  /** Ab dieser Korpusbreite ein zusätzlicher Bodenträger in der Rückwand (S. 26 „Breite Korpi"). */
  bodentraegerAbBreiteMm: 800,

  // --- Fronten ----------------------------------------------------------------------------
  frontMm: 19,
  fugeMm: 3,
  /** Abstand der beiden Laufebenen der zweiläufigen Schiebetür (Zeichenwert). */
  schiebeEbeneMm: 25,
  /**
   * Griffhöhe an Drehtüren und einläufigen Schiebetüren. Von Cramer noch nicht festgelegt —
   * übliche Bedienhöhe am Kleiderschrank.
   */
  griffhoeheTuer: { modus: 'festMm', mm: 1050, annahme: true } as GriffhoehenRegel,
  /** Abstand der Griffmitte zur Schließkante der Tür. */
  griffKantenabstandMm: 40,
  /** Griff an Schüben und Klappen: Abstand der Griffmitte von der Oberkante. */
  griffSchubVonObenMm: 40,
  /** Edge-Profil: Breite der Silhouette (Stahlprofil, vertikal). */
  edgeBreiteMm: 18,

  // --- Ausstattung (S. 26–30) -------------------------------------------------------------
  /** Kleiderstange unter dem tragenden Boden (Zeichenwert). */
  kleiderstangeUnterBodenMm: 60,
  /** Container Decoboard: Tiefe 50 cm (S. 26). */
  containerTiefeMm: 500,
  /** Schubhöhe in Containern und Innenschubladen: 1,5 Raster je Schublade (S. 26). */
  containerSchubRaster: 1.5,
  /** Innenschublade: 3 cm Spalt zum Öffnen (S. 26). */
  innenschubladeSpaltMm: 30,
  /** Bauhöhen der Container Craft (S. 28) und Conero (S. 29–30). */
  containerHoeheMm: {
    'craft:A': 610,
    'craft:B': 800,
    'craft:C': 800,
    'conero:A': 610,
    'conero:B': 710,
    'conero:C': 800,
    'conero:D': 800,
    'conero:E': 800,
    'conero:F': 800,
    'conero:G': 950,
    'conero:H': 1100,
  } as Record<string, number>,
  /** Auszüge je Container — für die Teilungslinien (S. 28–30). Höhe 168 / 72 = Innenauszug Conero. */
  containerAuszuege: {
    'craft:A': [1.5, 1.5, 1.5],
    'craft:B': [1.5, 1.5, 1.5, 1.5],
    'craft:C': [1.5, 1.5, 1.5, 1.5],
    'conero:A': [168, 168, 168],
    'conero:B': [168, 168, 168, 72],
    'conero:C': [168, 168, 168, 168],
    'conero:D': [168, 168, 168, 72, 72],
    'conero:E': [168, 168, 168],
    'conero:F': [168, 168],
    'conero:G': [950],
    // H: 1 × Rollboden, 1 × Innenauszug 72 H, 1 × Funktionsauszug (G ist 95 cm hoch).
    'conero:H': [80, 72, 950],
  } as Record<string, number[]>,
  /** Hemdeinsatz Craft: 35,4 cm hoch, lose auf einen Boden gelegt (S. 28). */
  hemdeinsatzMm: 354,
  /** Rollboden mit Schuhablage Craft: Höhenbedarf 35 cm (S. 28). */
  schuhablageCraftMm: 350,
  /** Rollkorb / Rollboden (Zeichenwerte). */
  rollkorbMm: 180,
  rollbodenMm: 90,
  /** Trennboden über Außenschüben, auf dem die Innenausstattung beginnt. */
  trennbodenMm: 28,

  // --- Verblendung (Zeichenwert, die echte Breite ergibt sich bei der Montage) -------------
  verblendungMm: 30,
} as const

/** Höhe über dem Fußboden einer Rasterposition (0 = Korpusboden). */
export function rasterHoeheMm(raster: number): number {
  const k = KONSTRUKTION
  return raster <= 0 ? k.bodenplatteOberkanteMm : k.bodenplatteOberkanteMm + k.raster1UeberBodenplatteMm + (raster - 1) * k.rasterMm
}

/** Nächste Rasterposition, deren Höhe ≥ `mm` ist (0 = Korpusboden). */
export function naechstesRasterAb(mm: number): number {
  const k = KONSTRUKTION
  if (mm <= k.bodenplatteOberkanteMm) return 0
  return Math.max(1, Math.ceil((mm - k.bodenplatteOberkanteMm - k.raster1UeberBodenplatteMm) / k.rasterMm) + 1)
}
