import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  artikel,
  artikelgruppen,
  artikelnummerLogik,
  meta,
  preise,
  produktgruppen,
  serien,
  teilearten,
} from '../../data/stammdaten.generated.ts'
import { basisOberflaechen, basisOberflaechenkategorien } from '../../data/farbmatrix.ts'
import { NummernSchema } from '../../components/ui/NummernSchema.tsx'
import { formatGanzzahl } from '../../lib/format.ts'
import styles from './Praesentation.module.css'

/**
 * PRÄSENTATIONS-MODUL — die Stammdatenverwaltung erklärt, für einen Termin.
 *
 * Bewusst keine Textwüste: Jede Folie trägt eine Aussage, der Rest ist Diagramm oder
 * Zahl. Was der Vortragende erzählt, steht nicht auf der Folie.
 *
 * ALLE ZAHLEN KOMMEN AUS DEN STAMMDATEN, keine ist abgetippt. Sonst steht in einem
 * halben Jahr eine Folie im Raum, die dem Konfigurator widerspricht — und das ist im
 * Kundentermin der teuerste denkbare Fehler.
 */

/** Ein Kasten im Ablauf-Diagramm. */
function FlussKasten({ kopf, farbe, children }: { kopf: string; farbe: string; children: ReactNode }) {
  return (
    <div className={styles.flussKasten} style={{ ['--kasten-farbe' as string]: farbe }}>
      <div className={styles.flussKopf}>{kopf}</div>
      <p className={styles.flussText}>{children}</p>
    </div>
  )
}

function Kennzahl({ titel, wert, text }: { titel: string; wert: string; text: string }) {
  return (
    <div className={styles.karte}>
      <p className={styles.karteTitel}>{titel}</p>
      <div className={styles.karteWert}>{wert}</div>
      <p className={styles.karteText}>{text}</p>
    </div>
  )
}

interface Folie {
  nummer: string
  titel: string
  untertitel?: string
  inhalt: ReactNode
}

export default function PraesentationPage() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  // Kennzahlen einmal ausrechnen — sie hängen nur an den Stammdaten.
  const zahlen = useMemo(() => {
    const beispiel = artikel.find((a) => a.artikelnummer === artikelnummerLogik.beispiel)
    const griffe = artikel.filter((a) => a.artikelnummer.startsWith('30-30-05-'))
    const drehtuer = preise.filter((p) => p.artikel === '20-20-05-0001')
    return {
      artikel: artikel.length,
      preiszeilen: preise.length,
      produktgruppen: produktgruppen.length,
      artikelgruppen: artikelgruppen.length,
      teilearten: teilearten.length,
      serien: serien.length,
      oberflaechen: basisOberflaechen.length,
      kategorien: basisOberflaechenkategorien.length,
      beispielBezeichnung: beispiel?.bezeichnung ?? '',
      griffeAnzahl: griffe.length,
      drehtuerZeilen: drehtuer.length,
    }
  }, [])

  const folien: Folie[] = useMemo(
    () => [
      // --- 1 -----------------------------------------------------------------
      {
        nummer: 'Cramer Planer',
        titel: 'Die Stammdatenverwaltung des Cramer Planers',
        untertitel:
          'Logik & Datenstruktur — wie aus Ihrer Preisliste ein Konfigurator wird, den Sie selbst pflegen.',
        inhalt: (
          <>
            <div className={styles.spalten}>
              <Kennzahl
                titel="Artikel im Stamm"
                wert={formatGanzzahl(zahlen.artikel)}
                text="Jeder mit eindeutiger Nummer, Klassifikation und Serien-Freigabe."
              />
              <Kennzahl
                titel="Preiszeilen"
                wert={formatGanzzahl(zahlen.preiszeilen)}
                text={`Aus der Preisliste ${meta.gueltigkeit}, jede mit Fundstelle belegt.`}
              />
              <Kennzahl
                titel="Oberflächen"
                wert={`${zahlen.oberflaechen} in ${zahlen.kategorien}`}
                text="Farben und Furniere, gruppiert in Kategorien mit Preisgruppe."
              />
            </div>
            <p className={styles.merksatz}>
              Ziel des Termins: Sie sehen, wo welche Angabe steht — und dass Sie jede davon
              selbst ändern können, ohne uns.
            </p>
          </>
        ),
      },

      // --- 2 -----------------------------------------------------------------
      {
        nummer: 'Folie 2',
        titel: 'Das Prinzip: Daten steuern, Code rechnet',
        untertitel:
          'Im Konfigurator steht keine einzige Artikelliste. Was ein Berater auswählen kann, ergibt sich vollständig aus den Stammdaten.',
        inhalt: (
          <>
            <div className={styles.fluss}>
              <FlussKasten kopf="Ihre Mappe" farbe="#3d6b8f">
                Cramer-Stammdaten.xlsx — Artikel, Preise, Oberflächen, Mitarbeiter
              </FlussKasten>
              <span className={styles.pfeil} aria-hidden="true">
                →
              </span>
              <FlussKasten kopf="Stammdaten" farbe="#8f6b3d">
                Eingelesen und geprüft. Änderungen bleiben als benannte Liste sichtbar.
              </FlussKasten>
              <span className={styles.pfeil} aria-hidden="true">
                →
              </span>
              <FlussKasten kopf="Konfigurator" farbe="#3d7a5a">
                Dropdowns, Regeln und Preise entstehen daraus — zur Laufzeit
              </FlussKasten>
            </div>
            <p className={styles.merksatz}>
              Neuer Griff, neue Farbe, neuer Preis? <strong>Ein Datensatz, keine Programmierung.</strong>{' '}
              Der Code kennt keine Griffe — er kennt nur die Regel, wie man Griffe findet.
            </p>
          </>
        ),
      },

      // --- 3 -----------------------------------------------------------------
      {
        nummer: 'Folie 3',
        titel: 'Das Artikelnummern-System',
        untertitel:
          'Vier Blöcke, vier Sichten auf denselben Artikel. Die Nummer ist der Schlüssel und ändert sich nie.',
        inhalt: (
          <>
            <NummernSchema
              nummer={artikelnummerLogik.beispiel}
              bezeichnung={zahlen.beispielBezeichnung}
            />
            <div className={styles.spalten} style={{ marginTop: '1.4em' }}>
              <div className={styles.karte}>
                <p className={styles.karteTitel}>Praxisbeispiel</p>
                <p className={styles.karteText}>
                  Ein neuer Griff kommt ins Sortiment. Er gehört in die Artikelgruppe GRIFF, also in
                  den Nummernkreis <span className={styles.mono}>30-30-05-</span>. Aktuell sind dort{' '}
                  <strong>{zahlen.griffeAnzahl} Griffe</strong> vergeben — der neue bekommt die
                  nächste freie Laufnummer und erscheint sofort im Griff-Dropdown.
                </p>
              </div>
              <div className={styles.karte}>
                <p className={styles.karteTitel}>Geprüft am Datenbestand</p>
                <p className={styles.karteText}>
                  Alle <strong>{formatGanzzahl(zahlen.artikel)} Artikel</strong> folgen dieser
                  Systematik ohne Ausnahme: {zahlen.teilearten} Teilearten,{' '}
                  {zahlen.produktgruppen} Produktgruppen, {zahlen.artikelgruppen} Artikelgruppen —
                  keine Doppelnummer, keine Lücke in den Laufnummern.
                </p>
              </div>
            </div>
          </>
        ),
      },

      // --- 4 -----------------------------------------------------------------
      {
        nummer: 'Folie 4',
        titel: 'Wie Preise berechnet werden',
        untertitel:
          'Eine Preisvariante ist kein eigener Artikel. Eine Drehtür bleibt eine Drehtür — unterschiedlich ist nur die Zeile, in der ihr Preis steht.',
        inhalt: (
          <>
            <div className={styles.fluss}>
              <FlussKasten kopf="1 · Artikel" farbe="#3d6b8f">
                Welches Bauteil? → Artikelnummer, z. B. Drehtür{' '}
                <span className={styles.mono}>20-20-05-0001</span>
              </FlussKasten>
              <span className={styles.pfeil} aria-hidden="true">
                →
              </span>
              <FlussKasten kopf="2 · Achsen" farbe="#8f6b3d">
                Worin variiert der Preis? Breite × Raster × Linie+Preisgruppe
              </FlussKasten>
              <span className={styles.pfeil} aria-hidden="true">
                →
              </span>
              <FlussKasten kopf="3 · Zelle" farbe="#3d7a5a">
                Genau eine Preiszeile — mit Fundstelle in der gedruckten Liste
              </FlussKasten>
            </div>
            <code className={styles.code}>
              {`Drehtür 20-20-05-0001        Achsen: BREITE × RASTER × LINIE_PG

  A1 Breite    A2 Raster    A3 Linie+PG      →   Preis
  ─────────    ─────────    ───────────          ────────
  T60-230      18           Glatt2               348,00 €
  T60-230      21           Glatt2               402,00 €
  T100-230     18           Glatt2               487,00 €`}
            </code>
            <p className={styles.merksatz}>
              Kein Treffer heißt <strong>nie geraten</strong>: Bei Maßen greift „nächstgrößeres
              Standardmaß", darüber hinaus entsteht eine Position „auf Anfrage" für die AV. Ein
              geschätzter Preis wäre schlimmer als gar keiner.
            </p>
          </>
        ),
      },

      // --- 5 -----------------------------------------------------------------
      {
        nummer: 'Folie 5',
        titel: 'Oberflächen & Preisgruppen',
        untertitel:
          'In die Preisfindung geht nie die Farbe ein, sondern nur ihre Preisgruppe. Das ist der Grund, warum neue Farben nichts kosten — an Aufwand.',
        inhalt: (
          <>
            <code className={styles.code}>
              {`Kategorie "Mattlack"        →  PG 2
   ├── Verkehrsweiß RAL 9016      erbt PG 2  ─┐
   ├── Schwarzgrau RAL 7021       erbt PG 2  ─┼→  Achsenwert "Glatt2"  →  Preiszeile
   └── …                                     ─┘

Kategorie "Furnier"         →  PG 3
   └── Wengé                      eigene PG 4   (Ausnahme schlägt Kategorie)`}
            </code>
            <table className={styles.tabelle} style={{ marginTop: '1.2em' }}>
              <thead>
                <tr>
                  <th>Preisgruppe</th>
                  <th>Umfasst</th>
                </tr>
              </thead>
              <tbody>
                {(['PG1', 'PG2', 'PG3', 'PG4'] as const).map((pg) => (
                  <tr key={pg}>
                    <td className={styles.mono}>{pg}</td>
                    <td style={{ textAlign: 'left' }}>{meta.preisgruppen[pg]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.merksatz}>
              Eine neue Farbe braucht <strong>keine neue Preiszeile</strong> — nur die richtige
              Kategorie. Sie steht danach sofort in den Material-Dropdowns von Korpus und Fronten.
            </p>
          </>
        ),
      },

      // --- 6 -----------------------------------------------------------------
      {
        nummer: 'Folie 6',
        titel: 'Excel-Import/Export & Qualitätsprüfung',
        untertitel:
          'Gepflegt wird dort, wo Sie ohnehin arbeiten: in Excel. Der Planer liest die Mappe und prüft sie, bevor etwas wirksam wird.',
        inhalt: (
          <>
            <div className={styles.fluss}>
              <FlussKasten kopf="Export" farbe="#3d6b8f">
                Ein Blatt je Reiter, Spaltennamen wie in der Verwaltung
              </FlussKasten>
              <span className={styles.pfeil} aria-hidden="true">
                →
              </span>
              <FlussKasten kopf="Bearbeiten" farbe="#8f6b3d">
                In Excel, mit den gewohnten Werkzeugen
              </FlussKasten>
              <span className={styles.pfeil} aria-hidden="true">
                →
              </span>
              <FlussKasten kopf="Import & Prüfung" farbe="#3d7a5a">
                Zuordnung über Spaltennamen, nicht über die Position
              </FlussKasten>
            </div>
            <ul className={styles.punkte} style={{ marginTop: '1.3em' }}>
              <li>
                <span>
                  <strong>Kein stiller Verlust.</strong> Regelwidrige Datensätze werden übernommen
                  und markiert, nicht verworfen — ein fehlender Artikel fiele erst im Angebot auf.
                </span>
              </li>
              <li>
                <span>
                  <strong>Jede Änderung benannt.</strong> Der Planer zeigt feldweise, was sich
                  geändert hat: <span className={styles.mono}>Preis: 372 → 410</span>. Ein Klick
                  springt zur betroffenen Zeile.
                </span>
              </li>
              <li>
                <span>
                  <strong>Jederzeit zurück.</strong> „Auf Excel-Stand zurücksetzen" stellt den
                  Ausgangszustand wieder her.
                </span>
              </li>
            </ul>
          </>
        ),
      },

      // --- 7 -----------------------------------------------------------------
      {
        nummer: 'Folie 7',
        titel: 'Was das für Cramer bedeutet',
        untertitel: 'Maximale Flexibilität ohne Programmieraufwand.',
        inhalt: (
          <>
            <div className={styles.spalten}>
              <div className={styles.karte}>
                <p className={styles.karteTitel}>Sie ändern selbst</p>
                <p className={styles.karteText}>
                  Preise, Farben, Griffe, Mitarbeiter, Filialen. Alles über Excel oder direkt in der
                  Verwaltung — ohne Release, ohne Wartezeit.
                </p>
              </div>
              <div className={styles.karte}>
                <p className={styles.karteTitel}>Nichts geht verloren</p>
                <p className={styles.karteText}>
                  Abgeschlossene Aufträge frieren ihren Preisstand ein. Eine Preispflege von heute
                  ändert einen Auftrag von gestern nicht rückwirkend.
                </p>
              </div>
              <div className={styles.karte}>
                <p className={styles.karteTitel}>Jeder Betrag belegbar</p>
                <p className={styles.karteText}>
                  Jede Position zeigt Artikelnummer, Achsenwerte und die Seite der Preisliste. Keine
                  Blackbox, keine geratenen Zahlen.
                </p>
              </div>
            </div>
            <p className={styles.merksatz}>
              Der Konfigurator wächst mit Ihrem Sortiment — und zwar in Ihrem Tempo, nicht in unserem.
            </p>
          </>
        ),
      },
    ],
    [zahlen],
  )

  const letzte = folien.length - 1
  const weiter = useCallback(() => setIndex((i) => Math.min(i + 1, letzte)), [letzte])
  const zurueck = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])

  // Tastatur: im Termin wird mit Pfeiltasten oder Presenter geblättert, nicht geklickt.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          event.preventDefault()
          weiter()
          break
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault()
          zurueck()
          break
        case 'Home':
          setIndex(0)
          break
        case 'End':
          setIndex(letzte)
          break
        case 'Escape':
          navigate('/')
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [weiter, zurueck, letzte, navigate])

  const folie = folien[index]

  return (
    <div className={styles.buehne}>
      <article className={styles.folie} key={index}>
        <p className={styles.nummer}>{folie.nummer}</p>
        <h1 className={styles.titel}>{folie.titel}</h1>
        {folie.untertitel ? <p className={styles.untertitel}>{folie.untertitel}</p> : null}
        <div className={styles.inhalt}>{folie.inhalt}</div>
      </article>

      <nav className={styles.leiste} aria-label="Foliensteuerung">
        <span className={styles.marke}>Cramer Planer</span>
        <button type="button" className={styles.zurueck} onClick={() => navigate('/')}>
          ← Zum Planer
        </button>

        <div className={styles.punkteReihe}>
          {folien.map((f, i) => (
            <button
              key={f.nummer}
              type="button"
              className={[styles.punktKnopf, i === index ? styles.punktAktiv : ''].filter(Boolean).join(' ')}
              onClick={() => setIndex(i)}
              aria-label={`Folie ${i + 1}: ${f.titel}`}
              aria-current={i === index}
            />
          ))}
        </div>

        <span className={styles.tastenhinweis}>← → blättern · Esc beendet</span>
        <span className={styles.zaehler}>
          {index + 1} / {folien.length}
        </span>
        <button type="button" className={styles.knopf} onClick={zurueck} disabled={index === 0}>
          Zurück
        </button>
        <button type="button" className={styles.knopf} onClick={weiter} disabled={index === letzte}>
          Weiter
        </button>
      </nav>
    </div>
  )
}
