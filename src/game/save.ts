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
 * Gruppo da cui scegli la prima squadra (solo 5): forme base di forza paragonabile, con ruoli diversi.
 * Niente Pokémon già forti in partenza (Snorlax…): sbilancerebbero l'inizio contro Brock.
 */
export const STARTER_POOL = [
  'bulbasaur', 'charmander', 'squirtle', 'pikachu', 'eevee',
  'onix', 'geodude', 'poliwag',
  'machop', 'abra', 'gastly', 'growlithe', 'nidoran-m',
  'dratini', 'magikarp',
];
export const STARTER_COUNT = 5;
export const STARTER_LEVEL = 30;
/** Squadra usata dalle simulazioni: tipi vari, un portiere vero. */
export const DEFAULT_STARTERS = ['onix', 'geodude', 'bulbasaur', 'squirtle', 'pikachu'];

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

/** La prima squadra: i 5 Pokémon scelti, tutti allo stesso livello, schierati nella formazione migliore. */
export function chooseStarters(save: SaveData, keys: string[]) {
  if (keys.length !== STARTER_COUNT || keys.some((k) => !STARTER_POOL.includes(k))) throw new Error('Scegli 5 Pokémon del gruppo');
  save.roster = keys.map((key) => ({ ...createInstance(key, STARTER_LEVEL), exp: 0 }));
  save.lineup = autoLineup(save);
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
