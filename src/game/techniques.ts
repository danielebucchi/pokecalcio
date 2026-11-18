import type { GameStats } from './stats';

/**
 * Premi delle medaglie, come in Rosso/Blu.
 * - Tecniche (le "MT"): ogni medaglia ne dà una da insegnare a un Pokémon, per sempre. Come le MT
 *   della prima generazione sono monouso: una tecnica va a un solo Pokémon, e un Pokémon ne impara una.
 * - Bonus alla squadra: quattro medaglie alzano una statistica di tutta la squadra in partita
 *   (Sasso l'Attacco, Tuono la Velocità, Anima la Difesa, Vulcano lo Speciale, che qui sono i PV).
 */
export type TechniqueId = 'muro' | 'pressing' | 'scatto' | 'rigenerazione' | 'testa' | 'giro' | 'potenza' | 'riflessi';

export interface Technique {
  id: TechniqueId;
  name: string;
  /** Indice della palestra che la dà. */
  badge: number;
  description: string;
}

export const TECHNIQUES: Technique[] = [
  { id: 'muro', name: 'Muro', badge: 0, description: 'Subisce un quarto di danni in meno nei contrasti e nelle parate.' },
  { id: 'pressing', name: 'Pressing', badge: 1, description: 'Vince più contrasti quando va a rubare palla.' },
  { id: 'scatto', name: 'Scatto', badge: 2, description: '+10% di Velocità.' },
  { id: 'rigenerazione', name: 'Rigenerazione', badge: 3, description: 'Recupera PV a poco a poco durante la partita.' },
  { id: 'testa', name: 'Colpo di testa', badge: 4, description: 'Vince più duelli aerei su angoli e cross.' },
  { id: 'giro', name: 'Tiro a giro', badge: 5, description: 'I suoi tiri sono più difficili da parare.' },
  { id: 'potenza', name: 'Tiro di potenza', badge: 6, description: 'Tira più forte.' },
  { id: 'riflessi', name: 'Riflessi', badge: 7, description: 'Para meglio: è per il portiere.' },
];

export const techniqueById = (id: TechniqueId | undefined) => TECHNIQUES.find((t) => t.id === id);

/** Bonus alla squadra delle medaglie (moltiplicatori), come in Rosso/Blu. */
export const BADGE_BONUS: { badge: number; stat: keyof GameStats; label: string }[] = [
  { badge: 0, stat: 'att', label: 'Attacco' },
  { badge: 2, stat: 'vel', label: 'Velocità' },
  { badge: 4, stat: 'dif', label: 'Difesa' },
  { badge: 6, stat: 'pv', label: 'PV' },
];
/** Quanto vale ogni bonus delle medaglie. */
export const BADGE_BONUS_PCT = 3;

/** Moltiplicatori della squadra con queste medaglie. */
export function badgeBonus(badges: number): Partial<Record<keyof GameStats, number>> {
  const out: Partial<Record<keyof GameStats, number>> = {};
  for (const b of BADGE_BONUS) if (badges > b.badge) out[b.stat] = 1 + BADGE_BONUS_PCT / 100;
  return out;
}
