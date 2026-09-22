# Stammdatenverwaltung und Preislogik — Überarbeitung 09/2026

Stand: 22.09.2026 · Grundlage: Preisliste 06.2026 · Prüfung: `npm run preisart:test`

Kennzeichnung wie gewohnt: **[GEFIXT]** umgesetzt und geprüft · **[OFFEN]** Rückfrage an Cramer.

---

## 1 · Stammdaten aktualisieren und Lookup-Logik prüfen

**[GEFIXT] Abgleich Stamm ↔ Konfigurator.** Alle 64 Zuordnungen des Konfigurators
(Korpus, Mittelseite, Außenset, Fußleistenausschnitt, sieben Fronttypen, 20 Ausstattungen
plus Kleiderstange als Komponente, 13 Container-Varianten je mit Decoboard- und
Rauchglas-Artikel, Verblendung, Aufschläge, Montage/Lieferung) treffen einen aktiven Artikel
mit passender Preisart; alle 15 Griff-Optionen finden ihren Griff-Artikel. Die Prüfung läuft
als Teil von `npm run preisart:test` mit (Abschnitt B).

**[GEFIXT] Drei Fehler aus der Umstellung auf das neue Nummernschema (TT-DDD-NNNN)**,
die beim Abgleich aufgefallen sind:

| Stelle | Fehler | Folge bisher |
|---|---|---|
| Griff-Lookup der Kalkulation | suchte Griffe noch unter `30-30-05-…` | kein Griff wurde je gefunden — der Edge-Griff (40 €/lfm) blieb **still ohne Preis** |
| „Neuer Artikel" (Artikelverwaltung) | prüfte das alte Muster `TT-PP-GG-NNNN` | jede gültige neue Nummer wurde abgelehnt |
| „Duplizieren" | erwartete vier Blöcke | meldete bei jedem Artikel „keine Nummer mehr frei" |
| Excel-Import-Prüfung | altes Muster | jeder importierte Artikel wäre als fehlerhaft markiert worden |

Stückgriffe bleiben wie bisher im Türpreis enthalten. Der Edge-Griff erscheint jetzt als
eigene Position — mangels erfasster Grifflänge „auf Anfrage" statt still 0 € (siehe Rückfrage).

**[GEFIXT] Preiszeilen gegen die Preisliste geprüft.** Alle 22 Kombinationspreise
(„EUR/Stk zzgl. … EUR/m²" u. ä.) wurden mit der Preislisten-Extraktion verglichen. Eine
Abweichung: **Wandpaneele PG 2–4** standen mit 150 €/m² in der Mappe, die Preisliste nennt
210 / 270 / 330 €/m² (S. 33). Korrigiert (Migration, mit Quellenangabe). Die Wandpaneele
sind im Konfigurator nicht verbaut — kein Entwurf ändert sich dadurch.

**[GEFIXT] Supabase-Overrides geprüft (102 Zeilen).** Jede Zeile wurde mit der Mappe
verglichen. Was den neuen Regeln widersprach oder nichts mehr änderte, ist entfernt —
**85 Zeilen**, vollständig gesichert in `supabase/override-bereinigung-preisarten.json`:

| Override | Befund | Entscheidung |
|---|---|---|
| 90-037-0001 Raumteiler | „entwurf", Preislogik AUF_ANFRAGE, Bemerkung „wird NICHT mehr automatisch kalkuliert" | entfernt — widerspricht der Vorgabe (Raumteiler als Aufschlag); der Aufschlag stünde sonst „auf Anfrage" |
| 90-037-0004 Sichtrückwand | derselbe Altstand | entfernt |
| 10-004-0001 Abdeckplatte | einzige Abweichung: gestrichener Code MATRIX_AUF | entfernt (ohne Wirkung) |
| 20-009-0001 Schublade, 40-017-0018 | identisch mit der Mappe | entfernt (ohne Wirkung, hätten künftige Mappen-Pflege verdeckt) |
| 80 Drehtür-Preiszeilen | „102,1 / 114,9 / 191,2 / 230,1 cm" — Betrag für Betrag gleich den Mappenzeilen derselben Rasterstufe | entfernt (Duplikate mit abweichender Stufengrenze) |

Bewusst gepflegte Änderungen sind **nicht** angetastet (17 Zeilen bleiben), auch wenn sie
der Preisliste widersprechen — dazu die Rückfragen unten. Gewollte Sperrungen bleiben:
Überhöhe (gesperrt — der 20-%-Aufschlag steckt bereits in den 21-Raster-Preisen),
wandhängende Kastenmöbel und Sonderprogrammierungen („entwurf", Preisart „Auf Anfrage"),
Anlehnleiter („entwurf", „in arbeit").

**[GEFIXT] Zentral gespeichert.** Die Artikelverwaltung bleibt die maßgebliche Quelle:
Preisart, Aufschlagsätze und Preislisten-Nr. sind Felder des Artikels, laufen über
„Speichern" nach Supabase und gelten damit auf allen Geräten. Die bestehenden Modulregeln
(Mittelseite, Außenset, Front-Geometrie, Ausstattung …) sind unverändert.

## 2 · Preislogiken sauber unterscheiden

**[GEFIXT] Sechs Preisarten** — Auswahl im Artikeldialog, Reiter „Preisart & Preise":

| Preisart | Funktionsweise | Anzahl |
|---|---|---:|
| Festpreis | Ein fest hinterlegter Preis. | 74 |
| Matrix – Stufenpreis | Matrix – Lookup über die Achsen. Maße gehen auf die nächste hinterlegte Stufe. | 110 |
| Matrix – Maßgenau | Matrix – Lookup über die Achsen. Betrag je Einheit × tatsächliches Maß, ohne Stufen. | 8 |
| Festpreis + Matrix | Fester Grundpreis plus variabler Matrixpreis, z. B. je laufendem Meter. | 10 |
| Aufschlag | Prozentsatz oder Betrag auf eine festgelegte Preisbasis. | 4 |
| Auf Anfrage | Bewusst ohne automatischen Preis. | 10 |

**[GEFIXT] Bestehende Ergebnisse beibehalten.** Die bisherige Preislogik MATRIX wurde nicht
pauschal umbenannt, sondern je Artikel so eingeordnet, wie die Engine ihn tatsächlich
rechnete (Zeilen je Einheit + Grundpreis → Festpreis + Matrix; nur je Einheit → Maßgenau;
sonst Stufenpreis). Nachweis: alle 24 hinterlegten Entwürfe in je drei Varianten
(72 Kalkulationen, mit Excel-Stand und mit dem Live-Stand aus Supabase) — **0 Abweichungen**
bei Positionen und Möbelpreis.

- Stufenpreis rundet nur auf Stufen, die in den Preiszeilen stehen (Korpus 55 cm → 60er);
  50 cm bleibt 50er — keine pauschale Aufrundung.
- Maßgenau rechnet mit dem Maß, wie es ist (Verblendung 4,01 m × 75 €/m = 300,75 €). Steht
  in einer Maßspalte doch ein Wert, zählt nur ein genau passender — zwischen zwei
  Preiszeilen wird nicht interpoliert, sondern „auf Anfrage" gemeldet.
- Altstände mit dem früheren Code MATRIX (Supabase, alte Excel-Exporte) werden beim Rechnen
  genauso eingeordnet und im Artikeldialog mit einem Hinweis in die neue Preisart überführt.

**Neu im Artikeldialog:** Unter der Preisart prüft die Verwaltung, ob die Preiszeilen zur
Preisart passen, und eine **Preisprobe** rechnet ein eingegebenes Maß mit derselben Engine wie
die Kalkulation — noch vor dem Speichern (Wandsteckboden 150 cm: 75 € + 1,5 m × 180 €/m = 345 €).

## 3 · Aufschläge und Kombinationspreise

**[GEFIXT] Raumteiler und Sichtrückwand** sind Artikel mit Preisart „Aufschlag": 5 % bzw. 10 %
auf den Möbelpreis. Der zweite betroffene Artikel aus den Beschreibungen ist die
Sichtrückwand („Aufschlag 10 % auf den Möbelpreis"). Die übrigen Prozent-Artikel
(wandhängende Kastenmöbel 15 %, Überhöhe 20 %) bleiben laut Reform-Vorgabe „Auf Anfrage" —
dort fehlt eine eindeutige Basis bzw. der Aufschlag steckt schon im Preis.

**[GEFIXT] Aufschläge konfigurierbar:** Satz (%) oder Betrag (€) und die Preisbasis
(Möbelpreis oder Gesamtmöbelpreis) stehen im Artikel. Fehlt eine Angabe oder ist der
Artikel gesperrt, wird nichts geschätzt — die Zeile steht „auf Anfrage", die Kalkulation
ist nicht verbindlich.

**[GEFIXT] Festpreis + Matrix:** Grundpreis (Zeile „Fixpreis") und variabler Preis (Zeile je
Einheit) stehen getrennt und werden in der Kalkulation als zwei benannte Teilpositionen mit
Summe gezeigt. Fehlt einer der beiden Teile → „auf Anfrage" statt halber Preis.

## 4 · Montage und Lieferung

**[GEFIXT]** Eigene Artikel im neuen Dropdown 039 „Serviceleistung":

| Artikel | Preisliste | Vorgabe | Basis |
|---|---|---|---|
| 90-039-0001 Montage | Art. 21033 | 10 % | Gesamtmöbelpreis |
| 90-039-0002 Lieferung regional | Art. 21032 | 3 % | Gesamtmöbelpreis |

Die Sätze wurden aus „50 Meta" übernommen und stehen dort nicht mehr (Verweiszeile auf den
Artikel). Änderbar in der Artikelverwaltung; im Abschluss weiterhin per Häkchen abwählbar
(Vorgabe: an). Die Preislisten-Nummer steht in Kalkulation, Abschluss und PDF.

## Ergänzung · Kalkulationsreihenfolge und Darstellung

**[GEFIXT] Zwei Stufen** in Kalkulation, Abschluss und AV-PDF — aus derselben Funktion
(`lib/kalkulationsUebersicht.ts`), damit Bildschirm und Papier nie auseinanderlaufen:

| Kalkulationsposition | Betrag |
|---|---:|
| Artikel und Ausstattung | 3.000,00 € |
| Artikelbezogene Aufschläge | 200,00 € |
| **Gesamtmöbelpreis** | **3.200,00 €** |
| Montage (10 %) | 320,00 € |
| Lieferung (3 %) | 96,00 € |
| **Gesamtpreis inkl. Montage und Lieferung** | **3.616,00 €** |

Dieses Beispiel ist als Testfall hinterlegt und wird exakt so berechnet. Montage und
Lieferung rechnen unabhängig voneinander auf den Gesamtmöbelpreis, nie aufeinander, und
kommen je genau einmal vor.

**Einzige gewollte Änderung an bestehenden Ergebnissen:** Bei Entwürfen **mit** Raumteiler
oder Sichtrückwand rechnen Montage und Lieferung jetzt auf den Gesamtmöbelpreis statt auf
den reinen Möbelpreis (Demo-Entwurf mit beiden: Montage 471,30 € → 542,00 €). Ohne diese
Aufschläge ändert sich nichts. Bereits abgeschlossene Aufträge behalten ihren eingefrorenen
Preisstand; auch ältere Snapshots werden zweistufig angezeigt.

## 5 · Abschließende Kontrolle — Testergebnisse

`npm run preisart:test` (neu) und alle bestehenden Prüfungen — **alle bestanden**:

| Frage | Prüfung | Ergebnis |
|---|---|---|
| Festpreis | Fußleistenausschnitt 50-027-0007 | 240,00 € ✓ (Menge 2: 480,00 €) |
| Matrix – Stufenpreis | Korpus Refugium 60er · 18 R · 60 cm · PG 1 | 258,00 € ✓ · 55 cm → 60er ✓ · 50 cm bleibt 50er (237,00 €) ✓ · 102 cm → auf Anfrage ✓ |
| Matrix – Maßgenau | Verblendung korpusbündig 3,35 m / 4,01 m · Lamellen PG 2 1,2 m | 251,25 € ✓ · 300,75 € ✓ · 1.890,00 € ✓ · keine Interpolation ✓ |
| Festpreis + Matrix | Wandsteckboden 1,5 m · Wandpaneel PG 3 1 × 2 m | 75 + 270 = 345,00 € ✓ · 75 + 540 = 615,00 € ✓ |
| Aufschläge | Demo-Entwurf (Möbelpreis 4.713,00 €) | Raumteiler 235,65 € · Sichtrückwand 471,30 € · Gesamtmöbelpreis 5.419,95 € ✓ |
| Montage/Lieferung | Sätze auf 12 % / 5 % geändert, einzeln abgewählt, aus Supabase geladen (8 %) | 565,56 € / 235,65 € ✓ · abgewählt zählt nicht ✓ · 377,04 € ✓ |
| Gleichheit | Artikelverwaltung (Preisprobe) = Konfigurator = Kalkulation = Snapshot = PDF | ✓ — PDF zusätzlich gerendert geprüft (4.713,00 → 5.419,95 → 6.124,55 €) |
| Gesperrte Artikel | Korpus, Raumteiler, Montage gesperrt bzw. Entwurf | jeweils „auf Anfrage", nicht verbindlich ✓ |
| Supabase | Laden eines Satzes aus Supabase, Alt-Override, Speichern/Laden-Logik (`sync:test`) | ✓ |
| Bestand | `data:test` `kalk:test` `preis:test` `pg:test` `achsen:test` `praxis:test` (372 Teilbeträge) `sync:test` `ue89:test` `format:test` `mass:test` | ✓ · `tsc` ✓ · `vite build` ✓ |

---

## Rückfragen

1. **[OFFEN] Edge-Griff.** In Supabase ist eine Staffel gepflegt (100/200/300 cm → 40/80/120 €,
   also je angefangenem Meter); die Preisliste S. 3 nennt 40 €/lfm maßgenau. Welche Rechnung
   soll gelten? Und woher soll die Grifflänge kommen — sollen wir sie im Konfigurator abfragen,
   oder gilt die Fronthöhe („bei Schiebetüren volle Türhöhe, bei Drehtüren kürzbar")? Bis dahin
   steht der Edge-Griff sichtbar „auf Anfrage" statt wie bisher unbemerkt ohne Preis.
2. **[OFFEN] KMK-Wandtablar** ist in Supabase als Festpreis 255 € gepflegt; die Preisliste S. 33
   nennt 75 € + 180 €/lfm (Festpreis + Matrix). Sollen wir auf die Preisliste zurückstellen?
3. **[OFFEN] Hintere Aufkantung** ist in Supabase als Festpreis 45 € je Stück gepflegt; die
   Preisliste S. 32 nennt 45 €/lfd.m. Ist der Stückpreis gewollt?
4. **[OFFEN] Container 4,5 R / 6 R mit Rauchglas-Deckplatte** (40-017-0029) ist gesperrt. Der
   Konfigurator bietet das Rauchglas-Häkchen weiter an; die Position steht dann „auf Anfrage".
   Ist die Sperre gewollt, oder sollen wir sie aufheben?
5. **[OFFEN] Tavolo-Massivplatten** (80-034-0001/-0002) führen vier €/m²-Zeilen ohne
   unterscheidende Achse (3 cm / 4 cm / andere Formen); die Preisliste nennt zusätzlich einen
   Grundpreis von 115 €. Tavolo ist noch nicht konfiguriert — wir ergänzen das, sobald die
   Zuordnung bestätigt ist.
6. **[OFFEN] Personalnummer M-004** ist doppelt vergeben (Mappe: Sarib Test-Berater, Supabase:
   Dietmar Kerschbaummayr). Außerhalb dieser Überarbeitung — bitte kurz bestätigen, welche
   Nummer Herr Kerschbaummayr bekommen soll.

## Technischer Überblick

| Bereich | Datei |
|---|---|
| Preisarten, Ableitung, Konsistenz, Aufschlagsbasen | `src/lib/preisarten.ts` |
| Lookup je Preisart (Stufe / exakt, Bezugsgrößen) | `src/lib/preisLookup.ts` |
| Zweistufige Kalkulation, Preisprobe, Griff-Lookup | `src/lib/kalkulation.ts` |
| Häkchen → Aufschlag-Artikel | `src/config/preisMapping.ts` (`artikelAufschlaege`, `serviceZuschlaege`) |
| Übersicht für Abschluss und PDF | `src/lib/kalkulationsUebersicht.ts`, `KalkulationsPanel.tsx`, `generatePdf.ts` |
| Artikelverwaltung | `ArtikelDetailModal.tsx`, `PreisartEditor.tsx`, Spalte „Preisart" im Gitter |
| Mappe | `scripts/migrate-preisarten.js` (idempotent) · neue Spalten „Aufschlag", „Aufschlag-Einheit", „Aufschlag-Basis", „Preislisten-Nr." |
| Supabase | `scripts/bereinige-overrides-preisarten.js` · Sicherung `supabase/override-bereinigung-preisarten.json` |
| Tests | `scripts/check-preisarten.js` (`npm run preisart:test`) |
