# Artikelnummer-Logik

Entwurf zur Abnahme. Noch **nicht** in die Anwendung eingearbeitet — nur in der Arbeitsmappe
`Cramer-Stammdaten.xlsx` umgesetzt, damit sie sich an echten Daten beurteilen lässt.

---

## 1. Vorprüfung: trägt eine sprechende Nummer überhaupt?

Eine Nummer darf nur dann eine Klassifikation enthalten, wenn diese eindeutig ist. Sonst
widerspricht sich die Nummer irgendwann selbst. Geprüft über alle 190 Artikel:

| Prüfung | Ergebnis |
|---|---|
| Artikelgruppe in mehreren Produktgruppen? | **keine** — eindeutig |
| Artikelgruppe mit mehreren Teilearten? | **keine** — eindeutig |

Jede Artikelgruppe gehört zu genau einer Produktgruppe und genau einer Teileart. Damit lässt sich
die Hierarchie verlustfrei in die Nummer codieren.

---

## 2. Der Aufbau

```
        30-012-0011
        │   │   └──── laufende Nummer im Dropdown   0001–9999
        │   └──────── Dropdown      012 = Griff
        └──────────── Teileart       30 = Frontausstattung
```

Drei Blöcke, 9 Ziffern, zwei Trennstriche. Gelesen: *Schritt Frontausstattung,
Auswahlfeld Griff, elfter Artikel.*

### Was sich gegenüber dem alten Schema geändert hat

Bis September 2026 galt ein Vier-Block-Schema `TT-PP-GG-NNNN` mit einer eigenen „Teileart"
(STRUKTUR, BESCHLAG, …) vor der Produktgruppe. Zwei Dinge daran waren Ballast:

**Der erste Block war redundant.** Die alte Teileart ist innerhalb jeder Artikelgruppe konstant —
geprüft, 38 von 38. Wer das Auswahlfeld kennt, kennt die Teileart. Der Block trug also keine
Information, die nicht schon im dritten Block stand, kostete aber Verwirrung: Zwei Blöcke hießen
fast gleich und meinten Verschiedenes.

**Die Auswahlfeld-Nummer war nicht eindeutig.** Sie zählte je Produktgruppe neu, weshalb `05` für
neun verschiedene Dinge stand — Korpus, Drehtür, Griff, Boden, Sockelplatte, Leuchte, Tischplatte,
Zuschlag, Porticus-Modell. Erst zusammen mit dem zweiten Block war sie eindeutig.

Deshalb jetzt: Die frühere **Produktgruppe heißt Teileart** (Block 1), die frühere
**Artikelgruppe heißt Dropdown** und bekommt eine **systemweit eindeutige dreistellige Nummer**
(Block 2). `001` ist überall im System der Korpus, nirgends sonst.

### Vergabe — der Platz zum Erweitern

**Teileart — Zehnerschritte** (Block 1), identisch mit der Schrittreihenfolge im Konfigurator

| Nr | Code | Schritt im Konfigurator |
|---:|---|---|
| 10 | KORPUS | Korpus-Konfiguration |
| 20 | FRONT | Fronten & Abschlüsse |
| 30 | FRONTAUSSTATTUNG | Griffe, Schlösser, PTO |
| 40 | INNENAUSSTATTUNG | Ausstattung hinter der Front |
| 50 | TECHNIK | Beleuchtung & Elektrifizierung |
| 60 | ABSCHLUSS | Sockel, Füße, Rollen, Wandmontage |
| 70 | MOEBEL | Komplette Möbel aus Modellserien |
| 80 | TISCH | Tischplatten & Untergestelle |
| 90 | KALKULATION | Zuschläge & Serviceleistungen |

Frei bleiben sämtliche Zwischenwerte 11–19, 21–29 usw. Eine neue Kategorie lässt sich
dazwischenschieben, ohne eine bestehende Nummer anzufassen.

**Dropdown — fortlaufend und global eindeutig** (Block 2), gruppiert nach Teileart:

| Teileart | Dropdowns |
|---|---|
| 10 KORPUS | 001 Korpus · 002 Mittelseite · 003 Außenset · 004 Abdeckplatte · 005 Ecklösung |
| 20 FRONT | 006 Drehtür · 007 Schiebetür einläufig · 008 Schiebetür zweiläufig · 009 Schublade · 010 Klappe · 011 Front-Aufpreis |
| 30 FRONTAUSSTATTUNG | 012 Griff · 013 Schloss |
| 40 INNENAUSSTATTUNG | 014 Boden · 015 Kleiderstange · 016 Auszug · 017 Container · 018 Spiegel · 019 Schubladeneinlage · 020 Wandelement · 021 Akustikpaneel · 022 Raumteiler · 023 Zubehör |
| 50 TECHNIK | 024 Leuchte · 025 Schalter · 026 Strom · 027 Kabelführung |
| 60 ABSCHLUSS | 028 Sockelplatte · 029 Fuß/Rolle |
| 70 MOEBEL | 030 Porticus-Modell · 031 Supersonus-Modell · 032 Cavum-Modul · 033 Publicum-Regal |
| 80 TISCH | 034 Tischplatte · 035 Untergestell · 036 Arcum-Einsatz |
| 90 KALKULATION | 037 Zuschlag · 038 Verblendung · 039 Service (Montage, Lieferung) |

Ein neues Auswahlfeld bekommt die nächste freie Nummer — **040**, unabhängig davon, zu welcher
Teileart es gehört. Die Nummer ist eine Identität, keine Sortierung.

**Laufende Nummer — fortlaufend** (Block 3). Hier ist bewusst **kein** Abstand gelassen: die
Reihenfolge im Dropdown regelt die Spalte `Sortierung`, nicht die Nummer. Das trennt Identität von
Anzeige — ein Artikel kann in der Liste nach oben rutschen, ohne die Nummer zu wechseln.

### Suchen über das Präfix — wie im ERP

```
30-              alles aus dem Schritt Frontausstattung
30-012-          alle Griffe
20-006-          alle Drehtüren
```

---

## 3. Beispiele aus dem echten Bestand

| Artikelnummer | Kurzzeichen | Bezeichnung | Achsen |
|---|---|---|---|
| `10-001-0001` | KOR-001 | Korpus (Atrium / Velare / Porticus) | Breite × Raster × PG × Tiefe × Variante |
| `10-001-0003` | KOR-003 | Korpus *(Refugium)* | Breite × Raster |
| `10-002-0001` | MIT-001 | Mittelseite (2 cm) | Raster |
| `10-003-0001` | AUS-001 | Außenset | Breite × PG |
| `20-006-0001` | DRT-001 | Drehtür | Breite × Raster × Linie+PG |
| `20-009-0001` | SCB-001 | Schublade | Breite × Raster × Linie+PG × Tiefe |
| `30-012-0013` | GRF-013 | Griff Nr. 19 | — |
| `30-012-0011` | GRF-011 | Griff Nr. 127 Griffleiste | — |
| `50-024-0003` | LEU-003 | LED-Band Aluprofil | Bedingung |
| `90-037-0004` | ZUS-004 | Sichtrückwand *(Zuschlag % vom Möbelpreis)* | — |
| `90-038-0001` | VBL-001 | Verblendung frontbündig *(€/lfm)* | — |

Das **Kurzzeichen** (`DRT-001`) bleibt als Lesehilfe für Gespräche und Bildschirmanzeige
erhalten — es ist ausdrücklich **kein Schlüssel**. Wenn es stört, ist es eine Spalte weniger.

---

## 4. Zwei Konsequenzen, die man kennen sollte

**Die Nummer wird nie geändert.** Sie ist eine sprechende Nummer, und sprechende Nummern haben
genau eine Schwäche: Ändert sich später die Klassifikation eines Artikels, stimmt die Nummer nicht
mehr mit den Spalten überein. Die Lösung ist nicht, die Nummer zu korrigieren — das bricht die
Verweise aus dem Preisblatt und aus allen gespeicherten Aufträgen. Die Regel lautet: **Nummer =
Identität, Spalten = Wahrheit.** Ausgewertet und gefiltert wird über die Spalten. Wird eine
Umklassifizierung sichtbar stören, legt man einen neuen Artikel an und setzt den alten auf
`gesperrt` mit Nachfolger.

**Teileart an Stelle 1 sortiert nach Produktion, nicht nach Konfigurator.** Weil die Teileart
vorne steht, landen Artikel desselben Konfigurationsschritts in unterschiedlichen Nummernblöcken,
sobald sie verschiedene Teilearten haben. Betroffen sind heute zwei Stellen:

* Schritt `ABSCHLUSS` — Sockelplatte ist `10` (Struktur), Fuß/Rolle ist `30` (Beschlag)
* Schritt `TISCH` — Tischplatte `10`, Untergestell `30`, Arcum-Einsatz `10`

Nach Nummer sortiert stehen die also nicht beieinander. Das ist die logische Folge davon, dass die
Teileart die *gröbste* Klassifikation ist — sie entspricht der Sicht von Einkauf und Fertigung.
Für die Konfigurator-Sicht sortiert man nach Produktgruppe, was über die Spalte und den Autofilter
jederzeit geht. Wolltest du stattdessen nach Konfigurator gruppieren, würde man Produktgruppe und
Teileart tauschen (`PP-TT-GG-NNNN`) — sag Bescheid, das ist eine Zeile im Generator.

---

## 5. Zu deiner Frage: Artikelmerkmale im Preisblatt

**Ein Hindernis gibt es, aber es ist lösbar — und der Nutzen überwiegt klar.**

Das Hindernis ist die doppelte Wahrheit: Steht „Griff" sowohl im Artikelstamm als auch in 1509
Preiszeilen, und jemand ändert eine der beiden Stellen, weiß niemand mehr, welche gilt. Genau so
laufen Stammdaten auseinander.

Die Lösung: **die Merkmalsspalten sind Formeln, keine Werte.** Umgesetzt und geprüft.

| Spalte | Inhalt | bearbeitbar |
|---|---|---|
| Artikel | Artikelnummer — der Schlüssel | ja |
| Bezeichnung, Teileart, Produktgruppe, Artikelgruppe, Modus, Preislogik, Einheit, Achsen | `INDEX/MATCH` auf „10 Artikel" | **nein — grau hinterlegt** |
| A1 – A5 | Achsenwerte | ja |
| Preis, Status, Seite | | ja |
| Ref | frühere Zeilen-ID | nein |

Damit gilt:

* **Filtern funktioniert vollständig** — Autofilter arbeitet auf Formelspalten genauso. Alle
  Griffe: Artikelgruppe = `GRIFF` filtern, Preisspalte markieren, ×1,05 rechnen, fertig.
* **Es bleibt eine Quelle der Wahrheit.** Wird ein Artikel im Stamm umbenannt, ändern sich die
  1509 Zeilen automatisch mit.
* **Der Import ignoriert diese Spalten.** Gelesen werden nur Artikel, A1–A5, Preis, Status, Seite.
  Überschreibt jemand versehentlich eine Formel, entsteht kein Datenfehler — nur ein veralteter
  Anzeigewert, der beim nächsten Regenerieren verschwindet.
* Beim **Anlegen einer neuen Preiszeile** muss man die Formeln eine Zeile nach unten ziehen. Das
  ist die einzige Handarbeit, die dazukommt.

Besonders wertvoll ist dabei die Spalte **Achsen**: Ohne sie ist `A1 | A2 | A3` nicht lesbar. Mit
ihr steht in jeder Zeile, dass A1 die Breite, A2 das Raster und A3 die Linie+PG ist.

Geprüft: **12.072 Formeln, 0 Fehler**, alle 1509 Zeilen finden ihren Artikel.

---

## 6. Was jetzt zu entscheiden ist

1. **Reihenfolge der Blöcke** — Teileart zuerst (wie vorgeschlagen) oder Produktgruppe zuerst?
2. **Schrittweiten** — 10er für Teileart und Produktgruppe, 5er für Artikelgruppe. Großzügiger geht,
   kostet aber Lesbarkeit.
3. **Kurzzeichen behalten** oder streichen?
4. **Trennzeichen** — `30-30-05-0011` oder kompakt `30300500 11`? Der Bindestrich passt zur
   Präfixsuche in eurem ERP (`4-`).

Erst wenn das steht, wandert die Logik in den Import und damit in die Anwendung — dann sind die
Nummern vergeben und liegen fest.
