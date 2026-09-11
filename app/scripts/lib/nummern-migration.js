/**
 * NUMMERN-MIGRATION  —  XX-XX-XX-XXXX  →  XX-XXX-XXXX
 *
 * Die Mappe `Cramer-Stammdaten.xlsx` führt weiterhin das gewachsene Schema mit vier
 * Blöcken. Die Anwendung arbeitet ab sofort mit drei. Diese Datei ist die einzige Stelle,
 * an der beide Welten aufeinandertreffen — bewusst hier und nicht verstreut im Code:
 *
 *   ALT   TT - PP - GG - NNNN     Teileart · Produktgruppe · Artikelgruppe · Laufnummer
 *   NEU        TT - DDD - NNNN    Teileart · Dropdown · Laufnummer
 *
 * WARUM DER ALTE ERSTE BLOCK ENTFÄLLT
 * Die alte „Teileart" (STRUKTUR, BESCHLAG, …) war keine eigene Ordnung, sondern eine
 * gröbere Sicht auf dieselbe Sache: Sie ist innerhalb jeder Artikelgruppe konstant
 * (geprüft, 38 von 38). Wer das Dropdown kennt, kennt die Teileart — der Block trug
 * also keine Information, die nicht schon im dritten Block stand. Was er kostete, war
 * Verwirrung: Zwei Blöcke hießen fast gleich und meinten Verschiedenes.
 *
 * WARUM DAS DROPDOWN DREISTELLIG UND GLOBAL EINDEUTIG WIRD
 * Die alte Artikelgruppen-Nummer zählte je Produktgruppe neu. „05" stand deshalb für
 * neun verschiedene Dinge — Korpus, Drehtür, Griff, Boden, Sockelplatte, Leuchte,
 * Tischplatte, Zuschlag, Porticus-Modell. Erst zusammen mit dem zweiten Block war sie
 * eindeutig. Jetzt bekommt jedes Auswahlfeld eine eigene Nummer: 001 ist überall im
 * System der Korpus, nirgends sonst.
 */

/** Sortierschlüssel: erst nach Produktgruppe, dann nach alter Artikelgruppen-Nummer. */
function sortSchluessel(row, pgNrVonCode) {
  const pg = pgNrVonCode.get(row['Produktgruppe']) ?? '99'
  return `${pg}|${row['Nr (Stelle 3)'] ?? '99'}`
}

/**
 * Baut die Übersetzung zwischen altem und neuem Schema.
 *
 * Die Dropdown-Nummern werden NICHT in der Zeilenreihenfolge der Mappe vergeben, sondern
 * nach (Produktgruppe, alte Nummer) sortiert. Damit liefert derselbe Datenstand immer
 * dieselben Nummern — auch wenn jemand in Excel Zeilen umsortiert.
 */
export function baueNummernMigration(xl) {
  const pgNrVonCode = new Map(xl.produktgruppen.map((r) => [r['Code'], String(r['Nr (Stelle 2)'] ?? '')]))

  const sortiert = [...xl.artikelgruppen].sort((a, b) =>
    sortSchluessel(a, pgNrVonCode).localeCompare(sortSchluessel(b, pgNrVonCode)),
  )

  /** Neue Teilearten = die bisherigen Produktgruppen, unverändert in Nummer und Code. */
  const teilearten = xl.produktgruppen.map((r) => ({
    nr: String(r['Nr (Stelle 2)'] ?? ''),
    code: r['Code'],
    reihenfolge: r['Reihenfolge'],
    bezeichnung: r['Bezeichnung'],
    schritt: r['Schritt im Konfigurator'],
  }))

  /** Neue Dropdowns = die bisherigen Artikelgruppen mit global eindeutiger Nummer. */
  const dropdowns = sortiert.map((r, i) => {
    const nr = String(i + 1).padStart(3, '0')
    const teileart = r['Produktgruppe']
    return {
      nr,
      code: r['Code'],
      teileart,
      bezeichnung: r['Bezeichnung (Dropdown-Titel)'],
      nummernkreis: `${pgNrVonCode.get(teileart) ?? '00'}-${nr}-`,
      anzahlArtikel: r['Artikel'],
      /** Nur für die Migration: so hieß dieses Auswahlfeld im alten Schema. */
      alterNummernkreis: r['Nummernkreis'] ?? '',
    }
  })

  const dropdownNrVonCode = new Map(dropdowns.map((d) => [d.code, d.nr]))

  /**
   * Übersetzt eine Artikelnummer. Fällt auf die alte Nummer zurück, wenn die Zuordnung
   * fehlt — ein stillschweigend falsch übersetzter Schlüssel wäre schlimmer als ein
   * unübersetzter, der in der Referenzprüfung auffällt.
   */
  function neueNummer(alteNummer, teileartCode, dropdownCode) {
    const teile = String(alteNummer ?? '').split('-')
    const lauf = teile.length === 4 ? teile[3] : teile[teile.length - 1]
    const tt = pgNrVonCode.get(teileartCode)
    const ddd = dropdownNrVonCode.get(dropdownCode)
    if (!tt || !ddd || !lauf) return alteNummer
    return `${tt}-${ddd}-${lauf}`
  }

  /** Vollständige Zuordnung alt → neu über alle Artikel. */
  const nummernMap = new Map()
  for (const a of xl.artikel) {
    nummernMap.set(
      a['Artikelnummer'],
      neueNummer(a['Artikelnummer'], a['Produktgruppe'], a['Artikelgruppe']),
    )
  }

  return { teilearten, dropdowns, dropdownNrVonCode, pgNrVonCode, neueNummer, nummernMap }
}
