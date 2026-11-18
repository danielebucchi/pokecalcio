import { POKEDEX } from '../data/pokedex';
import { FORMATIONS, type FormationKey } from './formations';
import { KANTO } from './kanto';
import type { LeagueRun } from './league';
import { createInstance, gameStats, realStats, roleRatings, type PokemonInstance } from './stats';

/** Pokémon della rosa: resta sempre nella forma base, l'evoluzione esiste solo in partita. */
export interface OwnedPokemon extends PokemonInstance {
  /** Esperienza accumulata verso il prossimo livello. */
  exp: number;
}

export interface SaveData {
  version: 1;
  clubName: string;
  color: string;
  roster: OwnedPokemon[];
  formation: FormationKey;
  /** uid del Pokémon per ogni posizione del modulo (stesso ordine di FORMATIONS[formation].slots). */
  lineup: (string | null)[];
  /** uid delle riserve portate in panchina (al massimo BENCH_MAX): in partita entrano solo loro. */
  bench: string[];
  /** Sessioni di allenamento EV (ATT/DIF/VEL/PV): 3 per ogni luogo nuovo, quelle non usate restano. */
  sessionsLeft: number;
  /** Sparring (esperienza): si ricaricano dopo ogni partita, di più se vinci. */
  sparringLeft: number;
  /** Luoghi che ti hanno già dato le loro sessioni di allenamento (una volta sola ciascuno). */
  trainedAt: string[];
  /** Partite giocate + 1 (palestre e percorso). */
  matchday: number;
  /** Medaglie vinte: le palestre si battono in ordine, quindi basta il numero. */
  badges: number;
  /** Edizione della Lega in corso (o l'ultima giocata). */
  league: LeagueRun | null;
  /** Lega Pokémon vinte. */
  titles: number;
  /** Luogo di Kanto in cui ti trovi, luoghi già visitati, allenatori dei percorsi già battuti. */
  location: string;
  visited: string[];
  defeated: string[];
  /** Leggendari che si sono già uniti (spariscono dal loro luogo). */
  legendaries: string[];
  record: { w: number; d: number; l: number; gf: number; ga: number };
}

const KEY = 'pokecalcio-save';
/** Sparring dopo una partita: l'esperienza si può sempre grindare, fino al tetto di livello. */
export const SPARRING_PER_MATCH = { w: 3, d: 2, l: 1 } as const;

/** Sessioni di allenamento che ricevi arrivando per la prima volta in un luogo. */
export const SESSIONS_PER_PLACE = 3;

/** Arrivo in un luogo: la prima volta dà le sue sessioni di allenamento. Restituisce quante. */
export function arriveAt(save: SaveData, id: string): number {
  save.location = id;
  if (!save.visited.includes(id)) save.visited.push(id);
  if (save.trainedAt.includes(id)) return 0;
  save.trainedAt.push(id);
  save.sessionsLeft += SESSIONS_PER_PLACE;
  return SESSIONS_PER_PLACE;
}

/**
 * La prima squadra si sceglie per ruoli, come in un draft: 1 portiere su 5, 2 difensori su 8 e
 * 2 attaccanti su 8. Forme base di Kanto di forza paragonabile, scelte per voto nel ruolo; niente
 * Pokémon già forti in partenza (Scyther, Tangela…): sbilancerebbero l'inizio contro Brock.
 * La squadra va in campo nel Quadrato (2-2), che è proprio portiere, 2 difensori e 2 attaccanti.
 */
export const STARTER_GROUPS = [
  { role: 'POR', label: 'Portiere', count: 1, pool: ['onix', 'tentacool', 'drowzee', 'cubone', 'shellder'] },
  { role: 'DIF', label: 'Difensori', count: 2, pool: ['squirtle', 'bulbasaur', 'geodude', 'krabby', 'sandshrew', 'koffing', 'exeggcute', 'seel'] },
  { role: 'ATT', label: 'Attaccanti', count: 2, pool: ['charmander', 'pikachu', 'abra', 'gastly', 'mankey', 'growlithe', 'eevee', 'dratini'] },
] as const;
export const STARTER_POOL: string[] = STARTER_GROUPS.flatMap((g) => [...g.pool]);
export const STARTER_COUNT = 5;
export const STARTER_LEVEL = 30;
/** Squadra usata dalle simulazioni: portiere, 2 difensori, 2 attaccanti (in quest'ordine). */
export const DEFAULT_STARTERS = ['onix', 'squirtle', 'bulbasaur', 'mankey', 'abra'];

/** Nuova carriera senza squadra: la si sceglie con chooseStarters (schermata iniziale). */
export function newSave(): SaveData {
  const roster: OwnedPokemon[] = [];
  return {
    version: 1,
    clubName: 'Biancavilla FC',
    color: '#e879a8',
    roster,
    formation: 'rombo',
    lineup: [],
    bench: [],
    sessionsLeft: SESSIONS_PER_PLACE,
    sparringLeft: SPARRING_PER_MATCH.w,
    matchday: 1,
    badges: 0,
    league: null,
    titles: 0,
    location: 'biancavilla',
    visited: ['biancavilla'],
    trainedAt: ['biancavilla'],
    defeated: [],
    legendaries: [],
    record: { w: 0, d: 0, l: 0, gf: 0, ga: 0 },
  };
}

/**
 * La prima squadra, in ordine: portiere, 2 difensori, 2 attaccanti (ognuno dal suo gruppo).
 * Tutti allo stesso livello, schierati nel Quadrato ognuno nel ruolo per cui è stato scelto.
 */
export function chooseStarters(save: SaveData, keys: string[]) {
  let i = 0;
  for (const g of STARTER_GROUPS) {
    const part = keys.slice(i, i + g.count);
    if (part.length !== g.count || part.some((k) => !(g.pool as readonly string[]).includes(k)) || new Set(part).size !== part.length) {
      throw new Error(`Scegli ${g.count} ${g.label.toLowerCase()} dal loro gruppo`);
    }
    i += g.count;
  }
  if (keys.length !== STARTER_COUNT) throw new Error('Scegli 5 Pokémon');
  save.roster = keys.map((key) => ({ ...createInstance(key, STARTER_LEVEL), exp: 0 }));
  save.formation = 'quadrato';
  save.lineup = save.roster.map((p) => p.uid);
  save.bench = autoBench(save);
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveData;
      if (data.version === 1 && data.roster.every((p) => POKEDEX[p.speciesKey])) {
        if (data.color === '#e5484d') data.color = '#e879a8'; // rosso del vecchio tema → rosa della palette
        data.badges ??= 0; // salvataggi di prima delle palestre
        data.league ??= null;
        data.titles ??= 0;
        data.legendaries ??= [];
        // prima l'allenamento si ricaricava a ogni partita: i luoghi già visitati contano come usati
        data.trainedAt ??= [...(data.visited ?? [])];
        data.sparringLeft ??= SPARRING_PER_MATCH.w;
        // prima in panchina andava tutta la rosa: si portano i 4 migliori
        data.bench ??= autoBench(data);
        // carriere di prima della mappa: si riparte dalla città dell'ultima medaglia
        if (!data.location) {
          const lastGymCity = KANTO.find((l) => l.gym === data.badges - 1);
          data.location = lastGymCity?.id ?? 'biancavilla';
          data.visited = [...new Set(['biancavilla', data.location])];
          data.defeated = [];
        }
        return data;
      }
    }
  } catch {
    // salvataggio corrotto: si riparte da zero
  }
  const fresh = newSave();
  storeSave(fresh);
  return fresh;
}

export function storeSave(save: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function findOwned(save: SaveData, uid: string | null): OwnedPokemon | undefined {
  return uid ? save.roster.find((p) => p.uid === uid) : undefined;
}

/** Motivo per cui la formazione non è schierabile, oppure null. */
export function lineupProblem(save: SaveData): string | null {
  const slots = FORMATIONS[save.formation].slots;
  if (save.lineup.length !== slots.length || save.lineup.some((uid) => !findOwned(save, uid))) {
    return 'Completa la formazione: ogni posizione deve avere un Pokémon.';
  }
  if (new Set(save.lineup).size !== save.lineup.length) return 'Lo stesso Pokémon è schierato due volte.';
  return null;
}

export function ratingsOf(p: PokemonInstance) {
  const sp = POKEDEX[p.speciesKey];
  return roleRatings(gameStats(realStats(sp, p)), sp.heightDm);
}

/** Rosa massima (come le squadre dei giochi, ma per il calcio a 5): oltre bisogna lasciare andare qualcuno. */
export const ROSTER_MAX = 14;
/** Riserve che si portano in panchina: le uniche che possono entrare in partita. */
export const BENCH_MAX = 4;

/** Ruolo di movimento che gli riesce meglio (i voti da portiere sono su un'altra scala) e il suo voto. */
export function bestRole(p: PokemonInstance): { role: 'DIF' | 'CEN' | 'ATT'; rating: number } {
  const r = ratingsOf(p);
  const role = (['DIF', 'CEN', 'ATT'] as const).reduce((a, b) => (r[b] > r[a] ? b : a));
  return { role, rating: r[role] };
}
export const bestRating = (p: PokemonInstance) => bestRole(p).rating;

/** Panchina automatica: le riserve con il voto migliore. */
export function autoBench(save: SaveData): string[] {
  return save.roster
    .filter((p) => !save.lineup.includes(p.uid))
    .sort((a, b) => bestRating(b) - bestRating(a))
    .slice(0, BENCH_MAX)
    .map((p) => p.uid);
}

/** Riserve in panchina, ripulite da chi non c'è più o è passato in campo. */
export function benchOf(save: SaveData): OwnedPokemon[] {
  return save.bench
    .filter((uid) => !save.lineup.includes(uid))
    .map((uid) => findOwned(save, uid))
    .filter((p): p is OwnedPokemon => !!p)
    .slice(0, BENCH_MAX);
}

/** Chi si può lasciare andare: non chi è in formazione. */
export const releasable = (save: SaveData) => save.roster.filter((p) => !save.lineup.includes(p.uid));

/** Lascia andare un Pokémon della rosa (non uno schierato). */
export function releasePokemon(save: SaveData, uid: string): boolean {
  if (save.lineup.includes(uid) || !findOwned(save, uid)) return false;
  save.roster = save.roster.filter((p) => p.uid !== uid);
  save.bench = save.bench.filter((b) => b !== uid);
  return true;
}

/**
 * Aggiunge un Pokémon alla rosa; se è piena serve lasciarne andare uno (`releaseUid`).
 * Se in panchina c'è posto, ci va subito. Restituisce false se non c'è spazio.
 */
export function addToRoster(save: SaveData, inst: PokemonInstance, releaseUid?: string): boolean {
  if (releaseUid) releasePokemon(save, releaseUid);
  if (save.roster.length >= ROSTER_MAX || save.roster.some((p) => p.uid === inst.uid)) return false;
  save.roster.push({ ...inst, exp: 0 });
  save.bench = benchOf(save).map((p) => p.uid);
  if (save.bench.length < BENCH_MAX) save.bench.push(inst.uid);
  return true;
}

/** Formazione migliore per il modulo: prova tutte le combinazioni (la rosa è piccola). */
export function autoLineup(save: SaveData): (string | null)[] {
  const slots = FORMATIONS[save.formation].slots;
  const ratings = new Map(save.roster.map((p) => [p.uid, ratingsOf(p)]));
  let best: string[] = [];
  let bestScore = -Infinity;
  const pick = (i: number, used: string[], score: number) => {
    if (i === slots.length) {
      if (score > bestScore) {
        bestScore = score;
        best = [...used];
      }
      return;
    }
    for (const p of save.roster) {
      if (used.includes(p.uid)) continue;
      used.push(p.uid);
      pick(i + 1, used, score + ratings.get(p.uid)![slots[i].role]);
      used.pop();
    }
  };
  pick(0, [], 0);
  return best;
}
