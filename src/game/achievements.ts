import { POKEDEX, descendants } from '../data/pokedex';
import type { Match } from '../match/engine';
import type { SaveData } from './save';

/**
 * Obiettivi: imprese da compiere in partita o nella carriera. Ognuno dà una sessione di allenamento
 * e un titolo da mostrare accanto al nome del club.
 */
export type MatchKind = 'gym' | 'league' | 'trainer' | 'wild' | 'legendary' | 'event' | 'champion' | 'rematch' | 'daily';

interface Ctx {
  save: SaveData;
  match: Match;
  kind: MatchKind;
}

export interface Achievement {
  id: string;
  /** Il titolo che si può mostrare. */
  name: string;
  description: string;
  check(ctx: Ctx): boolean;
}

/** Tua squadra: in carriera è sempre la 0. */
const ME = 0;
const vsGym = (k: MatchKind) => k === 'gym' || k === 'rematch';
/** Le partitelle con i selvatici non valgono per le imprese di partita. */
const real = (k: MatchKind) => k !== 'wild';
const won = (m: Match) => m.winner === ME;
const mine = (m: Match) => m.appearances.filter((p) => p.team === ME);

/** Il massimo svantaggio da cui si è partiti nel corso della partita. */
function worstDeficit(m: Match): number {
  const s = [0, 0];
  let worst = 0;
  for (const g of m.goals) {
    s[g.team]++;
    worst = Math.max(worst, s[1 - ME] - s[ME]);
  }
  return worst;
}

/** C'è un tipo in comune a tutti quelli scesi in campo (nella forma base)? */
function sameType(m: Match): boolean {
  const lists = mine(m).map((p) => POKEDEX[p.inst.speciesKey].types);
  return lists[0].some((t) => lists.every((l) => l.includes(t)));
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'goleada', name: 'Goleada', description: 'Segna almeno 7 gol in una sfida (non contro i selvatici).',
    check: ({ match, kind }) => real(kind) && match.score[ME] >= 7,
  },
  {
    id: 'poker', name: 'Poker', description: 'Un tuo Pokémon segna 4 gol nella stessa sfida (non contro i selvatici).',
    check: ({ match, kind }) => real(kind) && mine(match).some((p) => p.tally.goals >= 4),
  },
  {
    id: 'inviolata', name: 'Porta inviolata', description: 'Vinci una sfida senza subire gol (non contro i selvatici).',
    check: ({ match, kind }) => real(kind) && won(match) && match.score[1 - ME] === 0 && !match.shootout,
  },
  {
    id: 'senza-cambi', name: 'Sempre gli stessi', description: 'Batti un capopalestra senza fare cambi, con almeno 2 riserve in panchina.',
    check: ({ match, kind }) =>
      vsGym(kind) && won(match) && match.bench[ME].length >= 2 && mine(match).length === match.players.filter((p) => p.team === ME).length,
  },
  {
    id: 'forma-base', name: 'Forma base', description: 'Batti un capopalestra senza far evolvere nessuno, quando almeno 3 dei tuoi potevano.',
    check: ({ match, kind }) =>
      vsGym(kind) && won(match) && mine(match).every((p) => p.peakForm === p.inst.speciesKey) &&
      mine(match).filter((p) => descendants(p.inst.speciesKey).some((d) => d.level <= p.inst.level)).length >= 3,
  },
  {
    id: 'monotipo', name: 'Monotipo', description: 'Vinci una sfida con tutti i Pokémon scesi in campo dello stesso tipo.',
    check: ({ match, kind }) => real(kind) && won(match) && sameType(match),
  },
  {
    id: 'rimonta', name: 'Rimonta', description: 'Vinci una partita dopo essere stato sotto di 2 gol.',
    check: ({ match }) => won(match) && worstDeficit(match) >= 2,
  },
  {
    id: 'rigori', name: 'Dal dischetto', description: 'Vinci ai rigori.',
    check: ({ match }) => won(match) && !!match.shootout,
  },
  {
    id: 'saracinesca', name: 'Saracinesca', description: 'Il tuo portiere fa 15 parate nella stessa sfida (non contro i selvatici).',
    check: ({ match, kind }) => real(kind) && mine(match).some((p) => p.role === 'POR' && p.tally.saves >= 15),
  },
  {
    id: 'imbattibile', name: 'Imbattibile', description: 'Vinci 10 sfide di fila.',
    check: ({ save }) => save.history.length >= 10 && save.history.slice(0, 10).every((h) => h.won),
  },
  {
    id: 'bomber', name: 'Bomber', description: 'Un tuo Pokémon arriva a 25 gol in carriera.',
    check: ({ save }) => [...save.roster, ...save.box].some((p) => (p.career?.goals ?? 0) >= 25),
  },
  {
    id: 'collezionista', name: 'Collezionista', description: 'Prendi 40 specie nel Pokédex.',
    check: ({ save }) => save.dex.caught.length >= 40,
  },
  {
    id: 'cromatico', name: 'Shiny', description: 'Cattura un Pokémon shiny: ogni tanto chi chiede di unirsi ha colori rari.',
    check: ({ save }) => (save.dex.shiny?.length ?? 0) > 0,
  },
  {
    // come il diploma di Game Freak in Rosso/Blu
    id: 'diploma', name: 'Diploma', description: 'Completa il Pokédex di Kanto: tutti i 151.',
    check: ({ save }) => save.dex.caught.filter((k) => POKEDEX[k] && POKEDEX[k].dex <= 151).length >= 151,
  },
];

export const achievementById = (id: string | undefined) => ACHIEVEMENTS.find((a) => a.id === id);

/**
 * A fine partita (dopo aver aggiornato la carriera): sblocca gli obiettivi raggiunti e ne dà il premio.
 * Restituisce quelli nuovi.
 */
export function checkAchievements(save: SaveData, match: Match, kind: MatchKind): Achievement[] {
  const ctx = { save, match, kind };
  const fresh = ACHIEVEMENTS.filter((a) => !save.achievements.includes(a.id) && a.check(ctx));
  for (const a of fresh) {
    save.achievements.push(a.id);
    save.sessionsLeft += ACHIEVEMENT_SESSIONS;
  }
  return fresh;
}

/** Sessioni di allenamento in premio per ogni obiettivo. */
export const ACHIEVEMENT_SESSIONS = 1;
