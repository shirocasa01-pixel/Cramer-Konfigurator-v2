# Überarbeitung 10 — Rückmeldung

Stand: 09.10.2026 · Grundlage: „Überarbeitung 10 – Cramer Planer.pdf" (5 Seiten) und die
Nachfragen zum Abschluss · Prüfung: `npm run ue10:test`, `npm run durchgriff:test` und alle
übrigen Prüfungen

Kennzeichnung wie gewohnt: **[GEFIXT]** umgesetzt und geprüft · **[OFFEN]** Rückfrage an Cramer.

---

## Seite 1 — Zweiläufige Schiebetür: Höhe, 150er, Abschlusssets

- **[GEFIXT] Korpushöhe 18 bis 21 Raster.** Bei 18 R und 21 R immer möglich, Sonderhöhen nur
  dazwischen (ca. 235–274 cm). Bei einer anderen Höhe lässt sich die zweiläufige Schiebetür im
  Schritt „Fronten" nicht hinzufügen. Wird die Höhe später geändert, meldet der Schritt
  „Maße" das, die Fronten sind nicht abschließbar und die Kalkulation ist nicht verbindlich.
- **[GEFIXT] 150er nur in Decoboard oder Xtreme Plus.** Bisher wurde das zwar geprüft, die
  Anzeige im Schritt „Fronten" kannte das Material der Tür aber nicht und nannte immer 120 cm.
  Jetzt zählt das gewählte Material.
- **[GEFIXT] Abschlusssets links und rechts immer, 2 cm statt 1 cm.** Mit der zweiläufigen
  Schiebetür wird das Abschlussset automatisch auf „links & rechts" gestellt, das Material
  bleibt erhalten. Im Schritt „Maße" sind „kein / nur links / nur rechts" dann gesperrt. Das
  Außenmaß rechnet mit 2 × 20 mm, ein 2 × 100er Schrank z. B. mit 201,5 statt 199,5 cm.
- **[GEFIXT] Abschlussset hinter der Tür.** Zusammenfassung und AV-PDF schreiben: „links &
  rechts · 20 mm (Schiebetür zweiläufig: von der Tür abgedeckt, von vorne nicht sichtbar)".
  Auch die 2D-Skizze zeigt die Türen vor Abschlussset und Innenkorpus.

## Seite 2–4 — Korpus-Einteilung für 2, 3 und 4 Schiebetüren

**[GEFIXT] Symmetrische Einteilung in Türfelder.** Ihre Skizzen sind jetzt die Regel:

| Ihre Skizze | Im Konfigurator |
|---|---|
| 1 Korpus = eine Tür, Breite 80er–100er | Türfeld aus einem Korpus |
| „1 + 2 Korpus ½ Breite, 3 Korpus ½ Breite" (grüne Linie = zusätzliche Mittelseite) | Türfeld aus zwei Korpi mit zusammen derselben Breite wie die übrigen Felder |
| Tür zwischen 100 und 150 → „immer 2 Korpi" | Ein Korpus ohne Mittelseite höchstens 100 cm |
| alle Felder gleich breit | Felder, die nicht gleich breit sind, sind nicht wählbar |

Im Schritt „Fronten" stehen alle drei Anzahlen zur Wahl. Je Anzahl ist zu sehen, wie breit die
Tür wird und welche Korpi sie abdeckt (z. B. „100er · Tür 1: Korpus 1 · Tür 2: Korpus 2").
Anzahlen ohne passende Einteilung sind gesperrt, zu schmale oder zu breite Türen werden mit
Grund gemeldet. Geprüft u. a. mit 2 × 100, 50 + 50 + 100, 2 × (100 + 50), 3 × 100, 6 × 50,
8 × 50 und 4 × 60.

**[GEFIXT] Preis der Schiebetüren — wichtig.** Bei dieser Arbeit sind wir auf einen Fehler
gestoßen. Die Kalkulation hat bei der zweiläufigen Schiebetür immer nur **eine** Tür
berechnet, egal ob 2, 3 oder 4 gewählt waren. Bei Testentwurf B (2 × 100er, Glossy/Less) fehlte
damit eine Tür zu 1.950 €. Jetzt gilt: Anzahl × Tür in der Breite des Türfeldes, also so, wie
die Preisliste S. 27 die 80er / 100er / 120er / 150er führt.

| Beispiel | bisher | jetzt |
|---|---|---|
| 2 × 100er, Glossy/Less | 1 × 1.950 € | 2 × 1.950 € = 3.900 € |
| 3 × 100er, Glatt PG 1 | 1 × 735 € | 3 × 735 € |
| 4 × 60er, 2 Türen, Glatt PG 1 | 1 × 80er | 2 × 120er (je 845 €) |
| 2 × (100 + 50), Decoboard | 1 × 100er | 2 × 150er (je 1.055 €) |

Bereits **abgeschlossene** Aufträge behalten wie immer ihren eingefrorenen Preisstand. Offene
Entwürfe mit zweiläufiger Schiebetür rechnen ab sofort richtig.

## Seite 5 — Curve

- **[GEFIXT] Bei Curve kein Griffprofil „Edge".** Das Griffprofil entfällt bei Curve jetzt in
  jedem Material, bisher nur bei Mattlack und „anders". Ein vorher gewähltes Profil erscheint
  weder in der Zusammenfassung noch im AV-PDF. Nebenbei behoben: Die **Pulverfarbe des
  Griffprofils** (Glatt, Glossy/Less) wurde zwar abgefragt, stand aber nicht im AV-PDF. Jetzt
  steht sie dort.

## Ergänzungen

**Die sechs Antworten vom 23.09. — Stand geprüft.** Alle sechs Punkte waren schon umgesetzt
(Rückmeldung Preisarten). Wir haben sie heute erneut gegen Mappe und Supabase geprüft:

- **[GEFIXT] Edge-Griff:** 40 €/lfm, wird berechnet. Die Länge kommt aus der Türhöhe, ein
  eigenes Längenfeld gibt es nicht. Schiebetür = volle Türhöhe, Drehtür = Türhöhe, auf Wunsch
  gekürzt.
- **[GEFIXT] KMK-Wandtablar:** Festpreis + Matrix, 75 € + 180 €/lfm (S. 33).
- **[GEFIXT] Hintere Aufkantung:** 45 €/lfd. m (S. 32).
- **[GEFIXT] Container 4,5 R / 6 R mit Rauchglas-Deckplatte (40-017-0029):** aktiv, wird
  regulär berechnet.
- **[GEFIXT] Tavolo-Massivplatten (80-034-0001 / -0002):** „entwurf", auf Anfrage.
- **[GEFIXT] Personalnummer:** Herr Kerschbaummayr hat M-104, Sarib behält M-004.

In Supabase liegen weiter nur die 7 bekannten Overrides. Keiner davon betrifft diese Artikel.

**[GEFIXT] Raumteiler und Sichtrückwand.** Beide stehen auf „entwurf". Die Abfragen erscheinen
nur, wenn der Artikel in der Stammdatenverwaltung aktiv ist, und zwar sofort nach dem
Speichern. Die Beschriftung lautet jetzt genau:

- „Raumteiler (5% Aufschlag auf den Möbelpreis)"
- „Sichtrückwand (10% Aufschlag auf den Möbelpreis)"

Der Prozentwert kommt aus dem Artikel. Ändern Sie den Satz in der Verwaltung, ändert sich die
Beschriftung mit. Die Rechnung (5 % bzw. 10 % auf den Möbelpreis) ist unverändert. Ihre in der
Oberfläche hinterlegte Fassung „Raumteiler? (5% …)" ersetzt die neue Beschriftung. Wer sie
wieder anpassen möchte, kann das wie gewohnt über den Stift tun.

**[GEFIXT] Stammdaten wirken überall.** Die Durchgriff-Prüfung läuft jetzt auch mit den neu
gebauten Schiebetür-Schränken: **80 von 80 Artikeln** ohne Befund. Jede Preiszeile, die der
Konfigurator erreichen kann, wurde geändert und nachgerechnet. Danach wurde sie zurückgesetzt,
und es gibt keinen fest hinterlegten Betrag. Konfigurator, Abschluss und AV-PDF lesen weiterhin
dieselbe zweistufige Übersicht: Möbelpreis + artikelbezogene Aufschläge = Gesamtmöbelpreis,
dann + Montage + Lieferung.

**[GEFIXT] 2D-Konstruktionsansicht neben dem Formular.** Die zwischenzeitliche 3D-Vorschau ist
wieder entfernt. In den Schritten „Maße", „Material", „Ausstattung" und „Fronten" steht links
eine mitlaufende Skizze, rechts das Formular. Das Formular liegt rechts, weil Rechtshänder mit
Maus oder Touchpad dann kürzere Wege haben.

Die **Trennlinie lässt sich verschieben**: per Maus, Finger oder Pfeiltasten. So kann die
Zeichnung im Kundengespräch groß werden. Ein Doppelklick setzt sie zurück, und das Gerät merkt
sich die Breite. Das Formular bleibt immer mindestens 420 px breit.

Die Skizze ist im Stil Ihrer AV-Zeichnung gehalten, maßstäblich, Maße in mm. Es gibt **vier
Ansichten**:

- **Vorderansicht (geschlossen):** Korpi, Fronten mit Fugen, Öffnungslinien der Drehtüren
  (Spitze zur Bandseite), Griffe, Sockel, Abschlusssets, Verblendung, Maßketten.
- **Innenansicht (offen):** Fronten nur als Kontur. Dahinter die ganze Ausstattung mit
  Oberkante über dem Fußboden, die Rasterleiste je Korpus, Außenschübe mit Trennboden,
  Bodenplatte und Abschlussboden.
- **Draufsicht:** Tiefe, Korpustrennungen, Wand und Wandabstand (Kabelführung bei
  Beleuchtung), Abschlusssets, Verblendungen, Fußleistenausschnitt, Kleiderstangen,
  Container-Grundflächen, Türöffnungsbögen und die zwei Laufebenen der Schiebetüren.
- **Rückansicht:** von hinten gesehen, also gespiegelt. Rückwand je Korpus, Lochreihe,
  zusätzlicher Bodenträger ab 80 cm, Rückwandausschnitt und Revisionsklappe,
  Fußleistenausschnitt, Sichtrückwand.

**Bauteil-Bibliothek.** Jedes Refugium-Bauteil hat ein eigenes Zeichenmodul, das die Skizze
je nach Konfiguration zusammensetzt:

- Korpus mit Seiten und Mittelseiten (2 cm), Böden (28 mm), Glasboden (8 mm), Abschlussboden,
  Sockel und Rückwand.
- Kleiderstange, Kleiderlift, Gürtel-/Krawattenauszug.
- Container Decoboard (3 / 4,5 / 6 / 7,5 R mit Schüben à 1,5 R), Craft A–C (61 / 80 / 80 cm)
  und Conero A–H (61 bis 110 cm), jeweils mit Auszügen und Rauchglas-Deckplatte.
- Innenschublade, Rollboden, Rollkorb, Schuhablage, Hemdeinsatz, LED-Syncro und LED-Band.
- Drehtür, Schub, Klappe, ein- und zweiläufige Schiebetür, offenes Fach.
- Griffe als Silhouetten: Bügelgriff Nr. 90–124 in der Länge laut Liste, Knopf Nr. 19,
  Kantengriff Nr. 125/126, Griffleiste Nr. 127, Muschelgriff Nr. 128, Edge (voll oder gekürzt),
  die Griffleisten von Line, 107 und Curve, PTO und Sondergriff.

**Keine Überlappungen.** Teile hinter einer Front liegen nie übereinander. Plant der Berater
unten Außenschübe, rückt z. B. ein Container Conero, der „am Korpusboden" steht, automatisch
auf das nächste freie Raster über Schüben und Trennboden. Unter der Skizze steht dazu ein
Hinweis wie „Korpus 3 — Container Conero A: über die Außenschübe gesetzt (Raster 4)".

**Parameter statt fester Werte.** Alle Maße und Platzierungsregeln der Zeichnung stehen
zentral in `src/config/konstruktionsParameter.ts`, jeweils mit Quelle: Platten- und Bodenstärken,
Lage der Raster, Bauhöhen der Container, Griffhöhe, Kleiderstangen-Abstand. Was Sie noch nicht
festgelegt haben, ist dort als Annahme gekennzeichnet (Rückfragen 6 und 7). Preise und
Prüfungen hängen nicht an diesen Werten.

**[GEFIXT] Skizze im Vollbild.** Unten links in der Skizze öffnet ein Knopf die aktive Ansicht
bildschirmfüllend. Dort lässt sich stufenlos zoomen, bis 1.200 %: mit + / −, mit dem
Mausrad, mit zwei Fingern auf dem iPad oder per Doppelklick. Ziehen verschiebt den
Ausschnitt, „Einpassen" (oder die Taste 0) zeigt wieder alles. Weil über den Bildausschnitt
der Zeichnung gezoomt wird und nicht über eine Vergrößerung des Bildes, bleiben Maßketten,
Zahlen und Griffe in jeder Stufe gestochen scharf. Die vier Ansichten sind oben umschaltbar,
Esc schließt.

**[GEFIXT] AV-PDF: Seite 1 aufgebaut wie Ihre AV-Konstruktionszeichnung (A4 quer).**

- **Links (immer mittig):** der Schrank in Isometrie, als Vektorzeichnung. Fronten mit Griffen;
  offene Fächer zeigen das Innenleben (Seitenwand, Rückwand, Böden, Kleiderstange, Container).
  Das Material steht nur dann auf den Fronten („-- Furnier – Räuchereiche geölt --"), wenn die
  Fronten verschiedene Materialien/Oberflächen haben. Darüber die
  Hinweise („-- 3 Korpi, 2 Schübe, 3 Drehtüren …", Abschlussset, Verblendung, Beleuchtung,
  Sondermaße, Sonderausstattung).
- **Oben rechts:** „-- Refugium innen <Material> --", der Grundriss mit Maßketten: Gesamtbreite
  und Korpuseinteilung darüber, Frontbreiten darunter, links Korpustiefe und Tiefe mit Front.
  Darunter der Prüfhinweis „Hallo <Kunde>, bitte prüfen Sie umgehend die Zeichnung …".
- **Unten rechts:** nur die Innenansicht (offener Schrank) mit Höhen und LED, in Schwarz-Weiß.
- **Schriftfeld:** „Refugium 18Raster in <Korpus>", Filiale, Fuß\Rolle, Höhe / Breite / Tiefe,
  Liefertermin (leer zum Ausfüllen), Auftragsdatum; X-Felder Softschübe, Metallzarge,
  Drehtüren, Schiebetüren, Umlaufkorpus 20 mm | mit / ohne Lochreihe, Front korpusbündig,
  Front Standard, Umlaufkorpus 30 mm; GRIFF, Front, Korpus, Platte, RW; Auftragserfassung
  (Abschluss des Entwurfs), letzte Änderung, Logo CRAMER über PLANER, Serie; Kunde, Auftragsnummer,
  Möbelsoftnummer (= Entwurfsnummer). Metallzarge und Umlaufkorpus 30 mm kennt der Planer
  nicht; sie bleiben leer.

Ab Seite 2 folgen alle Angaben wie bisher. Serien mit freier Maßeingabe haben keine
Korpusdaten zum Zeichnen; ihr PDF bleibt unverändert.

## Rückfragen

1. **[OFFEN] Türbreite 120–150 cm:** Wir lassen Türen über 120 cm nur in Decoboard und Xtreme
   Plus zu, wie bisher (Punkt 7.7). Die Preisliste führt 150er-Zeilen für „Glatt 1" und „Glatt 4".
   Gilt „Glatt 4" nur für Xtreme Plus, oder auch für Mattlack und Lack in PG 4? Dort wäre der
   150er bei uns gesperrt.
2. **[OFFEN] Abschlussset 20 mm — Preis:** Wir rechnen die 20-mm-Sets mit derselben Preiszeile
   wie die 10-mm-Sets (Höhe × Preisgruppe). Gibt es einen eigenen Preis?
3. **[OFFEN] Material der verdeckten Abschlusssets:** Bei Schiebetüren sind die Sets von vorne
   nicht sichtbar. Soll weiter ein Material gewählt werden, oder gilt z. B. immer das Material
   des Innenkorpus?
4. **[OFFEN] Außenmaß bei Schiebetürschränken:** Wir rechnen wie bei allen Kleiderschränken
   über die Frontbreiten, nur mit 20-mm-Sets. Ist die Außenbreite bei Schiebetüren besser
   „Summe der Korpi + 2 × 2 cm"? Und kommt für die vordere Laufebene noch Tiefe hinzu?
5. **[OFFEN] Drei Korpi hinter einer Tür:** Ihre Skizzen zeigen je Tür einen oder zwei Korpi.
   Ist z. B. eine 150er Tür über 3 × 50er auch möglich? Bisher sperren wir das.

6. **[OFFEN] Griffhöhe an Drehtüren und einläufigen Schiebetüren:** In der Zeichnung sitzt die
   Griffmitte bei 105 cm über dem Fußboden (bei kurzen Türen in der Türmitte), 4 cm von der
   Schließkante. Welche Höhe ist bei Ihnen Standard?
7. **[OFFEN] Lage der Raster:** Aus Ihren Planungsmaßen (S. 27: Pos. 2 = 34,0 cm, Pos. 4 =
   59,6 cm) und „Raster 1 ca. 10 cm über der Bodenplatte" haben wir die Oberkante der
   Bodenplatte bei ca. 11,2 cm abgeleitet. Stimmt das, auch für 21 Raster?

## Technischer Überblick

| Bereich | Datei |
|---|---|
| Türfelder, Höhe 18–21 R, Befunde, AV-Zeile | `src/lib/schiebetuer.ts` (neu) |
| Abschlussset 20 mm im Außenmaß | `src/lib/frontbreiten.ts`, `src/lib/korpusMass.ts` |
| Kalkulation Anzahl × Türfeld-Breite | `src/lib/kalkulation.ts` |
| Fronten-Schritt, Maße-Schritt, Frontkarte | `Fronts.tsx`, `KorpusMasseSection.tsx`, `FrontElementCard.tsx` |
| Curve ohne Griffprofil | `griffProfilAnwendbar` in `src/lib/frontsHelpers.ts` |
| Raumteiler / Sichtrückwand | `src/pages/Korpus/Korpus.tsx` |
| 2D-Skizze | Modell `src/lib/konstruktion.ts` (mm, Stapelregel, Griffformen), Parameter `src/config/konstruktionsParameter.ts`, Bauteil-Bibliothek `src/components/konstruktion/bauteile/`, Ansichten `Konstruktion2D.tsx`, verschiebbares Layout `KonstruktionsLayout.tsx` (`<AppShell skizze>`), Vollbild `SkizzenVollbild.tsx` |
| AV-PDF Seite 1 | Daten `src/lib/lookbookDaten.ts`, Seite `src/lib/pdfLookbook.ts`, Druckbild `src/components/konstruktion/skizzenBild.tsx`, eingebunden in `generatePdf.ts` |
| Prüfung | `scripts/check-ueberarbeitung-10.js` (`npm run ue10:test`), Durchgriff um Schiebetür-Schränke ergänzt |
