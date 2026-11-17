import type { Role } from './stats';

export type FormationKey = 'rombo' | 'quadrato';

export interface Slot {
  role: Role;
  /** Posizione base in metri, vista dalla squadra che attacca verso destra. */
  home: [number, number];
}

export const FORMATIONS: Record<FormationKey, { name: string; description: string; slots: Slot[] }> = {
  rombo: {
    name: 'Rombo (1-1-2-1)',
    description: 'Un difensore, due centrocampisti larghi che si inseriscono, un pivot.',
    slots: [
      { role: 'POR', home: [3, 30] },
      { role: 'DIF', home: [22, 30] },
      { role: 'CEN', home: [38, 11] },
      { role: 'CEN', home: [38, 49] },
      { role: 'ATT', home: [58, 30] },
    ],
  },
  quadrato: {
    name: 'Quadrato (2-2)',
    description: 'Due difensori e due attaccanti: più solido dietro e più fisico, meno inserimenti.',
    slots: [
      { role: 'POR', home: [3, 30] },
      { role: 'DIF', home: [22, 17] },
      { role: 'DIF', home: [22, 43] },
      { role: 'ATT', home: [55, 17] },
      { role: 'ATT', home: [55, 43] },
    ],
  },
};
