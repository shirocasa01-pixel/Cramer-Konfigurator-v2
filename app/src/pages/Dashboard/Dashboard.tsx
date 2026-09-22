import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { gehoertNutzer, useDraft } from '../../context/DraftContext'
import { getBranch, getBranches } from '../../config/branches'
import { getProductGroup, getSeries } from '../../config/productCatalog'
import { getVisibleKorpusAreas } from '../../config/korpus'
import { isKorpusComplete } from '../../lib/korpusValidation'
import { isDimensionsValid } from '../../lib/dimensionsValidation'
import { isFrontsComplete } from '../../lib/frontsValidation'
import { formatVkPreis } from '../../lib/pricing'
import { gruppiereVarianten, variantenName } from '../../lib/entwurfsVarianten'
import type { Draft } from '../../types'
import styles from './Dashboard.module.css'

const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
type StatusFilter = 'all' | 'active' | 'final'

/** Ermittelt den Wiedereinstiegs-Schritt eines Entwurfs (erster unvollständiger Schritt). */
function resumeRoute(draft: Draft): string {
  if (draft.isVerification) return '/summary' // Referenz-Entwürfe direkt zur Auswertung
  const series = getSeries(draft.productGroupId, draft.seriesId)
  if (!getProductGroup(draft.productGroupId) || !series) return '/products'
  // Reihenfolge wie im Workflow: Maße vor Korpus.
  if (!isDimensionsValid(draft.dimensions)) return '/dimensions'
  if (!isKorpusComplete(draft.korpus, getVisibleKorpusAreas(series, draft.korpusMode))) return '/korpus'
  if (!isFrontsComplete(draft.fronts)) return '/fronts'
  return '/summary'
}

/**
 * PHASE 6 – Consultant Dashboard (Startseite nach Login).
 * Aktive und abgeschlossene Entwürfe wiederfinden (Filter nach Auftrag/Kunde/Berater
 * und Filiale) oder einen neuen Entwurf anlegen.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const {
    savedDrafts,
    draftsLoading,
    draftsError,
    refreshDrafts,
    startNewDraft,
    loadDraft,
    trashDraft,
    duplicateDraft,
  } = useDraft()
  const navigate = useNavigate()

  /** Entwurf, für den die Papierkorb-Rückfrage offen ist. */
  const [zuVerwerfen, setZuVerwerfen] = useState<{ id: string; kunde: string } | null>(null)
  const [verwirft, setVerwirft] = useState(false)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [branchId, setBranchId] = useState('')
  // Punkt 1.3: „Ja, Filter automatisch auf den angemeldeten Berater vorbelegen."
  // Nur die Startbelegung – über „Alle Berater" sieht man weiterhin fremde Vorgänge.
  const [consultantId, setConsultantId] = useState(() => user?.id ?? '')

  // Berater-Filter-Optionen aus den tatsächlich vorhandenen Entwürfen ableiten.
  // Der angemeldete Berater steht immer dabei, auch ohne eigenen Entwurf – sonst
  // zeigte die Vorbelegung auf eine Option, die es in der Liste nicht gibt.
  const beraterOptions = useMemo(() => {
    const map = new Map<string, string>()
    if (user) map.set(user.id, user.name)
    savedDrafts.forEach((draft) => map.set(draft.consultant.id, draft.consultant.name))
    return [
      { value: '', label: 'Alle Berater' },
      ...[...map.entries()].map(([value, label]) => ({
        value,
        label: value === user?.id ? `${label} (ich)` : label,
      })),
    ]
  }, [savedDrafts, user])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return savedDrafts.filter((draft) => {
      if (status === 'active' && draft.finalizedAt) return false
      if (status === 'final' && !draft.finalizedAt) return false
      if (branchId && draft.branchId !== branchId) return false
      if (consultantId && draft.consultant.id !== consultantId) return false
      if (!q) return true
      return `${draft.id} ${draft.orderNumber} ${draft.artikelnummer ?? ''} ${draft.customerName} ${draft.consultant.name}`
        .toLowerCase()
        .includes(q)
    })
  }, [savedDrafts, query, status, branchId, consultantId])

  // Punkt 1.5: Varianten desselben Kunden zusammenfassen. Die Abstammung wird gegen
  // ALLE Entwürfe aufgelöst, nicht nur gegen die gefilterten – sonst zerreißt ein
  // Filter die Gruppe.
  const gruppen = useMemo(() => gruppiereVarianten(filtered, savedDrafts), [filtered, savedDrafts])

  function handleNew() {
    if (user) startNewDraft({ id: user.id, name: user.name, branchId: user.branchId })
    navigate('/new')
  }

  // Erst laden, dann navigieren: Der Entwurf kommt jetzt aus Supabase, und ohne das
  // Abwarten stünde die Zielseite kurz ohne Entwurf da und leitete zurück.
  async function handleOpen(draft: Draft) {
    if (await loadDraft(draft.id)) navigate(resumeRoute(draft))
  }

  async function handleDuplicate(source: Draft) {
    const copy = await duplicateDraft(source.id)
    if (copy) navigate(resumeRoute(copy))
  }

  const statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'active', label: 'Aktiv' },
    { key: 'final', label: 'Abgeschlossen' },
  ]

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Entwürfe</h1>
            <p className={styles.subtitle}>
              Willkommen{user ? `, ${user.name.split(' ')[0]}` : ''}. Aktive Entwürfe fortsetzen,
              abgeschlossene erneut öffnen oder einen neuen anlegen.
            </p>
          </div>
          <Button onClick={handleNew}>+ Neuer Entwurf</Button>
        </header>

        <section className={styles.filters} aria-label="Filter">
          <div className={styles.search}>
            <TextField
              label="Suche"
              placeholder="Auftragsnummer, Artikelnr., Kunde, Berater oder Entwurfsnummer …"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className={styles.filterCol}>
            <Select
              label="Filiale"
              options={[{ value: '', label: 'Alle Filialen' }, ...getBranches().map((b) => ({ value: b.id, label: b.name }))]}
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            />
          </div>
          <div className={styles.filterCol}>
            <Select
              label="Berater"
              options={beraterOptions}
              value={consultantId}
              onChange={(event) => setConsultantId(event.target.value)}
            />
          </div>
          <div className={styles.statusChips} role="group" aria-label="Status">
            {statusChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={[styles.chip, status === chip.key ? styles.chipActive : ''].filter(Boolean).join(' ')}
                onClick={() => setStatus(chip.key)}
                aria-pressed={status === chip.key}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </section>

        {draftsError ? (
          <div className={styles.loadError} role="alert">
            <span>{draftsError}</span>
            <Button variant="ghost" onClick={() => void refreshDrafts()}>
              Erneut laden
            </Button>
          </div>
        ) : null}

        {draftsLoading && filtered.length === 0 ? (
          <div className={styles.empty}>Entwürfe werden geladen …</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {savedDrafts.length === 0
              ? 'Noch keine gespeicherten Entwürfe. Legen Sie einen neuen Entwurf an.'
              : 'Keine Entwürfe für die aktuelle Filterung.'}
          </div>
        ) : (
          <ul className={styles.list}>
            {gruppen.map((gruppe) => (
              <li key={gruppe.wurzelId} className={gruppe.istGruppe ? styles.group : undefined}>
                {gruppe.istGruppe ? (
                  <div className={styles.groupHead}>
                    <span className={styles.groupTitle}>
                      Angebotsvarianten · {gruppe.entwuerfe[0].customerName || 'ohne Kunde'}
                    </span>
                    <span className={styles.groupCount}>{gruppe.entwuerfe.length} Entwürfe</span>
                  </div>
                ) : null}
                <ul className={styles.groupList}>
                  {gruppe.entwuerfe.map((draft) => {
                    const variante = variantenName(draft)
                    return (
                      <li key={draft.id} className={styles.row}>
                        <button type="button" className={styles.rowMain} onClick={() => void handleOpen(draft)}>
                          <div className={styles.rowTop}>
                            <span className={styles.rowId}>{draft.id}</span>
                            {draft.isVerification ? (
                              <span className={styles.badgeRef}>Referenz</span>
                            ) : (
                              <span className={draft.finalizedAt ? styles.badgeFinal : styles.badgeActive}>
                                {draft.finalizedAt ? 'Abgeschlossen' : 'Aktiv'}
                              </span>
                            )}
                            {variante ? <span className={styles.badgeVariant}>{variante}</span> : null}
                            <span className={styles.rowPrice}>{formatVkPreis(draft.vkPreis)}</span>
                          </div>
                          <div className={styles.rowMeta}>
                            <span className={styles.rowStrong}>{draft.orderNumber || 'ohne Auftragsnr.'}</span>
                            <span>{draft.customerName || 'ohne Kunde'}</span>
                            <span>{getBranch(draft.branchId)?.name ?? '—'}</span>
                            <span>{dateFmt.format(new Date(draft.finalizedAt ?? draft.createdAt))}</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          className={styles.duplicate}
                          onClick={() => void handleDuplicate(draft)}
                          aria-label={`Entwurf ${draft.id} duplizieren`}
                          title={
                            gehoertNutzer(draft, user?.id)
                              ? 'Als neue Variante duplizieren'
                              : `Als eigenen Entwurf duplizieren — die Kopie gehört ${user?.name ?? 'Ihnen'}`
                          }
                        >
                          Duplizieren
                        </button>
                        {/* Löschen nur bei eigenen Entwürfen — fremde lassen sich nur duplizieren. */}
                        {draft.isVerification ? (
                          <span className={styles.pinned} title="Referenz-Entwurf (nicht löschbar)">
                            ★
                          </span>
                        ) : !gehoertNutzer(draft, user?.id) ? null : (
                          <button
                            type="button"
                            className={styles.delete}
                            onClick={() =>
                              setZuVerwerfen({ id: draft.id, kunde: draft.customerName || draft.id })
                            }
                            aria-label={`Entwurf ${draft.id} in den Papierkorb verschieben`}
                          >
                            Löschen
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/*
        Rückfrage vor dem Verwerfen. Der Entwurf wandert in den Papierkorb und bleibt
        dort wiederherstellbar — endgültig gelöscht wird erst beim Leeren des Papierkorbs.
      */}
      <Modal
        open={zuVerwerfen !== null}
        title="In den Papierkorb verschieben?"
        onClose={() => setZuVerwerfen(null)}
      >
        <p className={styles.modalText}>
          „{zuVerwerfen?.kunde}" wird aus der Übersicht entfernt und in den Papierkorb gelegt. Von dort
          lässt er sich jederzeit wiederherstellen; endgültig gelöscht wird er erst, wenn der Papierkorb
          geleert wird.
        </p>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setZuVerwerfen(null)} disabled={verwirft}>
            Abbrechen
          </Button>
          <Button
            onClick={async () => {
              if (!zuVerwerfen) return
              setVerwirft(true)
              try {
                await trashDraft(zuVerwerfen.id)
                setZuVerwerfen(null)
              } finally {
                setVerwirft(false)
              }
            }}
            disabled={verwirft}
          >
            {verwirft ? 'Verschiebt …' : 'In den Papierkorb'}
          </Button>
        </div>
      </Modal>
    </AppShell>
  )
}
