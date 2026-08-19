# CRAMER PLANER — Rückmeldung zur Bug- und Fixliste

**An:** Herrn Dietmann, Cramer Möbel + Design
**Von:** Entwicklungsteam CRAMER PLANER
**Stand:** 17. August 2026
**Bezug:** Ihr Dokument „Cramer Planer – Bugs und Fixes"

---

Sehr geehrter Herr Dietmann,

vielen Dank für Ihre sehr sorgfältige Durchsicht. Wir haben Ihre Liste Punkt für Punkt
gegen den aktuellen Stand des Konfigurators geprüft und melden Ihnen unten den Stand
zurück — **in genau Ihrer Gliederung nach Schritt 1 bis Schritt 7**, damit Sie sich
sofort zurechtfinden.

Dort, wo wir Ihre Angabe fachlich noch nicht eindeutig umsetzen können, finden Sie
direkt beim jeweiligen Punkt eine **Rückfrage von uns**. Am Ende des Dokuments haben
wir alle Rückfragen noch einmal gesammelt — als Agenda für unser nächstes Gespräch.

## Legende

| Kennzeichen | Bedeutung |
|---|---|
| `[GEFIXT]` | Umgesetzt und im aktuellen Stand nachprüfbar. |
| `[IN ARBEIT]` | Grundfunktion steht, aber noch nicht vollständig nach Ihrer Vorgabe. |
| `[OFFEN]` | Noch nicht umgesetzt. |
| ❓ | Rückfrage von uns an Sie. |

## Überblick

| Schritt | `[GEFIXT]` | `[IN ARBEIT]` | `[OFFEN]` |
|---|---|---|---|
| 1 — Entwurfsübersicht | 4 | 1 | — |
| 2 — Entwurf anlegen | 5 | — | — |
| 3 — Produktauswahl | ✓ | — | — |
| 4 — Korpusmaße | 6 | 5 | 2 |
| 5 — Material | 8 | 3 | 2 |
| 6 — Ausstattung | 7 | — | — |
| 7 — Fronten | 9 | 6 | 3 |

---

# Schritt 1 — Entwurfsübersicht

### 1.1 Statt „Auftrag" die Bezeichnung „Auftragsnummer" verwenden `[GEFIXT]`

Die Übersicht und die Suche sprechen durchgängig von der Auftragsnummer. Zuletzt haben
wir noch die Kopfzeile im Konfigurator angeglichen, dort stand neben der Nummer weiterhin
nur „Auftrag".

> Nur als Hinweis: Die Überschrift des Auftragsblocks in der Zusammenfassung und im
> AV-PDF heißt weiterhin „Auftrag" — dort ist es die Überschrift über mehrere Angaben
> (Auftragsnummer, Kunde, Filiale), nicht die Beschriftung der Nummer selbst. Wir haben
> sie bewusst stehen lassen; sagen Sie gern Bescheid, wenn Sie auch das geändert haben
> möchten.

### 1.2 Auch Suche nach „Artikelnummer" ermöglichen `[GEFIXT]`

Das Suchfeld durchsucht Auftragsnummer, **Artikelnummer**, Kunde, Berater und
Entwurfsnummer gleichzeitig.

### 1.3 Filter nach Berater über Dropdown `[GEFIXT]`

Über der Liste steht ein Auswahlfeld „Berater" neben dem Filialfilter. Die Auswahl wird
aus den tatsächlich vorhandenen Entwürfen gebildet.

❓ **Unsere Rückfrage:** Sie schreiben, meist wolle man nur die eigenen Aufträge sehen.
Sollen wir den Filter beim Öffnen **automatisch auf den angemeldeten Berater**
vorbelegen (mit einem Klick auf „Alle Berater" umschaltbar)? Für uns spricht viel dafür,
wir wollten es aber nicht ungefragt tun — in den Filialen schauen Kolleginnen und
Kollegen auch in fremde Vorgänge.

### 1.4 Artikel duplizieren und anpassen `[GEFIXT]`

Jede Zeile hat eine Schaltfläche „Duplizieren". Die Kopie bekommt eine neue
Entwurfsnummer, übernimmt die komplette Konfiguration und öffnet sich sofort zum
Anpassen. Auftrags- und Artikelnummer werden dabei bewusst geleert — sie gehören zum
Original.

### 1.5 Varianten als Varianten kennzeichnen `[IN ARBEIT]`

Eine duplizierte Konfiguration wird in der Übersicht automatisch mit dem Kennzeichen
**„Variante"** angezeigt und weiß, von welchem Entwurf sie abstammt.

Was noch fehlt: Der Berater kann einen Entwurf **nicht selbst** als Variante kennzeichnen
oder das Kennzeichen wieder entfernen.

❓ **Unsere Rückfrage:** Wie soll die Variante für Sie funktionieren?
1. Reicht das automatische Kennzeichen beim Duplizieren?
2. Oder brauchen Sie ein Feld, in dem der Berater die Variante **benennen** kann
   (z. B. „Variante A — Eiche geölt", „Variante B — Mattlack")?
3. Sollen zusammengehörige Varianten in der Übersicht **gruppiert** untereinander
   stehen, damit man die Angebotsalternativen zu einem Kunden auf einen Blick sieht?

---

# Schritt 2 — Entwurf anlegen

### 2.1 Feld „Artikelnummer" einfügen `[GEFIXT]`

Das Feld steht direkt unter der Auftragsnummer.

### 2.2 Auftragsnummer und Artikelnummer dürfen kein Pflichtfeld sein `[GEFIXT]`

Beide Felder sind ausdrücklich als „Optional" gekennzeichnet und halten den Berater nicht
auf. Pflicht sind nur Kunde und Filiale. Beide Nummern lassen sich jederzeit nachtragen.

### 2.3 Pflichtfeld erst vor dem Versenden an die AV `[GEFIXT]`

Wir haben Ihren Vorschlag übernommen: Auftrags- und Artikelnummer sind bei der Anlage
optional und werden **genau an einer Stelle zur Pflicht — bei „An AV senden"**. Fehlt
eine der beiden Nummern, ist die Schaltfläche gesperrt und darunter steht im Klartext,
was noch fehlt und wo es nachzutragen ist.

Wichtig: „PDF herunterladen" und „Speichern & abschließen" bleiben davon unberührt. Der
Berater kann also weiterarbeiten, drucken und speichern — nur die Übergabe an die
Arbeitsvorbereitung verlangt die vollständige Zuordnung.

❓ **Unsere Rückfrage:** Ist das die richtige Grenze? Oder sollen die Nummern auch schon
für „Speichern & abschließen" verpflichtend sein?

### 2.4 Pflichtfelder hervorheben `[GEFIXT]`

Pflichtfelder tragen einen Stern (`Kunde *`, `Ort / Filiale *`), darunter steht die
Legende „* Pflichtfeld". Optionale Felder sind ausdrücklich als „Optional" beschriftet.

### 2.5 Fehlende Pflichtfelder beim Seitenwechsel rot umranden `[GEFIXT]`

Beim Klick auf „Weiter" werden alle unausgefüllten Pflichtfelder **rot umrandet**, nicht
nur im Text erwähnt. Man sieht damit sofort, wo die Angabe fehlt.

---

# Schritt 3 — Produktauswahl

> „Perfekt gemacht! ;)"

Vielen Dank! Wir haben hier nichts verändert.

---

# Schritt 4 — Korpusmaße

Dieser Schritt ist der umfangreichste Ihrer Liste und derjenige mit dem größten
Restaufwand. Die Erfassungsstruktur steht weitgehend so, wie Sie sie skizziert haben —
bei der **Berechnung** der Maße sind wir noch nicht am Ziel.

### 4.1 Gesamthöhe: 18 Raster (ca. 235 cm), 21 Raster (ca. 274 cm), Sonderhöhe `[IN ARBEIT]`

Die drei Möglichkeiten stehen zur Auswahl, die Rasterhöhen mit 235 cm bzw. 274 cm.
Was fehlt: Bei „anders" nimmt das Feld **jede** Zahl an. Ihre Grenze **50–274 cm** steht
nur als Beschriftung daneben und wird nicht geprüft.

### 4.2 Schranktiefe: Standard 60 cm, Sondertiefe 31–60 cm `[IN ARBEIT]`

Auswahl vorhanden. Auch hier wird die Grenze **31–60 cm** noch nicht geprüft.

### 4.3 Bei Sondertiefen nur Einlegeböden als Ausstattung `[GEFIXT]`

Das ist umgesetzt und greift an beiden Stellen: In Schritt 6 sind die übrigen
Ausstattungen bei einer Sondertiefe nicht auswählbar, und eine bereits getroffene
Auswahl wird bereinigt, wenn nachträglich eine Sondertiefe eingetragen wird. Auch hinter
den Fronten erscheinen dann nur noch Einlegeböden. Bei der Eingabe der Tiefe steht ein
entsprechender Hinweis.

### 4.4 Schrankbreite: 50er / 60er / 100er Korpus, Sonderbreite 15–100 cm `[IN ARBEIT]`

Die Standardbreiten und das Sonderbreiten-Feld sind da. Die Grenze **15–100 cm** wird
noch nicht geprüft.

> **Zu 4.1, 4.2 und 4.4 gemeinsam:** Wir bauen die Bereichsprüfung gern sofort ein — das
> ist wenig Aufwand. Bevor wir das tun, brauchen wir aber Ihre Entscheidung zur folgenden
> Frage, weil sie das Verhalten bestimmt:

❓ **Unsere Rückfrage:** Sollen Werte außerhalb der Grenzen **hart blockiert** werden
(der Berater kann nicht weiter), oder sollen sie **mit einer Warnung erlaubt** bleiben
(„274 cm ist die Höchsthöhe — bitte mit der AV abstimmen")? Wir vermuten, dass es in der
Praxis Ausnahmen gibt, die der Verkauf abbilden können muss, und würden deshalb zur
Warnung tendieren. Bitte bestätigen Sie uns das oder korrigieren Sie uns.

### 4.5 Anzahl der Korpi, Breite je Korpus, Reihenfolge von links `[GEFIXT]`

Die Anzahl der Korpi ist frei wählbar, jeder Korpus bekommt seine eigene Breitenangabe,
und die Reihenfolge ist beschriftet („Korpus 1 · ganz links" bis „ganz rechts") — genau
wie in Ihrer Skizze.

### 4.6 Lochreihe je Korpus, standardmäßig ausgewählt `[GEFIXT]`

Jeder Korpus hat sein eigenes Häkchen „Lochreihe", und es ist bei jedem neuen Korpus
**standardmäßig gesetzt**.

### 4.7 Haken „Fixmaß" für jede Sonderdimension `[GEFIXT]`

Höhe, Tiefe und jede Korpusbreite haben ein eigenes Häkchen „Fixmaß". Die Kennzeichnung
wird in die AV-Ausgabe übernommen, damit die Arbeitsvorbereitung sie sieht.

### 4.8 Abschlussset links / rechts / beidseitig / nein und Material `[IN ARBEIT]`

Die Positionen und die Materialien (10 mm Decoboard, Furnier, Mattlack, Xtreme Plus,
anders) sind vollständig vorhanden.

Was fehlt: Bei der Auswahl **„anders" öffnet sich noch kein Freitextfeld**, um das
Material zu benennen — und keine Preisgruppen-Auswahl, damit es in die Kalkulation
einfließt. Sie fordern das an mehreren Stellen Ihres Dokuments; siehe auch 5.11.

### 4.9 Fußleistenausschnitt ja/nein mit Höhe und Tiefe `[GEFIXT]`

Vorhanden, mit beiden Maßfeldern, und in der AV-Ausgabe enthalten.

### 4.10 Automatische Berechnung und Anzeige der Außenmaße `[IN ARBEIT]`

Hier müssen wir ehrlich sein: **Der Block wird angezeigt, die Berechnung ist aber noch
nicht die, die Sie beschrieben haben.** Konkret:

- Die Gesamtbreite ist derzeit nur die **Summe der Korpus-Nennbreiten**. Die Fugen
  (3 mm je Fuge) und die Abschlusssets (10 mm je Seite) sind **nicht** eingerechnet.
- Der Hinweistext darunter behauptet aktuell, Abschlusssets seien im Maß berücksichtigt.
  **Das stimmt so noch nicht.** Wir korrigieren diesen Text sofort, damit im Verkauf
  niemand ein falsches Maß nennt — und rechnen ihn dann richtig aus.
- Der Wortlaut lautet noch „Das konfigurierte Möbel hat ein Außenmaß von …" statt Ihres
  Satzes „Ihr Kleiderschrank hat ein Maß von ca. …". Das gleichen wir an.
- Der Einfluss des Fußleistenausschnitts auf die Gesamttiefe fehlt im Hinweistext.

Dieser Punkt hängt unmittelbar an 4.13 — ohne Ihre Rechenregel können wir ihn nicht
abschließen.

### 4.11 Freitextfeld für Fixmaße / Sondermaße `[OFFEN]`

Ein solches Feld gibt es derzeit nicht. Es existiert nur ein Freitextfeld für
Sonderformen (siehe 4.12). Wir legen ein eigenes Feld „Fixmaße / Sondermaße" an.

❓ **Unsere Rückfrage:** Soll dieses Feld **zusätzlich** zu den Fixmaß-Häkchen aus 4.7
bestehen (Häkchen = welche Dimension, Freitext = die Erläuterung dazu), oder verstehen
wir Sie richtig, dass es eher eine allgemeine Bemerkung an die AV sein soll?

### 4.12 Sonderformen auswählbar `[IN ARBEIT]`

Es gibt bisher nur ein einzelnes Freitextfeld „Ecklösungen / Abschrägungen". Ihre vier
Formen — **Offene Ecklösung, Verdeckte Ecklösung, Seitliche Abschrägung, Hintere
Abschrägung** — sind noch nicht als ankreuzbare Auswahl hinterlegt. Wir bauen sie als
Auswahl mit den von Ihnen genannten Preislisten-Seiten (S. 26 bzw. S. 32) ein.

❓ **Unsere Rückfrage:** Sie schreiben, die Sonderformen würden „in der Planung bzw.
Berechnung nicht berücksichtigt". Heißt das, sie sollen **gar keinen Preis** auslösen und
rein informativ an die AV gehen? Oder sollen sie mit dem Preis der genannten
Preislistenseiten in die Kalkulation einfließen und nur die **Maßberechnung**
unberücksichtigt lassen? Für die Kalkulation macht das einen erheblichen Unterschied.

### 4.13 Ableitung der Korpusbreite über die Frontbreiten `[OFFEN]`

Das ist aus unserer Sicht **der wichtigste offene Punkt der gesamten Liste**, weil daran
sowohl die Maßanzeige (4.10) als auch die Artikelfindung hängt.

Stand: Die Konstanten für die Fuge (3 mm) und die Abdeckplatte/Abschlussset (10 mm) sind
im Code bereits hinterlegt, aber ausdrücklich noch **nicht angewandt**. Ihre
Zuordnungstabelle (15er Korpus → 14 cm Front, … 100er Korpus → 2 × 49 cm) ist noch
nirgends hinterlegt.

Sie bieten in Ihrem Dokument an, die Berechnung im Gespräch zu erklären — **darauf würden
wir sehr gern zurückkommen.** Damit das Gespräch kurz werden kann, hier unsere konkreten
Fragen:

❓ **Unsere Rückfragen zur Rechenregel:**
1. Gilt die Formel **Frontbreiten + 3 mm je Fuge + 10 mm je Abschlussset** so allgemein,
   wie wir sie aus Ihren Beispielen 1–3 ablesen? In Beispiel 1 kommen wir mit
   3 × 490 mm + Fugen + 2 × 10 mm auf die angegebenen 1.502 mm — bitte bestätigen Sie
   uns, dass wir richtig rechnen.
2. **Wie viele Fugen** entstehen genau? Eine je Korpusübergang plus je eine außen, oder
   zählen Sie anders? In Ihren Skizzen sehen wir Fugenmarkierungen an unterschiedlichen
   Stellen.
3. In Ihrer Liste steht bei **79 Korpus** ein Sprung auf **81 Korpus** — die 80 fehlt.
   Ist das ein Tippfehler, oder gibt es den 80er Korpus tatsächlich nicht?
4. Ihre Tabelle nennt **70 Korpus → 2 × 34,5 cm** und **35 Korpus → 35 cm**. Der 35er
   erscheint uns als einziger Wert ohne den sonst durchgängigen Abzug von 1 cm
   (35 Korpus → 34 cm wäre die Regel). Ist das eine bewusste Ausnahme?
5. Ab welcher Breite wird ein Korpus **zweitürig**? Nach Ihrer Liste ab dem 61er. Gilt
   das ausnahmslos?
6. Läuft die Ableitung in der Praxis **von der Frontbreite zur Korpusbreite** oder
   umgekehrt? Für die Bedienung ist das entscheidend: Gibt der Verkäufer die Korpusbreite
   ein und wir errechnen die Fronten, oder gibt er die Fronten vor?

---

# Schritt 5 — Material / Zentrale Materialdatenbank

Hier ist der Stand insgesamt sehr gut — Ihre Materialvorgaben sind fast vollständig
eingepflegt.

### 5.1 Beim Kleiderschrank gibt es keine Abdeckplatten `[GEFIXT]`

Der Bereich wird beim Kleiderschrank nicht mehr abgefragt.

### 5.2 Beim Kleiderschrank keine Sichtrückwand `[GEFIXT]`

Der Block ist beim Kleiderschrank vollständig ausgeblendet.

### 5.3 Kompletter Korpus oder einzelne Korpuse getrennt `[IN ARBEIT]`

Die Umschaltung „Komplett" / „Getrennt" gibt es. Sie trennt derzeit aber nach
**linker und rechter Außenseite**, nicht nach **Korpus 1 / Korpus 2 / Korpus 3**, wie Sie
es skizziert haben.

❓ **Unsere Rückfrage:** Wir würden das auf Ihre Systematik umstellen, also je Korpus aus
Schritt 4 eine eigene Materialauswahl. Bevor wir das tun: Brauchen Sie **zusätzlich**
weiterhin die Unterscheidung links/rechts (etwa für die Außenseiten des ersten und
letzten Korpus), oder ersetzt die Aufteilung je Korpus das vollständig?

### 5.4 Bezeichnung „Echtholz" streichen `[GEFIXT]`

Die Gruppe heißt „Furnier". Das Wort „Echtholz" kommt im gesamten Programm nicht mehr vor
— wir haben ausdrücklich danach gesucht.

### 5.5 Furnier-Oberflächen Preisgruppe 3 `[GEFIXT]`

Alle 15 von Ihnen genannten Oberflächen sind eingepflegt, einschließlich der Hinweise
zum Farbspiel Splint/Kern beim Europäischen Nussbaum.

> Kleinigkeit: Wir schreiben „Europäischer Nussbaum" und „Amerikanischer Nussbaum" aus,
> Sie kürzen mit „Euro." und „Am.". Sagen Sie gern, welche Schreibweise im Angebot beim
> Kunden stehen soll.

### 5.6 Wenge dunkel lackiert in Preisgruppe 4 `[GEFIXT]`

Eingepflegt, mit der abweichenden Preisgruppe 4 innerhalb der Furnier-Gruppe.

### 5.7 Mattlack-Sonderfarben mit Freitext `[GEFIXT]`

RAL-Classic (PG 3), NCS (PG 4), RAL-Design (PG 4) und SIKKENS (PG 4) sind angelegt. Bei
Auswahl einer dieser vier Kategorien öffnet sich wie gewünscht ein Freitextfeld für die
Farbbezeichnung.

### 5.8 Gruppe heißt nur noch „Gläser" `[GEFIXT]`

Umbenannt. Die Rauchgläser stehen jetzt als einzelne Optionen innerhalb dieser Gruppe.

### 5.9 Drei neue hinterlackierbare Gläser `[GEFIXT]`

Weißglas hinterlackiert, Weißglas satina hinterlackiert und Wave hinterlackiert sind
angelegt, jeweils mit Freitextfeld „Wunsch-Lackfarbe".

### 5.10 Material „anders": Freitext und freie Preisgruppe `[IN ARBEIT]`

Die **freie Preisgruppen-Wahl ist umgesetzt** — der Verkäufer wählt die PG selbst, und
der Wert fließt in die Kalkulation ein. Damit ist Ihr wichtigstes Anliegen an diesem
Punkt erfüllt.

Was noch fehlt: Sie wünschen sich ein **großes** Freitextfeld; derzeit ist es einzeilig.
Das ändern wir.

> Ergänzend: Linoleum schwarz auf MPX, MPX und Corian 6 mm haben wir zusätzlich als feste
> Optionen hinterlegt, damit sie nicht jedes Mal getippt werden müssen. Über „anders"
> bleiben sie natürlich weiterhin frei erfassbar.

### 5.11 Freitext + Preisgruppen-Auswahl an allen Stellen `[IN ARBEIT]`

Die Kombination aus Freitext und Preisgruppen-Auswahl gibt es überall dort, wo ein
**Material** gewählt wird — also im Korpus und bei allen Fronten.

Sie fordern sie in Ihrem Dokument aber an weiteren Stellen, und dort fehlt sie noch:

- Abschlussset „anders" (Schritt 4, siehe 4.8)
- Fußleistenausschnitt (Sie notieren dort ausdrücklich „Freies Textfeld + Auswahl­
  möglichkeit der Preisgruppe")
- Sonderformen (Schritt 4)
- Sonderausstattung und die Notizfelder der Ausstattung (Schritte 6 und 7)

Wir ziehen dafür ein einheitliches Bauteil „Freitext + Preisgruppe" hoch und setzen es an
allen genannten Stellen ein.

### 5.12 Standard-Mattlacke Preisgruppe 2 `[OFFEN]`

Sie schreiben, die Auswahl der Standard-Mattlacke in Preisgruppe 2 werde gerade
überarbeitet und Sie könnten uns die neue Liste „nächste Woche" senden.

❓ **Unsere Rückfrage:** Liegt diese Liste inzwischen vor? Wir pflegen sie gern
unmittelbar ein — es ist reine Datenpflege und in kurzer Zeit erledigt.

### 5.13 Korpuspreise Furnier und Mattlack `[OFFEN]`

Sie notieren: Bei den Korpuspreisen für Furnier und Mattlack werden die **Atriumpreise
der Preislistenseite 15** verwendet (Korpus 60 tief), und **21 Raster Höhe rechnet mit
20 % Aufpreis gegenüber 18 Raster**.

Diese Regel ist in der Kalkulation noch nicht hinterlegt.

❓ **Unsere Rückfragen:**
1. Gelten die 20 % Aufpreis **nur für den Korpus** oder auch für Fronten und Ausstattung?
2. Wie rechnen wir bei **Sonderhöhen** zwischen 18 und 21 Rastern — anteilig, oder gilt
   ab einer bestimmten Höhe pauschal der 21-Raster-Preis?
3. Gilt der Atriumpreis von Seite 15 auch bei **Sondertiefen** (31–60 cm), oder nur bei
   der Standardtiefe von 60 cm?

---

# Schritt 6 — Ausstattung

**Dieser Schritt ist vollständig umgesetzt.** Wir haben alle Positionen Ihrer Liste
einzeln geprüft.

### 6.1 Allgemeine Abfrage in Schritt 6, gefilterte Anzeige bei den Fronten `[GEFIXT]`

Genau so umgesetzt: In Schritt 6 wird angekreuzt, was benötigt wird. Bei der Definition
der Fronten erscheinen dann **nur noch die dort vorausgewählten** Ausstattungen.

### 6.2 Essentials vollständig `[GEFIXT]`

Alle 13 Positionen sind in Ihrer Reihenfolge vorhanden: Einlegeboden, Einlegeboden inkl.
Kleiderstange, Container, Rollboden, Innenschublade, Rollkorb, Innenspiegel für Drehtür,
Kleiderlift, Glasboden, Krawattenspange, Kleiderbügelhalter ausziehbar, Revisionsklappe,
Rückwandausschnitt.

### 6.3 Einlegeboden und Einlegeboden inkl. Kleiderstange vorausgewählt `[GEFIXT]`

Beide sind standardmäßig gesetzt und **abwählbar**.

### 6.4 Verblendung korpusbündig / frontbündig `[GEFIXT]`

Beide vorhanden, jeweils mit dem Eingabefeld für die laufenden Meter (siehe 7.17).

### 6.5 Beleuchtung `[GEFIXT]`

LED-Syncro und LED-Band Aluprofil sind angelegt (zur Detailauswahl siehe 7.18).

### 6.6 Ausstattung-Craft `[GEFIXT]`

Container Craft, Schubladenunterteilung Craft, Hemdeinsatz Craft, Rollboden mit
Schuhablage Craft.

### 6.7 Ausstattung-Conero `[GEFIXT]`

Container Conero, Kleiderlift Conero, Gürtel-/Krawattenauszug Conero, Schuhablage Conero.

---

# Schritt 7 — Fronten

### 7.1 Fronten je Korpus definierbar `[GEFIXT]`

Für jeden in Schritt 4 angelegten Korpus gibt es eine eigene Front-Spalte.

> Kleinigkeit: Wir beschriften sie „Front-Typ 1 / 2 / 3", Sie schreiben
> „Front - Korpus 1 / 2 / 3". Wir gleichen die Beschriftung an Ihre an — Ihre ist
> eindeutiger.

### 7.2 Schiebetür (zweiläufig) schließt weitere Fronten aus `[GEFIXT]`

Sobald eine zweiläufige Schiebetür geplant ist, lässt sich keine weitere Front für diesen
Schrank mehr anlegen. Die übrigen Front-Typen sind dann gesperrt.

### 7.3 Drehtür, Schübe und Offen beliebig kombinierbar `[GEFIXT]`

Auch mehrfach im selben Korpus.

### 7.4 Fronten immer von unten nach oben angeben `[IN ARBEIT]`

Der Hinweis steht an zwei Stellen im Bildschirm, aber die Reihenfolge ist noch **nicht
sichtbar durchnummeriert** — neue Elemente werden schlicht angehängt. Wir nummerieren die
Elemente von unten (1 = unten) und lassen sie in dieser Reihenfolge anzeigen.

❓ **Unsere Rückfrage:** Sie schlagen eine Vorbelegung der Bezeichnungen vor
(Schubladen S1, S2, S3 …, Drehtüren D1, D2 …). Sollen wir diese Kürzel **automatisch
vergeben** — und zählen sie je Korpus neu (Korpus 2 beginnt wieder bei S1) oder
durchgehend über den ganzen Schrank?

### 7.5 Breite, Höhe (Raster oder cm) und Türanschlag je Element `[OFFEN]`

Hier ist der größte Rückstand in Schritt 7:

- **Türanschlag rechts/links: fehlt vollständig.** Es gibt kein Feld dafür. Das ist für
  die AV eine wesentliche Angabe — wir bauen es ein.
- **Höhe in Rastern: fehlt.** Aktuell gibt es nur ein freies cm-Feld. Ihre Vorgabe
  „Höhe (Raster) [oder anders in cm]" bedeutet eine Auswahl mit cm als Ausweichweg.
- Die **Breite wird nicht aus dem Korpusmaß vorbelegt**, sondern muss getippt werden.

❓ **Unsere Rückfrage zum K-Code:** Sie notieren an mehreren Stellen „K-Code notwendig?
Haben wir in der PL oft nicht vergeben." Sollen wir das Feld **ganz weglassen**, oder als
optionales Feld vorsehen für die Fälle, in denen ein K-Code existiert?

### 7.6 Oberste Front automatisch bis oben ziehen `[OFFEN]`

Derzeit nur als Hinweistext vorhanden, ohne Berechnung. Das setzen wir um, sobald die
Rasterhöhen aus 7.5 stehen — die Resthöhe ergibt sich erst daraus.

### 7.7 Anzahl der Schiebetüren `[GEFIXT]`

Die Kopplung an die Korpus-Anzahl ist genau nach Ihrer Vorgabe umgesetzt: 2 Korpi → 2
Schiebetüren, 3 Korpi → 3, 4 Korpi → 2 oder 4. Die Angabe ist Pflicht.

❓ **Unsere Rückfrage:** Sie schreiben, bei 4 Korpi hänge es von der Schranklänge ab, ob
2 oder 4 Schiebetüren nötig sind, und Sie würden uns dazu genaue Informationen persönlich
geben. **Ab welcher Länge gilt was?** Dann können wir die Auswahl automatisch einschränken,
statt sie dem Verkäufer zu überlassen.

### 7.8 Schiebetür geht immer über die volle Schrankhöhe `[IN ARBEIT]`

Steht als Hinweis im Bildschirm, aber das Höhenfeld bleibt frei editierbar. Wir setzen es
bei zweiläufigen Schiebetüren automatisch auf die Schrankhöhe und sperren es, da es
technisch ohnehin nicht anders geht.

### 7.9 „Line" bei zweiläufiger Schiebetür nicht möglich `[GEFIXT]`

Die Stil-Linie „Line" steht bei der zweiläufigen Schiebetür nicht zur Auswahl.

### 7.10 Curve nicht in Glas `[GEFIXT]`

Bei Curve ist die Materialgruppe Glas ausgeschlossen — sowohl bei Drehtür und Schüben als
auch bei der zweiläufigen Schiebetür.

### 7.11 Glossy und Less nur in Glas `[IN ARBEIT]`

Für Drehtür, Schübe, Klappen und die **zweiläufige** Schiebetür ist die Regel korrekt
umgesetzt.

**Wir haben dabei aber eine Lücke gefunden**, auf die wir Sie ausdrücklich hinweisen
möchten: Bei der **einläufigen** Schiebetür lässt Glossy derzeit noch alle fünf
Materialgruppen zu. Das widerspricht Ihrer Regel und würde eine nicht baubare Kombination
durchlassen.

❓ **Unsere Rückfrage:** Bevor wir das schließen — **gibt es die einläufige Schiebetür
beim Kleiderschrank (Refugium) überhaupt?** In Ihrem Dokument sprechen Sie durchgehend
nur von der zweiläufigen. Wenn die einläufige hier gar nicht vorkommt, blenden wir sie
für den Kleiderschrank vollständig aus — das wäre die sauberere Lösung.

### 7.12 Griffe 103, 125, 126, 128 bei Glossy/Less gesperrt `[GEFIXT]`

Die vier Griffe stehen bei Glossy und Less nicht zur Auswahl. War beim Umschalten auf
Glossy/Less bereits ein solcher Griff gewählt, wird er automatisch entfernt.

### 7.13 Pulverfarbe für Griffprofil, Position von Freitext und Griffprofil tauschen `[OFFEN]`

Das Griffprofil ist eine reine Auswahl **ohne Feld für die Pulverfarbe**. Ihre Angabe
„Pulverfarbe für Griffprofil" ist damit noch nicht erfassbar — nur bei der Curve-Variante
gibt es einen allgemeinen Freitext „Griffleiste gepulvert in".

❓ **Unsere Rückfrage:** Wir bauen ein eigenes Feld „Pulverfarbe Griffprofil" ein. Soll
das ein **Freitext** sein (wie bei den Mattlack-Sonderfarben, also RAL/NCS nach Wunsch),
oder gibt es eine **feste Auswahlliste** an Pulverfarben, die Sie uns geben können?
Und: Löst die Pulverbeschichtung einen **Aufpreis** aus, den wir in der Kalkulation
berücksichtigen müssen?

### 7.14 Freitext bei Xtreme Plus und Decoboard nicht notwendig `[GEFIXT]`

Der materialbezogene Freitext wird bei Decoboard und Xtreme Plus ausgeblendet.

> Ein Hinweis: Das **allgemeine** Notizfeld neben der Materialauswahl bleibt auch bei
> Decoboard und Xtreme Plus sichtbar. Wir gehen davon aus, dass Sie das so wollen (es
> dient für sonstige Bemerkungen an die AV) — sagen Sie bitte Bescheid, falls es
> ebenfalls verschwinden soll.

### 7.15 Ausstattung hinter Fronten nur bei Drehtür, zweiläufiger Schiebetür und Offen `[GEFIXT]`

Vollständig umgesetzt, einschließlich der Feinheiten: Es erscheinen **nur** die in
Schritt 6 vorausgewählten Ausstattungen, und einzelne Positionen sind zusätzlich an den
Front-Typ gebunden (der Innenspiegel etwa erscheint nur bei der Drehtür).

### 7.16 Höhenangaben immer mit „ca." `[IN ARBEIT]`

Bei den **Ausstattungen** ist das umgesetzt — dort steht durchgängig „ca.".

Bei den **Front-Elementen** noch nicht: Dort heißt das Feld schlicht „Höhe (cm)", und in
Zusammenfassung und PDF erscheint das „ca." nur, wenn kein Fixmaß gesetzt ist. Wir gleichen
das an Ihre Vorgabe an.

❓ **Unsere Rückfrage:** Wir verstehen Ihre Regel so: **„ca." immer — außer dort, wo der
Berater ausdrücklich ein Fixmaß angehakt hat**, denn ein Fixmaß ist ja gerade kein
Circa-Maß. Ist das in Ihrem Sinne?

### 7.17 Verblendung: bei Schiebetürschrank nur seitlich, lfm-Feld `[IN ARBEIT]`

Das **Eingabefeld für die laufenden Meter ist vorhanden** und in der Kalkulation
angebunden — das war Ihr wesentliches Anliegen.

Die Einschränkung „bei Schiebetürschrank oben nicht möglich" steht bisher nur als
Hinweistext; die Position ist ein freies Textfeld ohne Prüfung. Wir bauen die Position als
Auswahl (links / oben / rechts) und blenden „oben" bei zweiläufiger Schiebetür aus.

### 7.18 LED-Syncro je Korpusbreite, LED-Band links/rechts/beidseitig `[IN ARBEIT]`

Beide Beleuchtungen sind vorhanden, aber ohne die von Ihnen skizzierte Detailauswahl:

- **LED-Syncro** hat keine Variante für 50er / 60er / 100er Korpus. (Eine solche
  Breiten-Auswahl existiert im System bereits beim Rollboden Craft — wir setzen sie hier
  ebenfalls ein.)
- **LED-Band Aluprofil** hat keine Auswahl links / rechts / beidseitig, sondern nur ein
  allgemeines Freitextfeld „Position".

❓ **Unsere Rückfrage:** Sie merken zum LED-Band an, dass die Seiten wegen des Alu-Profils
aufgedoppelt werden — „also immer 2 Seiten statt 1 Seite gebaut. Dadurch reduziert sich
die Lichtbreite." Sollen wir daraus eine **Auswirkung auf das Maß** ableiten (die
Innenbreite des betroffenen Korpus verringert sich), oder ist das eine reine Information
für die AV? Falls es das Maß beeinflusst: **um wie viele Millimeter je aufgedoppelter
Seite?**

---

# Zusammenstellung aller Rückfragen

Zur Vorbereitung unseres nächsten Gesprächs — nach Dringlichkeit sortiert.

## A — Blockierend (ohne Ihre Antwort kommen wir nicht weiter)

| Nr. | Punkt | Frage |
|---|---|---|
| A1 | 4.13 | Rechenregel Korpusbreite ↔ Frontbreite: Formel, Anzahl der Fugen, fehlender 80er Korpus, Ausnahme beim 35er, ab wann zweitürig, Rechenrichtung. |
| A2 | 5.13 | Atriumpreise S. 15 und der 20-%-Aufschlag für 21 Raster: Geltungsbereich, Sonderhöhen, Sondertiefen. |
| A3 | 7.7 | Ab welcher Schranklänge sind bei 4 Korpi 2 bzw. 4 Schiebetüren nötig? |
| A4 | 5.12 | Liegt die überarbeitete Liste der Standard-Mattlacke (PG 2) inzwischen vor? |

## B — Richtungsentscheidungen (wir haben eine Empfehlung, brauchen Ihr Ja)

| Nr. | Punkt | Frage | Unsere Empfehlung |
|---|---|---|---|
| B1 | 4.1/4.2/4.4 | Maßgrenzen hart sperren oder nur warnen? | Warnen — Ausnahmen muss der Verkauf abbilden können. |
| B2 | 7.11 | Gibt es die einläufige Schiebetür beim Kleiderschrank? | Falls nein: ganz ausblenden. |
| B3 | 1.3 | Berater-Filter auf den angemeldeten Berater vorbelegen? | Ja, mit Umschaltmöglichkeit. |
| B4 | 7.16 | „ca." immer, außer bei angehaktem Fixmaß? | Ja. |
| B5 | 2.3 | Auftrags-/Artikelnummer nur bei „An AV senden" Pflicht? | Ja, so umgesetzt. |
| B6 | 5.3 | Material je Korpus 1/2/3 statt links/rechts — links/rechts zusätzlich behalten? | — |

## C — Ausgestaltung (Detailfragen zur Umsetzung)

| Nr. | Punkt | Frage |
|---|---|---|
| C1 | 1.5 | Varianten: automatisches Kennzeichen genügt, oder benennbar und gruppiert? |
| C2 | 4.11 | Freitextfeld Fixmaße zusätzlich zu den Fixmaß-Häkchen? |
| C3 | 4.12 | Sonderformen: gar kein Preis, oder Preis ja und nur Maß ohne Berücksichtigung? |
| C4 | 7.5 | K-Code: Feld ganz weglassen oder optional vorsehen? |
| C5 | 7.4 | Automatische Kürzel S1/S2/D1/D2 — je Korpus oder durchgehend? |
| C6 | 7.13 | Pulverfarbe: Freitext oder feste Liste? Mit Aufpreis? |
| C7 | 7.18 | LED-Band: Aufdopplung mit Maßauswirkung? Wenn ja, wie viele mm je Seite? |
| C8 | 5.5 | Schreibweise „Euro./Am. Nussbaum" oder ausgeschrieben? |
| C9 | 7.14 | Soll auch das allgemeine Notizfeld bei Decoboard/XP verschwinden? |
| C10 | 1.1 | Auch die Blocküberschrift „Auftrag" in Zusammenfassung und PDF umbenennen? |

---

# Anhang — was wir in diesem Durchgang zusätzlich umgesetzt haben

Diese Punkte standen nicht in Ihrer Liste, betreffen Sie aber unmittelbar.

### Preise durchgängig im deutschen Format `[GEFIXT]`

Es gab einen Fehler bei der Eingabe von Preisen: Wurde im Freitextfeld für den VK-Preis
etwa `1.250` eingegeben, hat das Programm den Punkt als Dezimaltrennzeichen gelesen und
daraus **1,25 €** gemacht statt 1.250,00 €.

Das ist behoben. Es gilt jetzt strikt die deutsche Schreibweise: **Punkt trennt die
Tausender, Komma die Cent.** `9.009,00` sind neuntausendneun Euro. Zusätzlich haben wir
eine automatische Prüfung eingerichtet, die bei jeder Programmänderung nachrechnet, damit
dieser Fehler nicht zurückkommt.

### Spaltenbreiten in der Stammdatenverwaltung `[GEFIXT]`

Spalten ließen sich nicht schmaler ziehen als ihr längster Zelleninhalt. Jetzt lässt sich
jede Spalte beliebig eng ziehen; überstehender Text wird abgeschnitten — genau wie in
Excel. Die Zeilenhöhe bleibt dabei unverändert, und Nachbarspalten verschieben sich nicht.

### Berater- und Zugangsverwaltung `[GEFIXT]`

Die Berateransicht in der Stammdatenverwaltung hat ein **Passwortfeld** bekommen. Der
Administrator kann darüber E-Mail, Passwort und Profil pflegen und ein Profil für den
Konfigurator **freischalten** oder den Zugang wieder entziehen. Eine neue Spalte „Zugang"
zeigt auf einen Blick, wer freigeschaltet ist.

Passwörter werden verschlüsselt gespeichert und sind danach auch für den Administrator
nicht mehr lesbar. Sie stehen **nicht** in der Stammdatenmappe und laufen **nicht** über
den Excel-Export mit.

> **Wichtiger Hinweis zur Sicherheit:** Der Konfigurator ist weiterhin ein Prototyp, der
> vollständig im Browser läuft. Die Anmeldung ist damit noch keine belastbare
> Sicherheitsgrenze. Für den Echtbetrieb ist eine serverseitige Anmeldung erforderlich —
> wir haben die Zugangsverwaltung so gebaut, dass dieser Wechsel später an genau einer
> Stelle stattfindet.

---

Für Rückfragen stehen wir jederzeit zur Verfügung. Besonders freuen würden wir uns über
einen Termin zu **Punkt 4.13** — sobald die Rechenregel für die Korpusbreiten steht,
lassen sich die Maßanzeige und ein guter Teil der Kalkulation zügig abschließen.

Mit freundlichen Grüßen
Ihr Entwicklungsteam CRAMER PLANER
