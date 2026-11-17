import { POKEDEX, bst } from '../data/pokedex';
import type { Match, Player } from '../match/engine';
import type { PokemonInstance } from './stats';

/**
 * Catture senza lotte: dopo una partitella vinta contro i selvatici, qualcuno di loro chiede di
 * unirsi alla squadra e basta accettare. Si propone più spesso chi è facile da convincere e chi ha
 * giocato bene contro di te.
 */
export interface RecruitOffer {
  inst: PokemonInstance;
  /** Perché vuole unirsi, in breve. */
  reason: string;
}

/** Quanto un Pokémon è disposto a unirsi (prima della prestazione in campo). */
export function willingness(speciesKey: string): number {
  const sp = POKEDEX[speciesKey];
  // tasso di cattura dei giochi: 255 facilissimo, 3 leggendario
  let w = 0.15 + sp.captureRate / 255;
  // chi evolve si prende nella forma base debole: più facile; chi è già forte e non evolve, meno
  if (sp.evolutions.length) w *= 1.25;
  else if (bst(sp) >= 450) w *= 0.45;
  return w;
}

function performance(p: Player): { score: number; reason: string | null } {
  const t = p.tally;
  const score = t.goals * 0.6 + t.assists * 0.35 + t.saves * 0.25 + t.tackles * 0.12;
  const reason =
    t.goals ? `ha segnato ${t.goals === 1 ? 'un gol' : `${t.goals} gol`} contro di te`
    : t.saves >= 2 ? `ha fatto ${t.saves} parate`
    : t.tackles >= 2 ? `ti ha rubato ${t.tackles} palloni`
    : null;
  return { score, reason };
}

/**
 * Chi chiede di unirsi dopo la partitella (vuoto se non hai vinto). Di solito uno, a volte due:
 * più la vittoria è larga, più è probabile.
 */
export function recruitOffers(match: Match, team: 0 | 1, rng: () => number = Math.random): RecruitOffer[] {
  const them: 0 | 1 = team === 0 ? 1 : 0;
  if (match.winner !== team) return [];
  const margin = match.score[team] - match.score[them];
  const count = (rng() < Math.min(0.9, 0.65 + 0.1 * (margin - 1)) ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
  const pool = match.appearances
    .filter((p) => p.team === them)
    .map((p) => {
      const perf = performance(p);
      return { p, weight: willingness(p.inst.speciesKey) * (1 + perf.score), reason: perf.reason };
    });
  const offers: RecruitOffer[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    // sorteggio pesato: i più disposti escono più spesso, ma non sempre
    const total = pool.reduce((a, c) => a + c.weight, 0);
    let r = rng() * total;
    const idx = pool.findIndex((c) => (r -= c.weight) <= 0);
    const [pick] = pool.splice(idx < 0 ? pool.length - 1 : idx, 1);
    offers.push({ inst: pick.p.inst, reason: pick.reason ?? 'è rimasto colpito dalla tua squadra' });
  }
  return offers;
}
