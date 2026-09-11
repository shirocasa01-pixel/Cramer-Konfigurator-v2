import { artikel, artikelnummerLogik, dropdowns, serien, teilearten } from '../../data/stammdaten.generated.ts'
import { NummernSchema } from '../ui/NummernSchema.tsx'
import styles from './Handbuch.module.css'

/**
 * HANDBUCH — die Pflegeregeln dort, wo gepflegt wird.
 *
 * Der Inhalt ist bewusst kein allgemeiner Hilfetext, sondern beantwortet die eine Frage,
 * an der die Datenpflege scheitert: **Was muss ich eintragen, damit der Konfigurator
 * meinen neuen Artikel als Option anbietet?**
 *
 * Die Tabellen ziehen ihre Werte aus den Stammdaten — kommt eine Serie oder ein Dropdown
 * dazu, steht es auch hier, ohne dass jemand den Text nachpflegt.
 */

export function Handbuch() {
  // Beispiele aus dem echten Bestand auflösen, damit unter dem Schema kein
  // ausgedachter Artikel steht.
  const beispielArtikel = artikel.find((a) => a.artikelnummer === artikelnummerLogik.beispiel)
  const ledBeispiel = artikel.find((a) => a.artikelnummer === '50-024-0006')
  const leuchtenDropdown = dropdowns.find((d) => d.code === 'LEUCHTE')
  const naechsteDropdownNr = String(dropdowns.length + 1).padStart(3, '0')

  return (
    <div className={styles.wurzel}>
      <article className={styles.blatt}>
        <h2 className={styles.h1}>Stammdatenverwaltung — Handbuch</h2>
        <p className={styles.lead}>
          Der Konfigurator hat keine eingebaute Artikelliste. Was ein Berater auswählen kann, ergibt
          sich vollständig aus diesen Stammdaten. Ein Artikel taucht genau dann als Option auf, wenn
          vier Angaben stimmen — Dropdown, Modus, Status und eine passende Preiszeile.
        </p>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>1 · Die Artikelnummer</h3>
          <p>
            Sie ist der Schlüssel und wird <strong>nie geändert</strong>. Ändert sich später die
            Einordnung, wird ein neuer Artikel angelegt und der alte auf <code>gesperrt</code>{' '}
            gesetzt — eine korrigierte Nummer bräche die Verweise aus dem Preisblatt und aus
            gespeicherten Entwürfen.
          </p>
          <NummernSchema
            nummer={artikelnummerLogik.beispiel}
            bezeichnung={beispielArtikel?.bezeichnung}
          />
          <p>
            Gelesen wird sie von links nach rechts, von grob nach fein:{' '}
            <em>Schritt Frontausstattung, Auswahlfeld Griff, elfter Artikel darin.</em> Drei Blöcke,
            neun Ziffern, zwei Trennstriche.
          </p>
          <p className={styles.hinweis}>
            Beim Duplizieren zählt die Anwendung die laufende Nummer im selben Nummernkreis hoch und
            nimmt die nächste freie — die beiden Klassifikationsblöcke bleiben unangetastet.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>2 · Was sich gegenüber früher geändert hat</h3>
          <p>
            Bis September 2026 hatte die Nummer <strong>vier</strong> Blöcke:{' '}
            <code>TT-PP-GG-NNNN</code>, mit einer eigenen „Teileart" (STRUKTUR, BESCHLAG, …) vor der
            Produktgruppe. Zwei Dinge daran waren Ballast:
          </p>
          <ol className={styles.liste}>
            <li>
              <strong>Der erste Block war redundant.</strong> Die alte Teileart war innerhalb jedes
              Auswahlfeldes immer dieselbe — geprüft, 38 von 38. Wer das Dropdown kannte, kannte die
              Teileart. Der Block trug keine Information, die nicht schon woanders stand, kostete
              aber Verwirrung: Zwei Blöcke hießen fast gleich und meinten Verschiedenes.
            </li>
            <li>
              <strong>Die Auswahlfeld-Nummer war nicht eindeutig.</strong> Sie zählte je
              Produktgruppe neu. <code>05</code> stand deshalb für neun verschiedene Dinge — Korpus,
              Drehtür, Griff, Boden, Sockelplatte, Leuchte, Tischplatte, Zuschlag, Porticus-Modell.
              Erst zusammen mit dem zweiten Block war sie eindeutig.
            </li>
          </ol>
          <p>
            Seitdem heißt die frühere <em>Produktgruppe</em> <strong>Teileart</strong>, die frühere{' '}
            <em>Artikelgruppe</em> heißt <strong>Dropdown</strong> und trägt eine systemweit
            eindeutige dreistellige Nummer. <code>001</code> ist überall im System der Korpus,
            nirgends sonst.
          </p>
          <pre className={styles.schema}>
            {`ALT   30-30-05-0011     Teileart · Produktgruppe · Artikelgruppe · Laufnummer
NEU      30-012-0011     Teileart · Dropdown · Laufnummer`}
          </pre>
          <p className={styles.hinweis}>
            Die Mappe <code>Cramer-Stammdaten.xlsx</code> führt intern weiterhin das alte Schema —
            die Umrechnung passiert beim Einlesen an genau einer Stelle
            (<code>scripts/lib/nummern-migration.js</code>). Jedes Dropdown trägt deshalb auch
            seinen alten Nummernkreis mit, damit Altbestände zuordenbar bleiben.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>3 · Steuert die Nummer oder das Dropdown?</h3>
          <p>
            Die häufigste Rückfrage — und die Antwort ist zweigeteilt, weil zwei verschiedene Dinge
            gesteuert werden:
          </p>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Frage</th>
                <th>Entscheidet</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Was kostet das?</strong>
                </td>
                <td>
                  Die <strong>Artikelnummer</strong>. Die Preis-Engine schlägt ausschließlich über
                  sie nach.
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Wo taucht es auf?</strong>
                </td>
                <td>
                  Das <strong>Dropdown</strong> (und über dessen Teileart der Schritt).
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Konkret: In <code>config/preisMapping.ts</code> ist jedes Bauteil des Konfigurators fest
            auf eine Artikelnummer abgebildet — „Drehtür" heißt dort{' '}
            <code className={styles.mono}>20-006-0001</code>. Die Suche in{' '}
            <code>lib/preisLookup.ts</code> nimmt diese Nummer plus die Achsenwerte. Teileart und
            Dropdown kommen in der gesamten Preiskette <strong>nicht vor</strong>; sie werden nur in
            die Positionsliste kopiert, damit man in der Kalkulation sieht, woher ein Betrag stammt.
          </p>
          <p className={styles.hinweis}>
            Praktische Folge: Ändert jemand das Dropdown eines Artikels, wandert er in ein anderes
            Auswahlfeld — der Preis bleibt. Ändert jemand die Artikelnummer, brechen alle
            Preiszeilen <strong>und</strong> jeder gespeicherte Entwurf, der darauf verweist. Genau
            deshalb ist die Nummer unveränderlich.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>4 · Die Reiter — was steht wo?</h3>
          <p>
            Die Verwaltung hat fünf Datenreiter. Sie hängen zusammen wie Bauplan, Preisliste,
            Musterkoffer und Adressbuch: Der <strong>Artikelstamm</strong> sagt, <em>was es gibt</em>,
            das <strong>Preisblatt</strong>, <em>was es kostet</em>, die <strong>Oberflächen</strong>,{' '}
            <em>wie es aussieht</em>, <strong>Berater</strong> und <strong>Filialen</strong>,{' '}
            <em>wer damit arbeitet</em>.
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
              <tr><td className={styles.mono}>Teileart</td><td>Block 1 — der Hauptschritt im Konfigurator.</td></tr>
              <tr><td className={styles.mono}>Dropdown</td><td>Block 2 — <strong>die wichtigste Angabe</strong>. Sie entscheidet, in welchem Auswahlfeld der Artikel auftaucht.</td></tr>
              <tr><td className={styles.mono}>Modus</td><td>Für welche Serien freigegeben. GROSS = Standard, klein = Sonderanfertigung (Abschnitt 6).</td></tr>
              <tr><td className={styles.mono}>Preislogik</td><td>Wie der Preis entsteht: fester Stückpreis, Matrix, Aufpreis oder Prozentzuschlag.</td></tr>
              <tr><td className={styles.mono}>Einheit</td><td>Stück, lfm, m², %. Bestimmt, womit die Menge multipliziert wird.</td></tr>
              <tr><td className={styles.mono}>Achsen · Achse 1–5</td><td>Was die Spalten A1–A5 der Preiszeilen bei <em>diesem</em> Artikel bedeuten (Abschnitt 7).</td></tr>
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
            Preisgruppe. Deshalb braucht eine neue Farbe <strong>keine</strong> neue Preiszeile.
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

          <h4 className={styles.h3}>Berater — wer sich anmelden darf</h4>
          <p>
            Die Mitarbeiter aus Blatt „40 Mitarbeiter": Personalnummer (die Identität), Name,
            E-Mail, Rolle (<code>berater</code> oder <code>admin</code>), Stamm-Filiale, Status und
            Bemerkung. Die Stamm-Filiale ist eine <strong>Vorbelegung, keine Sperre</strong> — bei
            einer Urlaubsvertretung bleibt das Feld im Entwurf frei änderbar.
          </p>
          <p>
            Der Zugang wird getrennt davon vergeben: Ein Mitarbeiter steht im Stamm, kann sich aber
            erst anmelden, wenn ein Administrator ihm ein Passwort gesetzt hat. Ein Status ungleich{' '}
            <code>aktiv</code> sperrt die Anmeldung, auch wenn ein Passwort hinterlegt ist.
          </p>

          <h4 className={styles.h3}>Filialen — die Verkaufshäuser</h4>
          <p>
            Filialnummer, Name, Anschrift, Telefon, E-Mail und Status. Die <code>Alt-ID</code>{' '}
            verbindet den Datensatz mit der bisherigen Nummerierung, damit alte Vorgänge zuordenbar
            bleiben. Gesperrte Filialen verschwinden aus dem Dropdown im Entwurf.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>5 · Wie ein Dropdown entsteht</h3>
          <p>Die Regel steht im Blatt „00 Anleitung" der Mappe und ist im Code genau so umgesetzt:</p>
          <pre className={styles.schema}>
            {`Teileart = ein Schritt im Konfigurator
  └── Dropdown = ein Auswahlfeld in diesem Schritt
        └── Artikel = die Einträge, gefiltert über Modus und Status`}
          </pre>
          <p>
            Ein Dropdown ist also keine Liste im Code, sondern eine Abfrage: „alle Artikel mit
            Dropdown X, deren Modus die gewählte Serie enthält und deren Status <code>aktiv</code>{' '}
            ist". Enthält die Abfrage kein Ergebnis, verschwindet das Auswahlfeld ganz — deshalb
            sieht ein Refugium-Berater keine Abdeckplatten-Auswahl.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>6 · Der Modus — Serien-Freigabe</h3>
          <p>
            Im Feld <code>Modus</code> steht, für welche Serien ein Artikel freigegeben ist.
            Groß = Standard, klein = Sonderanfertigung (Preis auf Anfrage).
          </p>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Kürzel</th>
                <th>Serie</th>
              </tr>
            </thead>
            <tbody>
              {serien.map((s) => (
                <tr key={s.code}>
                  <td className={styles.mono}>{s.code}</td>
                  <td>{s.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.hinweis}>
            Ohne den passenden Buchstaben taucht der Artikel bei dieser Serie nirgends auf — das ist
            die häufigste Ursache für „mein neuer Artikel erscheint nicht".
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>7 · Achsen A1–A5</h3>
          <p>
            Ein Artikel ist ein Artikel — seine Preisvarianten sind Achsen, keine eigenen Artikel.
            Die Achsen des Artikels legen fest, was die Spalten A1–A5 seiner Preiszeilen bedeuten.
            Dieselbe Spalte heißt bei einem anderen Artikel etwas anderes.
          </p>
          <pre className={styles.schema}>
            {`20-006-0001  Drehtür     Achsen: BREITE × RASTER × LINIE_PG

   A1 Breite     A2 Raster     A3 Linie+PG      →   Preis
   ──────────    ──────────    ───────────          ────────
   T60-230       18            Glatt2               348,00 €
   T60-230       21            Glatt2               402,00 €
   T100-230      18            Glatt2               487,00 €

10-003-0001  Aussenset   Achsen: BREITE × PG
   A1 = 18R          A2 = PG2                       →  359,00 €`}
          </pre>
          <p>
            Das ist die Matrix: Jede Kombination der Achsenwerte ist ein Feld mit genau einem Preis.
            Beim Suchen gilt die Regel „Preis des nächstgrößeren Maßes" — eine Breite von 70 cm nimmt
            das 100er-Bracket, wenn es kein 70er gibt. Liegt die Anforderung über dem größten
            bepreisten Wert, entsteht bewusst <strong>keine</strong> Schätzung, sondern eine Position
            „auf Anfrage" für die Arbeitsvorbereitung.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>8 · Schritt für Schritt: neue LED-Leiste anlegen</h3>
          <p>
            Angenommen, Cramer nimmt eine neue LED-Leiste ins Sortiment, die wie{' '}
            {ledBeispiel ? (
              <>
                <code className={styles.mono}>{ledBeispiel.artikelnummer}</code> („
                {ledBeispiel.bezeichnung}")
              </>
            ) : (
              'die bestehenden LED-Bänder'
            )}{' '}
            nach Breite bepreist wird.
          </p>
          <ol className={styles.liste}>
            <li>
              <strong>Dropdown bestimmen.</strong> Leuchten liegen im Auswahlfeld{' '}
              <code className={styles.mono}>{leuchtenDropdown?.nr ?? '024'}</code>{' '}
              {leuchtenDropdown?.bezeichnung ?? 'Leuchte'} (Teileart{' '}
              <code>{leuchtenDropdown?.teileart ?? 'TECHNIK'}</code>). Damit steht der Nummernkreis
              fest: <code className={styles.mono}>{leuchtenDropdown?.nummernkreis ?? '50-024-'}</code>
            </li>
            <li>
              <strong>Artikel anlegen.</strong> Im Reiter Artikelstamm auf „+ Neuer Artikel". Die
              nächste freie laufende Nummer im Kreis vergeben. Teileart und Dropdown wie eben
              bestimmt setzen.
            </li>
            <li>
              <strong>Modus setzen.</strong> Für welche Serien gilt die Leiste? Nur Refugium ⇒{' '}
              <code>R</code>. Auch Atrium und Velare ⇒ <code>AVR</code>. Ohne Buchstaben erscheint
              sie nirgends.
            </li>
            <li>
              <strong>Status auf <code>aktiv</code></strong> — <code>entwurf</code> und{' '}
              <code>gesperrt</code> werden im Konfigurator ausgeblendet.
            </li>
            <li>
              <strong>Achsen festlegen.</strong> Bepreisung nach Breite ⇒ Achse 1 ={' '}
              <code>BREITE</code>. Ein Festpreis ohne Varianten ⇒ gar keine Achse.
            </li>
            <li>
              <strong>Preiszeilen anlegen</strong>, im selben Fenster unter „Preise &amp; Achsen".
              Je Breitenklasse eine Zeile mit ihrem Preis. Ohne passende Preiszeile ist der Artikel
              zwar wählbar, erscheint in der Kalkulation aber als „auf Anfrage".
            </li>
            <li>
              <strong>Speichern</strong> — erst im Fenster, dann oben im Kopf über den
              Speichern-Knopf. Der Artikel steht sofort im Auswahlfeld.
            </li>
          </ol>
          <p className={styles.hinweis}>
            Braucht die Leiste ein <em>eigenes</em> Auswahlfeld statt eines bestehenden, bekommt sie
            das nächste freie Dropdown — aktuell wäre das{' '}
            <code className={styles.mono}>{naechsteDropdownNr}</code>. Dropdown-Nummern sind
            systemweit fortlaufend, unabhängig von der Teileart.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>9 · Schritt für Schritt: neue Mattlack-Farbe anlegen</h3>
          <p>
            Eine Farbe ist <strong>kein Artikel</strong>. Das ist der häufigste Irrtum — und der
            Grund, warum eine neue Farbe so wenig Aufwand macht.
          </p>
          <ol className={styles.liste}>
            <li>
              Reiter <strong>Oberflächen</strong> öffnen. Die Kategorie <em>Mattlack</em> suchen —
              sie trägt bereits die Preisgruppe (PG 2).
            </li>
            <li>
              Neue Oberfläche in dieser Kategorie anlegen: ID, Bezeichnung (z. B. „Achatgrau RAL
              7038"), Sortierung, Status <code>aktiv</code>.
            </li>
            <li>
              <strong>Preisgruppe leer lassen.</strong> Die Farbe erbt PG 2 von ihrer Kategorie. Nur
              wenn sie teurer ist als ihre Gruppe — wie Wengé — trägt sie eine eigene Preisgruppe
              ein.
            </li>
            <li>
              Fertig. <strong>Keine Preiszeile nötig.</strong> Die Farbe steht sofort in den
              Material-Dropdowns von Korpus und Fronten und geht über ihre Preisgruppe in die
              Berechnung ein.
            </li>
          </ol>
          <p className={styles.hinweis}>
            Zum Vergleich: Ein neuer <em>Griff</em> ist ein Artikel und braucht Nummer, Modus, Status
            und Preiszeile. Eine neue <em>Farbe</em> ist ein Katalogeintrag und braucht nur die
            richtige Kategorie. Der Unterschied: Ein Griff hat einen eigenen Preis, eine Farbe
            verschiebt nur die Preisgruppe des Bauteils, an dem sie hängt.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>10 · Wertelisten</h3>
          <div className={styles.zweiSpalten}>
            <div>
              <h4 className={styles.h3}>Teilearten · Schritte</h4>
              <table className={styles.tabelle}>
                <tbody>
                  {teilearten.map((t) => (
                    <tr key={t.code}>
                      <td className={styles.mono}>{t.nr}</td>
                      <td>{t.code}</td>
                      <td className={styles.leise}>{t.schritt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className={styles.h3}>Dropdowns ({dropdowns.length})</h4>
              <table className={styles.tabelle}>
                <tbody>
                  {dropdowns.map((d) => (
                    <tr key={d.code}>
                      <td className={styles.mono}>{d.nr}</td>
                      <td>{d.bezeichnung}</td>
                      <td className={styles.leise}>{d.teileart}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>11 · Excel-Runde</h3>
          <p>
            <strong>Exportieren</strong> schreibt den aktuell gefilterten Stand als echte{' '}
            <code>.xlsx</code> — ein Blatt je Reiter, mit den Spaltennamen der neuen Nomenklatur
            (<code>Teileart</code>, <code>Dropdown</code>). <strong>Importieren</strong> liest eine
            solche Datei wieder ein; zugeordnet wird über die Spaltenüberschriften, nicht über die
            Position — eine verschobene Spalte bricht also nichts.
          </p>
          <p className={styles.hinweis}>
            Ältere Exporte mit den Spalten <code>Produktgruppe</code> und <code>Artikelgruppe</code>{' '}
            werden weiterhin gelesen und automatisch auf die neuen Felder abgebildet. Änderungen
            liegen im Browser-Speicher dieses Geräts, nicht in der Mappe auf der Platte; über „Auf
            Excel-Stand zurücksetzen" ist jederzeit der Ausgangszustand erreichbar.
          </p>
        </section>
      </article>
    </div>
  )
}
