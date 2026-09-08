import type { Draft } from '../types/index.ts'

/**
 * ANGEBOTSVARIANTEN — Punkt 1.5.
 *
 * Dietmars Vorgabe, wörtlich:
 *
 *   „Ja, Angebotsvarianten sollen gruppiert angezeigt werden. Aber nur die, die
 *    auch für den gleichen Kunden sind. Z. B. wenn ein bestehender Artikel (ein
 *    Ausstellungsstück) für einen anderen Kunden dupliziert und bearbeitet wird,
 *    soll dieser nicht zum Ausstellungsartikel gruppiert werden."
 *
 * Die Abstammung (`variantOf`) allein genügt also NICHT. Erst Abstammung + gleicher
 * Kunde ergeben eine Variantengruppe. Ein Duplikat für einen anderen Kunden ist ein
 * eigenständiger Vorgang und steht für sich.
 *
 * Der Kundenname wird für den Vergleich normalisiert (Groß-/Kleinschreibung,
 * mehrfache Leerzeichen) — sonst trennt „Müller " von „Müller" eine Gruppe, die
 * fachlich zusammengehört.
 */

/** Kundenname in vergleichbarer Form. */
function kundeSchluessel(name: string | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Wurzel der Variantengruppe eines Entwurfs.
 *
 * Läuft die `variantOf`-Kette nach oben, solange der Kunde derselbe bleibt. Beim
 * ersten Kundenwechsel — oder wenn der Ursprung nicht (mehr) vorliegt — endet die
 * Kette, und der Entwurf ist selbst die Wurzel.
 */
export function gruppenWurzel(draft: Draft, nachId: ReadonlyMap<string, Draft>): string {
  let aktuell = draft
  const gesehen = new Set<string>([aktuell.id])

  while (aktuell.variantOf) {
    const eltern = nachId.get(aktuell.variantOf)
    if (!eltern) break
    if (gesehen.has(eltern.id)) break // Zyklus – darf die Anzeige nicht aufhängen
    if (kundeSchluessel(eltern.customerName) !== kundeSchluessel(draft.customerName)) break
    gesehen.add(eltern.id)
    aktuell = eltern
  }
  return aktuell.id
}

export interface Variantengruppe {
  /** Entwurfsnummer des Ursprungs-Entwurfs. */
  wurzelId: string
  /** Ursprung zuerst, danach die Varianten in der Reihenfolge der Liste. */
  entwuerfe: Draft[]
  /** true, sobald mindestens eine Variante dazugehört. */
  istGruppe: boolean
}

/**
 * Fasst eine bereits gefilterte Entwurfsliste zu Variantengruppen zusammen.
 *
 * Die Reihenfolge der Liste bleibt erhalten: Eine Gruppe erscheint dort, wo ihr
 * erstes Mitglied stand. Innerhalb der Gruppe steht der Ursprung oben, falls er
 * in der Filterung enthalten ist.
 *
 * @param liste    gefilterte Entwürfe in Anzeigereihenfolge
 * @param alle     alle bekannten Entwürfe – auch die weggefilterten, damit die
 *                 Abstammung nicht an der Filterung zerbricht
 */
export function gruppiereVarianten(liste: readonly Draft[], alle: readonly Draft[]): Variantengruppe[] {
  const nachId = new Map(alle.map((d) => [d.id, d]))
  const gruppen = new Map<string, Draft[]>()
  const reihenfolge: string[] = []

  for (const draft of liste) {
    const wurzel = gruppenWurzel(draft, nachId)
    const vorhanden = gruppen.get(wurzel)
    if (vorhanden) vorhanden.push(draft)
    else {
      gruppen.set(wurzel, [draft])
      reihenfolge.push(wurzel)
    }
  }

  return reihenfolge.map((wurzelId) => {
    const entwuerfe = gruppen.get(wurzelId)!
    // Ursprung nach oben – er ist der Bezugspunkt der Gruppe.
    const sortiert = [...entwuerfe].sort((a, b) =>
      a.id === wurzelId ? -1 : b.id === wurzelId ? 1 : 0,
    )
    return { wurzelId, entwuerfe: sortiert, istGruppe: sortiert.length > 1 }
  })
}

/**
 * Anzeigename einer Variante: die vom Berater vergebene Bezeichnung, sonst schlicht
 * „Variante". Punkt 1.5 Frage 2 — das automatische Kennzeichen allein genügt Dietmar
 * ausdrücklich nicht.
 */
export function variantenName(draft: Draft): string | undefined {
  const eigen = draft.variantLabel?.trim()
  if (eigen) return eigen
  return draft.variantOf ? 'Variante' : undefined
}
