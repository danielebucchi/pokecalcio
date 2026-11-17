// I dati vengono da PokeAPI (stessi valori di Bulbapedia): rigenerali con `npm run import-pokedex`.
import data from './pokedex.json';

export type PokeType =
  | 'normal' | 'fire' | 'water' | 'grass' | 'electric' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface Evolution {
  key: string;
  /**
   * Livello minimo per poter evolvere in partita. Se nei giochi l'evoluzione non è di livello
   * (pietre, scambio, amicizia…) è stimato dalla potenza della forma evoluta.
   */
  level: number;
  /** Come avviene nei giochi: 'level', 'use-item', 'trade', 'level-up' (amicizia, ora del giorno…), … */
  method: string;
}

export interface Species {
  key: string;
  dex: number;
  /** Nome italiano. */
  name: string;
  types: PokeType[];
  /** Statistiche base come su Bulbapedia: la loro somma è la potenza della specie. */
  base: BaseStats;
  /** Altezza in decimetri: usata per la portata del portiere e per i colpi di testa. */
  heightDm: number;
  generation: number;
  /** Tasso di cattura dei giochi (3 = leggendari, 255 = facilissimo). */
  captureRate: number;
  legendary: boolean;
  mythical: boolean;
  baby: boolean;
  preEvolution?: string;
  /** Possono essere più di una (Eevee, Gloom, Poliwhirl…). */
  evolutions: Evolution[];
}

export const POKEDEX: Record<string, Species> = Object.fromEntries(
  (data as unknown as Species[]).map((s) => [s.key, s]),
);

export const TYPE_NAMES: Record<PokeType, string> = {
  normal: 'Normale', fire: 'Fuoco', water: 'Acqua', grass: 'Erba', electric: 'Elettro', ice: 'Ghiaccio',
  fighting: 'Lotta', poison: 'Veleno', ground: 'Terra', flying: 'Volante', psychic: 'Psico', bug: 'Coleottero',
  rock: 'Roccia', ghost: 'Spettro', dragon: 'Drago', dark: 'Buio', steel: 'Acciaio', fairy: 'Folletto',
};

export const bst = (sp: Species) => Object.values(sp.base).reduce((a, b) => a + b, 0);

/** Tutte le forme raggiungibili da una specie, con la profondità (1 = evoluzione diretta). */
export function descendants(key: string): (Evolution & { depth: number })[] {
  const out: (Evolution & { depth: number })[] = [];
  const visit = (k: string, depth: number) => {
    for (const e of POKEDEX[k]?.evolutions ?? []) {
      out.push({ ...e, depth });
      visit(e.key, depth + 1);
    }
  };
  visit(key, 1);
  return out;
}
