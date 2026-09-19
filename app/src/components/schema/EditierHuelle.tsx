import { useState, type ReactNode } from 'react'
import { FeldEinstellungen } from '../admin/FeldEinstellungen'
import { aktualisiereFeld, entferneFeld } from '../../lib/schemaStore'
import { useEditorModus } from '../../lib/editorModus'
import { dropdowns } from '../../data/stammdaten.generated'
import type { SchemaFeld } from '../../types/schema'
import styles from './Editierbar.module.css'

/**
 * Woher ein Auswahlfeld seine Einträge nimmt — im Klartext, direkt am Feld.
 *
 * Damit der Administrator nicht in die Stammdaten wechseln muss, um zu sehen, welche
 * Artikelgruppe hinter einem Dropdown steckt. Nummernkreis und Artikelzahl kommen live
 * aus der Artikelverwaltung.
 */
export function datenquelle(feld: SchemaFeld): string | null {
  if (feld.dropdownCode) {
    const dd = dropdowns.find((d) => d.nr === feld.dropdownCode)
    if (!dd) return `Dropdown ${feld.dropdownCode} — in den Stammdaten nicht gefunden`
    return `${dd.nummernkreis} ${dd.bezeichnung} · ${dd.anzahlArtikel ?? 0} Artikel`
  }
  if (feld.optionen === 'filialen') return 'Filialen · Blatt „41 Filialen"'
  if (feld.bindung) return `Entwurfsfeld „${feld.bindung}"`
  if (feld.quelle) return `automatisch · ${feld.quelle}`
  return null
}

/**
 * Legt die Bearbeitungsschicht über ein Feld der echten Oberfläche.
 *
 * Außerhalb des Bearbeitungsmodus gibt sie ihre Kinder unverändert weiter — der Berater
 * sieht also exakt dieselbe Maske wie vorher, ohne Rahmen, ohne Stift, ohne zusätzliche
 * Umschließung im Layout.
 */
export function EditierHuelle({
  feld,
  abschnittId,
  children,
}: {
  feld: SchemaFeld
  abschnittId: string
  children: ReactNode
}) {
  const bearbeitung = useEditorModus()
  const [offen, setOffen] = useState(false)

  if (!bearbeitung) return <>{children}</>

  const quelle = datenquelle(feld)

  return (
    <div className={feld.aktiv ? styles.huelle : styles.huelleAus}>
      <div className={styles.werkzeuge}>
        <button
          type="button"
          className={styles.stift}
          title={`„${feld.label}" bearbeiten`}
          onClick={() => setOffen(true)}
        >
          ✏️
        </button>
        {feld.aktiv ? (
          <button
            type="button"
            className={styles.weg}
            title={feld.systemfeld ? 'Abschalten (Auslieferungsfeld)' : 'Entfernen'}
            onClick={() => entferneFeld(abschnittId, feld.id)}
          >
            🗑
          </button>
        ) : (
          <button
            type="button"
            className={styles.stift}
            title="Wieder einschalten"
            onClick={() => aktualisiereFeld(abschnittId, { ...feld, aktiv: true })}
          >
            ⟲
          </button>
        )}
      </div>

      {children}

      {quelle ? <span className={styles.quelle}>◆ {quelle}</span> : null}

      <FeldEinstellungen
        offen={offen}
        feld={feld}
        onAbbrechen={() => setOffen(false)}
        onSpeichern={(neu) => {
          aktualisiereFeld(abschnittId, neu)
          setOffen(false)
        }}
      />
    </div>
  )
}
