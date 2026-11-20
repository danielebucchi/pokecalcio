import type { BaseStats } from '../data/pokedex';

/**
 * Nature, come nei giochi dalla terza generazione: ognuna alza del 10% una statistica e ne abbassa
 * un'altra del 10% (i PV mai); cinque sono neutre. Nomi italiani ufficiali.
 */
type Stat = Exclude<keyof BaseStats, 'hp'>;

export interface Nature {
  id: string;
  name: string;
  up?: Stat;
  down?: Stat;
}

const ROWS: [string, string, Stat | null, Stat | null][] = [
  ['hardy', 'Ardita', null, null], ['lonely', 'Schiva', 'atk', 'def'], ['brave', 'Audace', 'atk', 'spe'],
  ['adamant', 'Decisa', 'atk', 'spa'], ['naughty', 'Birbona', 'atk', 'spd'],
  ['bold', 'Sicura', 'def', 'atk'], ['docile', 'Docile', null, null], ['relaxed', 'Placida', 'def', 'spe'],
  ['impish', 'Scaltra', 'def', 'spa'], ['lax', 'Fiacca', 'def', 'spd'],
  ['timid', 'Timida', 'spe', 'atk'], ['hasty', 'Lesta', 'spe', 'def'], ['serious', 'Seria', null, null],
  ['jolly', 'Allegra', 'spe', 'spa'], ['naive', 'Ingenua', 'spe', 'spd'],
  ['modest', 'Modesta', 'spa', 'atk'], ['mild', 'Mite', 'spa', 'def'], ['quiet', 'Quieta', 'spa', 'spe'],
  ['bashful', 'Ritrosa', null, null], ['rash', 'Ardente', 'spa', 'spd'],
  ['calm', 'Calma', 'spd', 'atk'], ['gentle', 'Gentile', 'spd', 'def'], ['sassy', 'Vivace', 'spd', 'spe'],
  ['careful', 'Cauta', 'spd', 'spa'], ['quirky', 'Furba', null, null],
];

export const NATURES: Nature[] = ROWS.map(([id, name, up, down]) => ({ id, name, ...(up ? { up } : {}), ...(down ? { down } : {}) }));
const BY_ID = new Map(NATURES.map((n) => [n.id, n]));
export const natureById = (id: string | undefined) => (id ? BY_ID.get(id) : undefined);

export const randomNature = () => NATURES[Math.floor(Math.random() * NATURES.length)].id;
/** Una natura neutra a caso (per i Pokémon che esistevano prima delle nature: le statistiche non cambiano). */
export const randomNeutralNature = () => {
  const neutral = NATURES.filter((n) => !n.up);
  return neutral[Math.floor(Math.random() * neutral.length)].id;
};

/** Moltiplicatore della natura su una statistica (1.1, 0.9 o 1). */
export function natureMult(id: string | undefined, stat: keyof BaseStats): number {
  const n = natureById(id);
  if (!n || stat === 'hp') return 1;
  return n.up === stat ? 1.1 : n.down === stat ? 0.9 : 1;
}
