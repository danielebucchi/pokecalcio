import type { TechniqueId } from './techniques';
import type { BaseStats, Species } from '../data/pokedex';

export type Role = 'POR' | 'DIF' | 'CEN' | 'ATT';

/** Un Pokémon della rosa: la specie è sempre quella base, l'evoluzione esiste solo in partita. */
export interface PokemonInstance {
  uid: string;
  speciesKey: string;
  level: number;
  /** Talento nascosto (0-31), come nei giochi. */
  ivs: BaseStats;
  /** Allenamento specifico (max 252 per stat, 510 totali), come nei giochi. */
  evs: BaseStats;
  /** Tecniche imparate con le MT delle medaglie (vedi techniques.ts), per sempre. */
  techniques?: TechniqueId[];
  /** Vecchi salvataggi: una sola tecnica (loadSave la sposta in `techniques`). */
  technique?: TechniqueId;
  /** Soprannome dato dall'allenatore (vuoto = nome della specie). */
  nickname?: string;
  /** Shiny: colori rari, solo da collezione (le statistiche sono le stesse). */
  shiny?: boolean;
}

/** Le 4 statistiche del gioco: tra fisico e speciale si prende il valore più alto. */
export interface GameStats {
  att: number;
  dif: number;
  vel: number;
  pv: number;
}

/** Formula ufficiale delle statistiche (senza natura). */
export function realStats(sp: Species, inst: PokemonInstance): BaseStats {
  const L = inst.level;
  const calc = (k: keyof BaseStats) =>
    Math.floor(((2 * sp.base[k] + inst.ivs[k] + Math.floor(inst.evs[k] / 4)) * L) / 100);
  return {
    hp: calc('hp') + L + 10,
    atk: calc('atk') + 5,
    def: calc('def') + 5,
    spa: calc('spa') + 5,
    spd: calc('spd') + 5,
    spe: calc('spe') + 5,
  };
}

export function gameStats(s: BaseStats): GameStats {
  return {
    att: Math.max(s.atk, s.spa),
    dif: Math.max(s.def, s.spd),
    vel: s.spe,
    pv: s.hp,
  };
}

/** Raggio (in metri di campo) entro cui il portiere arriva sul pallone: cresce con l'altezza, max 4 m. */
export function reachOf(heightDm: number): number {
  return 2.5 + Math.min(heightDm / 10, 4);
}

export function keeperRating(g: GameStats): number {
  return 0.5 * g.dif + 0.3 * g.pv + 0.2 * g.vel;
}

/** Forza nel gioco aereo (cross e calci piazzati): conta molto la DIF e l'altezza, fino a 3 m. */
export function headerRating(g: GameStats, heightDm: number): number {
  return (0.35 * g.att + 0.45 * g.dif + 0.2 * g.pv) * (1 + Math.min(heightDm / 10, 3) * 0.12);
}

export function roleRatings(g: GameStats, heightDm: number): Record<Role, number> {
  const reachBonus = 1 + (reachOf(heightDm) - 2.5) * 0.05;
  return {
    POR: keeperRating(g) * reachBonus,
    DIF: 0.6 * g.dif + 0.2 * g.pv + 0.2 * g.vel,
    CEN: 0.35 * g.att + 0.35 * g.dif + 0.3 * g.vel,
    ATT: 0.6 * g.att + 0.25 * g.vel + 0.15 * g.pv,
  };
}

/** Il Pokémon conosce questa tecnica? */
export const knows = (p: PokemonInstance, id: TechniqueId) => !!p.techniques?.includes(id);

/** Quante MT può imparare un Pokémon, come le quattro mosse dei giochi. */
export const MAX_TECHNIQUES = 4;

export function createInstance(speciesKey: string, level: number): PokemonInstance {
  const iv = () => Math.floor(Math.random() * 32);
  return {
    // univoco anche tra sessioni diverse: gli uid finiscono nei salvataggi
    uid: `${speciesKey}-${crypto.randomUUID().slice(0, 8)}`,
    speciesKey,
    level,
    ivs: { hp: iv(), atk: iv(), def: iv(), spa: iv(), spd: iv(), spe: iv() },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  };
}
