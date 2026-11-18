import type { Match } from '../match/engine';
import type { SaveData } from './save';

/**
 * Pokédex della carriera: specie viste (incontrate in partita, tue e avversarie) e prese (entrate
 * nella tua rosa, più le forme evolute raggiunte in partita, come quando nei giochi un Pokémon evolve).
 */
export interface Dex {
  seen: string[];
  caught: string[];
}

const add = (list: string[], key: string) => {
  if (!list.includes(key)) list.push(key);
};

/** Una specie presa è anche vista. */
export function registerCaught(save: SaveData, key: string) {
  add(save.dex.caught, key);
  add(save.dex.seen, key);
}

/** Dopo una partita: tutti quelli scesi in campo sono visti, le forme dei tuoi sono prese. */
export function registerMatch(save: SaveData, match: Match, team: 0 | 1) {
  for (const p of match.appearances) {
    for (const key of [p.inst.speciesKey, p.formKey, p.peakForm]) {
      add(save.dex.seen, key);
      if (p.team === team) add(save.dex.caught, key);
    }
  }
}
