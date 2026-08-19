# -*- coding: utf-8 -*-
"""
Setzt CRAMER-PLANER-Technischer-Aufbau.md als A4-PDF.

Bewusst kein generischer Markdown-Konverter: die Datei benutzt eine bekannte,
begrenzte Teilmenge (H1-H3, Tabellen, Code-Blöcke, Listen, Zitate, Trennlinien,
fett/kursiv/Code inline). Der Parser deckt genau diese Teilmenge ab — dafür
stimmt der Satz.

Schriften: Segoe UI (Fließtext) + Consolas (Code, wegen der Rahmenzeichen der
ASCII-Diagramme). Vor dem Satz wird jedes Zeichen gegen den Zeichenvorrat der
Schrift geprüft; fehlende Zeichen werden ersetzt statt als schwarzer Kasten
gedruckt zu werden.
"""

import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont, TTFontFile
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle,
)
from reportlab.platypus.flowables import Flowable
from reportlab.platypus.tableofcontents import TableOfContents

# ---------------------------------------------------------------------------
# Pfade
# ---------------------------------------------------------------------------

PROJEKT = r"C:\Users\Lenovo\OneDrive\Desktop\Cramer Planer 2 - Johannes x Sarib Version"
QUELLE = os.path.join(PROJEKT, "CRAMER-PLANER-Technischer-Aufbau.md")
ZIEL = os.path.join(PROJEKT, "CRAMER-PLANER-Technischer-Aufbau.pdf")

# ---------------------------------------------------------------------------
# Farben — warme Neutraltöne auf weißem Papier, Nussbaum als einziger Akzent
# ---------------------------------------------------------------------------

INK = colors.HexColor("#1A1D21")   # Fließtext, leicht kühles Schwarz
MUTED = colors.HexColor("#5F6672")  # Bildunterschriften, Seitenzahlen
WALNUT = colors.HexColor("#7A4E24")  # Akzent: Nussbaum
WALNUT_L = colors.HexColor("#A97A4E")
HAIRLINE = colors.HexColor("#DAD5CC")  # warmes Grau
SURFACE = colors.HexColor("#F5F2ED")   # Tabellenkopf, Code-Grund
PAPER = colors.white

# Farben der drei Merker aus dem Dokument
TINT = {
    "IST": (colors.HexColor("#EFF1F4"), colors.HexColor("#5F6672")),
    "LÜCKE": (colors.HexColor("#FBF2E0"), colors.HexColor("#B07A16")),
    "EMPFEHLUNG": (colors.HexColor("#EDF3EE"), colors.HexColor("#4A7550")),
}

# ---------------------------------------------------------------------------
# Schriften
# ---------------------------------------------------------------------------

WINFONTS = r"C:\Windows\Fonts"
FONT_DEFS = [
    ("Body", "segoeui.ttf"), ("Body-Bold", "segoeuib.ttf"),
    ("Body-It", "segoeuii.ttf"), ("Body-BoldIt", "segoeuiz.ttf"),
    ("Mono", "consola.ttf"), ("Mono-Bold", "consolab.ttf"),
]
for name, datei in FONT_DEFS:
    pdfmetrics.registerFont(TTFont(name, os.path.join(WINFONTS, datei)))
pdfmetrics.registerFontFamily(
    "Body", normal="Body", bold="Body-Bold", italic="Body-It", boldItalic="Body-BoldIt"
)
pdfmetrics.registerFontFamily("Mono", normal="Mono", bold="Mono-Bold")

# Zeichenvorrat prüfen: was keine Schrift kennt, wird ersetzt statt geschwärzt.
_VORRAT = {
    "Body": set(TTFontFile(os.path.join(WINFONTS, "segoeui.ttf")).charToGlyph),
    "Mono": set(TTFontFile(os.path.join(WINFONTS, "consola.ttf")).charToGlyph),
}
ERSATZ = {"⇒": "→", "✓": "√", "⚠": "!", "⧉": "»"}
_fehlend = set()


def sicher(text, familie="Body"):
    """Ersetzt Zeichen, die die Schrift nicht führt."""
    vorrat = _VORRAT[familie]
    out = []
    for ch in text:
        if ord(ch) in vorrat or ch in "\n\t":
            out.append(ch)
            continue
        kandidat = ERSATZ.get(ch)
        if kandidat and all(ord(c) in vorrat for c in kandidat):
            out.append(kandidat)
        else:
            _fehlend.add(ch)
            out.append("?")
    return "".join(out)


# ---------------------------------------------------------------------------
# Absatzformate
# ---------------------------------------------------------------------------

S = {}
S["body"] = ParagraphStyle(
    "body", fontName="Body", fontSize=9.4, leading=14.2, textColor=INK,
    spaceAfter=0, alignment=TA_LEFT, hyphenationLang="de_DE", embeddedHyphenation=1,
)
S["h1"] = ParagraphStyle(
    "h1", parent=S["body"], fontName="Body-Bold", fontSize=19, leading=23,
    textColor=WALNUT, spaceBefore=0, spaceAfter=2,
)
S["h1num"] = ParagraphStyle(
    "h1num", parent=S["body"], fontName="Body-Bold", fontSize=8, leading=10,
    textColor=WALNUT_L, spaceAfter=3,
)
S["h2"] = ParagraphStyle(
    "h2", parent=S["body"], fontName="Body-Bold", fontSize=13, leading=16.5,
    textColor=INK, spaceBefore=16, spaceAfter=5,
)
S["h3"] = ParagraphStyle(
    "h3", parent=S["body"], fontName="Body-Bold", fontSize=10.6, leading=14,
    textColor=WALNUT, spaceBefore=12, spaceAfter=3,
)
S["h4"] = ParagraphStyle(
    "h4", parent=S["body"], fontName="Body-Bold", fontSize=9.6, leading=13,
    textColor=INK, spaceBefore=10, spaceAfter=2,
)
S["li"] = ParagraphStyle("li", parent=S["body"], leftIndent=11, bulletIndent=1)
S["quote"] = ParagraphStyle(
    "quote", parent=S["body"], fontSize=9.2, leading=13.8, leftIndent=9, rightIndent=4,
)
S["cell"] = ParagraphStyle(
    "cell", parent=S["body"], fontSize=8.4, leading=11.6, spaceAfter=0,
)
S["cellhead"] = ParagraphStyle(
    "cellhead", parent=S["cell"], fontName="Body-Bold", textColor=INK,
)
S["cellr"] = ParagraphStyle("cellr", parent=S["cell"], alignment=TA_RIGHT)
S["cellheadr"] = ParagraphStyle("cellheadr", parent=S["cellhead"], alignment=TA_RIGHT)
S["toc0"] = ParagraphStyle(
    "toc0", parent=S["body"], fontName="Body-Bold", fontSize=10, leading=17,
    spaceBefore=7, textColor=INK,
)
S["toc1"] = ParagraphStyle(
    "toc1", parent=S["body"], fontSize=9, leading=14, leftIndent=13, textColor=MUTED,
)
S["caption"] = ParagraphStyle(
    "caption", parent=S["body"], fontSize=8, leading=11, textColor=MUTED,
)

PAGE_W, PAGE_H = A4
M_L, M_R, M_T, M_B = 22 * mm, 20 * mm, 24 * mm, 20 * mm
AVAIL = PAGE_W - M_L - M_R

# ---------------------------------------------------------------------------
# Inline-Auszeichnung
# ---------------------------------------------------------------------------

_RE_CODE = re.compile(r"`([^`]+)`")
_RE_BOLD = re.compile(r"\*\*(.+?)\*\*", re.S)
_RE_ITAL = re.compile(r"(?<![\*\w])\*([^\*\n]+?)\*(?!\*)")
_RE_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def inline(text):
    """Markdown-Auszeichnung → ReportLab-Auszeichnung. Reihenfolge zählt:
    erst maskieren, dann Code (damit ** in Code nicht greift), dann fett/kursiv."""
    text = sicher(text)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = _RE_LINK.sub(r"\1", text)

    platzhalter = []

    def _code(m):
        inhalt = sicher(m.group(1), "Mono")
        inhalt = inhalt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        platzhalter.append(
            f'<font face="Mono" size="8.2" color="#3C4650">{inhalt}</font>'
        )
        return f"\x00{len(platzhalter)-1}\x00"

    # Der Code-Inhalt wurde oben schon maskiert – hier zurückholen und neu maskieren.
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = _RE_CODE.sub(_code, text)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    text = _RE_BOLD.sub(r"<b>\1</b>", text)
    text = _RE_ITAL.sub(r"<i>\1</i>", text)

    for i, wert in enumerate(platzhalter):
        text = text.replace(f"\x00{i}\x00", wert)
    return text


def klartext(text):
    """Dieselbe Zeile ohne Auszeichnung – für Breitenmessung."""
    text = _RE_LINK.sub(r"\1", text)
    text = _RE_CODE.sub(r"\1", text)
    text = _RE_BOLD.sub(r"\1", text)
    text = _RE_ITAL.sub(r"\1", text)
    return sicher(text)


# ---------------------------------------------------------------------------
# Bausteine
# ---------------------------------------------------------------------------

class Regel(Flowable):
    """Waagerechte Linie. Ohne `breite` über die volle Satzbreite des Rahmens —
    die steht erst beim Umbruch fest, deshalb wird sie in `wrap()` übernommen."""

    def __init__(self, hoehe=10, farbe=HAIRLINE, staerke=0.5, breite=None):
        Flowable.__init__(self)
        self.hoehe, self.farbe, self.staerke, self.breite = hoehe, farbe, staerke, breite
        self.width, self.height = breite or 0, hoehe

    def wrap(self, verfuegbar_b, verfuegbar_h):
        self.width = self.breite if self.breite else verfuegbar_b
        self.height = self.hoehe
        return self.width, self.height

    def draw(self):
        self.canv.setStrokeColor(self.farbe)
        self.canv.setLineWidth(self.staerke)
        y = self.height / 2
        self.canv.line(0, y, self.width, y)


def code_block(zeilen):
    """Code-/Diagrammblock: Consolas auf getöntem Grund mit Akzentkante links.
    Schriftgrad wird so gewählt, dass die längste Zeile ohne Umbruch passt."""
    text = sicher("\n".join(zeilen), "Mono")
    innen = AVAIL - 20  # Polsterung links/rechts
    laengste = max((len(z) for z in text.split("\n")), default=1)
    # Consolas ist dickteneinheitlich: Zeichenbreite = 0.55 em
    grad = min(8.2, innen / (laengste * 0.55) if laengste else 8.2)
    grad = max(5.6, grad)
    stil = ParagraphStyle(
        "code", fontName="Mono", fontSize=grad, leading=grad * 1.34,
        textColor=colors.HexColor("#2B3138"), spaceAfter=0,
    )
    t = Table([[Preformatted(text, stil)]], colWidths=[AVAIL])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("LINEBEFORE", (0, 0), (0, -1), 2, WALNUT_L),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return [Spacer(1, 7), t, Spacer(1, 9)]


def zitat_block(zeilen):
    """Zitat/Merker. Trägt es [IST]/[LÜCKE]/[EMPFEHLUNG], wird es eingefärbt."""
    roh = "\n".join(zeilen)
    grund, kante = colors.HexColor("#FAFAF8"), HAIRLINE
    for schluessel, (g, k) in TINT.items():
        if f"[{schluessel}]" in roh:
            grund, kante = g, k
            break
    absaetze = [Paragraph(inline(a.replace("\n", " ")), S["quote"])
                for a in re.split(r"\n\s*\n", roh) if a.strip()]
    zellen = []
    for i, p in enumerate(absaetze):
        zellen.append([p])
        if i < len(absaetze) - 1:
            zellen.append([Spacer(1, 5)])
    t = Table(zellen, colWidths=[AVAIL])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), grund),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, kante),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    t._argW_pad = True
    return [Spacer(1, 7), t, Spacer(1, 9)]


def spaltenbreiten(rohzeilen, ausrichtung):
    """Verteilt die Satzbreite auf die Spalten: erst der Mindestbedarf
    (längstes Wort), der Rest im Verhältnis des Wunschbedarfs (ganze Zelle)."""
    n = len(ausrichtung)
    polster = 11.0
    wunsch, minimum = [0.0] * n, [0.0] * n
    for zeile in rohzeilen:
        for i, zelle in enumerate(zeile[:n]):
            txt = klartext(zelle)
            wunsch[i] = max(wunsch[i], pdfmetrics.stringWidth(txt, "Body", 8.4))
            teile = txt.split() or [""]
            minimum[i] = max(minimum[i], max(
                pdfmetrics.stringWidth(w, "Body-Bold", 8.4) for w in teile))
    wunsch = [w + polster for w in wunsch]
    minimum = [min(m + polster, 150.0) for m in minimum]

    if sum(wunsch) <= AVAIL:
        rest = AVAIL - sum(wunsch)
        gesamt = sum(wunsch) or 1
        return [w + rest * w / gesamt for w in wunsch]

    if sum(minimum) >= AVAIL:  # Notbremse: proportional stauchen
        f = AVAIL / sum(minimum)
        return [m * f for m in minimum]

    rest = AVAIL - sum(minimum)
    spanne = [max(0.0, wunsch[i] - minimum[i]) for i in range(n)]
    gesamt = sum(spanne) or 1
    return [minimum[i] + rest * spanne[i] / gesamt for i in range(n)]


def tabelle(kopf, rohzeilen, ausrichtung):
    breiten = spaltenbreiten([kopf] + rohzeilen, ausrichtung)
    daten = [[Paragraph(inline(z), S["cellheadr"] if ausrichtung[i] == "r" else S["cellhead"])
              for i, z in enumerate(kopf)]]
    for zeile in rohzeilen:
        daten.append([Paragraph(inline(z), S["cellr"] if ausrichtung[i] == "r" else S["cell"])
                      for i, z in enumerate(zeile)])
    t = Table(daten, colWidths=breiten, repeatRows=1)
    stil = [
        ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
        ("LINEBELOW", (0, 0), (-1, 0), 0.9, WALNUT_L),
        ("LINEBELOW", (0, 1), (-1, -2), 0.35, HAIRLINE),
        ("LINEBELOW", (0, -1), (-1, -1), 0.6, HAIRLINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]
    t.setStyle(TableStyle(stil))
    return [Spacer(1, 7), t, Spacer(1, 11)]


# ---------------------------------------------------------------------------
# Markdown lesen
# ---------------------------------------------------------------------------

def parse(pfad):
    quelle = open(pfad, encoding="utf-8").read().split("\n")
    story, i, n = [], 0, len(quelle)
    kapitel = 0
    # Kopf des Dokuments (bis zur ersten H1) wird gesondert gesetzt
    vorspann_fertig = False

    while i < n:
        zeile = quelle[i]

        # --- Code-Block ---
        if zeile.lstrip().startswith("```"):
            einzug = len(zeile) - len(zeile.lstrip())
            i += 1
            block = []
            while i < n and not quelle[i].lstrip().startswith("```"):
                z = quelle[i]
                block.append(z[einzug:] if z[:einzug].strip() == "" else z.lstrip())
                i += 1
            i += 1
            while block and not block[-1].strip():
                block.pop()
            story.extend(code_block(block))
            continue

        # --- Überschriften ---
        if zeile.startswith("# "):
            titel = zeile[2:].strip()
            kapitel += 1
            if vorspann_fertig:
                story.append(PageBreak())
            vorspann_fertig = True
            story.append(Regel(hoehe=2, farbe=WALNUT, staerke=1.6))
            story.append(Spacer(1, 9))
            nummer, rest = trenne_nummer(titel)
            if nummer:
                story.append(Paragraph(sicher(f"KAPITEL {nummer}"), S["h1num"]))
            p = Paragraph(inline(rest), S["h1"])
            # Im Inhaltsverzeichnis steht die Kapitelnummer vorn – im Satz trägt sie
            # die Zeile darüber, damit sie nicht mit der Überschrift konkurriert.
            p._toc = ("h1", f"{nummer}  {klartext(rest)}" if nummer else klartext(rest))
            story.append(p)
            story.append(Spacer(1, 12))
            i += 1
            continue

        if zeile.startswith("#### "):
            story.append(Paragraph(inline(zeile[5:].strip()), S["h4"]))
            i += 1
            continue

        if zeile.startswith("### "):
            t = zeile[4:].strip()
            p = Paragraph(inline(t), S["h3"])
            story.append(p)
            i += 1
            continue

        if zeile.startswith("## "):
            t = zeile[3:].strip()
            p = Paragraph(inline(t), S["h2"])
            p._toc = ("h2", klartext(t))
            story.append(p)
            i += 1
            continue

        # --- Trennlinie ---
        if re.fullmatch(r"-{3,}", zeile.strip()):
            naechste = next((quelle[j] for j in range(i + 1, n) if quelle[j].strip()), "")
            if naechste.startswith("# "):
                i += 1
                continue
            story.append(Spacer(1, 6))
            story.append(Regel(hoehe=10))
            story.append(Spacer(1, 2))
            i += 1
            continue

        # --- Tabelle ---
        if zeile.lstrip().startswith("|") and i + 1 < n and re.match(
                r"^\s*\|[\s:\-\|]+\|\s*$", quelle[i + 1]):
            kopf = zellen(zeile)
            trenner = zellen(quelle[i + 1])
            ausrichtung = ["r" if t.strip().endswith(":") else "l" for t in trenner]
            i += 2
            zeilen = []
            while i < n and quelle[i].lstrip().startswith("|"):
                z = zellen(quelle[i])
                z = (z + [""] * len(kopf))[:len(kopf)]
                zeilen.append(z)
                i += 1
            story.extend(tabelle(kopf, zeilen, ausrichtung))
            continue

        # --- Zitat / Merker ---
        if zeile.startswith(">"):
            block = []
            while i < n and quelle[i].startswith(">"):
                block.append(quelle[i][1:].lstrip() if quelle[i][1:2] == " " else quelle[i][1:])
                i += 1
            story.extend(zitat_block(block))
            continue

        # --- Liste ---
        if re.match(r"^\s*[-*]\s+", zeile) or re.match(r"^\s*\d+\.\s+", zeile):
            eintraege = []
            while i < n:
                m1 = re.match(r"^\s*[-*]\s+(.*)$", quelle[i])
                m2 = re.match(r"^\s*(\d+)\.\s+(.*)$", quelle[i])
                if not (m1 or m2):
                    break
                marke = "•" if m1 else f"{m2.group(1)}."
                inhalt = m1.group(1) if m1 else m2.group(2)
                i += 1
                # Fortsetzungszeilen (eingerückt, kein neuer Punkt)
                while (i < n and quelle[i].strip()
                       and not re.match(r"^\s*[-*]\s+", quelle[i])
                       and not re.match(r"^\s*\d+\.\s+", quelle[i])
                       and not quelle[i].lstrip().startswith(("#", "|", ">", "```"))):
                    inhalt += " " + quelle[i].strip()
                    i += 1
                eintraege.append((marke, inhalt))
            for marke, inhalt in eintraege:
                story.append(Paragraph(inline(inhalt), S["li"],
                                       bulletText=sicher(marke)))
                story.append(Spacer(1, 3.5))
            story.append(Spacer(1, 4))
            continue

        # --- Leerzeile ---
        if not zeile.strip():
            i += 1
            continue

        # --- Absatz ---
        absatz = [zeile.strip()]
        i += 1
        while (i < n and quelle[i].strip()
               and not quelle[i].lstrip().startswith(("#", "|", ">", "```"))
               and not re.match(r"^\s*[-*]\s+", quelle[i])
               and not re.match(r"^\s*\d+\.\s+", quelle[i])
               and not re.fullmatch(r"-{3,}", quelle[i].strip())):
            absatz.append(quelle[i].strip())
            i += 1
        story.append(Paragraph(inline(" ".join(absatz)), S["body"]))
        story.append(Spacer(1, 7))

    return story


def zellen(zeile):
    z = zeile.strip()
    if z.startswith("|"):
        z = z[1:]
    if z.endswith("|"):
        z = z[:-1]
    return [t.strip() for t in z.split("|")]


def trenne_nummer(titel):
    m = re.match(r"^(\d+)\.\s*(.*)$", titel)
    return (m.group(1), m.group(2)) if m else (None, titel)


# ---------------------------------------------------------------------------
# Seitengerüst
# ---------------------------------------------------------------------------

DOKTITEL = "CRAMER PLANER · Technischer Aufbau"


class Doku(BaseDocTemplate):
    def __init__(self, *a, **k):
        BaseDocTemplate.__init__(self, *a, **k)
        self.kapitel = ""

    def afterFlowable(self, fl):
        toc = getattr(fl, "_toc", None)
        if not toc:
            return
        ebene, text = toc
        if ebene == "h1":
            self.kapitel = text
            self.notify("TOCEntry", (0, text, self.page))
        else:
            self.notify("TOCEntry", (1, text, self.page))


def _kopf_fuss(canv, doc, mit_kopf=True):
    canv.saveState()
    if mit_kopf:
        canv.setFont("Body", 7.4)
        canv.setFillColor(MUTED)
        canv.drawString(M_L, PAGE_H - M_T + 12, sicher(DOKTITEL))
        kap = sicher(getattr(doc, "kapitel", "") or "")
        if kap:
            if pdfmetrics.stringWidth(kap, "Body", 7.4) > AVAIL * 0.55:
                while pdfmetrics.stringWidth(kap + "…", "Body", 7.4) > AVAIL * 0.55:
                    kap = kap[:-1]
                kap += "…"
            canv.drawRightString(PAGE_W - M_R, PAGE_H - M_T + 12, kap)
        canv.setStrokeColor(HAIRLINE)
        canv.setLineWidth(0.5)
        canv.line(M_L, PAGE_H - M_T + 7, PAGE_W - M_R, PAGE_H - M_T + 7)
    canv.setFont("Body", 8)
    canv.setFillColor(MUTED)
    canv.drawCentredString(PAGE_W / 2, M_B - 12, str(doc.page))
    canv.restoreState()


def auf_titelseite(canv, doc):
    canv.saveState()
    # Ein einzelner breiter Nussbaum-Balken oben – der einzige Farbakzent der Seite
    canv.setFillColor(WALNUT)
    canv.rect(0, PAGE_H - 14 * mm, PAGE_W, 14 * mm, stroke=0, fill=1)
    canv.restoreState()


def titelseite():
    st_marke = ParagraphStyle("marke", fontName="Body-Bold", fontSize=9, leading=12,
                              textColor=WALNUT, spaceAfter=0)
    st_titel = ParagraphStyle("titel", fontName="Body-Bold", fontSize=31, leading=36,
                              textColor=INK, spaceAfter=0)
    st_unter = ParagraphStyle("unter", fontName="Body", fontSize=13.5, leading=19,
                              textColor=MUTED, spaceAfter=0)
    st_meta = ParagraphStyle("meta", fontName="Body", fontSize=9, leading=15,
                             textColor=MUTED)
    st_metak = ParagraphStyle("metak", fontName="Body-Bold", fontSize=7.5, leading=15,
                              textColor=INK)

    def metazeile(k, v):
        return [Paragraph(sicher(k), st_metak), Paragraph(inline(v), st_meta)]

    tab = Table(
        [metazeile("QUELLE", "Quellcode `CRAMER PLANER - Kopie für Johannes`, "
                             "`Cramer-Stammdaten.xlsx`, `ARTIKELNUMMER-LOGIK.md`"),
         metazeile("DATENSTAND", "190 Artikel · 1.509 Preiszeilen · 9 Serien · Preisliste 06.2026"),
         metazeile("ZIELGRUPPE", "Projektteam, Vertrieb, Geschäftsführung, Kunde – "
                                 "keine Softwareentwickler"),
         metazeile("STAND", "18. August 2026")],
        colWidths=[26 * mm, AVAIL - 26 * mm])
    tab.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.35, HAIRLINE),
    ]))

    return [
        Spacer(1, 46 * mm),
        Paragraph(sicher("CRAMER MÖBEL"), st_marke),
        Spacer(1, 5),
        Paragraph(sicher("Der CRAMER PLANER,"), st_titel),
        Paragraph(sicher("technisch erklärt"), st_titel),
        Spacer(1, 12),
        Regel(hoehe=2, farbe=WALNUT, staerke=1.6, breite=64),
        Spacer(1, 14),
        Paragraph(sicher("Wie das Konfigurations-Tool aufgebaut ist, wo die Daten liegen, "
                         "wie ein Preis zustande kommt – und was der Kunde später selbst "
                         "pflegen kann."), st_unter),
        Spacer(1, 40),
        tab,
        NextPageTemplate("inhalt"),
        PageBreak(),
    ]


# ---------------------------------------------------------------------------
# Bauen
# ---------------------------------------------------------------------------

def main():
    doc = Doku(ZIEL, pagesize=A4,
               leftMargin=M_L, rightMargin=M_R, topMargin=M_T, bottomMargin=M_B,
               title="CRAMER PLANER – Technischer Aufbau",
               author="Cramer Möbel", subject="Technische Dokumentation des CRAMER PLANERs")

    rahmen = Frame(M_L, M_B, AVAIL, PAGE_H - M_T - M_B, id="normal",
                   leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="titel", frames=[rahmen], onPage=auf_titelseite),
        PageTemplate(id="inhalt", frames=[rahmen],
                     onPageEnd=lambda c, d: _kopf_fuss(c, d, mit_kopf=False)),
        PageTemplate(id="text", frames=[rahmen],
                     onPageEnd=lambda c, d: _kopf_fuss(c, d, mit_kopf=True)),
    ])

    toc = TableOfContents()
    toc.levelStyles = [S["toc0"], S["toc1"]]
    toc.dotsMinLevel = 0

    story = titelseite()
    story += [
        Paragraph(sicher("Inhalt"), ParagraphStyle(
            "tochead", fontName="Body-Bold", fontSize=17, leading=21, textColor=WALNUT)),
        Spacer(1, 4),
        Regel(hoehe=10, farbe=WALNUT, staerke=1.2),
        Spacer(1, 6),
        toc,
        NextPageTemplate("text"),
        PageBreak(),
    ]
    story += parse(QUELLE)

    doc.multiBuild(story)

    if _fehlend:
        print("Zeichen ohne Glyphe (durch ? ersetzt):", "".join(sorted(_fehlend)))
    else:
        print("Alle Zeichen der Vorlage sind in den Schriften vorhanden.")
    print(f"Geschrieben: {ZIEL}")
    print(f"Größe: {os.path.getsize(ZIEL)/1024:.0f} KB")


if __name__ == "__main__":
    main()
