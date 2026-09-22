import { useMemo, useState } from 'react'
import type { Artikel, Preiszeile } from '../../data/stammdaten.generated.ts'
import { bepreiseProbe, type ProbeEingabe } from '../../lib/kalkulation.ts'
import { formatEuro, parseEingabeDe } from '../../lib/format.ts'
import { parseListe } from '../../lib/preisAchsen.ts'
import { PREISART_AUSWAHL, preisartTitel } from '../../lib/preisartAnzeige.ts'
import {
  AUFSCHLAG_BASEN,
  AUFSCHLAG_BASIS_KATALOG,
  aufschlagText,
  aufschlagVon,
  pruefePreisart,
  type PreisartCode,
} from '../../lib/preisarten.ts'
import { massRichtung } from '../../lib/preisLookup.ts'
import { OHNE_AUTOFILL } from './ZellenFeld.tsx'
import styles from './PreisartEditor.module.css'

/**
 * PREISART-EDITOR — die sechs Preisarten der Artikelverwaltung.
 *
 * Oben die Wahl der Preisart (Name + ein Satz, nicht mehr), darunter je nach Art die
 * Felder, die sie braucht, eine Prüfung, ob die Preiszeilen die Preisart tragen, und eine
 * Preisprobe: Sie rechnet den UNGESPEICHERTEN Formularstand mit derselben Engine wie die
 * Kalkulation — was hier steht, steht nach dem Speichern auch im Konfigurator.
 */

/** Was jede Preisart an Preiszeilen erwartet — ein Satz unter der Wahl. */
const ZEILEN_HINWEIS: Record<PreisartCode, string> = {
  FESTPREIS: 'Eine Preiszeile mit dem Betrag. Achsen sind nicht nötig.',
  MATRIX_STUFE:
    'Je Achsenkombination eine Preiszeile. Links in der Maßzelle steht der Schwellenwert in cm — ein Zwischenmaß geht auf die nächste hinterlegte Stufe, nie darüber hinaus.',
  MATRIX_MASS:
    'Achse PREISART mit €/cm · €/m · €/m². Die Maßachsen bleiben leer und liefern die Menge — gerechnet wird mit dem tatsächlichen Maß.',
  FEST_PLUS_MATRIX:
    'Achse PREISART: eine Zeile „Fixpreis" (Grundpreis) und eine Zeile je Einheit (variabler Preis). Die Kalkulation zeigt beide Teile und ihre Summe.',
  AUFSCHLAG: 'Keine Preiszeilen — Satz bzw. Betrag und Preisbasis stehen im Artikel.',
  AUF_ANFRAGE: 'Keine automatische Kalkulation. In der Kalkulation steht die Position „auf Anfrage".',
}

export function PreisartWahl({
  wert,
  altCode,
  onChange,
}: {
  wert: PreisartCode
  /** Früherer Code (z. B. MATRIX), aus dem `wert` abgeleitet wurde. */
  altCode?: string
  onChange: (code: PreisartCode) => void
}) {
  return (
    <div className={styles.box}>
      <div className={styles.kopf}>
        Preisart
        <span className={styles.kopfHinweis}>wie dieser Artikel zu seinem Preis kommt</span>
      </div>
      <div className={styles.wahl} role="radiogroup" aria-label="Preisart">
        {PREISART_AUSWAHL.map((p) => (
          <button
            key={p.code}
            type="button"
            role="radio"
            aria-checked={wert === p.code}
            aria-label={`${p.titel} — ${p.kurz}`}
            className={[styles.option, wert === p.code ? styles.optionAktiv : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(p.code)}
          >
            <span className={styles.optionTitel}>{p.titel}</span>
            <span className={styles.optionText}>{p.kurz}</span>
          </button>
        ))}
      </div>
      <p className={styles.hinweis}>{ZEILEN_HINWEIS[wert]}</p>
      {altCode ? (
        <p className={styles.alt}>
          Gespeichert war noch die frühere Preislogik <code>{altCode}</code>. Aus den Preiszeilen ergibt sich
          „{preisartTitel(wert)}" — so hat die Kalkulation den Artikel bisher schon gerechnet. Mit „Speichern" wird
          die Preisart übernommen.
        </p>
      ) : null}
    </div>
  )
}

/** Passen Preisart, Achsen und Preiszeilen zusammen? — dieselben Bedingungen wie im Lookup. */
export function PreisartPruefung({ artikel, zeilen }: { artikel: Artikel; zeilen: readonly Preiszeile[] }) {
  const probleme = useMemo(() => pruefePreisart(artikel, zeilen), [artikel, zeilen])
  if (probleme.length === 0) {
    const text =
      artikel.preislogik === 'AUFSCHLAG'
        ? 'Satz, Einheit und Preisbasis sind vollständig gepflegt.'
        : artikel.preislogik === 'AUF_ANFRAGE'
          ? 'Bewusst ohne automatischen Preis — die Kalkulation weist die Position „auf Anfrage“ aus.'
          : `Die Preiszeilen passen zur Preisart „${preisartTitel(artikel.preislogik)}“.`
    return <p className={styles.ok}>✓ {text}</p>
  }
  return (
    <ul className={styles.probleme} aria-label="Prüfung der Preisart">
      {probleme.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  )
}

/** Satz bzw. Betrag, Einheit und Preisbasis eines Aufschlags. */
export function AufschlagFelder({
  artikel,
  onChange,
}: {
  artikel: Artikel
  onChange: (patch: Pick<Artikel, 'aufschlag' | 'aufschlagEinheit' | 'aufschlagBasis'>) => void
}) {
  const [roh, setRoh] = useState<string | null>(null)
  const wert = artikel.aufschlag
  const def = aufschlagVon(artikel)
  const beispielBasis = 3000
  const setze = (patch: Partial<Pick<Artikel, 'aufschlag' | 'aufschlagEinheit' | 'aufschlagBasis'>>) =>
    onChange({
      aufschlag: artikel.aufschlag ?? null,
      aufschlagEinheit: artikel.aufschlagEinheit ?? '',
      aufschlagBasis: artikel.aufschlagBasis ?? '',
      ...patch,
    })

  return (
    <div className={styles.box}>
      <div className={styles.kopf}>
        Aufschlag
        <span className={styles.kopfHinweis}>Satz bzw. Betrag und die Preisbasis, auf die er rechnet</span>
      </div>
      <div className={styles.aufschlagReihe}>
        <label className={styles.feld}>
          <span className={styles.label}>{artikel.aufschlagEinheit === '€' ? 'Betrag' : 'Satz'}</span>
          <span className={styles.wertMitEinheit}>
            <input
              {...OHNE_AUTOFILL}
              className={styles.input}
              inputMode="decimal"
              aria-label="Aufschlag"
              value={roh ?? (wert == null ? '' : String(wert).replace('.', ','))}
              onChange={(e) => setRoh(e.target.value)}
              onBlur={() => {
                if (roh == null) return
                setze({ aufschlag: roh.trim() === '' ? null : parseEingabeDe(roh) })
                setRoh(null)
              }}
            />
            <select
              {...OHNE_AUTOFILL}
              className={styles.einheit}
              aria-label="Einheit des Aufschlags"
              value={artikel.aufschlagEinheit ?? ''}
              onChange={(e) => setze({ aufschlagEinheit: e.target.value })}
            >
              <option value="">—</option>
              <option value="%">%</option>
              <option value="€">€</option>
            </select>
          </span>
        </label>
        <label className={[styles.feld, styles.feldBreit].join(' ')}>
          <span className={styles.label}>Preisbasis</span>
          <select
            {...OHNE_AUTOFILL}
            className={styles.input}
            value={artikel.aufschlagBasis ?? ''}
            onChange={(e) => setze({ aufschlagBasis: e.target.value })}
          >
            <option value="">— bitte wählen —</option>
            {AUFSCHLAG_BASEN.map((b) => (
              <option key={b} value={b}>
                {AUFSCHLAG_BASIS_KATALOG[b].titel}
              </option>
            ))}
          </select>
          <span className={styles.feldHinweis}>
            {artikel.aufschlagBasis && artikel.aufschlagBasis in AUFSCHLAG_BASIS_KATALOG
              ? AUFSCHLAG_BASIS_KATALOG[artikel.aufschlagBasis as keyof typeof AUFSCHLAG_BASIS_KATALOG].kurz
              : 'Möbelpreis für artikelbezogene Aufschläge, Gesamtmöbelpreis für Montage und Lieferung.'}
          </span>
        </label>
      </div>
      {def ? (
        <p className={styles.probeZeile}>
          Beispiel: {aufschlagText(def)}
          {def.einheit === '%' ? ` auf ${formatEuro(beispielBasis)} ${AUFSCHLAG_BASIS_KATALOG[def.basis].titel}` : ''} ={' '}
          <strong>{formatEuro(def.einheit === '%' ? Math.round(beispielBasis * def.wert) / 100 : def.wert)}</strong>
        </p>
      ) : null}
    </div>
  )
}

/** Maßachsen und Merkmalsachsen des Artikels — daraus entstehen die Probefelder. */
function probeFelder(artikel: Artikel, zeilen: readonly Preiszeile[]) {
  const masse = new Set<'breite' | 'hoehe' | 'tiefe' | 'laenge'>()
  const merkmale: Array<{ code: 'PG' | 'LINIE_PG'; werte: string[] }> = []
  artikel.achsen.forEach((code, index) => {
    const richtung = massRichtung(code)
    if (richtung) masse.add(richtung)
    if (code === 'PG' || code === 'LINIE_PG') {
      const werte = new Set<string>()
      for (const z of zeilen) {
        const roh = (z.a[index] ?? '').trim()
        if (!roh) continue
        if (code === 'PG') parseListe(roh).forEach((w) => werte.add(w))
        else werte.add(roh)
      }
      merkmale.push({ code, werte: [...werte].sort((a, b) => a.localeCompare(b, 'de')) })
    }
  })
  return { masse: [...masse], merkmale }
}

const MASS_LABEL = { breite: 'Breite', hoehe: 'Höhe', tiefe: 'Tiefe', laenge: 'Länge' } as const

/**
 * PREISPROBE — ein Maß eingeben, den Preis sehen, bevor gespeichert ist.
 *
 * Zeigt den Rechenweg wie die Kalkulation: bei „Festpreis + Matrix" Grundpreis und
 * variablen Preis getrennt, bei „Stufenpreis" die Stufe, auf die gehoben wurde.
 */
export function Preisprobe({ artikel, zeilen }: { artikel: Artikel; zeilen: readonly Preiszeile[] }) {
  const felder = useMemo(() => probeFelder(artikel, zeilen), [artikel, zeilen])
  const [eingabe, setEingabe] = useState<Record<string, string>>({})
  const probe: ProbeEingabe = {
    breiteCm: parseEingabeDe(eingabe.breite ?? '') ?? undefined,
    hoeheCm: parseEingabeDe(eingabe.hoehe ?? '') ?? undefined,
    tiefeCm: parseEingabeDe(eingabe.tiefe ?? '') ?? undefined,
    laengeCm: parseEingabeDe(eingabe.laenge ?? '') ?? undefined,
    pg: eingabe.PG || undefined,
    liniePg: eingabe.LINIE_PG || undefined,
    menge: parseEingabeDe(eingabe.menge ?? '') ?? 1,
  }
  // Der Status des Artikels soll die Probe nicht sperren — geprüft wird die Rechnung.
  const ergebnis = bepreiseProbe({ ...artikel, status: 'aktiv' }, zeilen, probe)

  return (
    <div className={styles.box}>
      <div className={styles.kopf}>
        Preisprobe
        <span className={styles.kopfHinweis}>rechnet den aktuellen Formularstand wie die Kalkulation</span>
      </div>
      <div className={styles.probeReihe}>
        {felder.masse.map((m) => (
          <label key={m} className={styles.feld}>
            <span className={styles.label}>{MASS_LABEL[m]}</span>
            <span className={styles.wertMitEinheit}>
              <input
                {...OHNE_AUTOFILL}
                className={styles.input}
                inputMode="decimal"
                value={eingabe[m] ?? ''}
                onChange={(e) => setEingabe((alt) => ({ ...alt, [m]: e.target.value }))}
              />
              <span className={styles.einheitText}>cm</span>
            </span>
          </label>
        ))}
        {felder.merkmale.map((f) => (
          <label key={f.code} className={styles.feld}>
            <span className={styles.label}>{f.code === 'PG' ? 'Preisgruppe' : 'Linie + PG'}</span>
            <select
              {...OHNE_AUTOFILL}
              className={styles.input}
              value={eingabe[f.code] ?? ''}
              onChange={(e) => setEingabe((alt) => ({ ...alt, [f.code]: e.target.value }))}
            >
              <option value="">—</option>
              {f.werte.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className={styles.feld}>
          <span className={styles.label}>Menge</span>
          <input
            {...OHNE_AUTOFILL}
            className={[styles.input, styles.kurz].join(' ')}
            inputMode="decimal"
            placeholder="1"
            value={eingabe.menge ?? ''}
            onChange={(e) => setEingabe((alt) => ({ ...alt, menge: e.target.value }))}
          />
        </label>
      </div>
      {ergebnis.status === 'berechnet' ? (
        <div className={styles.probeErgebnis}>
          {ergebnis.teile.map((t, i) => (
            <div key={i} className={styles.probeZeile}>
              <span>{t.bezeichnung ?? (ergebnis.teile.length > 1 ? `Teil ${i + 1}` : 'Preis')}</span>
              <span className={styles.rechnung}>
                {t.mengeText} × {formatEuro(t.preis)}
                {t.preisEinheit === '€' ? '' : `/${t.preisEinheit.replace('€/', '')}`}
              </span>
              <span className={styles.betrag}>{formatEuro(t.gesamt)}</span>
            </div>
          ))}
          <div className={[styles.probeZeile, styles.probeSumme].join(' ')}>
            <span>{preisartTitel(ergebnis.preisart)}</span>
            <span className={styles.rechnung}>{ergebnis.hinweis ?? ''}</span>
            <span className={styles.betrag}>{formatEuro(ergebnis.gesamt)}</span>
          </div>
        </div>
      ) : (
        <p className={styles.probeOffen}>auf Anfrage — {ergebnis.grund}</p>
      )}
    </div>
  )
}
