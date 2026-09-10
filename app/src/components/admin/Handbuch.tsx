import { artikel, artikelnummerLogik, produktgruppen, serien, teilearten } from '../../data/stammdaten.generated.ts'
import { NummernSchema } from '../ui/NummernSchema.tsx'
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
  // Das Beispiel aus den Stammdaten aufloesen, damit unter dem Schema ein echter
  // Artikel steht und nicht ein ausgedachter.
  const beispielArtikel = artikel.find((a) => a.artikelnummer === artikelnummerLogik.beispiel)

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
          <NummernSchema
            nummer={artikelnummerLogik.beispiel}
            bezeichnung={beispielArtikel?.bezeichnung}
          />
          <p className={styles.hinweis}>
            Beim Duplizieren zählt die Anwendung die laufende Nummer im selben Nummernkreis hoch und
            nimmt die nächste freie — die drei Klassifikationsblöcke bleiben unangetastet.
          </p>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>2 · Die vier Reiter — was steht wo?</h3>
          <p>
            Die Verwaltung hat vier Datenreiter. Sie hängen zusammen wie Bauplan, Preisliste,
            Musterkoffer und Adressbuch: Der <strong>Artikelstamm</strong> sagt, <em>was es gibt</em>,
            das <strong>Preisblatt</strong>, <em>was es kostet</em>, die <strong>Oberflächen</strong>,{' '}
            <em>wie es aussieht</em>, und <strong>Berater &amp; Filialen</strong>, <em>wer damit
            arbeitet</em>.
          </p>

          <h4 className={styles.h3}>Artikelstamm — der Bauplan</h4>
          <p>
            Eine Zeile je Artikel. Enthält <strong>keine Preise</strong> — nur, was der Artikel ist
            und wie er sich verhält.
          </p>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Spalte</th>
                <th>Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className={styles.mono}>Artikelnummer</td><td>Der Schlüssel. Unveränderlich — siehe Abschnitt 1.</td></tr>
              <tr><td className={styles.mono}>Kurzzeichen</td><td>Lesehilfe wie „DRT-001". Ausdrücklich <strong>kein</strong> Schlüssel, darf sich ändern.</td></tr>
              <tr><td className={styles.mono}>Bezeichnung</td><td>Was der Berater im Dropdown liest.</td></tr>
              <tr><td className={styles.mono}>Bezeichnung 2</td><td>Oberbegriff für die Gruppierung in Listen und im AV-PDF.</td></tr>
              <tr><td className={styles.mono}>Teileart</td><td>Block 1 der Nummer — Sicht von Einkauf und Fertigung.</td></tr>
              <tr><td className={styles.mono}>Produktgruppe</td><td>Block 2 — legt den Schritt im Konfigurator fest.</td></tr>
              <tr><td className={styles.mono}>Artikelgruppe</td><td>Block 3 — <strong>die wichtigste Angabe</strong>. Sie entscheidet, in welchem Dropdown der Artikel auftaucht.</td></tr>
              <tr><td className={styles.mono}>Modus</td><td>Für welche Serien freigegeben. GROSS = Standard, klein = Sonderanfertigung (Abschnitt 4).</td></tr>
              <tr><td className={styles.mono}>Preislogik</td><td>Wie der Preis entsteht: fester Stückpreis, Matrix, Aufpreis oder Prozentzuschlag.</td></tr>
              <tr><td className={styles.mono}>Einheit</td><td>Stück, lfm, m², %. Bestimmt, womit die Menge multipliziert wird.</td></tr>
              <tr><td className={styles.mono}>Achsen · Achse 1–5</td><td>Was die Spalten A1–A5 der Preiszeilen bei <em>diesem</em> Artikel bedeuten (Abschnitt 6).</td></tr>
              <tr><td className={styles.mono}>Preiszellen</td><td>Wie viele Preiswerte laut Grundstand zu erwarten sind — Kontrollzahl gegen Lücken.</td></tr>
              <tr><td className={styles.mono}>Oberfläche</td><td>J/N: Braucht der Artikel eine Material- bzw. Farbwahl?</td></tr>
              <tr><td className={styles.mono}>Status</td><td>Nur <code>aktiv</code> erscheint im Konfigurator. <code>gesperrt</code> ist das Mittel der Wahl statt Löschen.</td></tr>
              <tr><td className={styles.mono}>Sortierung</td><td>Reihenfolge im Dropdown — bewusst getrennt von der Artikelnummer.</td></tr>
              <tr><td className={styles.mono}>Quelle · Bemerkung</td><td>Seite der gedruckten Preisliste und Notizen zur Herkunft.</td></tr>
            </tbody>
          </table>

          <h4 className={styles.h3}>Preisblatt &amp; Achsen — die Preisliste</h4>
          <p>
            Viele Zeilen je Artikel, eine je Preisvariante. <strong>Eine Preisvariante ist kein
            eigener Artikel.</strong> Eine Drehtür bleibt eine Drehtür, ob 50 cm oder 100 cm breit —
            unterschiedlich ist nur die Zeile, in der ihr Preis steht.
          </p>
          <p>
            Welche Zeile gilt, entscheiden bis zu fünf <strong>Achsen</strong>: die Dimensionen, in
            denen der Preis variiert. Die Achsen stehen im Artikelstamm, ihre Werte in den Spalten
            A1–A5 der Preiszeile.
          </p>
          <pre className={styles.schema}>
            {`Artikel 20-20-05-0001 "Drehtür"      Achsen: BREITE × RASTER × LINIE_PG

   A1 Breite     A2 Raster     A3 Linie+PG     →   Preis
   ──────────    ──────────    ───────────         ────────
   T60-230       18            Glatt2              348,00 €
   T60-230       21            Glatt2              402,00 €
   T100-230      18            Glatt2              487,00 €`}
          </pre>
          <p>
            Das ist die Matrix: Jede Kombination der Achsenwerte ist ein Feld mit genau einem Preis.
            Gesucht wird über die <strong>Artikelnummer plus die Achsenwerte</strong> aus der
            Konfiguration. Trifft keine Zeile exakt, greift bei Maßen die Regel „nächstgrößeres
            Bracket". Darüber hinaus entsteht bewusst <strong>keine Schätzung</strong>, sondern eine
            Position „auf Anfrage" für die Arbeitsvorbereitung.
          </p>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Spalte</th>
                <th>Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className={styles.mono}>Artikel</td><td>Verweis auf die Artikelnummer im Stamm.</td></tr>
              <tr><td className={styles.mono}>A1 – A5</td><td>Die Achsenwerte. Ihre Bedeutung steht beim Artikel, nicht hier.</td></tr>
              <tr><td className={styles.mono}>Preis</td><td>VK in Euro, inkl. 19 % MwSt.</td></tr>
              <tr><td className={styles.mono}>Status</td><td><code>fixed</code> = gültiger Preis. <code>on-request</code> = bewusst ohne Preis, die AV entscheidet.</td></tr>
              <tr><td className={styles.mono}>Seite · Ref</td><td>Fundstelle in der gedruckten Preisliste — macht jeden Betrag nachprüfbar.</td></tr>
            </tbody>
          </table>

          <h4 className={styles.h3}>Oberflächen — Musterkoffer in zwei Ebenen</h4>
          <p>Zwei Ebenen in einem Reiter, und die Reihenfolge ist entscheidend:</p>
          <pre className={styles.schema}>
            {`Kategorie "Mattlack"          trägt die Preisgruppe  →  PG 2
   ├── Verkehrsweiß RAL 9016     erbt PG 2
   ├── Schwarzgrau RAL 7021      erbt PG 2
   └── …

Kategorie "Furnier"           trägt die Preisgruppe  →  PG 3
   ├── Eiche geölt               erbt PG 3
   └── Wengé                     eigene PG 4  (Ausnahme schlägt Kategorie)`}
          </pre>
          <p>
            In die Preisfindung geht <strong>nie die Farbe</strong> ein, sondern nur ihre
            Preisgruppe. Deshalb braucht eine neue Farbe <strong>keine</strong> neue Preiszeile: Sie
            wird als Datensatz angelegt, erbt die Preisgruppe ihrer Kategorie und steht sofort in den
            Material-Dropdowns von Korpus und Fronten. Nur echte Ausreißer bekommen eine eigene
            Preisgruppe.
          </p>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Spalte</th>
                <th>Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className={styles.mono}>Kategorie</td><td>Zu welcher Materialgruppe die Farbe gehört.</td></tr>
              <tr><td className={styles.mono}>Preisgruppe</td><td>Auf Kategorie-Ebene: gilt für alle Farben darin. Auf Farb-Ebene: Ausnahme.</td></tr>
              <tr><td className={styles.mono}>Standardauswahl</td><td>Was vorausgewählt ist, sobald der Berater die Kategorie wählt.</td></tr>
              <tr><td className={styles.mono}>Freitextfeld</td><td>Öffnet ein Eingabefeld — für RAL-/NCS-Sonderfarben ohne feste Liste.</td></tr>
              <tr><td className={styles.mono}>Sortierung · Status</td><td>Reihenfolge im Dropdown; gesperrte Farben verschwinden aus der Auswahl.</td></tr>
            </tbody>
          </table>

          <h4 className={styles.h3}>Berater &amp; Filialen — wer damit arbeitet</h4>
          <p>
            Der Reiter <strong>Berater</strong> führt die Mitarbeiter aus Blatt „40 Mitarbeiter":
            Personalnummer (die Identität), Name, E-Mail, Rolle (<code>berater</code> oder{' '}
            <code>admin</code>), Stamm-Filiale, Status und Bemerkung. Die Stamm-Filiale ist eine{' '}
            <strong>Vorbelegung, keine Sperre</strong> — bei einer Urlaubsvertretung bleibt das Feld
            im Entwurf frei änderbar.
          </p>
          <p>
            Der Zugang wird getrennt davon vergeben: Ein Mitarbeiter steht im Stamm, kann sich aber
            erst anmelden, wenn ein Administrator ihm ein Passwort gesetzt hat. Ein Status ungleich{' '}
            <code>aktiv</code> sperrt die Anmeldung, auch wenn ein Passwort hinterlegt ist.
          </p>
          <p>
            Der Reiter <strong>Filialen</strong> führt die Verkaufshäuser mit Filialnummer, Name,
            Anschrift, Telefon, E-Mail und Status. Die <code>Alt-ID</code> verbindet den Datensatz mit
            der bisherigen Nummerierung, damit alte Vorgänge zuordenbar bleiben.
          </p>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>3 · Wie ein Dropdown entsteht</h3>
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
          <h3 className={styles.h2}>4 · Der Modus — Serien-Freigabe</h3>
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
          <h3 className={styles.h2}>5 · Materialien und Preisgruppen</h3>
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
            Die Farbmatrix wird im Reiter <strong>Oberflächen</strong> gepflegt — zwei Ebenen:
            die <em>Kategorie</em> (Mattlack, Decoboard, Gläser …) trägt die Preisgruppe, die
            einzelne <em>Oberfläche</em> (Verkehrsweiß RAL 9016 …) verweist auf ihre Kategorie und
            erbt deren Preisgruppe. Eine neue Farbe ist damit ein Datensatz, keine Code-Änderung:
            sie steht sofort in den Material-Dropdowns von Korpus und Fronten. Nur wenn eine
            einzelne Farbe teurer ist als ihre Gruppe (Beispiel Wengé), trägt sie eine eigene
            Preisgruppe. Grundstand ist <code>data/farbmatrix.ts</code>; „Zurücksetzen" stellt ihn wieder her.
          </p>
        </section>

        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>6 · Achsen A1–A5</h3>
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
          <h3 className={styles.h2}>7 · Checkliste: neuen Artikel anlegen</h3>
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
          <h3 className={styles.h2}>8 · Wertelisten</h3>
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
          <h3 className={styles.h2}>9 · Excel-Runde</h3>
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
