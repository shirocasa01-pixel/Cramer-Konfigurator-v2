import { useEffect } from 'react'

/**
 * HINTERGRUND FESTHALTEN, solange ein Dialog offen ist.
 *
 * Ohne das scrollt das Mausrad die Seite HINTER dem Dialog: Der Dialog bleibt stehen,
 * der Inhalt darunter wandert — genau der Effekt, über den in der Verwaltung berichtet
 * wurde.
 *
 * Gezählt statt geschaltet: In der Stammdatenverwaltung liegt der Artikel-Editor über dem
 * Verwaltungsfenster. Würde jeder Dialog beim Schließen einfach `overflow` zurücksetzen,
 * gäbe der innere beim Schließen den Hintergrund frei, obwohl der äußere noch offen ist.
 */
let offeneDialoge = 0
let vorherigerWert = ''

function sperren() {
  if (offeneDialoge === 0) {
    vorherigerWert = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  offeneDialoge++
}

function freigeben() {
  offeneDialoge = Math.max(0, offeneDialoge - 1)
  if (offeneDialoge === 0) document.body.style.overflow = vorherigerWert
}

/** Hält den Seitenhintergrund fest, solange `aktiv` gilt. */
export function useScrollSperre(aktiv: boolean): void {
  useEffect(() => {
    if (!aktiv) return
    sperren()
    return freigeben
  }, [aktiv])
}
