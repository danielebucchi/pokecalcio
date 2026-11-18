import { POKEDEX } from '../data/pokedex';
import { KANTO, RIVAL_STEPS } from './kanto';
import { levelCap } from './progression';
import { ROSTER_MAX, SESSIONS_PER_PLACE, addToRoster, type SaveData } from './save';
import { createInstance } from './stats';

/**
 * Missioni facoltative e i loro premi: completata una missione, il premio si ritira (una volta sola)
 * dalla scheda Missioni. I premi restano una sorpresa finché la missione non è completa.
 */
export interface SideMission {
  id: string;
  name: string;
  progress(save: SaveData): [done: number, total: number];
  /** Pokémon in premio (arriva 2 livelli sotto il tetto) oppure sessioni di allenamento. */
  reward: { pokemon: string } | { sessions: number };
}

const isRival = (id: string) => RIVAL_STEPS.some((r) => r.trainer === id);
const routeTrainers = () => KANTO.flatMap((l) => l.trainers).filter((t) => !isRival(t.id));

export const SIDE_MISSIONS: SideMission[] = [
  {
    id: 'legendaries', name: 'Leggendari',
    progress: (save) => [save.legendaries.length, KANTO.filter((l) => l.legendary).length],
    // il segreto per eccellenza
    reward: { pokemon: 'mew' },
  },
  {
    id: 'events', name: 'Eventi nascosti',
    progress: (save) => [save.events.length, KANTO.reduce((a, l) => a + (l.events?.length ?? 0), 0)],
    // quello che dorme sul Percorso 12
    reward: { pokemon: 'snorlax' },
  },
  {
    id: 'trainers', name: 'Allenatori battuti',
    progress: (save) => {
      const all = routeTrainers();
      return [save.defeated.filter((id) => all.some((t) => t.id === id)).length, all.length];
    },
    // il premio del Casinò di Azzurropoli in Rosso/Blu
    reward: { pokemon: 'porygon' },
  },
  {
    id: 'roster', name: 'Rosa completa',
    progress: (save) => [save.roster.length, ROSTER_MAX],
    reward: { sessions: SESSIONS_PER_PLACE * 2 },
  },
];

/** Livello dei Pokémon in premio. */
export const rewardLevel = (save: SaveData) => Math.max(5, levelCap(save) - 2);

export function rewardLabel(save: SaveData, m: SideMission): string {
  return 'pokemon' in m.reward
    ? `${POKEDEX[m.reward.pokemon].name} (Lv ${rewardLevel(save)})`
    : `+${m.reward.sessions} sessioni di allenamento`;
}

export const missionComplete = (save: SaveData, m: SideMission) => {
  const [n, tot] = m.progress(save);
  return n >= tot;
};

/** Ritira il premio di una missione completata. Restituisce un messaggio, oppure null se non si può. */
export function claimReward(save: SaveData, m: SideMission, releaseUid?: string): string | null {
  if (save.rewards.includes(m.id) || !missionComplete(save, m)) return null;
  if ('pokemon' in m.reward) {
    const inst = createInstance(m.reward.pokemon, rewardLevel(save));
    if (!addToRoster(save, inst, releaseUid)) return null;
    save.rewards.push(m.id);
    return `${POKEDEX[m.reward.pokemon].name} si unisce alla tua squadra!`;
  }
  save.sessionsLeft += m.reward.sessions;
  save.rewards.push(m.id);
  return `+${m.reward.sessions} sessioni di allenamento: le trovi in Allenamento.`;
}
