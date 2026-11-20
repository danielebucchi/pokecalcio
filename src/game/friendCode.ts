import { POKEDEX } from '../data/pokedex';
import type { TeamSetup } from '../match/engine';
import { teamFrom } from '../match/teams';
import { FORMATIONS, type FormationKey } from './formations';
import { benchOf, findOwned, fromBase64, toBase64, type SaveData } from './save';
import { MAX_TECHNIQUES, type PokemonInstance } from './stats';
import { TECHNIQUES, badgeBonus, type TechniqueId } from './techniques';

/**
 * Amichevole con un amico, senza server: esporti la tua squadra (titolari, panchina, livelli, talento,
 * allenamento e tecniche) come codice di testo; chi lo importa ci gioca contro, guidata dalla CPU.
 */
const PREFIX = 'PKS1.';

type Stats6 = [number, number, number, number, number, number];
interface CodeMon {
  k: string;
  l: number;
  iv: Stats6;
  ev: Stats6;
  /** Tecniche (vecchi codici: `t`, una sola). */
  ts?: TechniqueId[];
  t?: TechniqueId;
  n?: string;
  s?: boolean;
}
interface CodeTeam {
  club: string;
  color: string;
  formation: FormationKey;
  badges: number;
  lineup: CodeMon[];
  bench: CodeMon[];
}

const KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

const pack = (p: PokemonInstance): CodeMon => ({
  k: p.speciesKey, l: p.level,
  iv: KEYS.map((k) => p.ivs[k]) as Stats6, ev: KEYS.map((k) => p.evs[k]) as Stats6,
  ...(p.techniques?.length ? { ts: p.techniques } : {}), ...(p.nickname ? { n: p.nickname } : {}), ...(p.shiny ? { s: true } : {}),
});

/** Il codice della tua squadra attuale. */
export function exportTeam(save: SaveData): string {
  const team: CodeTeam = {
    club: save.clubName, color: save.color, formation: save.formation, badges: save.badges,
    lineup: save.lineup.map((uid) => pack(findOwned(save, uid!)!)),
    bench: benchOf(save).map(pack),
  };
  return PREFIX + toBase64(JSON.stringify(team));
}

const valid = (m: CodeMon) =>
  !!POKEDEX[m?.k] && Number.isInteger(m.l) && m.l >= 1 && m.l <= 100 &&
  Array.isArray(m.iv) && m.iv.length === 6 && m.iv.every((v) => Number.isInteger(v) && v >= 0 && v <= 31) &&
  Array.isArray(m.ev) && m.ev.length === 6 && m.ev.every((v) => Number.isInteger(v) && v >= 0 && v <= 252) &&
  m.ev.reduce((a, b) => a + b, 0) <= 510 && (!m.t || TECHNIQUES.some((t) => t.id === m.t)) &&
  (!m.ts || (Array.isArray(m.ts) && m.ts.length <= MAX_TECHNIQUES && m.ts.every((id) => TECHNIQUES.some((t) => t.id === id))));

const stats6 = (v: Stats6): PokemonInstance['ivs'] => ({ hp: v[0], atk: v[1], def: v[2], spa: v[3], spd: v[4], spe: v[5] });

const unpack = (m: CodeMon, i: number): PokemonInstance => ({
  uid: `amico-${i}-${m.k}`, speciesKey: m.k, level: m.l,
  ivs: stats6(m.iv),
  evs: stats6(m.ev),
  techniques: [...new Set([...(m.ts ?? []), ...(m.t ? [m.t] : [])])], nickname: typeof m.n === 'string' ? m.n.slice(0, 16) : undefined, shiny: m.s === true,
});

/** La squadra dell'amico pronta da sfidare, oppure il motivo per cui il codice non va. */
export function importTeam(code: string): TeamSetup | string {
  const text = code.trim().replace(/\s+/g, '');
  if (!text.startsWith(PREFIX)) return 'Non sembra un codice squadra: deve iniziare con PKS1.';
  let t: CodeTeam;
  try {
    t = JSON.parse(fromBase64(text.slice(PREFIX.length)));
  } catch {
    return 'Il codice è incompleto o rovinato: fattelo mandare di nuovo per intero.';
  }
  const formation = FORMATIONS[t?.formation] ? t.formation : null;
  if (!formation || !Array.isArray(t.lineup) || t.lineup.length !== FORMATIONS[formation].slots.length || !t.lineup.every(valid)
    || !Array.isArray(t.bench) || t.bench.length > 4 || !t.bench.every(valid)) {
    return 'Il codice non contiene una squadra valida.';
  }
  const name = `${String(t.club || 'Squadra amica').slice(0, 30)} (amico)`;
  const color = /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#a890d8';
  return {
    ...teamFrom(name, color, false, formation, t.lineup.map(unpack), t.bench.map((m, i) => unpack(m, i + 10))),
    bonus: badgeBonus(Math.max(0, Math.min(8, Number(t.badges) || 0))),
  };
}
