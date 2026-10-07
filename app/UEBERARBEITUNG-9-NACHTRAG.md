# Überarbeitung 9 — Rückmeldung

Stand: 07.10.2026 · Grundlage: „Überarbeitung 9 – Cramer Planer.pdf" und die Ergänzungen dazu ·
Prüfung: `npm run ue9b:test` und `npm run durchgriff:test`

Kennzeichnung wie gewohnt: **[GEFIXT]** umgesetzt und geprüft · **[OFFEN]** Rückfrage an Cramer.

---

## Vorab: Stammdatenverwaltung → Konfigurator → Kalkulation

**[GEFIXT] Warum LED-Syncro 100er in der Verwaltung 400 € zeigte, die Kalkulation aber 405 €.**
Die Kalkulation rechnet immer mit den Stammdaten — der Fehler lag beim Speichern. Der Knopf
„Speichern" im Artikelfenster hat die Änderung nur im Bearbeitungsstand **dieses einen Browsers**
vorgemerkt; zentral gespeichert wurde erst mit einem zweiten „Speichern" oben im Kopf der
Verwaltung. In Supabase ist die 400 € nie angekommen. Jeder Berater, jedes andere Gerät (und jede
Anmeldung als Berater, die vorgemerkte Verwaltungsänderungen bewusst verwirft) rechnete deshalb
weiter mit 405 €.

Jetzt gilt:

- **„Speichern" in den Fenstern speichert sofort zentral** — Artikel samt Preiszeilen,
  Oberflächen, Kategorien, Filialen (Berater taten das schon). Danach rechnet jeder Konfigurator
  und jede Kalkulation offener Entwürfe mit dem neuen Stand.
- Wer die Verwaltung mit vorgemerkten, nicht gespeicherten Änderungen schließt, wird gefragt.
- Rechnet eine Kalkulation mit nicht gespeicherten Stammdaten, steht ein Hinweis darüber.
- Speichern ohne echte Änderung schreibt nichts (sonst entstünde ein Override, der spätere Pflege
  in der Mappe verdeckt).
- Die **Preisgruppe einer Farbe oder Kategorie** wird jetzt in der Kalkulation aktuell
  nachgeschlagen. Vorher galt die beim Auswählen gespeicherte PG — wer z. B. Mattlack von PG 2 auf
  PG 3 setzte, sah das in schon angelegten Entwürfen nicht. Abgeschlossene Aufträge behalten wie
  bisher ihren eingefrorenen Preisstand.
- LED-Syncro 100er steht in der Stammdatenmappe auf **400 €** (Tippfehler der Preisliste).

**[GEFIXT] Durchgriff-Prüfung — Artikel für Artikel, Zeile für Zeile.** Ihr Ablauf „einer ändert
und speichert, der andere baut einen Schrank und vergleicht, dann zurücksetzen" läuft jetzt
automatisch und jederzeit wiederholbar (`npm run durchgriff:test`):

| Schritt | Ergebnis |
|---|---|
| Für **jede** Preiszeile jedes im Konfigurator verbauten Artikels einen Kleiderschrank bauen, der genau diese Zeile treffen muss | 80 Artikel, 1.274 Schränke |
| Zeile um 111,11 € ändern — als gespeicherter Stand, wie ihn jedes Gerät lädt — und den Schrank neu rechnen | **1.274 von 1.274**: Betrag ändert sich exakt um Menge × 111,11 € |
| Änderung zurücksetzen | jedes Mal wieder exakt der alte Betrag |
| „Fingerabdruck": jede Preiszeile bekommt einen eindeutigen Preis | **3.754 von 3.754** Teilbeträgen stammen aus einer Preiszeile — nichts ist fest im Programm hinterlegt |
| Artikel sperren | 66 von 66: Position „auf Anfrage", Kalkulation nicht verbindlich |
| Satz von Montage, Lieferung, Raumteiler, Sichtrückwand ändern | Betrag folgt dem Satz |
| Preisgruppe einer Kategorie bzw. einer einzelnen Farbe ändern | Korpus, Tür und Ausstattung eines bestehenden Entwurfs folgen |

Die Prüfung hat dabei drei Fehler gefunden, die jetzt behoben sind:

| Befund | Folge bisher | Behoben |
|---|---|---|
| Craft-Artikel (Container Craft A–C, Hemdeinsatz, Rollboden mit Schuhablage, Schubladenunterteilung): Breitenstufe „50/60er" hatte die Schwelle 50 cm | ein **60er Korpus bekam den 80er-Preis** (z. B. Schubladenunterteilung 201 statt 183 €) | Schwelle 60 cm |
| LED-Band rechnete mit der bepreisten Korpusstufe (nur 18 R / 21 R) | jeder niedrigere Schrank zahlte den **18-R-Preis**; die Zeilen 9 R / 12 R / 15 R wurden nie gezogen | tatsächliche Schrankhöhe |
| Preisgruppe der Farbe wurde beim Auswählen eingefroren | geänderte PG wirkte nicht auf offene Entwürfe | siehe oben |

## Seite 1

- **[GEFIXT] LED-Syncro 100er = 400 €** (siehe oben).
- **[GEFIXT] Abschlussset nur links oder nur rechts = ½ Preis.** Der Listenpreis bleibt als
  Einzelpreis sichtbar, die Position rechnet mit Menge ½ und nennt den Grund („Nur links: ½ des
  Listenpreises").
- **[GEFIXT] Raumteiler beim Kleiderschrank ausgeblendet** — und ein älterer Haken wird dort auch
  nicht mehr berechnet oder gedruckt.
- **[GEFIXT] Korpusvertiefung bei Beleuchtung:** +1 cm bei LED-Syncro bzw. LED-Band, **außer** es
  gibt einen Fußleistenausschnitt — dann läuft die Verkabelung dort, ohne zusätzlichen Zentimeter.
  Zusammenfassung und AV-PDF nennen das.

## Seite 2 — Container

- **[GEFIXT] Container 3 R und 7,5 R hinterlegt** (Decoboard 526 / 552 / 666 € und 1.081 / 1.137 /
  1.356 €; Rauchglas-Deckplatte + 210 / 220 / 230 €). Höhenetiketten 38,1 cm bzw. 95,7 cm.
- **[GEFIXT] Preisgruppe vom Innenkorpus, +30 / 40 / 50 %** für PG 2 / 3 / 4 — Container und
  Deckplatte, für alle vier Höhen. Alle 96 Kombinationen geprüft. Jede Zeile steht als eigene
  Preiszeile in der Stammdatenverwaltung und ist dort pflegbar.

## Seite 3

- **[GEFIXT] Korpusboden ist nicht Raster 1.** „Am Korpusboden" ist jetzt eine eigene Position
  unterhalb von Raster 1. Rollboden auf Raster 1 und Rollboden am Korpusboden sind kein Konflikt
  mehr; ein Container am Boden belegt „Korpusboden bis Raster 6". Für die Fronten und die spätere
  3D-Planung haben wir Ihren Hinweis notiert.
- **[GEFIXT] Rollkörbe mit Preisgruppe** (+30 / 40 / 50 %, PG vom Innenkorpus).

## Seite 4

- **[GEFIXT] Kleiderbügelhalter ausziehbar:** Einbauhöhe gestrichen, Position nur als Text.
- **[GEFIXT] Schubladenunterteilung immer Preisgruppe 1** (Decoboard Anthrazitgrau), unabhängig vom
  Innenkorpus.
- **[GEFIXT] Rollboden mit Schuhablage Craft:** Positionsfeld gestrichen, je Auszug eine eigene
  Einbauhöhe. Zwei Auszüge brauchen mindestens ca. 35 cm (3 Raster) Abstand — zu nahe Raster sind
  in der Auswahl gesperrt, und eine zu nahe Sonderhöhe wird gemeldet.

## Seite 5 — Conero

- **[GEFIXT] Gürtel-/Krawattenauszug:** je Auszug eine eigene Wunschhöhe.
- **[GEFIXT] Conero G und H nur im 100er Korpus** — bei anderen Breiten nicht wählbar.
- **[GEFIXT] Ausführung des Funktionsauszugs bei G und H:** 12 Hosenhalter · 6 Hosenhalter /
  1 Wäschesack · 2 Wäschesäcke. Die Kalkulation zieht den passenden Artikel, die AV sieht, welche
  Ausführung geliefert wird.
- **[GEFIXT] Preisgruppen für G und H** (+30 / 40 / 50 %); A–F hatten sie schon.

## Seite 6–8

- **[GEFIXT] Weißglas hinterlackiert:** „Vollflächig lackiert" oder „Passepartout (Rahmen,
  Vitrinentür)" — nur bei Drehtüren, Pflichtangabe, steht im AV-PDF.
- **[GEFIXT] Line:** Mattlack und Furnier zusammengefasst — die Aufkantung kann bei einer Furnier-
  wie bei einer Mattlack-Frontscheibe in Lack oder Furnier gewählt werden. Neu: Bei einer
  Sonderfarbe der Aufkantung gibt es jetzt auch das Feld für den Farbcode (die Prüfung verlangte
  ihn schon, nur fehlte das Feld).
- **[GEFIXT] Schübe:** Höhe zusätzlich als 1 / 1,5 / 2 Raster wählbar, höchstens 40 cm.

## Ergänzungen

- **[GEFIXT] Montage und Lieferung je Entwurf überschreibbar.** In der Kalkulation neben dem
  Häkchen steht ein Feld „Satz %". Leer = Satz aus der Artikelverwaltung; ein eingetragener Satz
  gilt nur für diesen Entwurf und wird als „für diesen Entwurf angepasst (Vorgabe 10 %)"
  ausgewiesen.
- **[GEFIXT] Raumteiler und Sichtrückwand auf „Entwurf".** Die Abfragen erscheinen nur noch, wenn
  der Artikel in der Stammdatenverwaltung aktiv ist (ein schon gesetzter Haken bleibt zum Abwählen
  sichtbar). Sie stehen weiter im Schritt „Material", weil es den Schritt „Ausstattung" nur beim
  Kleiderschrank gibt — und dort entfällt der Raumteiler ganz, die Sichtrückwand war dort schon
  ausgeblendet.

## Rückfragen

1. **[OFFEN] Conero H in den neuen Ausführungen** (6 Hosenhalter / 1 Wäschesack, 2 Wäschesäcke):
   Die Preisliste führt für H nur „12 Hosenhalter". Wir haben beide wie bei Conero G preisgleich
   angelegt (1.080 € / Rauchglas 1.280 €). Stimmt das?
2. **[OFFEN] Conero A–F, 50er teurer als 60er:** Conero A kostet laut Preisliste im 50er 1.526 €,
   im 60er 1.226 €, im 100er 1.406 € (dasselbe Muster bei B–F). Ist der 50er-Preis ein
   Tippfehler?
3. **[OFFEN] LED-Band im 21-Raster-Korpus:** Die Preisliste endet bei 18 Raster (235 cm). Im 21-R-
   Korpus steht das LED-Band deshalb „auf Anfrage". Welcher Preis gilt?
4. **[OFFEN] Schübe über 25,3 cm (2 Raster):** Bis 40 cm sind sie jetzt erlaubt, die Preisliste
   endet aber bei 2 Raster. Höhere Schübe stehen „auf Anfrage". Gibt es Preise dafür?
5. **[OFFEN] Nicht erreichbare Preiszeilen:** 24 Zeilen „Seite" im Korpus-Artikel (Atrium-
   Seitenpreise, die keine Korpusbreite trifft) und 11 Schub-Zeilen ohne Stil-Linie (Preisliste
   S. 11). Der Konfigurator zieht sie nie. Dürfen wir sie aus der Stammdatenmappe entfernen?
6. **[OFFEN] Raumteiler und Sichtrückwand:** Wir haben „zu Ausstattung" so verstanden, dass beide
   selten genutzt und deshalb ausgeblendet sind, bis sie in der Stammdatenverwaltung aktiviert
   werden. Falls sie bei den Nicht-Kleiderschrank-Serien an einer anderen Stelle stehen sollen,
   geben Sie uns bitte Bescheid.

## Technischer Überblick

| Bereich | Datei |
|---|---|
| Sofort speichern, wirkungslose Änderungen, Grundstand-Schlüssel | `src/lib/stammdatenStore.ts` |
| Artikelfenster, Verwaltung (Schließen-Abfrage), Kalkulationshinweis, Satzfeld | `ArtikelDetailModal.tsx`, `StammdatenAdminModal.tsx`, `KalkulationsPanel.tsx` |
| PG live, Abschlussset ½, LED-Band-Höhe, Conero-Ausführung, feste PG, Satz je Entwurf | `src/lib/kalkulation.ts`, `src/config/preisMapping.ts` |
| Korpusboden, Mindestabstand | `src/lib/rasterBelegung.ts`, `src/config/equipment.ts` |
| Weißglas, Line, Schübe | `FrontElementCard.tsx`, `frontsHelpers.ts`, `frontsValidation.ts`, `frontCatalog.ts` |
| Korpusvertiefung | `src/lib/korpusMass.ts` |
| Mappe | `scripts/migrate-ueberarbeitung-9-nachtrag.js` (idempotent), Daten in `scripts/lib/ueberarbeitung-9-nachtrag.js` |
| Prüfungen | `npm run ue9b:test` (alle PDF-Punkte) · `npm run durchgriff:test` (alle Artikel und Varianten) |
