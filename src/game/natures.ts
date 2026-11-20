import type { GameStats } from './stats';

/**
 * Nature, come nei giochi ma sulle quattro statistiche del calcio: ognuna alza del 10% Attacco, Difesa,
 * Velocità o Resistenza (PV) e ne abbassa un'altra del 10%; quattro sono neutre (la diagonale della tabella 4×4). Nomi italiani ufficiali,
 * scelti tra le nature dei giochi con lo stesso significato (Timida: più veloce, meno attacco).
 */
type Stat = keyof GameStats;

export interface Nature {
  id: string;
  name: string;
  up?: Stat;
  down?: Stat;
}

const ROWS: [string, string, Stat | null, Stat | null][] = [
  ['lonely', 'Schiva', 'att', 'dif'], ['brave', 'Audace', 'att', 'vel'], ['adamant', 'Decisa', 'att', 'pv'],
  ['bold', 'Sicura', 'dif', 'att'], ['relaxed', 'Placida', 'dif', 'vel'], ['impish', 'Scaltra', 'dif', 'pv'],
  ['timid', 'Timida', 'vel', 'att'], ['hasty', 'Lesta', 'vel', 'dif'], ['jolly', 'Allegra', 'vel', 'pv'],
  ['calm', 'Calma', 'pv', 'att'], ['gentle', 'Gentile', 'pv', 'dif'], ['sassy', 'Vivace', 'pv', 'vel'],
  // diagonale della tabella: la stessa statistica sale e scende, come le neutre dei giochi
  ['hardy', 'Ardita', null, null], ['docile', 'Docile', null, null], ['serious', 'Seria', null, null], ['quirky', 'Furba', null, null],
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

/** Moltiplicatore della natura su una statistica del gioco (1.1, 0.9 o 1). */
export function natureMult(id: string | undefined, stat: Stat): number {
  const n = natureById(id);
  if (!n) return 1;
  return n.up === stat ? 1.1 : n.down === stat ? 0.9 : 1;
}

export const STAT_NAMES: Record<Stat, string> = { att: 'Attacco', dif: 'Difesa', vel: 'Velocità', pv: 'Resistenza' };

/** "Timida · Velocità +10%, Attacco −10%" (o "Seria · neutra"). */
export function natureText(id: string | undefined): string {
  const n = natureById(id);
  if (!n) return '';
  return n.up ? `${n.name} · ${STAT_NAMES[n.up]} +10%, ${STAT_NAMES[n.down!]} −10%` : `${n.name} · neutra`;
}
