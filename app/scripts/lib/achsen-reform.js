/**
 * ACHSEN- UND PREISLOGIK-REFORM — die Umrechnungsregeln an einer Stelle.
 *
 * Ausgangslage (Stammdatenverwaltung Reform, 17.09.2026):
 *
 *   „Raster und auch die ___er (50er, 60er…) können nicht einfach so übernommen werden,
 *    Raster bei Korpus und Drehtüren zum Beispiel unterschiedlich (keine universelle
 *    Maßeinheit)."
 *
 * Genau das ist der Befund: Dieselbe Zahl `18` in der Spalte RASTER bedeutet beim
 * Refugium-Korpus 235,0 cm und bei der Drehtür 230 cm. Ein Achsenwert, den man nur mit
 * Zusatzwissen über den Artikel lesen kann, ist keine Achse — er ist eine Abkürzung.
 *
 * Die Reform macht daraus zwei getrennte Angaben in EINER Zelle:
 *
 *     „235 cm | 18R"     links der Zentimeter-Schwellenwert, rechts das Etikett
 *     „60 cm | 60er"     der Preis gilt bis zu diesem Maß, benannt wird er wie gedruckt
 *     „60 cm"            Tiefe braucht kein Etikett
 *
 * Damit rechnet die Kalkulation in Zentimetern — der einzigen Größe, die über alle
 * Artikel dasselbe bedeutet — und die gedruckte Bezeichnung bleibt trotzdem sichtbar.
 *
 * Zweiter Teil der Reform: die Preislogik schrumpft auf drei Werte (FESTPREIS, MATRIX,
 * AUF_ANFRAGE). Alles, was vorher eine eigene Logik war, wird zu einer Achse:
 *
 *     MATRIX_AUF        ⇒ MATRIX          (Aufrunden ist Eigenschaft der cm-Achse)
 *     SATZPREIS         ⇒ FESTPREIS       (Satzgröße steht in der Einheit)
 *     PRO_LFM           ⇒ MATRIX + LAENGE + PREISART „€/m"
 *     PRO_QM            ⇒ MATRIX + BREITE_CM × TIEFE_CM + PREISART „€/m²"
 *     GRUND_PLUS_QM     ⇒ MATRIX + PREISART: eine Zeile Fixpreis, eine Zeile €/m²
 *     PRO_SEITE         ⇒ FESTPREIS       (Einheit „Stück (je Schrankseite)")
 *     PROZENT_*         ⇒ AUF_ANFRAGE     (der Verkäufer entscheidet im Abschluss)
 *
 * Diese Datei ist die einzige Quelle beider Umrechnungen. Sie wird benutzt von
 *   • `scripts/migrate-achsen-reform.js`  — schreibt die Mappe einmalig um
 *   • `scripts/check-achsen-reform.js`    — prüft das Ergebnis
 */

// ---------------------------------------------------------------------------
// Konstanten (Spiegel von „50 Meta" — bewusst hier hart, weil die Migration die
// Mappe umschreibt und dabei nicht von ihr abhängen soll)
// ---------------------------------------------------------------------------

/** Ein Raster in Millimetern. */
export const RASTER_MM = 128
/** Fronthöhen-Offset in Millimetern (−0,3 cm) — gilt in allen Programmen. */
export const FRONT_OFFSET_MM = -3
/** Korpushöhen-Offset je Serie in Millimetern. */
export const KORPUS_OFFSET_MM = { atrium: 52, velare: 37, publicum: 52, refugium: 46 }
/** Serien-Kürzel → Serien-ID, soweit ein Korpusoffset hinterlegt ist. */
const SERIEN_OFFSET_CODE = { A: 'atrium', V: 'velare', P: 'publicum', R: 'refugium' }

// ---------------------------------------------------------------------------
// Achsen-Katalog („35 Achsen")
// ---------------------------------------------------------------------------

/**
 * Der neue Achsen-Katalog.
 *
 *   `stufe`    cm-Schwellenwert + Etikett („60 cm | 60er"). Wird aufgerundet:
 *              gesucht ist die kleinste Stufe, die das verlangte Maß noch abdeckt.
 *   `mass`     reines cm-Maß. Leer = die Achse benennt nur, welches Maß die MENGE
 *              liefert (m², lfm); gefüllt = zusätzlich Staffelgrenze wie `stufe`.
 *   `liste`    Text, Komma ist Aufzählung („PG3,PG4").
 *   `text`     Text, exakt.
 *   `preisart` Bezugsgröße des Betrags: Fixpreis · €/cm · €/m · €/m².
 */
export const ACHSEN_KATALOG = [
  { code: 'BREITE', bedeutung: 'BREITE (cm + ___er) — Breitenstufe, wird aufgerundet', art: 'stufe' },
  { code: 'HOEHE', bedeutung: 'HÖHE (cm + Raster) — Höhenstufe, wird aufgerundet', art: 'stufe' },
  { code: 'TIEFE', bedeutung: 'TIEFE (cm – Stufe) — Tiefenstufe, wird aufgerundet', art: 'stufe' },
  { code: 'BREITE_CM', bedeutung: 'Breite (cm) — Maß, liefert zugleich die Menge', art: 'mass' },
  { code: 'HOEHE_CM', bedeutung: 'Höhe (cm) — Maß, liefert zugleich die Menge', art: 'mass' },
  { code: 'TIEFE_CM', bedeutung: 'Tiefe (cm) — Maß, liefert zugleich die Menge', art: 'mass' },
  { code: 'LAENGE', bedeutung: 'LÄNGE (cm) — laufende Länge, wird aufgerundet', art: 'stufe' },
  { code: 'PG', bedeutung: 'PG — Preisgruppe PG1–PG4', art: 'liste' },
  { code: 'LINIE_PG', bedeutung: 'LINIE+PG — Stil-Linie mit Preisgruppe', art: 'text' },
  { code: 'AUSFUEHRUNG', bedeutung: 'AUSFÜHRUNG — Ausführungsvariante dieses Artikels', art: 'text' },
  { code: 'PREISART', bedeutung: 'PREISART — Fixpreis · €/cm · €/m · €/m²', art: 'preisart' },
]

/** Die drei verbleibenden Preislogiken. */
export const PREISLOGIK_KATALOG = [
  { code: 'MATRIX', bedeutung: 'Matrix-Lookup über die Achsen; cm-Achsen runden auf das nächstgrößere Maß auf' },
  { code: 'FESTPREIS', bedeutung: 'Ein Preis, unabhängig von Achsen' },
  { code: 'AUF_ANFRAGE', bedeutung: 'Kein Preis hinterlegt — Arbeitsvorbereitung klärt' },
]

/** Werte der Achse PREISART. */
export const PREISARTEN = {
  FIX: 'Fixpreis',
  CM: '€/cm',
  M: '€/m',
  QM: '€/m²',
}

// ---------------------------------------------------------------------------
// Zahlen & Zellwerte
// ---------------------------------------------------------------------------

export function zahl(raw) {
  if (raw == null) return null
  const text = String(raw).trim()
  if (!text) return null
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function runde2(n) {
  return Math.round(n * 100) / 100
}

/** Zentimeter in deutscher Schreibweise, ohne überflüssige Nullen. */
export function cmText(cm) {
  const gerundet = Math.round(cm * 10) / 10
  return String(gerundet).replace('.', ',')
}

/**
 * Baut den kanonischen Achsenwert. Das Trennzeichen `|` ist bewusst nicht Teil einer
 * Zahl oder eines Etiketts — ein Wert lässt sich damit ohne Mehrdeutigkeit zerlegen.
 */
export function baueStufenwert(cm, etikett) {
  if (cm == null) return String(etikett ?? '').trim()
  const links = `${cmText(cm)} cm`
  const rechts = String(etikett ?? '').trim()
  return rechts ? `${links} | ${rechts}` : links
}

/** true, wenn der Wert schon die kanonische Form „<cm> cm [| Etikett]" hat. */
export function istKanonisch(raw) {
  const text = String(raw ?? '').trim()
  return /^[\d.,]+\s*cm\s*(\|.*)?$/i.test(text)
}

/** Zerlegt einen kanonischen Achsenwert wieder in cm und Etikett. */
export function zerlegeStufenwert(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return { cm: null, etikett: '' }
  const [links, ...rest] = text.split('|')
  const cm = zahl(links.replace(/cm/i, ''))
  return { cm, etikett: rest.join('|').trim() }
}

// ---------------------------------------------------------------------------
// Raster → Zentimeter
// ---------------------------------------------------------------------------

/**
 * Welchen Offset ein Artikel für seine Rasterhöhen benutzt.
 *
 * Korpusteile (Korpus, Mittelseite, Außenset, Ecklösung) folgen der Korpusformel
 * `R × 128 mm + Offset(Serie)`, alles andere der Frontformel `R × 128 mm − 3 mm`.
 * Genau diese beiden Formeln stehen seit jeher in `src/lib/raster.ts`; neu ist nur,
 * dass ihr Ergebnis in die Stammdaten geschrieben wird statt im Code zu leben.
 */
export function offsetFuerArtikel(artikelZeile) {
  if (!istKorpusartikel(artikelZeile)) return FRONT_OFFSET_MM
  const modus = String(artikelZeile['Modus'] ?? '')
  for (const code of modus.toUpperCase()) {
    const serie = SERIEN_OFFSET_CODE[code]
    if (serie) return KORPUS_OFFSET_MM[serie]
  }
  return KORPUS_OFFSET_MM.refugium
}

/**
 * Gehört der Artikel zum Korpusbau?
 *
 * Die Mappe führt noch die alte Vier-Block-Klassifikation (Teileart `STRUKTUR`,
 * Produktgruppe `KORPUS`), die Anwendung die neue (Teileart `KORPUS`). Beide Schreibweisen
 * müssen treffen — sonst bekäme der Korpus still den Fronten-Offset, und 18 Raster stünden
 * mit 230,1 cm statt 235,0 cm in der Mappe. Eine Korpushöhe von 235 cm fiele dann auf die
 * nächste Stufe und wäre eine Preisklasse zu teuer.
 */
export function istKorpusartikel(artikelZeile) {
  const felder = ['Teileart', 'Produktgruppe', 'Artikelgruppe'].map((k) =>
    String(artikelZeile[k] ?? '').trim().toUpperCase(),
  )
  return felder.some((v) => v === 'KORPUS' || v === 'MITTELSEITE' || v === 'AUSSENSET')
}

/** Höhe (cm) einer Rasterstufe. */
export function hoeheFuerRaster(raster, offsetMm) {
  return Math.round(raster * RASTER_MM + offsetMm) / 10
}

/** Etikett einer Rasterstufe („1,5R"). */
export function rasterEtikett(raster) {
  return `${String(raster).replace('.', ',')}R`
}

// ---------------------------------------------------------------------------
// Alte Achsenwerte lesen
// ---------------------------------------------------------------------------

/**
 * Liest einen ALTEN Wert der Spalte BREITE und sagt, wohin er gehört.
 *
 * Die gedruckte Preisliste führt die Breite in sieben Schreibweisen, und drei davon
 * stehen gar nicht für eine Breite: `18R` ist eine Rasterhöhe (Mittelseite, Außenset),
 * `bis 9Raster (120cm)` eine Korpushöhenklasse (LED-Band) und `T50-51` beides zugleich
 * (Drehtür: 50er breit, 51 cm hoch). Die Reform trennt das auf.
 *
 * @returns {{ ziel: 'BREITE'|'HOEHE', cm: number|null, etikett: string, hinweis?: string }|null}
 */
export function leseAlteBreite(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null

  // Bereits kanonisch („60 cm | 60er", „60 cm") — unverändert übernehmen. Ohne diesen
  // Zweig wäre die Migration nicht wiederholbar: Ein zweiter Lauf erkennte den eigenen
  // Wert nicht wieder und würfe die Achse weg.
  if (istKanonisch(text)) {
    const { cm, etikett } = zerlegeStufenwert(text)
    return { ziel: 'BREITE', cm, etikett }
  }

  // T50-51 · T60-230 — Katalog-Code der Drehtür: Nennbreite + Türhöhe in cm.
  const code = /^T(\d+)-(\d+)$/i.exec(text)
  if (code) {
    return {
      ziel: 'BREITE',
      cm: Number(code[1]),
      etikett: `${code[1]}er`,
      hoehe: { cm: Number(code[2]), etikett: '' },
    }
  }

  // 18R · 21R — in Wahrheit eine Rasterhöhe in der Breitenspalte.
  const raster = /^(\d+(?:[.,]\d+)?)\s*R$/i.exec(text)
  if (raster) {
    const stufe = Number(raster[1].replace(',', '.'))
    return { ziel: 'HOEHE', raster: stufe, etikett: rasterEtikett(stufe) }
  }

  // bis 9Raster (120cm) — Korpushöhenklasse mit gedruckter Obergrenze.
  const rasterKlasse = /^bis\s*(\d+(?:[.,]\d+)?)\s*Raster\s*\(([\d.,]+)\s*cm\)$/i.exec(text)
  if (rasterKlasse) {
    const stufe = Number(rasterKlasse[1].replace(',', '.'))
    return { ziel: 'HOEHE', cm: zahl(rasterKlasse[2]), etikett: rasterEtikett(stufe) }
  }

  // Seite · Seite (2,0cm) — der Preis gilt je Bauteilseite.
  if (/^Seite\b/i.test(text)) {
    return { ziel: 'BREITE', cm: zahl(/\(([\d.,]+)\s*cm\)/i.exec(text)?.[1]) ?? 2, etikett: 'Seite' }
  }

  // bis 60cm · bis 75cm Breite · -140cm — die gedruckte Obergrenze IST der Schwellenwert.
  const obergrenze = /^(?:bis\s*|-)\s*([\d.,]+)\s*cm\b/i.exec(text)
  if (obergrenze) return { ziel: 'BREITE', cm: zahl(obergrenze[1]), etikett: '' }

  // 50er · 60er (59,5cm) · 50/60er (49,5/59,5cm)
  // Der Schwellenwert ist das NENNMASS (50), nicht das Fertigungsmaß (49,5): Der
  // Konfigurator führt Korpi in Nennbreiten, das Fertigungsmaß ist eine Werkstattangabe.
  const nominal = /^(\d+)(?:\/(\d+))?\s*er\b/i.exec(text)
  if (nominal) {
    const klammer = /\(([^)]*)\)/.exec(text)?.[1]
    return {
      ziel: 'BREITE',
      cm: Number(nominal[1]),
      etikett: nominal[2] ? `${nominal[1]}/${nominal[2]}er` : `${nominal[1]}er`,
      fertigungsmass: klammer ? klammer.trim() : undefined,
    }
  }

  // 140cm — nacktes Maß
  const mass = /^([\d.,]+)\s*cm$/i.exec(text)
  if (mass) return { ziel: 'BREITE', cm: zahl(mass[1]), etikett: '' }

  return { ziel: 'BREITE', cm: null, etikett: text, unklar: true }
}

/**
 * Liest einen ALTEN Wert der Spalte BEDINGUNG.
 *
 * Zwei Sorten stecken darin: Längenstaffeln („bis Laenge 158 cm", „bis 100cm
 * Korpuslaenge") — die werden zur Achse LÄNGE — und Fließtext-Notizen („Tiefenkuerzung
 * nicht moeglich"), die nie eine Achse waren und in die Bemerkung gehören.
 */
export function leseAlteBedingung(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const treffer = /(?:^|\b)bis\s+(?:L(?:ae|ä)nge\s+)?([\d.,]+)\s*cm/i.exec(text)
  if (treffer) return { ziel: 'LAENGE', cm: zahl(treffer[1]) }
  return { ziel: 'BEMERKUNG', text }
}

/**
 * Liest einen ALTEN Wert der Spalte VARIANTE.
 *
 * Drei Sorten: echte Ausführungsvarianten („Deckplatte Rauchglas grau"), reine Maße, die
 * schon in der Bezeichnung stehen („138mm" bei „Griff Nr. 103 (138 mm)"), und
 * Extraktions-Notizen. Nur die erste Sorte bleibt eine Achse — dann aber als
 * AUSFÜHRUNG mit geschlossenem, artikeleigenem Wertevorrat statt als Freitext.
 */
export function leseAlteVariante(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  // Reine Maßangabe („138mm", „105,5x37mm") — steht bereits in der Bezeichnung.
  if (/^[\d.,]+\s*(?:x\s*[\d.,]+\s*)?mm$/i.test(text)) return { ziel: 'BEMERKUNG', text }
  // Fließtext aus der Extraktion — länger als jeder Variantenname.
  if (text.length > 90) return { ziel: 'BEMERKUNG', text }
  return { ziel: 'AUSFUEHRUNG', text }
}

// ---------------------------------------------------------------------------
// Einheiten
// ---------------------------------------------------------------------------

/**
 * Räumt das Einheitenfeld auf.
 *
 * „Es sei denn es handelt sich ausdrücklich um kalkulations und service aufschläge" —
 * alles andere soll eine schlichte Mengeneinheit sein. Was vorher als Rechenanweisung im
 * Einheitentext stand („EUR/Stk zzgl. 525 EUR/m²"), wandert in die Achse PREISART und
 * eine zweite Preiszeile; übrig bleibt die reine Einheit.
 */
export const EINHEIT_ERSATZ = {
  EUR: 'Stück',
  'EUR/Stk': 'Stück',
  'EUR/Stück': 'Stück',
  'EUR/Stueck': 'Stück',
  'EUR/Element': 'Stück (je Element)',
  'EUR/Paneel': 'Stück (je Paneel)',
  'EUR/Wandpaneel': 'Stück (je Wandpaneel)',
  'EUR/Schrankseite': 'Stück (je Schrankseite)',
  'EUR/fuer 2 Seiten': 'Stück (für 2 Seiten)',
  'EUR/für 2 Seiten': 'Stück (für 2 Seiten)',
  'EUR/lfd.m': 'Meter',
  'EUR/lfm': 'Meter',
  'EUR/m²': 'Quadratmeter',
  Satz: 'Satz (Satzgröße: offen)',
  'Auf Anfrage': 'Auf Anfrage',
  'Nach Aufwand EUR': 'Nach Aufwand',
  'n/v': '—',
}

/**
 * Zieht eine zusätzliche Bezugsgröße aus dem alten Einheitentext.
 *
 * „EUR/Stk zzgl. 525 EUR/m²" ⇒ der Zeilenpreis ist ein Fixpreis, und daneben gehört
 * eine zweite Zeile mit 525 €/m². „EUR/m² (+225 EUR Grundpreis)" ⇒ umgekehrt.
 *
 * @returns {{ basis: string, zusatz?: { preisart: string, preis: number } }}
 */
export function leseEinheit(einheit) {
  const text = String(einheit ?? '').trim()

  // EUR/m² (+225 EUR Grundpreis) — der Zeilenpreis ist die Rate, der Zusatz ein Fixpreis.
  const grund = /\(\+\s*([\d.,]+)\s*EUR\s*Grundpreis\)/i.exec(text)
  if (grund) {
    return {
      basis: /m²/i.test(text) ? PREISARTEN.QM : PREISARTEN.M,
      zusatz: { preisart: PREISARTEN.FIX, preis: zahl(grund[1]) },
    }
  }

  // Grundpreis EUR zzgl. 50 EUR/lfd.m — der Zeilenpreis ist der Grundpreis.
  // EUR/Stk zzgl. 180 EUR/m²      — dito.
  // `\b` taugt hier nicht: nach „m²" steht ein Nicht-Wortzeichen, die Grenze fehlt —
  // der Ausdruck fiele auf „m" zurück und machte aus €/m² still ein €/m.
  const zzgl = /zzgl\.?\s*([\d.,]+)\s*EUR\s*\/\s*(m²|qm|lfd\.?m|lfm|m)(?![a-z²])/i.exec(text)
  if (zzgl) {
    const einheitTeil = zzgl[2].toLowerCase()
    return {
      basis: PREISARTEN.FIX,
      zusatz: {
        preisart: /m²|qm/.test(einheitTeil) ? PREISARTEN.QM : PREISARTEN.M,
        preis: zahl(zzgl[1]),
      },
    }
  }

  if (/^EUR\s*\/\s*m²$/i.test(text)) return { basis: PREISARTEN.QM }
  if (/^EUR\s*\/\s*(lfd\.?m|lfm)$/i.test(text)) return { basis: PREISARTEN.M }
  return { basis: PREISARTEN.FIX }
}

/** Die aufgeräumte Einheit zu einem alten Einheitentext. */
export function bereinigeEinheit(einheit) {
  const text = String(einheit ?? '').trim()
  if (EINHEIT_ERSATZ[text]) return EINHEIT_ERSATZ[text]
  if (/\(\+\s*[\d.,]+\s*EUR\s*Grundpreis\)/i.test(text)) return 'Quadratmeter'
  if (/^EUR\/Stk\s+zzgl\./i.test(text)) return 'Stück'
  if (/^Grundpreis EUR\s+zzgl\./i.test(text)) return 'Stück'
  if (/^%/.test(text) || /^\s*%/.test(text)) return 'Aufschlag in %'
  return text || 'Stück'
}

// ---------------------------------------------------------------------------
// Preislogik
// ---------------------------------------------------------------------------

/** Alte Preislogik → neue Preislogik. */
export const PREISLOGIK_ERSATZ = {
  MATRIX: 'MATRIX',
  MATRIX_AUF: 'MATRIX',
  FESTPREIS: 'FESTPREIS',
  SATZPREIS: 'FESTPREIS',
  PRO_SEITE: 'FESTPREIS',
  PRO_LFM: 'MATRIX',
  PRO_QM: 'MATRIX',
  GRUND_PLUS_QM: 'MATRIX',
  PROZENT_ARTIKEL: 'AUF_ANFRAGE',
  PROZENT_MOEBEL: 'AUF_ANFRAGE',
  PROZENT_AUFTRAG: 'AUF_ANFRAGE',
  AUF_ANFRAGE: 'AUF_ANFRAGE',
}

/** Die Prozent-Logiken, die ersatzlos entfallen. */
export const PROZENT_LOGIKEN = new Set(['PROZENT_ARTIKEL', 'PROZENT_MOEBEL', 'PROZENT_AUFTRAG'])

/**
 * Begründung, die beim Streichen einer Prozent-Logik in die Bemerkung wandert.
 *
 * „das kann am ende wenn der Endpreis vom konfigurator steht vom Verkäufer entschieden
 * werden, der Konfigurator soll den ‚Katalogpreis/Listenpreis‘ [zeigen]. Für die
 * Flexibilität des Verkäufers haben wir ja im Abschluss die Unterteilung von
 * kalkuliertem Preis und der Eingabe des Angebotspreises."
 */
export function prozentBemerkung(satz) {
  return (
    `Aufschlag ${satz != null ? `${String(satz).replace('.', ',')} %` : '(Satz siehe Preisliste)'} — ` +
    'wird NICHT mehr automatisch kalkuliert. Der Konfigurator weist den Listenpreis aus; ' +
    'der Aufschlag wird im Abschluss über den Angebotspreis entschieden.'
  )
}

// ---------------------------------------------------------------------------
// Artikel, die als Mischsystem aufgelöst werden
// ---------------------------------------------------------------------------

/**
 * AUFPREIS-ARTIKEL, DIE IN ECHTE PREISZEILEN AUFGEHEN.
 *
 *   „Solche Aufpreis positionen sind schwierig, bereinige das system und arbeite neue
 *    Preiszeilen ein und löse das damit einheitlich. Diese Mischsysteme mit aufpreisen
 *    wirken erstmal einfach, aber man verliert den Überblick."
 *
 * Schlüssel ist die ALTE Vier-Block-Nummer der Mappe.
 */
export const AUFPREIS_AUFLOESUNG = {
  '40-40-20-0018': {
    /** Basisartikel, der die Aufpreis-Zeilen als eigene Ausführung bekommt. */
    ziel: '40-40-20-0019',
    ausfuehrungBasis: 'Deckplatte Decoboard',
    ausfuehrungAufpreis: 'Deckplatte Rauchglas grau',
    /** Der Aufpreis ist nach Korpusbreite gestaffelt; so führt ihn auch der Container. */
    aufpreisNachBreiteCm: [50, 60, 100],
    grund:
      'Aufpreis in die Ausführungs-Achse von 40-40-20-0019 aufgelöst (Deckplatte Decoboard / Rauchglas grau). ' +
      'Damit steht je Ausführung ein vollständiger Preis statt eines Zuschlags.',
  },
  '20-20-25-0002': {
    ziel: '20-20-25-0003',
    ausfuehrungBasis: 'ohne Ledereinlage',
    ausfuehrungAufpreis: 'mit Ledereinlage (Leder Napoli schwarz 0500)',
    grund:
      'Aufpreis in die Ausführungs-Achse von 20-20-25-0003 aufgelöst (ohne / mit Ledereinlage). ' +
      'Damit steht je Ausführung ein vollständiger Preis statt eines Zuschlags.',
  },
  '20-20-30-0001': {
    /** Kein Ziel: der Aufpreis ist in der Achse LINIE+PG (Glatt3) bereits enthalten. */
    ziel: null,
    grund:
      'Der Aufpreis auf Preisgruppe 3 ist in der Achse LINIE+PG der Front-Artikel bereits enthalten ' +
      '(Glatt3 gegenüber Glatt1). Eine zweite, parallele Aufpreisstelle wäre doppelt berechnet.',
  },
}
