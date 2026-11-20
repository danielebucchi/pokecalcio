import { FORMATIONS, type FormationKey } from '../game/formations';
import { POKEDEX, bst, type BaseStats, type PokeType } from '../data/pokedex';
import type { Gym } from '../game/gyms';
import { eventLevel, locationById, neighbors, trainerLevel, type KantoLocation, type PlaceEvent, type RouteTrainer } from '../game/kanto';
import type { LeagueTrainer } from '../game/league';
import { benchOf, findOwned, ratingsOf, type SaveData } from '../game/save';
import { createInstance, type PokemonInstance, type Role } from '../game/stats';
import { typeMultiplier } from '../game/typechart';
import { badgeBonus } from '../game/techniques';
import { SHINY_RATE } from '../game/recruit';
import { Match, type TeamSetup } from './engine';

export function teamFrom(
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
  // i bonus delle medaglie (Sasso, Tuono, Anima, Vulcano) valgono per tutta la tua squadra
  return { ...teamFrom(save.clubName, save.color, true, save.formation, insts, benchOf(save)), bonus: badgeBonus(save.badges) };
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
function bestLineup(pool: PokemonInstance[], formation: FormationKey, keeper?: PokemonInstance, weight: (p: PokemonInstance) => number = () => 1) {
  if (keeper) pool.splice(pool.indexOf(keeper), 1);
  const score = (p: PokemonInstance, role: Role) => ratingsOf(p)[role] * weight(p);
  const lineup = FORMATIONS[formation].slots.map((slot) =>
    slot.role === 'POR' && keeper ? keeper : pool.sort((a, b) => score(b, slot.role) - score(a, slot.role)).shift()!,
  );
  return { lineup, bench: pool };
}

/**
 * Vantaggio di tipo di una specie contro i Pokémon avversari: > 0 se li mette in difficoltà
 * (colpisce forte e incassa poco), < 0 se li subisce. Media dei logaritmi dei moltiplicatori.
 */
function typeEdge(types: PokeType[], rivals: PokeType[][]): number {
  if (!rivals.length) return 0;
  return rivals.reduce((a, r) => a + Math.log(typeMultiplier(types, r)) - Math.log(typeMultiplier(r, types)), 0) / rivals.length;
}

/** Tipi della squadra da studiare: titolari e panchina. */
const scoutTypes = (team?: TeamSetup): PokeType[][] =>
  team ? [...team.roster.map((r) => r.inst), ...(team.bench ?? [])].map((i) => POKEDEX[i.speciesKey].types) : [];

const shuffle = <T>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/** Forma più evoluta raggiungibile a quel livello (ramo con la somma delle statistiche più alta). */
export function evolvedForm(key: string, level: number): string {
  let k = key;
  for (;;) {
    const next = POKEDEX[k].evolutions.filter((e) => e.level <= level).sort((a, b) => bst(POKEDEX[b.key]) - bst(POKEDEX[a.key]))[0];
    if (!next) return k;
    k = next.key;
  }
}

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
  /** Contromossa delle palestre: sempre in squadra e sempre in campo, come l'asso. */
  counter?: string;
  /** Leggendari: uno, sorteggiato, è sempre in squadra. */
  legendary?: string[];
  pool: string[];
  /** Quanto è allenata la squadra, 0-1: scala talento (IV) e allenamento (EV). La Lega è al massimo. */
  training?: number;
  /** Squadra già evoluta quanto il livello permette, come nei giochi (le palestre sì). */
  evolved?: boolean;
}

/**
 * Sfida del giorno: la squadra del piano di oggi. È già evoluta (i tuoi partono dalla forma base),
 * quindi gioca qualche livello sotto i tuoi titolari e meno allenata: tarata con le simulazioni per
 * vincerla circa una volta su due.
 */
export const DAILY = { training: 0.3 };
/** Livelli sotto i tuoi titolari: 8 fino al livello 50, poi meno (a fine avventura la tua squadra è più completa). */
export const dailyGap = (level: number) => Math.round(Math.min(8, Math.max(3, 8 - (level - 50) * 0.4)));
export const buildDailyTeam = (plan: { name: string; color: string; formation: FormationKey; species: string[] }, level: number) =>
  buildEliteTeam({
    name: plan.name, color: plan.color, formation: plan.formation, level: Math.max(5, level - dailyGap(level)),
    signature: plan.species[0], pool: plan.species, training: DAILY.training,
  });

/**
 * Squadra di un capopalestra o di un allenatore della Lega, nuova a ogni sfida: il Pokémon simbolo
 * più 6 pescati dal suo gruppo. Livello fisso, talento perfetto (IV 31) e allenamento completo mirato al ruolo.
 */
function buildEliteTeam(def: EliteDef, scout?: TeamSetup): TeamSetup {
  const legendary = def.legendary?.length ? def.legendary[Math.floor(Math.random() * def.legendary.length)] : undefined;
  const fixed = [...new Set([def.signature, def.counter, def.keeper, legendary].filter((k): k is string => !!k))];
  // il gruppo può contenere più esemplari della stessa specie (la squadra di Eevee di Penny):
  // si toglie solo una copia di simbolo e portiere
  const rest = [...def.pool];
  for (const k of fixed) if (rest.includes(k)) rest.splice(rest.indexOf(k), 1);
  // il capopalestra studia la tua squadra: dal suo gruppo porta soprattutto chi ti mette in difficoltà
  // (con un po' di caso, così la squadra cambia comunque da una sfida all'altra)
  const rivals = scoutTypes(scout);
  const edge = (k: string) => typeEdge(POKEDEX[k].types, rivals);
  const drawn = rivals.length
    ? rest.map((k) => [edge(k) + Math.random() * 0.25, k] as const).sort((a, b) => b[0] - a[0]).map(([, k]) => k)
    : shuffle(rest);
  const picks = [...fixed, ...drawn.slice(0, 7 - fixed.length)];
  // il leggendario non evolve e parte già al massimo: gioca qualche livello sotto il resto della squadra
  const insts = picks.map((k) => {
    if (k === legendary) return createInstance(k, Math.max(5, def.level - LEGENDARY_LEVEL_GAP));
    // come nei giochi la squadra è già evoluta quanto il livello permette (a scelta, il ramo più forte)
    return createInstance(def.evolved ? evolvedForm(k, def.level) : k, def.level);
  });
  const keeper = def.keeper ? insts[picks.indexOf(def.keeper)] : undefined;
  // asso e contromossa: si prendono adesso, perché bestLineup riordina e svuota `insts`
  const forced = [def.signature, def.counter].filter((k): k is string => !!k).map((k) => insts[picks.indexOf(k)]);
  // in campo per voto (tipo e statistiche insieme: un tipo giusto un po' conta), con la stella sempre titolare
  const weight = (p: PokemonInstance) => Math.min(1.15, Math.max(0.9, 1 + 0.2 * edge(p.speciesKey)));
  const { lineup, bench } = bestLineup(insts, def.formation, keeper, rivals.length ? weight : undefined);
  // l'asso e la contromossa giocano sempre: se sono in panchina prendono il posto del più debole
  // in campo tra gli altri (portiere escluso); gli altri titolari restano quelli scelti studiando te
  for (const p of forced) {
    if (lineup.includes(p)) continue;
    const weakest = lineup
      .slice(1)
      .filter((q) => !forced.includes(q))
      .sort((a, b) => Math.max(...Object.values(ratingsOf(a))) - Math.max(...Object.values(ratingsOf(b))))[0];
    lineup[lineup.indexOf(weakest)] = p;
    bench.splice(bench.indexOf(p), 1, weakest);
  }
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

/** `scout`: la tua squadra, che il capopalestra studia per scegliere chi schierare. */
export const buildGymTeam = (gym: Gym, scout?: TeamSetup) =>
  buildEliteTeam({ ...gym, name: `${gym.leader} · ${gym.city}`, level: gymLevel(gym), evolved: true }, scout);

/** Livello della squadra del capopalestra (qualcuno sta un po' sopra il livello nominale della palestra). */
export const gymLevel = (gym: Gym) => gym.level + (gym.extraLevels ?? 0);

/** Livelli in più degli allenatori della Lega (tarato con `npm run career`: la si vince in qualche edizione). */
export const LEAGUE_EXTRA = { levels: 0 };
/** Dopo ogni titolo Lega, Campione e rivincite salgono di 2 livelli (fino a +10). */
export const postGameLevels = (titles: number) => 2 * Math.min(titles, 5);
export const buildLeagueTeam = (t: LeagueTrainer, scout?: TeamSetup, extra = 0) =>
  buildEliteTeam({ ...t, name: t.name, level: t.level + LEAGUE_EXTRA.levels + extra }, scout);

/** Il Campione Blu, ultima sfida della Lega: la sua squadra della Lega, 4 livelli più in alto. */
export const buildChampionTeam = (blu: LeagueTrainer, scout?: TeamSetup, extra = 0) =>
  buildEliteTeam({ ...blu, name: `${blu.name}, Campione`, level: blu.level + LEAGUE_EXTRA.levels + 4 + extra }, scout);

/** Rivincita con un capopalestra dopo il titolo: squadra evoluta e allenata al massimo, dal livello 68. */
export const REMATCH_LEVEL = 68;
export const buildRematchTeam = (gym: Gym, scout?: TeamSetup, extra = 0) =>
  buildEliteTeam({ ...gym, name: `${gym.leader} · rivincita`, level: REMATCH_LEVEL + extra, training: 1, evolved: true }, scout);

/** Partita giocata senza grafica (le altre del tabellone della Lega): restituisce il vincitore. */
export function simulateMatch(a: TeamSetup, b: TeamSetup, knockout: boolean): Match {
  const m = new Match([{ ...a, controlled: false }, { ...b, controlled: false }], { knockout });
  while (!m.finished) m.step(1 / 60);
  return m;
}

/**
 * Pokémon selvatici di un luogo; nelle città senza selvatici si usano quelli dei luoghi vicini già
 * aperti a quel punto del viaggio (non chiedono più medaglie della città, né il titolo di Campione).
 */
export function localWild(loc: KantoLocation): string[] {
  if (loc.wild.length) return loc.wild;
  const open = neighbors(loc.id).map(locationById).filter((n) => n.badges <= loc.badges && !n.requiresChampion);
  const around = [...new Set(open.flatMap((n) => n.wild))];
  return around.length ? around : ['pidgey', 'rattata'];
}

/** Allenatori non d'élite: talento casuale e un po' di allenamento, che cresce con il livello. */
/** Difficoltà di allenatori e selvatici (tarata con `npm run career`). */
export const TUNING = {
  /** EV degli allenatori dei percorsi: base + 12 per livello sopra il 25. */
  trainerEvBase: 510,
  /** I selvatici della partitella stanno al massimo tanti livelli sotto la tua squadra… */
  wildGap: 1,
  /** …e hanno questo allenamento (EV sparsi). */
  wildEvs: 300,
};

function trainedInstance(key: string, level: number, evBase = TUNING.trainerEvBase) {
  const inst = createInstance(key, Math.max(5, Math.min(100, level)));
  spreadEvs(inst, Math.min(510, evBase + Math.max(0, (level - 25) * 12)));
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

/** Taratura delle sfide ai leggendari: scorta evoluta e livelli in più per tutti (oltre a quelli di ogni luogo). */
export const LEGEND = { evolved: true, escortLevels: 0 };

/**
 * Partita contro un leggendario nel suo luogo: lui (talento perfetto) guida una scorta di selvatici
 * della zona, allenati e al livello pieno del luogo. Il leggendario è sempre in campo.
 */
export function buildLegendaryTeam(loc: KantoLocation): TeamSetup {
  const leg = loc.legendary!;
  const boss = createInstance(leg.key, Math.max(5, loc.level - leg.levelGap));
  boss.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  const wild = localWild(loc);
  // la sua scorta: 4 selvatici della zona pescati a caso, già nella forma finale (Zapdos guida Raichu,
  // non Pikachu), allenati e al livello del luogo
  const others = Array.from({ length: 4 }, () => {
    const k = wild[Math.floor(Math.random() * wild.length)];
    return trainedInstance(LEGEND.evolved ? evolvedForm(k, 100) : k, loc.level + (leg.escortLevels ?? 0) + LEGEND.escortLevels, 0);
  });
  const formation: FormationKey = 'rombo';
  // in campo tutti e cinque, il portiere è il più adatto
  const { lineup } = bestLineup([boss, ...others], formation);
  // niente panchina: il leggendario e la sua scorta giocano tutta la partita senza cambi
  return teamFrom(`${POKEDEX[leg.key].name} e i selvatici di ${loc.name}`, '#e8a317', false, formation, lineup, []);
}

/** Taratura delle sfide degli eventi (`npm run career` / prove a parte): circa 55-65% di vittorie. */
export const EVENT = { escortLevels: 2 };

/**
 * Sfida di un evento: il Pokémon in palio (al livello dell'evento) gioca con 4 selvatici del luogo,
 * allenati come un allenatore del percorso, senza panchina. Se vinci chiede di unirsi a te.
 */
export function buildEventTeam(loc: KantoLocation, ev: PlaceEvent, species: string): TeamSetup {
  const star = createInstance(species, eventLevel(loc, ev));
  star.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
  const wild = localWild(loc);
  // la scorta è forte come un allenatore del percorso (EVENT.escortLevels sopra il luogo, allenata al massimo)
  const others = Array.from({ length: 4 }, () => trainedInstance(wild[Math.floor(Math.random() * wild.length)], loc.level + (ev.escortLevels ?? EVENT.escortLevels)));
  const { lineup } = bestLineup([star, ...others], 'rombo');
  return teamFrom(`${POKEDEX[species].name} · ${ev.title}`, '#e8a317', false, 'rombo', lineup, []);
}

/**
 * Partitella con i selvatici: ripetibile, per fare esperienza e reclutare (vincendo, qualcuno chiede
 * di unirsi). Pokémon selvatici della zona, senza allenamento, poco sotto il livello del luogo;
 * nelle città senza selvatici giocano quelli dei dintorni.
 */
export function buildWildTeam(loc: KantoLocation, playerLevel = 0): TeamSetup {
  const wild = localWild(loc);
  const keys = Array.from({ length: 7 }, () => wild[Math.floor(Math.random() * wild.length)]);
  const formation: FormationKey = Math.random() < 0.5 ? 'rombo' : 'quadrato';
  // nei luoghi già superati i selvatici non restano troppo indietro: altrimenti finisce 14-1
  const base = Math.round(Math.max(loc.level - 2, playerLevel - TUNING.wildGap));
  const level = () => Math.max(5, Math.min(100, base + Math.floor(Math.random() * 2)));
  const insts = keys.map((k) => {
    const inst = createInstance(k, level());
    spreadEvs(inst, TUNING.wildEvs);
    // ogni tanto tra i selvatici c'è uno shiny: si vede già prima di giocare e in campo
    if (Math.random() < SHINY_RATE) inst.shiny = true;
    return inst;
  });
  const { lineup, bench } = bestLineup(insts, formation);
  const name = loc.wild.length ? `Selvatici di ${loc.name}` : `Selvatici dei dintorni di ${loc.name}`;
  return teamFrom(name, '#7dd1b8', false, formation, lineup, bench);
}
