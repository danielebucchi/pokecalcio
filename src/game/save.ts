import { POKEDEX } from '../data/pokedex';
import { FORMATIONS, type FormationKey } from './formations';
import { registerCaught, type Dex } from './dex';
import { TECHNIQUES, type TechniqueId } from './techniques';
import { KANTO, RIVAL_STEPS, locationById, type KantoLocation, type PlaceEvent, type RouteTrainer } from './kanto';
import type { LeagueRun } from './league';
import { createInstance, gameStats, realStats, roleRatings, type PokemonInstance } from './stats';

/** Pokémon della rosa: resta sempre nella forma base, l'evoluzione esiste solo in partita. */
export interface OwnedPokemon extends PokemonInstance {
  /** Esperienza accumulata verso il prossimo livello. */
  exp: number;
  /** Statistiche di tutta la carriera con te. */
  career?: CareerStats;
}

export interface CareerStats {
  matches: number;
  goals: number;
  assists: number;
  saves: number;
}

/** Una partita importante, per lo storico (non le partitelle). */
export interface HistoryEntry {
  matchday: number;
  /** Cosa era: "Palestra di Brock", "Rivale Blu", "Lega · Finale"… */
  title: string;
  /** Gol tuoi e loro (e i rigori, se ci sono stati). */
  score: [number, number];
  penalties?: [number, number];
  won: boolean;
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
  /** Eventi dei luoghi già ritirati (Pokémon regalati: una volta sola). */
  events: string[];
  /** Premi delle missioni facoltative già ritirati (id della missione). */
  rewards: string[];
  /** Tecniche delle medaglie già insegnate: come le MT di Rosso/Blu si usano una volta sola. */
  techniquesUsed: TechniqueId[];
  /** Pokédex: specie viste e prese. */
  dex: Dex;
  /** Partite importanti, dalla più recente (al massimo HISTORY_MAX). */
  history: HistoryEntry[];
  record: { w: number; d: number; l: number; gf: number; ga: number };
  /** Obiettivi raggiunti (id, vedi achievements.ts) e quello scelto come titolo del club. */
  achievements: string[];
  title?: string;
  /** PC di Bill: chi esce dalla rosa finisce qui, senza limiti (si ritira solo da Campione, in città). */
  box: OwnedPokemon[];
}

const KEY = 'pokecalcio-save';

export const HISTORY_MAX = 40;

/** Aggiunge una partita importante allo storico (la più recente in cima). */
export function recordHistory(save: SaveData, entry: HistoryEntry) {
  save.history.unshift(entry);
  save.history.length = Math.min(save.history.length, HISTORY_MAX);
}

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
 * 2 attaccanti su 8. Si parte al livello 30 e si evolve subito in partita, quindi conta la forma
 * più evoluta raggiungibile entro il tetto di Brock (32): tutte nella stessa fascia (somma delle
 * statistiche ~370-425), da tutte le generazioni. Fuori chi diventa troppo forte (Bulbasaur →
 * Venusaur al 32, Tentacool → Tentacruel, Shinx → Luxray, Mareep → Ampharos, Magikarp → Gyarados),
 * chi è fuori scala nel ruolo (Onix portiere, Abra/Kadabra e Gastly in attacco), chi resta troppo
 * debole (Pikachu evolve solo al 38) e gli pseudo-leggendari (Dratini, Bagon, Gible…), che più
 * avanti diventano mostri da 600.
 * La squadra va in campo nel Quadrato (2-2), che è proprio portiere, 2 difensori e 2 attaccanti.
 */
export const STARTER_GROUPS = [
  { role: 'POR', label: 'Portiere', count: 1, pool: ['geodude', 'chespin', 'wailmer', 'timburr', 'tinkatink'] },
  { role: 'DIF', label: 'Difensori', count: 2, pool: ['squirtle', 'snivy', 'mudkip', 'roggenrola', 'flabebe', 'poochyena', 'spheal', 'grubbin'] },
  { role: 'ATT', label: 'Attaccanti', count: 2, pool: ['charmander', 'froakie', 'treecko', 'scorbunny', 'diglett', 'murkrow', 'woobat', 'rattata'] },
] as const;
export const STARTER_POOL: string[] = STARTER_GROUPS.flatMap((g) => [...g.pool]);
export const STARTER_COUNT = 5;
export const STARTER_LEVEL = 30;
/** Squadra usata dalle simulazioni: portiere, 2 difensori, 2 attaccanti (in quest'ordine). */
export const DEFAULT_STARTERS = ['geodude', 'squirtle', 'snivy', 'treecko', 'diglett'];

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
    matchday: 1,
    badges: 0,
    league: null,
    titles: 0,
    location: 'biancavilla',
    visited: ['biancavilla'],
    trainedAt: ['biancavilla'],
    defeated: [],
    legendaries: [],
    events: [],
    rewards: [],
    techniquesUsed: [],
    dex: { seen: [], caught: [] },
    history: [],
    record: { w: 0, d: 0, l: 0, gf: 0, ga: 0 },
    achievements: [],
    box: [],
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
  for (const k of keys) registerCaught(save, k);
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
        data.events ??= [];
        data.rewards ??= [];
        data.techniquesUsed ??= [];
        // il Pokédex parte dalla rosa attuale
        data.history ??= [];
        data.achievements ??= [];
        data.box ??= [];
        // carriere di prima del Campione Blu: chi aveva già vinto la Lega l'ha battuto
        if (data.league?.champion === 'you' && !data.league.championMatch) data.league.championMatch = data.titles ? 'won' : 'pending';
        data.dex ??= { seen: data.roster.map((p) => p.speciesKey), caught: data.roster.map((p) => p.speciesKey) };
        // carriere di prima che il rivale diventasse obbligatorio: le sfide già "superate" contano come vinte
        for (const r of RIVAL_STEPS) if (data.badges > r.blocks && !data.defeated?.includes(r.trainer)) data.defeated?.push(r.trainer);
        // prima l'allenamento si ricaricava a ogni partita: i luoghi già visitati contano come usati
        data.trainedAt ??= [...(data.visited ?? [])];
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

/** Prefisso dei codici di salvataggio (versione del formato). */
const CODE_PREFIX = 'PKC1.';

/** Codice da copiare per portare la carriera su un altro dispositivo (o tenerla da parte). */
export function exportSave(save: SaveData): string {
  const json = JSON.stringify(save);
  // base64 di UTF-8: i soprannomi possono avere accenti ed emoji
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}

/**
 * Importa un codice di salvataggio: se è valido sostituisce la carriera in memoria e restituisce
 * null (poi va ricaricata con loadSave, che applica gli aggiornamenti), altrimenti il motivo.
 */
export function importSave(code: string): string | null {
  const text = code.trim().replace(/\s+/g, '');
  if (!text.startsWith(CODE_PREFIX)) return 'Non sembra un codice di PokéCalcio: deve iniziare con PKC1.';
  let data: SaveData;
  try {
    const bin = atob(text.slice(CODE_PREFIX.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return 'Il codice è incompleto o rovinato: copialo di nuovo per intero.';
  }
  if (data?.version !== 1 || !Array.isArray(data.roster) || !data.roster.every((p) => POKEDEX[p.speciesKey])) {
    return 'Il codice non contiene una carriera valida.';
  }
  localStorage.setItem(KEY, JSON.stringify(data));
  return null;
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
/** Manda un Pokémon della rosa (non titolare) nel PC di Bill. */
export function depositPokemon(save: SaveData, uid: string): boolean {
  const p = findOwned(save, uid);
  if (save.lineup.includes(uid) || !p) return false;
  save.roster = save.roster.filter((x) => x.uid !== uid);
  save.bench = save.bench.filter((b) => b !== uid);
  save.box.push(p);
  return true;
}

/**
 * Il Box si apre solo da Campione e al Centro Pokémon di una città: durante l'avventura la rosa resta
 * di 14, così le palestre non si battono pescando ogni volta la squadra perfetta da una rosa infinita.
 */
export function boxLock(save: SaveData): string | null {
  if (!save.titles) return 'Da Campione potrai ritirarli al Centro Pokémon di una città.';
  if (locationById(save.location).kind !== 'city') return 'Si ritirano al Centro Pokémon: vai in una città.';
  return null;
}

/** Ritira un Pokémon dal Box; con la rosa piena `swapUid` è chi ci va al suo posto. */
export function withdrawPokemon(save: SaveData, uid: string, swapUid?: string): boolean {
  const p = save.box.find((x) => x.uid === uid);
  if (!p || boxLock(save)) return false;
  if (save.roster.length >= ROSTER_MAX && !(swapUid && depositPokemon(save, swapUid))) return false;
  save.box = save.box.filter((x) => x.uid !== uid);
  save.roster.push(p);
  return true;
}

/** `releaseUid` speciale: il nuovo arrivato va direttamente nel PC. */
export const TO_BOX = 'box';

/**
 * Aggiunge un Pokémon alla rosa; se è piena se ne manda uno nel Box (`releaseUid`), oppure ci va lui
 * (`TO_BOX`). Se in panchina c'è posto, ci va subito. Restituisce false se non c'è spazio.
 */
export function addToRoster(save: SaveData, inst: PokemonInstance, releaseUid?: string): boolean {
  if (releaseUid === TO_BOX) {
    if (save.box.some((p) => p.uid === inst.uid)) return false;
    save.box.push({ ...inst, exp: 0 });
    registerCaught(save, inst.speciesKey);
    return true;
  }
  if (releaseUid) depositPokemon(save, releaseUid);
  if (save.roster.length >= ROSTER_MAX || save.roster.some((p) => p.uid === inst.uid)) return false;
  save.roster.push({ ...inst, exp: 0 });
  registerCaught(save, inst.speciesKey);
  save.bench = benchOf(save).map((p) => p.uid);
  if (save.bench.length < BENCH_MAX) save.bench.push(inst.uid);
  return true;
}

/** Tecniche delle medaglie vinte e ancora da insegnare. */
export const techniquesAvailable = (save: SaveData) =>
  TECHNIQUES.filter((t) => t.badge < save.badges && !save.techniquesUsed.includes(t.id));

/** Insegna una tecnica a un Pokémon della rosa: per sempre, e il Pokémon ne impara una sola. */
export function teachTechnique(save: SaveData, id: TechniqueId, uid: string): boolean {
  const p = findOwned(save, uid);
  if (!p || p.technique || !techniquesAvailable(save).some((t) => t.id === id)) return false;
  p.technique = id;
  save.techniquesUsed.push(id);
  return true;
}

/** Allenatore (di qualunque luogo) per id. */
export const trainerById = (id: string): RouteTrainer | undefined => KANTO.flatMap((l) => l.trainers).find((t) => t.id === id);

/** Rivale ancora da battere che chiude questo luogo (o la sua palestra, con `gym`), oppure null. */
export function rivalGate(save: SaveData, l: KantoLocation, gym = false): RouteTrainer | null {
  const id = gym ? l.gymRequiresTrainer : l.requiresTrainer;
  return id && !save.defeated.includes(id) ? (trainerById(id) ?? null) : null;
}

/** Stato di un evento: già ritirato, pronto, oppure cosa manca. */
/** Id con cui si segna la seconda scelta di un evento (l'altro fossile, l'altro lottatore del Dojo). */
export const secondPick = (id: string) => `${id}:bis`;

/**
 * Specie in palio ora in un evento. Negli eventi a scelta (fossili, Dojo) quella che non hai preso
 * torna in palio dopo il titolo di Campione: nei giochi si aveva con uno scambio, qui serve per il Pokédex.
 */
export function eventChoices(save: SaveData, ev: PlaceEvent): string[] {
  if (!save.events.includes(ev.id)) return ev.species;
  if (ev.species.length < 2 || !save.titles || save.events.includes(secondPick(ev.id))) return [];
  return ev.species.filter((k) => !save.dex.caught.includes(k));
}

/** Eventi ritirati (senza contare le seconde scelte). */
export const eventsFound = (save: SaveData) => save.events.filter((id) => !id.endsWith(':bis')).length;

export function eventState(save: SaveData, ev: PlaceEvent): { done: true } | { done: false; missing: string | null } {
  if (!eventChoices(save, ev).length) return { done: true };
  if (ev.badges && save.badges < ev.badges) return { done: false, missing: `Serve${ev.badges === 1 ? '' : 'no'} ${ev.badges} ${ev.badges === 1 ? 'medaglia' : 'medaglie'}` };
  const left = (ev.beat ?? []).filter((id) => !save.defeated.includes(id));
  if (left.length) return { done: false, missing: `Prima batti ${left.length === 1 ? "l'allenatore" : 'gli allenatori'} di questo luogo` };
  return { done: false, missing: null };
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
