import { artikelnummerLogik, produktgruppen, serien, teilearten } from '../../data/stammdaten.generated.ts'
import styles from './Handbuch.module.css'

/**
 * HANDBUCH — die Pflegeregeln dort, wo gepflegt wird.
 *
 * Der Inhalt ist bewusst kein allgemeiner Hilfetext, sondern beantwortet die eine Frage,
 * an der die Datenpflege scheitert: **Was muss ich eintragen, damit der Konfigurator
 * meinen neuen Artikel als Option anbietet?**
 *
 * Die Tabellen ziehen ihre Werte aus den Stammdaten — kommt eine Serie oder Produktgruppe
 * dazu, steht sie auch hier, ohne dass jemand den Text nachpflegt.
 */

export function Handbuch() {
  return (
    <div className={styles.wurzel}>
      <article className={styles.blatt}>
        <h2 className={styles.h1}>Stammdatenverwaltung — Handbuch</h2>
        <p className={styles.lead}>
          Der Konfigurator hat keine eingebaute Artikelliste. Was ein Berater auswählen kann, ergibt
          sich vollständig aus diesen Stammdaten. Ein Artikel taucht genau dann als Option auf, wenn
          vier Angaben stimmen — Artikelgruppe, Modus, Status und eine passende Preiszeile.
        </p>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>1 · Die Artikelnummer</h3>
          <p>
            Sie ist der Schlüssel und wird <strong>nie geändert</strong>. Ändert sich später die
            Klassifikation, wird ein neuer Artikel angelegt und der alte auf <code>gesperrt</code>{' '}
            gesetzt — eine korrigierte Nummer bräche die Verweise aus dem Preisblatt und aus
            gespeicherten Entwürfen.
          </p>
          <pre className={styles.schema}>
            {`        ${artikelnummerLogik.beispiel}
        │  │  │  └──── laufende Nummer in der Artikelgruppe
        │  │  └─────── Artikelgruppe    → das Dropdown
        │  └────────── Produktgruppe    → der Schritt im Konfigurator
        └───────────── Teileart         → Sicht von Einkauf und Fertigung`}
          </pre>
          <p className={styles.hinweis}>
            Beim Duplizieren zählt die Anwendung die laufende Nummer im selben Nummernkreis hoch und
            nimmt die nächste freie — die drei Klassifikationsblöcke bleiben unangetastet.
          </p>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>2 · Wie ein Dropdown entsteht</h3>
          <p>Die Regel steht im Blatt „00 Anleitung" der Mappe und ist im Code genau so umgesetzt:</p>
          <pre className={styles.schema}>
            {`Produktgruppe = ein Schritt im Konfigurator
  └── Artikelgruppe = ein Dropdown in diesem Schritt
        └── Artikel = die Einträge, gefiltert über Modus und Status`}
          </pre>
          <p>
            Ein Dropdown ist also keine Liste im Code, sondern eine Abfrage: „alle Artikel mit
            Artikelgruppe X, deren Modus die gewählte Serie enthält und deren Status{' '}
            <code>aktiv</code> ist". Enthält die Abfrage kein Ergebnis, verschwindet das Dropdown
            ganz — deshalb sieht ein Refugium-Berater keine Abdeckplatten-Auswahl.
          </p>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>3 · Der Modus — Serien-Freigabe</h3>
          <p>
            Im Feld <code>Modus</code> steht, für welche Serien ein Artikel freigegeben ist.
            Groß = Standard, klein = Sonderanfertigung (Preis auf Anfrage).
          </p>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Kürzel</th>
                <th>Serie</th>
                <th>Schwerpunkt</th>
              </tr>
            </thead>
            <tbody>
              {serien.map((s) => (
                <tr key={s.code}>
                  <td className={styles.mono}>{s.code}</td>
                  <td>{s.name}</td>
                  <td className={styles.leise}>{s.schwerpunkt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.hinweis}>
            Die Auswertung ist absichtlich fehlertolerant: Reihenfolge, Trennzeichen und
            Groß-/Kleinschreibung spielen fürs Finden keine Rolle. <code>RP</code>,{' '}
            <code>R, P</code>, <code>R/P</code> und <code>_R_P_</code> bedeuten dasselbe. Was zählt,
            ist allein, <em>ob der Buchstabe vorkommt</em>.
          </p>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>4 · Materialien und Preisgruppen</h3>
          <p>
            <strong>Materialien sind keine Artikel.</strong> Das ist der häufigste Irrtum. Der
            Konfigurator bietet Oberflächen aus der Farbmatrix an; jede Option trägt dort ihre
            Preisgruppe PG&nbsp;1–4. In die Preisfindung geht <em>nicht</em> die Farbe ein, sondern
            nur ihre Preisgruppe:
          </p>
          <pre className={styles.schema}>
            {`Mattlack „Schwarzgrau"  →  PG 2  ─┐
Mattlack „Graubeige"    →  PG 2  ─┼→  Achsenwert „Glatt2"  →  Preiszeile
Stil-Linie „Glatt"               ─┘`}
          </pre>
          <p>
            Deshalb passt Mattlack immer zu Mattlack: beide landen in derselben Preisgruppe und
            damit in derselben Preisspalte. Eine neue Farbe braucht <strong>keine</strong> neue
            Preiszeile — sie braucht nur die richtige Preisgruppe in der Farbmatrix.
          </p>
          <p className={styles.hinweis}>
            Die Farbmatrix liegt derzeit noch im Code (<code>config/materialMatrix.ts</code>), weil
            sie nicht Teil der Stammdatenmappe ist. Sie ist der nächste Kandidat für die Übernahme.
          </p>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>5 · Achsen A1–A5</h3>
          <p>
            Ein Artikel ist ein Artikel — seine Preisvarianten sind Achsen, keine eigenen Artikel.
            Die Achsen des Artikels legen fest, was die Spalten A1–A5 seiner Preiszeilen bedeuten.
            Dieselbe Spalte heißt bei einem anderen Artikel etwas anderes.
          </p>
          <pre className={styles.schema}>
            {`20-20-05-0001  Drehtür     Achsen: BREITE × RASTER × LINIE_PG
   A1 = T60-230      A2 = 18       A3 = Glatt2      →  348,00 €

10-10-15-0001  Aussenset   Achsen: BREITE × PG
   A1 = 18R          A2 = PG2                       →  359,00 €`}
          </pre>
          <p>
            Beim Suchen gilt die Regel „Preis des nächstgrößeren Maßes": eine Breite von 70 cm
            nimmt das 100er-Bracket, wenn es kein 70er gibt. Liegt die Anforderung über dem größten
            bepreisten Wert, entsteht bewusst <strong>keine</strong> Schätzung, sondern eine
            Position „auf Anfrage" für die Arbeitsvorbereitung.
          </p>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>6 · Checkliste: neuen Artikel anlegen</h3>
          <ol className={styles.liste}>
            <li>
              <strong>Nummer</strong> nach Muster <code>{artikelnummerLogik.muster}</code> vergeben —
              Teileart und Produktgruppe müssen zur Einordnung passen, sonst steht der Artikel im
              falschen Schritt.
            </li>
            <li>
              <strong>Artikelgruppe</strong> wählen — sie entscheidet, in welchem Dropdown der
              Artikel erscheint. Das ist die wichtigste Angabe.
            </li>
            <li>
              <strong>Modus</strong> setzen — ohne den Serien-Buchstaben taucht der Artikel bei
              dieser Serie nirgends auf.
            </li>
            <li>
              <strong>Status</strong> auf <code>aktiv</code> — <code>entwurf</code> und{' '}
              <code>gesperrt</code> werden im Konfigurator ausgeblendet.
            </li>
            <li>
              <strong>Achsen</strong> festlegen und <strong>Preiszeilen</strong> anlegen. Ohne
              passende Preiszeile ist der Artikel wählbar, erscheint aber als „auf Anfrage".
            </li>
          </ol>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>7 · Wertelisten</h3>
          <div className={styles.zweiSpalten}>
            <div>
              <h4 className={styles.h3}>Teilearten</h4>
              <table className={styles.tabelle}>
                <tbody>
                  {teilearten.map((t) => (
                    <tr key={t.code}>
                      <td className={styles.mono}>{t.nr}</td>
                      <td>{t.code}</td>
                      <td className={styles.leise}>{t.bezeichnung}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className={styles.h3}>Produktgruppen · Schritte</h4>
              <table className={styles.tabelle}>
                <tbody>
                  {produktgruppen.map((p) => (
                    <tr key={p.code}>
                      <td className={styles.mono}>{p.nr}</td>
                      <td>{p.code}</td>
                      <td className={styles.leise}>{p.schritt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>8 · Excel-Runde</h3>
          <p>
            <strong>Exportieren</strong> schreibt den aktuell gefilterten Stand als echte{' '}
            <code>.xlsx</code> mit denselben Blatt- und Spaltennamen wie die Stammdatenmappe.{' '}
            <strong>Importieren</strong> liest eine solche Datei wieder ein; zugeordnet wird über die
            Spaltenüberschriften, nicht über die Position — eine verschobene Spalte bricht also
            nichts.
          </p>
          <p className={styles.hinweis}>
            Änderungen liegen im Browser-Speicher dieses Geräts, nicht in der Mappe auf der Platte.
            Über „Auf Excel-Stand zurücksetzen" ist jederzeit der Ausgangszustand erreichbar.
          </p>
        </section>
      </article>
    </div>
  )
}
