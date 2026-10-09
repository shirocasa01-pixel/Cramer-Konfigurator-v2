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
  Auch die 3D-Vorschau zeigt die Türen über Abschlussset und Innenkorpus.

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

**[GEFIXT] 3D-Vorschau (Prototyp).** Im Schritt „Maße" erscheint unter dem Außenmaß eine
drehbare 3D-Ansicht des Kleiderschranks. Sie zeigt die Korpus-Module (50er, 60er, 80er,
100er, Sondermaße, beliebig viele, getestet mit 4 bis 8) samt Höhe, Tiefe und Abschlusssets.
Darüber wahlweise:

- die geplanten Fronten (Drehtüren, Schübe, Schiebetüren),
- Standard-Drehtüren,
- zweiläufige Schiebetüren in zwei Laufebenen,
- keine Fronten (mit Kleiderstange).

Jede Änderung an Breite, Höhe oder Anzahl baut das Modell sofort neu. Das Modell ist eine
Anschauung, maßgeblich bleiben Außenmaß und AV.

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

## Technischer Überblick

| Bereich | Datei |
|---|---|
| Türfelder, Höhe 18–21 R, Befunde, AV-Zeile | `src/lib/schiebetuer.ts` (neu) |
| Abschlussset 20 mm im Außenmaß | `src/lib/frontbreiten.ts`, `src/lib/korpusMass.ts` |
| Kalkulation Anzahl × Türfeld-Breite | `src/lib/kalkulation.ts` |
| Fronten-Schritt, Maße-Schritt, Frontkarte | `Fronts.tsx`, `KorpusMasseSection.tsx`, `FrontElementCard.tsx` |
| Curve ohne Griffprofil | `griffProfilAnwendbar` in `src/lib/frontsHelpers.ts` |
| Raumteiler / Sichtrückwand | `src/pages/Korpus/Korpus.tsx` |
| 3D-Modell / Darstellung | `src/lib/schrankModell.ts`, `src/components/vorschau/Schrank3DVorschau.tsx` (Three.js 0.186.1, lazy geladen) |
| Prüfung | `scripts/check-ueberarbeitung-10.js` (`npm run ue10:test`), Durchgriff um Schiebetür-Schränke ergänzt |
