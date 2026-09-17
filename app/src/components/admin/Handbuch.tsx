import {
  achsen,
  artikel,
  artikelnummerLogik,
  dropdowns,
  preislogiken,
  serien,
  teilearten,
} from '../../data/stammdaten.generated.ts'
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
          <h3 className={styles.h2}>2 · Steuert die Nummer oder das Dropdown?</h3>
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
          <h3 className={styles.h2}>3 · Die Reiter — was steht wo?</h3>
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
              <tr><td className={styles.mono}>Modus</td><td>Für welche Serien freigegeben. GROSS = Standard, klein = Sonderanfertigung (Abschnitt 7).</td></tr>
              <tr><td className={styles.mono}>Preislogik</td><td>Wie der Preis entsteht — es gibt nur noch drei Werte: Festpreis, Matrix, auf Anfrage (Abschnitt 7a).</td></tr>
              <tr><td className={styles.mono}>Einheit</td><td>Stück, lfm, m², %. Bestimmt, womit die Menge multipliziert wird.</td></tr>
              <tr><td className={styles.mono}>Achsen · Achse 1–5</td><td>Was die Spalten A1–A5 der Preiszeilen bei <em>diesem</em> Artikel bedeuten (Abschnitt 8).</td></tr>
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
            Filialnummer, Name, Anschrift, Telefon, E-Mail und Status. Die <code>Alt-ID</code> trägt die
            Kennung, unter der die Filiale in den Cramer-Systemen geführt wird — sie hält Vorgänge
            über Systemgrenzen hinweg zuordenbar. Gesperrte Filialen verschwinden aus dem Dropdown im Entwurf.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>4 · Datensätze bearbeiten — der Doppelklick</h3>
          <p>
            In den Tabellen wird <strong>nicht direkt getippt</strong>. Ein{' '}
            <strong>Doppelklick auf eine beliebige Zeile</strong> öffnet das Bearbeitungs-Fenster;
            dort liegt der Datensatz vollständig und in Ruhe vor. Das ist Absicht: In einer Tabelle
            mit 1.509 Preiszeilen wäre ein versehentlicher Tastendruck sonst eine stille
            Datenänderung, die niemandem auffällt.
          </p>
          <p>Welcher Reiter welches Fenster öffnet:</p>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Doppelklick im Reiter</th>
                <th>öffnet</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Artikelstamm</td>
                <td>Artikel-Fenster, startet bei <strong>Allgemein</strong></td>
              </tr>
              <tr>
                <td>Preisblatt &amp; Achsen</td>
                <td>
                  Dasselbe Artikel-Fenster, springt aber direkt auf{' '}
                  <strong>Preise &amp; Achsen</strong> — man landet dort, wo man hinwollte
                </td>
              </tr>
              <tr>
                <td>Oberflächen</td>
                <td>Kategorie- oder Farb-Fenster, je nachdem, welche Zeilenart getroffen wurde</td>
              </tr>
              <tr>
                <td>Berater</td>
                <td>Berater-Fenster inklusive Zugangsverwaltung</td>
              </tr>
              <tr>
                <td>Filialen</td>
                <td>Filial-Fenster</td>
              </tr>
            </tbody>
          </table>

          <h4 className={styles.h3}>Das Artikel-Fenster hat drei Reiter</h4>
          <p>
            Nur der Artikel ist umfangreich genug für eine Aufteilung. Oberflächen, Berater und
            Filialen öffnen ein einzelnes Formular ohne Unterreiter — dort steht alles auf einen
            Blick.
          </p>

          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Reiter</th>
                <th>Felder</th>
                <th>Wirkung im Konfigurator</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Allgemein</strong></td>
                <td>
                  Artikelnummer, Kurzzeichen, Bezeichnung 1 und 2, Einheit, „Oberfläche relevant",
                  Quelle, Preiszellen, Bemerkung
                </td>
                <td>
                  <strong>Bezeichnung 1</strong> ist der Text, den der Berater im Auswahlfeld liest.{' '}
                  <strong>Einheit</strong> bestimmt, womit die Menge multipliziert wird (Stück, lfm,
                  m², %). <strong>Oberfläche relevant</strong> schaltet die Material- und Farbwahl für
                  diesen Artikel frei. Die <strong>Artikelnummer</strong> ist nur beim Anlegen
                  beschreibbar.
                </td>
              </tr>
              <tr>
                <td><strong>Klassifikation &amp; Status</strong></td>
                <td>Teileart, Dropdown, Preislogik, Status, Sortierung, Modus (Serien-Freigabe)</td>
                <td>
                  Hier entscheidet sich <strong>ob und wo</strong> der Artikel überhaupt erscheint.
                  Das <strong>Dropdown</strong> bestimmt das Auswahlfeld, der <strong>Modus</strong>{' '}
                  die Serien — die Serien lassen sich anklicken statt tippen, das Fenster zeigt
                  darunter, welche es erkannt hat. <strong>Status</strong> auf <code>gesperrt</code>{' '}
                  nimmt den Artikel sofort aus allen Auswahlfeldern, ohne ihn zu löschen.{' '}
                  <strong>Sortierung</strong> verschiebt ihn nur in der Liste.
                </td>
              </tr>
              <tr>
                <td><strong>Preise &amp; Achsen</strong></td>
                <td>
                  Achsen A1–A5 des Artikels sowie alle seine Preiszeilen — anlegen, ändern, entfernen
                </td>
                <td>
                  Die <strong>Achsen</strong> legen fest, was die Spalten A1–A5 bei diesem Artikel
                  bedeuten. Die <strong>Preiszeilen</strong> sind die Matrix darunter: je Kombination
                  von Achsenwerten ein Preis. Fehlt eine passende Zeile, bleibt der Artikel wählbar,
                  erscheint in der Kalkulation aber als „auf Anfrage".
                </td>
              </tr>
            </tbody>
          </table>

          <h4 className={styles.h3}>Zweistufiges Speichern</h4>
          <p>
            Das Fenster übernimmt nur in den <strong>Bearbeitungsstand</strong>. Verbindlich wird
            eine Änderung erst über den <strong>Speichern-Knopf oben im Kopf</strong> — er gilt für
            alle Reiter gemeinsam und ist die einzige Stelle mit Rückfrage. Bis dahin zeigt der
            Zähler im Kopf, wie viele Änderungen ausstehen; ein Klick darauf listet sie feldweise
            auf (<span className={styles.mono}>preis: 372 → 410</span>) und springt auf Wunsch zur
            betroffenen Zeile. „Abbrechen" im Fenster verwirft alles, was dort geändert wurde.
          </p>

          <h4 className={styles.h3}>Beispiel 1 — Preis eines Artikels anpassen</h4>
          <ol className={styles.liste}>
            <li>
              Reiter <strong>Preisblatt &amp; Achsen</strong> öffnen und die betroffene Zeile suchen
              — am schnellsten über das Suchfeld mit der Artikelnummer.
            </li>
            <li>
              <strong>Doppelklick</strong> auf die Zeile. Das Artikel-Fenster öffnet direkt im Reiter
              „Preise &amp; Achsen"; die Preiszeilen des Artikels stehen untereinander.
            </li>
            <li>
              Im Preisfeld den neuen Betrag eintragen. Deutsche Schreibweise: Komma trennt die Cent.
            </li>
            <li>
              <strong>Änderungen speichern</strong> — das Fenster schließt, der Zähler im Kopf zählt
              hoch.
            </li>
            <li>
              Oben im Kopf auf <strong>Speichern</strong>. Erst jetzt gilt der neue Preis; ab dem
              nächsten Rendern rechnet die Kalkulation damit.
            </li>
          </ol>

          <h4 className={styles.h3}>Beispiel 2 — einer Front eine andere Material-Preisgruppe geben</h4>
          <p>
            Fronten haben keine eigene Preisgruppe. Sie erben sie von dem Material, das der Berater
            wählt — deshalb wird das nicht am Artikel, sondern im Reiter{' '}
            <strong>Oberflächen</strong> gepflegt.
          </p>
          <ol className={styles.liste}>
            <li>
              Reiter <strong>Oberflächen</strong> öffnen. Die Liste zeigt zwei Ebenen: Kategorien und
              die Farben darunter.
            </li>
            <li>
              Soll die Änderung für <strong>alle</strong> Farben einer Gruppe gelten — etwa alle
              Mattlacke von PG 2 auf PG 3 —, per Doppelklick die <strong>Kategoriezeile</strong>{' '}
              öffnen und dort die Preisgruppe ändern. Alle Farben darin erben sie sofort.
            </li>
            <li>
              Soll nur <strong>eine einzelne Farbe</strong> abweichen — wie Wengé, das teurer ist als
              der Rest seiner Gruppe —, per Doppelklick die <strong>Farbzeile</strong> öffnen und dort
              die abweichende Preisgruppe eintragen. Sie schlägt die Kategorie.
            </li>
            <li>
              Speichern im Fenster, dann oben im Kopf. Die Front zieht ab sofort die neue Preisgruppe
              in die Preiszeile — <strong>ohne</strong> dass am Front-Artikel selbst etwas geändert
              werden musste.
            </li>
          </ol>
          <p className={styles.hinweis}>
            Faustregel für beide Beispiele: Am <strong>Artikel</strong> ändert man, was das Bauteil
            ist und kostet. An der <strong>Oberfläche</strong> ändert man, in welche Preisgruppe ein
            Material fällt. Wer das verwechselt, legt einen zweiten Artikel an, wo ein Katalogeintrag
            gereicht hätte.
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
            {`20-006-0001  Drehtür     Achsen: BREITE × HÖHE × LINIE+PG

   A1 Breite          A2 Höhe           A3 Linie+PG   →   Preis
   ───────────────    ──────────────    ───────────       ────────
   60 cm | 60er       230 cm | 18R      Glatt2            348,00 €
   60 cm | 60er       268,5 cm | 21R    Glatt2            402,00 €
   100 cm | 100er     230 cm | 18R      Glatt2            487,00 €

10-003-0001  Aussenset   Achsen: HÖHE × PG
   A1 = 235 cm | 18R      A2 = PG2                    →   359,00 €`}
          </pre>
          <p>
            Das ist die Matrix: Jede Kombination der Achsenwerte ist ein Feld mit genau einem Preis.
            Beim Suchen gilt die Regel „Preis des nächstgrößeren Maßes" — eine Breite von 70 cm nimmt
            die 100er-Stufe, wenn es keine 70er gibt. Liegt die Anforderung über dem größten
            bepreisten Wert, entsteht bewusst <strong>keine</strong> Schätzung, sondern eine Position
            „auf Anfrage" für die Arbeitsvorbereitung.
          </p>

          <h4 className={styles.h3}>Warum Zentimeter neben der Bezeichnung stehen</h4>
          <p>
            „18 Raster" ist keine Maßeinheit. Beim Refugium-Korpus sind das 235,0 cm, bei der
            Drehtür 230 cm — und „60er" heißt je nach Bauteil 59 cm, 59,5 cm oder 60,5 cm. Eine
            Achse, die man nur mit Zusatzwissen über den Artikel lesen kann, ist deshalb keine
            Achse, sondern eine Abkürzung.
          </p>
          <p>
            Maßachsen tragen darum <strong>zwei Angaben in einer Zelle</strong>: links den
            Zentimeter-Schwellenwert, rechts die Bezeichnung aus der gedruckten Preisliste. Gerechnet
            wird mit den Zentimetern — der einzigen Größe, die über alle Artikel dasselbe bedeutet.
            Im Fenster „Preise &amp; Achsen" ist die Zelle entsprechend geteilt: links das Feld mit
            der Einheit <code>cm</code>, rechts das Auswahlfeld für Raster bzw. „___er".
          </p>

          <h4 className={styles.h3}>Die elf Achsen</h4>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Achse</th>
                <th>Wert</th>
                <th>Verhalten</th>
              </tr>
            </thead>
            <tbody>
              {achsen.map((a) => (
                <tr key={a.code}>
                  <td className={styles.mono}>{a.code}</td>
                  <td>{a.bedeutung}</td>
                  <td>
                    {a.art === 'stufe'
                      ? 'Zentimeter + Bezeichnung; wird auf die nächstgrößere Stufe gerundet'
                      : a.art === 'mass'
                        ? 'Zentimeter; leer = benennt nur, welches Maß die Menge liefert'
                        : a.art === 'liste'
                          ? 'Text; Komma ist eine Aufzählung („PG3,PG4")'
                          : a.art === 'preisart'
                            ? 'Bezugsgröße des Betrags: Fixpreis · €/cm · €/m · €/m²'
                            : 'Text, exakt'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className={styles.abschnitt}>
          <h3 className={styles.h2}>7a · Preislogik — es gibt nur noch drei</h3>
          <p>
            Früher stand jede Rechenart als eigene Preislogik im Stamm: Satzpreis, pro laufendem
            Meter, pro Quadratmeter, Grundpreis plus Quadratmeter, drei Prozent-Varianten. Das sah
            bequem aus, war aber ein Mischsystem — was ein Betrag bedeutete, stand halb in der
            Preislogik und halb im Einheitentext („EUR/Stk zzgl. 525 EUR/m²"), und gerechnet wurde
            davon nichts.
          </p>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th>Preislogik</th>
                <th>Bedeutung</th>
              </tr>
            </thead>
            <tbody>
              {preislogiken.map((p) => (
                <tr key={p.code}>
                  <td className={styles.mono}>{p.code}</td>
                  <td>{p.bedeutung}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Alles andere ist jetzt eine <strong>Achse</strong>. Die Achse{' '}
            <code className={styles.mono}>PREISART</code> sagt, worauf sich ein Betrag bezieht, und
            die Maßachsen sagen, welches Maß die Menge liefert. Ein Artikel mit Grundpreis
            <em> und</em> Quadratmeterpreis führt deshalb schlicht zwei Preiszeilen — und die
            Kalkulation zeigt beide:
          </p>
          <pre className={styles.schema}>
            {`Wandpaneele                       Menge        Preis        Summe
   PREISART = Fixpreis            1        ×   75,00 €
   PREISART = €/m²             1,48 m²     ×  150,00 €     297,00 €`}
          </pre>
          <p>
            <strong>Prozentuale Zuschläge sind ersatzlos gestrichen.</strong> Der Konfigurator weist
            den Listenpreis aus; ob und wie viel darauf kommt, entscheidet die Verkäuferin oder der
            Verkäufer im Abschluss über den Angebotspreis — dort stehen kalkulierter Preis und
            Angebotspreis ohnehin nebeneinander. Montage und regionale Lieferung bleiben davon
            unberührt: Das sind Service-Aufschläge, ihre Sätze stehen in „50 Meta".
          </p>
          <p>
            <strong>Aufpreis-Artikel sind aufgelöst.</strong> Wo früher ein eigener Artikel nur einen
            Zuschlag trug — der Rauchglas-Aufpreis des Containers etwa —, führt der Basisartikel
            heute eine Ausführung mit vollständigem Preis. Zwei Stellen für einen Preis sind eine zu
            viel: Man findet die zweite erst, wenn sie fehlt.
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
            Änderungen liegen im Browser-Speicher dieses Geräts, nicht in der Mappe auf der Platte; über „Auf
            Excel-Stand zurücksetzen" ist jederzeit der Ausgangszustand erreichbar.
          </p>
        </section>
      </article>
    </div>
  )
}
