import { useMemo, useState } from 'react'
import { serien } from '../../data/stammdaten.generated'
import { baueStruktur, bilanziere } from '../../lib/konfiguratorStruktur'
import { useStammdaten } from '../../lib/useStammdaten'
import styles from './KonfiguratorStruktur.module.css'

/**
 * KONFIGURATOR-STRUKTUR — der Bauplan, den die Mappe bereits enthält.
 *
 * Erste Stufe des Baukastens: erst sehen, dann bearbeiten. Die Ansicht stellt den Baum
 * aus den Stammdaten (Schritt → Auswahlfeld → Artikel) dem gegenüber, was der
 * Konfigurator heute tatsächlich anbindet. Beides wird gelesen, nichts gepflegt — die
 * Bearbeitung kommt in der nächsten Stufe und braucht diese Bestandsaufnahme als Grundlage.
 */
export function KonfiguratorStruktur() {
  // Der Arbeitsstand der Stammdatenverwaltung zählt mit: Wer einen Artikel sperrt, sieht
  // das Auswahlfeld hier sofort schrumpfen.
  const stand = useStammdaten()
  const [serieId, setSerieId] = useState('refugium')

  const struktur = useMemo(() => baueStruktur(serieId), [serieId, stand.version])
  const bilanz = useMemo(() => bilanziere(struktur), [struktur])
  const serie = serien.find((s) => s.id === serieId)

  return (
    <div className={styles.wrap}>
      <div className={styles.kopf}>
        <div>
          <label className={styles.serieLabel} htmlFor="struktur-serie">
            Serie
          </label>
          <select
            id="struktur-serie"
            className={styles.serieSelect}
            value={serieId}
            onChange={(event) => setSerieId(event.target.value)}
          >
            {serien.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </div>
        <dl className={styles.bilanz}>
          <Kennzahl wert={bilanz.schritte} label="Schritte" />
          <Kennzahl wert={bilanz.dropdowns} label="Auswahlfelder" />
          <Kennzahl wert={bilanz.artikel} label="Artikel" />
          <Kennzahl wert={bilanz.angebunden} label="bepreist" ton="gut" />
          <Kennzahl wert={bilanz.offen} label="ohne Anbindung" ton={bilanz.offen ? 'offen' : undefined} />
        </dl>
      </div>

      <p className={styles.erklaerung}>
        Der Baum kommt aus der Mappe: Blatt „33 Teilearten" liefert die Schritte, Blatt
        „32 Artikelgruppen" die Auswahlfelder, die Artikelnummer <code>TT-DDD-NNNN</code>
        verbindet beides. <strong>Bepreist</strong> heißt: Die Kalkulation holt für dieses Feld
        mindestens einen Artikel aus dem Stamm — abgeleitet aus den Zuordnungen in{' '}
        <code>config/preisMapping.ts</code>, nicht von Hand gepflegt.{' '}
        <strong>Ohne Anbindung</strong> heißt: Die Artikel stehen im Stamm, aber kein Preis des
        Konfigurators kommt von dort. Das kann zweierlei bedeuten — es gibt gar kein Eingabefeld
        (Wandelement, Akustikpaneel), oder das Feld existiert, holt seinen Preis aber woanders
        her (Griffe stecken im Türpreis bzw. in <code>config/handles.ts</code>).
      </p>

      {struktur.length === 0 ? (
        <p className={styles.leer}>Für {serie?.name ?? 'diese Serie'} ist kein Artikel freigegeben.</p>
      ) : null}

      <ol className={styles.schritte}>
        {struktur.map((schritt) => (
          <li key={schritt.code} className={styles.schritt}>
            <div className={styles.schrittKopf}>
              <span className={styles.schrittNr}>{schritt.nr}</span>
              <span className={styles.schrittName}>{schritt.schritt}</span>
              <span className={styles.schrittMeta}>
                {schritt.dropdowns.length} {schritt.dropdowns.length === 1 ? 'Auswahlfeld' : 'Auswahlfelder'}
              </span>
            </div>
            <ul className={styles.felder}>
              {schritt.dropdowns.map((dd) => {
                const angebunden = dd.verwendetIn.length > 0
                return (
                  <li key={dd.nr} className={angebunden ? styles.feld : styles.feldOffen}>
                    <span className={styles.feldNr}>{dd.nummernkreis}</span>
                    <span className={styles.feldName}>{dd.bezeichnung}</span>
                    <span className={styles.feldArtikel}>
                      {dd.artikelFuerSerie} {dd.artikelFuerSerie === 1 ? 'Artikel' : 'Artikel'}
                    </span>
                    <span className={angebunden ? styles.badgeGut : styles.badgeOffen}>
                      {angebunden ? dd.verwendetIn.join(' · ') : 'nicht bepreist'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Kennzahl({ wert, label, ton }: { wert: number; label: string; ton?: 'gut' | 'offen' }) {
  const klasse = ton === 'gut' ? styles.kennzahlGut : ton === 'offen' ? styles.kennzahlOffen : styles.kennzahl
  return (
    <div className={klasse}>
      <dt className={styles.kennzahlWert}>{wert}</dt>
      <dd className={styles.kennzahlLabel}>{label}</dd>
    </div>
  )
}
