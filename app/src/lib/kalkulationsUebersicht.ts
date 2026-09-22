/**
 * KALKULATIONSÜBERSICHT — die zweistufige Zusammenfassung für Abschluss und AV-PDF.
 *
 *   Artikel und Ausstattung                      3.000,00 €
 *     Raumteiler (5 %)                             150,00 €
 *     Sichtrueckwand (10 %)                         50,00 €   (Beispielwerte)
 *   Artikelbezogene Aufschläge                     200,00 €
 *   Gesamtmöbelpreis                             3.200,00 €
 *   Montage (10 %)                                 320,00 €
 *   Lieferung regional (3 %)                        96,00 €
 *   Gesamtpreis inkl. Montage und Lieferung      3.616,00 €
 *
 * Abschluss, PDF und Tests lesen dieselben Zeilen aus dieser einen Funktion — eine zweite
 * Fassung der Reihenfolge wäre die sichere Quelle dafür, dass Bildschirm und Papier
 * irgendwann verschiedene Summen zeigen.
 */

import { formatEuro } from './format.ts'
import type { AufgeloestePreise } from './pricingSnapshot.ts'

export type UebersichtArt = 'moebel' | 'aufschlag' | 'aufschlaegeSumme' | 'gesamtmoebel' | 'service' | 'gesamt'

export interface UebersichtZeile {
  art: UebersichtArt
  label: string
  /** Betrag; `null` = auf Anfrage (Artikel gesperrt oder unvollständig gepflegt). */
  betrag: number | null
  /** Zusatz in kleiner Schrift: Basis, Preislisten-Nummer, Grund für „auf Anfrage". */
  detail?: string
  /** Summenzeile (fett, mit Linie). */
  summe?: boolean
  /** Unterzeile eines Blocks (eingerückt). */
  einzug?: boolean
  /** Nur Montage/Lieferung: angehakt? `false` ⇒ zählt nicht, Betrag nur zur Information. */
  aktiv?: boolean
  /** Nur Montage/Lieferung (live): der Schalter in `Draft.pricingOptions`. */
  option?: 'montage' | 'lieferungRegional'
}

function gesamtLabel(montage: boolean, lieferung: boolean): string {
  if (montage && lieferung) return 'Gesamtpreis inkl. Montage und Lieferung'
  if (montage) return 'Gesamtpreis inkl. Montage'
  if (lieferung) return 'Gesamtpreis inkl. Lieferung'
  return 'Gesamtpreis (ohne Montage und Lieferung)'
}

export function kalkulationsUebersicht(p: AufgeloestePreise): UebersichtZeile[] {
  const zeilen: UebersichtZeile[] = [
    { art: 'moebel', label: 'Artikel und Ausstattung', betrag: p.moebelpreis },
  ]

  for (const z of p.artikelAufschlaege) {
    zeilen.push({ art: 'aufschlag', label: z.label, betrag: z.gesamt, detail: z.hinweis, einzug: true })
  }
  zeilen.push({
    art: 'aufschlaegeSumme',
    label: 'Artikelbezogene Aufschläge',
    betrag: p.summeArtikelAufschlaege,
    detail: p.artikelAufschlaege.length === 0 ? 'keine' : undefined,
  })
  zeilen.push({ art: 'gesamtmoebel', label: 'Gesamtmöbelpreis', betrag: p.gesamtmoebelpreis, summe: true })

  // Live: alle Service-Zuschläge mit Schalterstellung. Eingefroren: nur die berechneten.
  const service =
    p.serviceAuswahl.length > 0
      ? p.serviceAuswahl.map((s) => ({ position: s.position, aktiv: s.aktiv, option: s.option }))
      : p.serviceZuschlaege.map((position) => ({ position, aktiv: true, option: undefined }))
  for (const { position, aktiv, option } of service) {
    const nr = position.preislistenNr ? `Art.-Nr. ${position.preislistenNr}` : undefined
    zeilen.push({
      art: 'service',
      label: position.label,
      betrag: position.gesamt,
      detail: [nr, aktiv ? position.hinweis : 'nicht beauftragt'].filter(Boolean).join(' · ') || undefined,
      aktiv,
      option,
    })
  }

  const hat = (art: string) => service.some((s) => s.aktiv && s.position.zuschlagArt === art)
  zeilen.push({ art: 'gesamt', label: gesamtLabel(hat('montage'), hat('lieferung')), betrag: p.gesamt, summe: true })
  return zeilen
}

/** Betrag lesbar — „auf Anfrage" statt einer erfundenen Null. */
export function uebersichtBetrag(zeile: UebersichtZeile): string {
  return zeile.betrag == null ? 'auf Anfrage' : formatEuro(zeile.betrag)
}
