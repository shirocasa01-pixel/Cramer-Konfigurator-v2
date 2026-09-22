import { useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { getBranches } from '../../config/branches'
import { useAuth } from '../../context/AuthContext'
import { useDraft } from '../../context/DraftContext'
import { setzeEditorModus } from '../../lib/editorModus'
import { getEntwurfSchema, hatOffenenEntwurf, subscribeSchema } from '../../lib/schemaStore'
import type { Draft, MaterialSelection } from '../../types'
import styles from './KonfiguratorEinstieg.module.css'

/**
 * EINSTIEG IN DEN LIVE-EDITOR.
 *
 * Es gibt bewusst keine nachgebaute Verwaltungsansicht des Konfigurators: Der
 * Administrator läuft durch dieselbe Oberfläche wie der Berater und bearbeitet sie dort,
 * wo sie steht. Dieser Knopf legt dafür einen Vorschau-Entwurf an und schaltet die
 * Bearbeitungsschicht ein.
 *
 * Der Vorschau-Entwurf trägt `isVerification` — daran hängen zwei Dinge, die ihn vom
 * Arbeitsalltag fernhalten: Das automatische Speichern nach Supabase überspringt ihn
 * (`DraftContext`), und die Vollständigkeits-Weichen der Schritte lassen ihn durch, sodass
 * der Administrator alle sieben Schritte ansehen kann, ohne einen Schrank zu konfigurieren.
 */
/**
 * Ein durchgängig gültiger Vorschau-Entwurf.
 *
 * Die Schritte prüfen der Reihe nach, ob der vorherige vollständig ist — ohne Maße keine
 * Materialauswahl, ohne Material keine Fronten. Der Administrator will aber alle sieben
 * Schritte ansehen, nicht erst einen Schrank konfigurieren. Deshalb startet die Vorschau
 * mit dem kleinsten vollständigen Möbel: ein 100er Korpus, 18 Raster, Decoboard, eine
 * Drehtür.
 */
function vorschauEntwurf(): Partial<Draft> {
  const decoboard: MaterialSelection = {
    materialGroupId: 'decoboard',
    optionId: 'schwarz-u190vl',
    priceGroup: 'PG1',
  }
  return {
    isVerification: true,
    customerName: 'Vorschau · Bearbeitungsmodus',
    orderNumber: 'VORSCHAU',
    branchId: getBranches()[0]?.id ?? '',
    productGroupId: 'kleiderschraenke',
    seriesId: 'refugium',
    korpus: { innen: { ...decoboard }, aussen: { ...decoboard } },
    korpusGrunddaten: {
      heightMode: '18R',
      depthMode: '60',
      korpusse: [{ id: 'vorschau-k1', breiteMode: '100', lochreihe: true }],
      abschlussSet: { position: 'beide', material: { ...decoboard } },
    },
    dimensions: { heightCm: '235', widthCm: '100', depthCm: '60', segments: 1 },
    ausstattung: { selected: ['einlegeboden', 'einlegeboden-kleiderstange'] },
    fronts: {
      columns: [
        {
          id: 'vorschau-c1',
          elements: [
            {
              id: 'vorschau-t1',
              typeId: 'drehtuer',
              label: 'D1',
              widthCm: '49',
              heightCm: '230,1',
              hoeheModus: 'raster',
              hoeheRaster: '18',
              tuerAnschlag: 'links',
              styleLineId: 'glatt',
              fieldValues: { material: { material: { ...decoboard } } },
            },
          ],
          equipment: [],
        },
      ],
    },
    // Wie jeder neue Entwurf: Montage und Lieferung sind standardmäßig angehakt.
    pricingOptions: { montage: true, lieferungRegional: true },
  } as Partial<Draft>
}

export function KonfiguratorEinstieg() {
  const { user } = useAuth()
  const { startNewDraft, updateDraft } = useDraft()
  const navigate = useNavigate()
  const schema = useSyncExternalStore(subscribeSchema, getEntwurfSchema, getEntwurfSchema)
  const offen = useSyncExternalStore(subscribeSchema, hatOffenenEntwurf, hatOffenenEntwurf)

  function starten() {
    if (user) startNewDraft({ id: user.id, name: user.name })
    updateDraft(vorschauEntwurf())
    setzeEditorModus(true)
    navigate('/new')
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.text}>
        Der Konfigurator wird dort bearbeitet, wo er benutzt wird. Ein Klick öffnet Schritt 1
        in der Ansicht des Beraters — mit Stift an jeder Überschrift und jedem Feld, einem Plus
        am Ende der Abschnitte und der Angabe, aus welcher Artikelgruppe ein Auswahlfeld seine
        Einträge zieht. Durchklicken zeigt unmittelbar, was der Berater später sieht.
      </p>

      <div className={styles.status}>
        <span className={offen ? styles.entwurf : styles.live}>
          {offen ? 'Ein Entwurf ist offen — noch nicht veröffentlicht' : `Veröffentlicht · Fassung ${schema.version}`}
        </span>
        <span className={styles.hinweis}>
          Zum Bearbeiten wird ein Vorschau-Entwurf geöffnet. Er wird nicht gespeichert und
          erscheint in keiner Entwurfsliste.
        </span>
      </div>

      <Button onClick={starten}>Konfigurator bearbeiten</Button>
    </div>
  )
}
