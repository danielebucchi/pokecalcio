import { FORMATIONS, type FormationKey } from '../game/formations';
import { POKEDEX, type BaseStats } from '../data/pokedex';
import { GYMS, type Gym } from '../game/gyms';
import { locationById, neighbors, trainerLevel, type KantoLocation, type RouteTrainer } from '../game/kanto';
import type { LeagueTrainer } from '../game/league';
import { findOwned, ratingsOf, type SaveData } from '../game/save';
import { createInstance, type PokemonInstance, type Role } from '../game/stats';
import { Match, type TeamSetup } from './engine';

function teamFrom(
  name: string, color: string, controlled: boolean, formation: FormationKey, insts: PokemonInstance[],
  bench: PokemonInstance[] = [],
): TeamSetup {
  const slots = FORMATIONS[formation].slots;
  return {
    name,
    color,
    controlled,
    roster: insts.map((inst, i) => ({ inst, role: slots[i].role, home: slots[i].home })),
    bench,
  };
}

/** Squadre fisse usate dal simulatore di bilanciamento. */
export function buildDemoTeams(): [TeamSetup, TeamSetup] {
  const make = (picks: [string, number][]) => picks.map(([k, l]) => createInstance(k, l));
  return [
    teamFrom('Biancavilla FC', '#e879a8', true, 'rombo', make([
      ['onix', 32], ['geodude', 30], ['bulbasaur', 34], ['pikachu', 28], ['charmander', 36],
    ]), make([['growlithe', 26], ['poliwag', 24]])),
    teamFrom('Celestopoli United', '#6aaecb', false, 'rombo', make([
      ['snorlax', 34], ['machop', 32], ['squirtle', 36], ['gastly', 32], ['dratini', 36],
    ]), make([['poliwag', 32], ['abra', 32]])),
  ];
}

/** La squadra del giocatore, dalla formazione salvata (va validata prima con lineupProblem). */
export function clubTeam(save: SaveData): TeamSetup {
  const insts = save.lineup.map((uid) => findOwned(save, uid)!);
  const bench = save.roster.filter((p) => !save.lineup.includes(p.uid));
  return teamFrom(save.clubName, save.color, true, save.formation, insts, bench);
}

/** Distribuisce a caso un budget di EV, come farebbe un allenatore avversario. */
function spreadEvs(inst: PokemonInstance, budget: number) {
  const stats = Object.keys(inst.evs) as (keyof typeof inst.evs)[];
  for (let left = budget; left > 0; left -= 10) {
    const k = stats[Math.floor(Math.random() * stats.length)];
    if (inst.evs[k] < 252) inst.evs[k] += 10;
  }
}

/**
 * Mette ognuno nel ruolo che gli riesce meglio (prima il portiere): i primi 5 vanno in campo,
 * gli altri in panchina. Modifica `pool`.
 */
function bestLineup(pool: PokemonInstance[], formation: FormationKey, keeper?: PokemonInstance) {
  if (keeper) pool.splice(pool.indexOf(keeper), 1);
  const lineup = FORMATIONS[formation].slots.map((slot) =>
    slot.role === 'POR' && keeper ? keeper : pool.sort((a, b) => ratingsOf(b)[slot.role] - ratingsOf(a)[slot.role]).shift()!,
  );
  return { lineup, bench: pool };
}

const shuffle = <T>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/** Livelli in meno per i leggendari degli allenatori (Zekrom/Reshiram di N, Zacian di Hop). */
export const LEGENDARY_LEVEL_GAP = 12;

interface EliteDef {
  name: string;
  color: string;
  level: number;
  formation: FormationKey;
  signature: string;
  /** Portiere fisso, sempre in porta. */
  keeper?: string;
  /** Leggendari: uno, sorteggiato, è sempre in squadra. */
  legendary?: string[];
  pool: string[];
  /** Quanto è allenata la squadra, 0-1: scala talento (IV) e allenamento (EV). La Lega è al massimo. */
  training?: number;
}

/** Allenamento delle palestre: le prime sono alla portata di una squadra appena formata, le ultime al massimo. */
export const GYM_TRAINING = { first: 0.3, last: 1 };
export const gymTraining = (index: number) =>
  GYM_TRAINING.first + ((GYM_TRAINING.last - GYM_TRAINING.first) * index) / 7;

/**
 * Squadra di un capopalestra o di un allenatore della Lega, nuova a ogni sfida: il Pokémon simbolo
 * più 6 pescati dal suo gruppo. Livello fisso, talento perfetto (IV 31) e allenamento completo mirato al ruolo.
 */
function buildEliteTeam(def: EliteDef): TeamSetup {
  const legendary = def.legendary?.length ? def.legendary[Math.floor(Math.random() * def.legendary.length)] : undefined;
  const fixed = [...new Set([def.signature, def.keeper, legendary].filter((k): k is string => !!k))];
  // il gruppo può contenere più esemplari della stessa specie (la squadra di Eevee di Penny):
  // si toglie solo una copia di simbolo e portiere
  const rest = [...def.pool];
  for (const k of fixed) if (rest.includes(k)) rest.splice(rest.indexOf(k), 1);
  const picks = [...fixed, ...shuffle(rest).slice(0, 7 - fixed.length)];
  // il leggendario non evolve e parte già al massimo: gioca qualche livello sotto il resto della squadra
  const insts = picks.map((k) => createInstance(k, k === legendary ? Math.max(5, def.level - LEGENDARY_LEVEL_GAP) : def.level));
  const keeper = def.keeper ? insts[picks.indexOf(def.keeper)] : undefined;
  const { lineup, bench } = bestLineup(insts, def.formation, keeper);
  const slots = FORMATIONS[def.formation].slots;
  const t = def.training ?? 1;
  const iv = Math.round(15 + 16 * t);
  const ev = Math.round(252 * t);
  const train = (inst: PokemonInstance, role: Role) => {
    inst.ivs = { hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv };
    const sp = POKEDEX[inst.speciesKey].base;
    const att = sp.atk >= sp.spa ? 'atk' : 'spa';
    const dif = sp.def >= sp.spd ? 'def' : 'spd';
    const focus: Record<Role, [keyof BaseStats, keyof BaseStats]> = {
      POR: [dif, 'hp'], DIF: [dif, 'hp'], CEN: [att, dif], ATT: [att, 'spe'],
    };
    const [a, b] = focus[role];
    inst.evs[a] = ev;
    inst.evs[b] = ev;
  };
  lineup.forEach((inst, i) => train(inst, slots[i].role));
  bench.forEach((inst) => train(inst, 'ATT'));
  return teamFrom(def.name, def.color, false, def.formation, lineup, bench);
}

export const buildGymTeam = (gym: Gym) =>
  buildEliteTeam({ ...gym, name: `${gym.leader} · ${gym.city}`, training: gymTraining(GYMS.indexOf(gym)) });

export const buildLeagueTeam = (t: LeagueTrainer) => buildEliteTeam({ ...t, name: t.name });

/** Partita giocata senza grafica (le altre del tabellone della Lega): restituisce il vincitore. */
export function simulateMatch(a: TeamSetup, b: TeamSetup, knockout: boolean): Match {
  const m = new Match([{ ...a, controlled: false }, { ...b, controlled: false }], { knockout });
  while (!m.finished) m.step(1 / 60);
  return m;
}

/** Pokémon selvatici di un luogo; nelle città senza selvatici si usano quelli dei luoghi vicini. */
function localWild(loc: KantoLocation): string[] {
  if (loc.wild.length) return loc.wild;
  const around = [...new Set(neighbors(loc.id).flatMap((n) => locationById(n).wild))];
  return around.length ? around : ['pidgey', 'rattata'];
}

/** Allenatori non d'élite: talento casuale e un po' di allenamento, che cresce con il livello. */
function trainedInstance(key: string, level: number) {
  const inst = createInstance(key, Math.max(5, Math.min(100, level)));
  spreadEvs(inst, Math.min(510, Math.max(0, (level - 25) * 12)));
  return inst;
}

/**
 * Allenatore di un percorso (una sola sfida): i suoi Pokémon caratteristici, completati con i
 * selvatici della zona fino a 7 (5 in campo + 2 in panchina), ognuno nel ruolo che gli riesce meglio.
 */
export function buildTrainerTeam(loc: KantoLocation, t: RouteTrainer): TeamSetup {
  const level = trainerLevel(loc, t);
  const wild = localWild(loc);
  const keys = [...t.team];
  while (keys.length < 7) keys.push(wild[Math.floor(Math.random() * wild.length)]);
  const formation: FormationKey = Math.random() < 0.5 ? 'rombo' : 'quadrato';
  const { lineup, bench } = bestLineup(keys.slice(0, 7).map((k) => trainedInstance(k, level)), formation);
  return teamFrom(t.name, t.name.startsWith('Rivale') ? '#5b8def' : '#8ec5d8', false, formation, lineup, bench);
}

/**
 * Partita contro un leggendario nel suo luogo: lui (talento perfetto) guida una scorta di selvatici
 * della zona, allenati e al livello pieno del luogo. Il leggendario è sempre in campo.
 */
export function buildLegendaryTeam(loc: KantoLocation): TeamSetup {
  const leg = loc.legendary!;
  const boss = createInstance(leg.key, Math.max(5, loc.level - leg.levelGap));
  boss.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  const wild = localWild(loc);
  // la sua scorta: 4 selvatici della zona pescati a caso, al livello pieno e allenati
  const others = Array.from({ length: 4 }, () => trainedInstance(wild[Math.floor(Math.random() * wild.length)], loc.level));
  const formation: FormationKey = 'rombo';
  // in campo tutti e cinque, il portiere è il più adatto
  const { lineup } = bestLineup([boss, ...others], formation);
  // niente panchina: il leggendario e la sua scorta giocano tutta la partita senza cambi
  return teamFrom(`${POKEDEX[leg.key].name} e i selvatici di ${loc.name}`, '#e8a317', false, formation, lineup, []);
}

/**
 * Partitella con i selvatici: ripetibile, per fare esperienza e reclutare (vincendo, qualcuno chiede
 * di unirsi). Pokémon selvatici della zona, senza allenamento, poco sotto il livello del luogo;
 * nelle città senza selvatici giocano quelli dei dintorni.
 */
export function buildWildTeam(loc: KantoLocation): TeamSetup {
  const wild = localWild(loc);
  const keys = Array.from({ length: 7 }, () => wild[Math.floor(Math.random() * wild.length)]);
  const formation: FormationKey = Math.random() < 0.5 ? 'rombo' : 'quadrato';
  const level = () => Math.max(5, loc.level - 2 + Math.floor(Math.random() * 2));
  const { lineup, bench } = bestLineup(keys.map((k) => createInstance(k, level())), formation);
  const name = loc.wild.length ? `Selvatici di ${loc.name}` : `Selvatici dei dintorni di ${loc.name}`;
  return teamFrom(name, '#7dd1b8', false, formation, lineup, bench);
}
