// Per le simulazioni: insegna le tecniche delle medaglie vinte al titolare più adatto (come farebbe un giocatore).
import { FORMATIONS } from '../src/game/formations';
import { findOwned, teachTechnique, techniquesAvailable, type SaveData } from '../src/game/save';
import type { Role } from '../src/game/stats';
import type { TechniqueId } from '../src/game/techniques';

const PREFERRED: Record<TechniqueId, Role[]> = {
  riflessi: ['POR'],
  muro: ['DIF', 'CEN'],
  pressing: ['DIF', 'CEN'],
  testa: ['DIF', 'CEN', 'ATT'],
  scatto: ['ATT', 'CEN'],
  giro: ['ATT', 'CEN'],
  potenza: ['ATT', 'CEN'],
  rigenerazione: ['CEN', 'DIF', 'ATT', 'POR'],
};

export function teachAll(save: SaveData) {
  const slots = FORMATIONS[save.formation].slots;
  for (const t of techniquesAvailable(save)) {
    for (const role of PREFERRED[t.id]) {
      // come farebbe un giocatore: prima a chi non ne ha, poi a chi ne ha meno
      const free = (k: number) => findOwned(save, save.lineup[k])?.techniques?.length ?? 0;
      const i = slots
        .map((s, k) => ({ s, k }))
        .filter(({ s }) => s.role === role)
        .sort((a, b) => free(a.k) - free(b.k))[0]?.k ?? -1;
      if (i >= 0 && teachTechnique(save, t.id, save.lineup[i]!)) break;
    }
  }
}
