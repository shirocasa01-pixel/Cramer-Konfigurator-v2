/**
 * PREIS-SNAPSHOT — Aufträge von der Artikelverwaltung entkoppeln.
 *
 * Das Problem: `berechneEntwurf` rechnet immer gegen den AKTUELLEN Stammdaten-Stand.
 * Für einen offenen Entwurf ist das genau richtig — der Berater soll heutige Preise
 * sehen. Für einen abgeschlossenen Auftrag ist es fatal: Eine Preispflege in der
 * Artikelverwaltung würde rückwirkend ändern, was der Kunde unterschrieben hat.
 *
 * Die Trennlinie ist `finalizedAt`:
 *
 *   finalizedAt gesetzt   ⇒ AUFTRAG. Preise kommen starr aus `pricing_snapshot`.
 *   finalizedAt leer      ⇒ ENTWURF. Preise werden bei jedem Laden neu gerechnet.
 *
 * Der Snapshot entsteht GENAU EINMAL, beim Finalisieren (`friereBeimSpeichernEin`),
 * und wird danach nie überschrieben — auch nicht, wenn der Auftrag erneut gespeichert
 * wird. Wird ein Auftrag wieder geöffnet (Duplizieren), fällt der Snapshot weg, damit
 * die Kopie nicht stillschweigend mit alten Preisen weiterläuft.
 */

import { berechneEntwurf, type KalkMeldung, type ServiceAuswahl } from './kalkulation.ts'
import { parseEingabeDe } from './format.ts'
import { getStammdatenStand } from './stammdatenStore.ts'
import type { Draft, PricingSnapshot, PricingSnapshotPosition, ZuschlagStufe } from '../types/index.ts'

/** true ⇒ abgeschlossener Auftrag (nicht mehr neu rechnen). */
export function istFinalisiert(draft: Draft): boolean {
  return Boolean(draft.finalizedAt)
}

/**
 * Rechnet den Entwurf einmal durch und friert das Ergebnis ein.
 *
 * Bewusst wird auch ein UNVOLLSTÄNDIGER Stand eingefroren (`vollstaendig: false`,
 * `offenePositionen > 0`): Ein Auftrag, der mit „auf Anfrage"-Positionen abgeschlossen
 * wurde, soll später genau das zeigen — und nicht so aussehen, als sei er sauber
 * durchkalkuliert gewesen.
 */
export function erzeugePricingSnapshot(draft: Draft, frozenAt: string): PricingSnapshot {
  const ergebnis = berechneEntwurf(draft)
  return {
    frozenAt,
    stammdatenVersion: getStammdatenStand().version,
    gueltigkeit: ergebnis.gueltigkeit,
    waehrung: ergebnis.waehrung,
    positionen: ergebnis.positionen,
    zuschlaege: ergebnis.zuschlaege,
    moebelpreis: ergebnis.moebelpreis,
    gesamtmoebelpreis: ergebnis.gesamtmoebelpreis,
    gesamt: ergebnis.gesamt,
    offenePositionen: ergebnis.offenePositionen,
    vollstaendig: ergebnis.vollstaendig,
    vkPreis: draft.vkPreis,
    vkPreisNumerisch: parseEingabeDe(draft.vkPreis),
  }
}

/**
 * Stufe eines Zuschlags. Snapshots vor der zweistufigen Kalkulation (09/2026) tragen sie
 * nicht — dort ergibt sie sich aus der Art: Montage und Lieferung sind nachgelagert.
 */
export function stufeVon(z: PricingSnapshotPosition): ZuschlagStufe {
  if (z.zuschlagStufe) return z.zuschlagStufe
  return z.zuschlagArt === 'montage' || z.zuschlagArt === 'lieferung' ? 'service' : 'artikel'
}

/**
 * SPEICHER-SEITE. Bringt den Entwurf in den Zustand, in dem er abgelegt werden darf.
 *
 *   • Auftrag ohne Snapshot  ⇒ jetzt einfrieren.
 *   • Auftrag mit Snapshot   ⇒ unverändert lassen. Genau hier entsteht die Entkopplung:
 *                              erneutes Speichern zieht KEINE neuen Preise nach.
 *   • Offener Entwurf        ⇒ evtl. vorhandenen Snapshot entfernen.
 */
export function friereBeimSpeichernEin(draft: Draft): Draft {
  if (!istFinalisiert(draft)) return ohneSnapshot(draft)
  if (draft.pricing_snapshot) return draft
  return {
    ...draft,
    // `finalizedAt` ist der fachlich richtige Zeitpunkt; nur falls er fehlt, jetzt.
    pricing_snapshot: erzeugePricingSnapshot(draft, draft.finalizedAt ?? new Date().toISOString()),
  }
}

/**
 * LADE-SEITE. Anders als beim Speichern wird hier NICHTS eingefroren.
 *
 * Ein Auftrag ohne Snapshot (Altbestand aus der Zeit vor diesem Feature) bekommt hier
 * bewusst keinen — sonst würde beim Öffnen der heutige Preisstand eingefroren und sähe
 * anschließend aus, als sei er immer schon der Auftragspreis gewesen. Solche Aufträge
 * rechnen live weiter und werden in der Oberfläche als solche gekennzeichnet.
 */
export function normalisiereBeimLaden(draft: Draft): Draft {
  return istFinalisiert(draft) ? draft : ohneSnapshot(draft)
}

/** Entfernt einen Snapshot, falls vorhanden (sonst unverändert — keine neue Referenz). */
export function ohneSnapshot(draft: Draft): Draft {
  if (!draft.pricing_snapshot) return draft
  const kopie: Draft = { ...draft }
  delete kopie.pricing_snapshot
  return kopie
}

/** Woher die angezeigten Preise stammen. */
export type PreisHerkunft = 'snapshot' | 'live'

export interface AufgeloestePreise {
  herkunft: PreisHerkunft
  /** Nur bei `herkunft === 'snapshot'`: Zeitpunkt des Einfrierens (ISO-8601). */
  frozenAt?: string
  /**
   * true ⇒ der Entwurf ist finalisiert, trägt aber keinen Snapshot (Altbestand).
   * Die Beträge sind dann live gerechnet und können vom Auftragspreis abweichen —
   * die Oberfläche muss das sichtbar machen, statt es zu verschweigen.
   */
  snapshotFehlt: boolean
  positionen: PricingSnapshotPosition[]
  /** Beide Stufen zusammen, wie im Snapshot. */
  zuschlaege: PricingSnapshotPosition[]
  /** Stufe 1: artikelbezogene Aufschläge auf den Möbelpreis. */
  artikelAufschlaege: PricingSnapshotPosition[]
  /** Stufe 2: Montage und Lieferung — nur die berechneten. */
  serviceZuschlaege: PricingSnapshotPosition[]
  /**
   * Stufe 2 mit Schalterstellung — nur live gerechnet. Ein eingefrorener Auftrag kennt
   * abgewählte Zuschläge nicht mehr; die Liste ist dann leer.
   */
  serviceAuswahl: ServiceAuswahl[]
  /** „Artikel und Ausstattung" — Summe der Positionen. */
  moebelpreis: number
  summeArtikelAufschlaege: number
  /** Möbelpreis + artikelbezogene Aufschläge. */
  gesamtmoebelpreis: number
  /** Gesamtmöbelpreis + Montage + Lieferung. */
  gesamt: number
  offenePositionen: number
  vollstaendig: boolean
  gueltigkeit: string
  waehrung: string
  /** Hinweise der Live-Kalkulation; bei eingefrorenen Aufträgen leer. */
  meldungen: KalkMeldung[]
}

/**
 * Der EINE Einstieg für jede Preisanzeige.
 *
 * Abgeschlossener Auftrag mit Snapshot ⇒ starr aus dem Snapshot.
 * Alles andere                          ⇒ frisch aus den aktuellen Stammdaten.
 *
 * Wer Preise anzeigt, ruft diese Funktion — nicht `berechneEntwurf` direkt. Sonst
 * entsteht wieder eine Stelle, an der ein Auftrag doch live nachrechnet.
 */
export function aufgeloestePreise(draft: Draft): AufgeloestePreise {
  const snapshot = draft.pricing_snapshot
  const finalisiert = istFinalisiert(draft)

  if (finalisiert && snapshot) {
    const artikelAufschlaege = snapshot.zuschlaege.filter((z) => stufeVon(z) === 'artikel')
    const summeArtikelAufschlaege =
      Math.round(artikelAufschlaege.reduce((s, z) => s + (z.gesamt ?? 0), 0) * 100) / 100
    return {
      herkunft: 'snapshot',
      frozenAt: snapshot.frozenAt,
      snapshotFehlt: false,
      positionen: snapshot.positionen,
      zuschlaege: snapshot.zuschlaege,
      artikelAufschlaege,
      serviceZuschlaege: snapshot.zuschlaege.filter((z) => stufeVon(z) === 'service'),
      serviceAuswahl: [],
      moebelpreis: snapshot.moebelpreis,
      summeArtikelAufschlaege,
      // Ältere Snapshots tragen die Zwischensumme nicht — sie ergibt sich aus den Zuschlägen.
      gesamtmoebelpreis:
        snapshot.gesamtmoebelpreis ?? Math.round((snapshot.moebelpreis + summeArtikelAufschlaege) * 100) / 100,
      gesamt: snapshot.gesamt,
      offenePositionen: snapshot.offenePositionen,
      vollstaendig: snapshot.vollstaendig,
      gueltigkeit: snapshot.gueltigkeit,
      waehrung: snapshot.waehrung,
      meldungen: [],
    }
  }

  const ergebnis = berechneEntwurf(draft)
  return {
    herkunft: 'live',
    snapshotFehlt: finalisiert,
    positionen: ergebnis.positionen,
    zuschlaege: ergebnis.zuschlaege,
    artikelAufschlaege: ergebnis.artikelAufschlaege,
    serviceZuschlaege: ergebnis.serviceZuschlaege,
    serviceAuswahl: ergebnis.serviceAuswahl,
    moebelpreis: ergebnis.moebelpreis,
    summeArtikelAufschlaege: ergebnis.summeArtikelAufschlaege,
    gesamtmoebelpreis: ergebnis.gesamtmoebelpreis,
    gesamt: ergebnis.gesamt,
    offenePositionen: ergebnis.offenePositionen,
    vollstaendig: ergebnis.vollstaendig,
    gueltigkeit: ergebnis.gueltigkeit,
    waehrung: ergebnis.waehrung,
    meldungen: ergebnis.meldungen,
  }
}
