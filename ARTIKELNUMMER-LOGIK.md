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
        30-30-05-0011
        │  │  │  └──── laufende Nummer in der Artikelgruppe   0001–9999
        │  │  └─────── Artikelgruppe        05 = Griff
        │  └────────── Produktgruppe        30 = Frontausstattung
        └───────────── Teileart             30 = Beschlag
```

Vier Blöcke, 10 Ziffern, drei Trennstriche. Gelesen: *Beschlag, im Schritt Frontausstattung,
Dropdown Griff, elfter Artikel.*

### Vergabe in Schritten — der Platz zum Erweitern

Alle drei Klassifikationsblöcke sind **nicht** fortlaufend vergeben, sondern in Schritten. So
lässt sich eine neue Klasse dazwischenschieben, ohne eine einzige bestehende Nummer anzufassen.

**Teileart — Zehnerschritte** (Stelle 1)

| Nr | Code | Bedeutung |
|---:|---|---|
| 10 | STRUKTUR | Strukturteil — trägt das Möbel |
| 20 | FRONT | Frontteil |
| 30 | BESCHLAG | Beschlag |
| 40 | AUSSTATTUNG | Ausstattung |
| 50 | TECHNIK | Technik |
| 60 | KOMPLETT | Fertigmöbel |
| 70 | KALKULATION | Kalkulationsposition |

Frei: 80, 90 sowie sämtliche Zwischenwerte 11–19, 21–29 usw. Wird etwa „Verpackung/Logistik" als
eigene Teileart nötig, wird sie 80 — oder 35, wenn sie fachlich zwischen Beschlag und Ausstattung
gehört.

**Produktgruppe — Zehnerschritte** (Stelle 2), identisch mit der Schrittreihenfolge im Konfigurator

| Nr | Code |
|---:|---|
| 10 | KORPUS |
| 20 | FRONT |
| 30 | FRONTAUSSTATTUNG |
| 40 | INNENAUSSTATTUNG |
| 50 | TECHNIK |
| 60 | ABSCHLUSS |
| 70 | MOEBEL |
| 80 | TISCH |
| 90 | KALKULATION |

**Artikelgruppe — Fünferschritte** (Stelle 3), je Produktgruppe neu beginnend, fachlich sortiert:
erst das Tragende, dann das Zubehör.

| Produktgruppe | Artikelgruppen |
|---|---|
| 10 KORPUS | 05 Korpus · 10 Mittelseite · 15 Außenset · 20 Abdeckplatte · 25 Ecklösung |
| 20 FRONT | 05 Drehtür · 10 Schiebetür einläufig · 15 Schiebetür zweiläufig · 20 Schublade · 25 Klappe · 30 Front-Aufpreis |
| 30 FRONTAUSSTATTUNG | 05 Griff · 10 Schloss |
| 40 INNENAUSSTATTUNG | 05 Boden · 10 Kleiderstange · 15 Auszug · 20 Container · 25 Spiegel · 30 Schubladeneinlage · 35 Wandelement · 40 Akustikpaneel · 45 Raumteiler · 50 Zubehör |
| 50 TECHNIK | 05 Leuchte · 10 Schalter · 15 Strom · 20 Kabelführung |
| 60 ABSCHLUSS | 05 Sockelplatte · 10 Fuß/Rolle |
| 70 MOEBEL | 05 Porticus-Modell · 10 Supersonus-Modell · 15 Cavum-Modul · 20 Publicum-Regal |
| 80 TISCH | 05 Tischplatte · 10 Untergestell · 15 Arcum-Einsatz |
| 90 KALKULATION | 05 Zuschlag · 10 Verblendung |

**Laufende Nummer — fortlaufend** (Stellen 4–7). Hier ist bewusst **kein** Abstand gelassen: die
Reihenfolge im Dropdown regelt die Spalte `Sortierung`, nicht die Nummer. Das trennt Identität von
Anzeige — ein Artikel kann in der Liste nach oben rutschen, ohne die Nummer zu wechseln.

### Suchen über das Präfix — wie im ERP

```
30-              alle Beschläge
20-20-           alle Fronten im Schritt „Fronten"
20-20-05-        alle Drehtüren
```

---

## 3. Beispiele aus dem echten Bestand

| Artikelnummer | Kurzzeichen | Bezeichnung | Achsen |
|---|---|---|---|
| `10-10-05-0001` | KOR-001 | Korpus (Atrium / Velare / Porticus) | Breite × Raster × PG × Tiefe × Variante |
| `10-10-05-0003` | KOR-003 | Korpus *(Refugium)* | Breite × Raster |
| `10-10-10-0001` | MIT-001 | Mittelseite (2 cm) | Raster |
| `10-10-15-0001` | AUS-001 | Außenset | Breite × PG |
| `20-20-05-0001` | DRT-001 | Drehtür | Breite × Raster × Linie+PG |
| `20-20-20-0001` | SCB-001 | Schublade | Breite × Raster × Linie+PG × Tiefe |
| `30-30-05-0013` | GRF-013 | Griff Nr. 19 | — |
| `30-30-05-0011` | GRF-011 | Griff Nr. 127 Griffleiste | — |
| `50-50-05-0003` | LEU-003 | LED-Band Aluprofil | Bedingung |
| `70-90-05-0004` | ZUS-004 | Sichtrückwand *(Zuschlag % vom Möbelpreis)* | — |
| `70-90-10-0001` | VBL-001 | Verblendung frontbündig *(€/lfm)* | — |

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
