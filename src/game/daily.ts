import { POKEDEX, TYPE_NAMES, bst, type PokeType } from '../data/pokedex';
import type { FormationKey } from './formations';
import { ALL_TYPES } from './typechart';

/**
 * Sfida del giorno: ogni giorno una squadra diversa, uguale per tutti perché nasce dalla data
 * (niente server). Sette Pokémon già evoluti di un tipo, al livello dei tuoi titolari: si gioca quante
 * volte si vuole, conta il miglior risultato. Non dà esperienza: è una sfida, non un allenamento.
 */

/** Il giorno di oggi (ora locale), AAAA-MM-GG. */
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Numeri casuali ripetibili a partire da un testo (mulberry32). */
function seeded(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyPlan {
  key: string;
  type: PokeType;
  name: string;
  color: string;
  formation: FormationKey;
  /** Il primo è l'asso, sempre in campo. */
  species: string[];
}

const COLORS = ['#e879a8', '#a890d8', '#8ec5d8', '#7dd1b8', '#e8a317', '#f08a5d'];

export function dailyPlan(key = todayKey()): DailyPlan {
  const rnd = seeded(`pokecalcio:${key}`);
  // forme finali (niente leggendari né misteriosi), abbastanza forti ma non fuori scala
  const finals = Object.values(POKEDEX).filter((s) => !s.evolutions.length && !s.legendary && !s.mythical && bst(s) >= 430 && bst(s) <= 560);
  const types = ALL_TYPES.filter((t) => finals.filter((s) => s.types.includes(t)).length >= 7);
  const type = types[Math.floor(rnd() * types.length)];
  const pool = finals.filter((s) => s.types.includes(type)).map((s) => s.key).sort();
  const species: string[] = [];
  while (species.length < 7) {
    const k = pool[Math.floor(rnd() * pool.length)];
    if (!species.includes(k)) species.push(k);
  }
  return {
    key, type, species,
    name: `Sfida del giorno · tipo ${TYPE_NAMES[type]}`,
    color: COLORS[Math.floor(rnd() * COLORS.length)],
    formation: rnd() < 0.5 ? 'rombo' : 'quadrato',
  };
}

export interface DailyResult {
  gf: number;
  ga: number;
  won: boolean;
}

/** Il risultato è migliore del record? Prima la vittoria, poi la differenza reti, poi i gol fatti. */
export function better(a: DailyResult, b: DailyResult | null): boolean {
  if (!b) return true;
  if (a.won !== b.won) return a.won;
  if (a.gf - a.ga !== b.gf - b.ga) return a.gf - a.ga > b.gf - b.ga;
  return a.gf > b.gf;
}
