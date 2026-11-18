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
      const i = slots.findIndex((s, k) => s.role === role && !findOwned(save, save.lineup[k])?.technique);
      if (i >= 0 && teachTechnique(save, t.id, save.lineup[i]!)) break;
    }
  }
}
