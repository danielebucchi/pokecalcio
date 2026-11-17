import { POKEDEX, descendants, type BaseStats } from '../data/pokedex';
import type { Match } from '../match/engine';
import { SESSIONS_PER_MATCHDAY, type OwnedPokemon, type SaveData } from './save';
import { gameStats, realStats, type GameStats, type Role } from './stats';

export const MAX_LEVEL = 100;
export const EV_STAT_CAP = 252;
export const EV_TOTAL_CAP = 510;
export const EV_PER_SESSION = 40;
const SPARRING_EXP = 150;
/** Livello a cui l'esperienza di una partita vale il 100%. */
const EXP_REF_LEVEL = 55;

/** Esperienza per passare al livello successivo: cresce piano, ~1 livello a partita a metà carriera. */
export const expToNext = (level: number) => 50 + level * 10;

/** Aggiunge esperienza e restituisce i livelli guadagnati. */
export function addExp(p: OwnedPokemon, amount: number): number {
  let gained = 0;
  p.exp += amount;
  while (p.level < MAX_LEVEL && p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    p.level++;
    gained++;
  }
  if (p.level >= MAX_LEVEL) p.exp = 0;
  return gained;
}

export function currentStats(p: OwnedPokemon): GameStats {
  return gameStats(realStats(POKEDEX[p.speciesKey], p));
}

// ───────────────────────────── allenamento ─────────────────────────────

export type Drill = 'att' | 'dif' | 'vel' | 'pv' | 'sparring';

export const DRILLS: Record<Drill, { label: string; chip: string; description: string }> = {
  att: { label: 'Attacco', chip: 'pink', description: `+${EV_PER_SESSION} EV sulla migliore tra Attacco e Att. Sp.` },
  dif: { label: 'Difesa', chip: 'mint', description: `+${EV_PER_SESSION} EV sulla migliore tra Difesa e Dif. Sp.` },
  vel: { label: 'Velocità', chip: 'sky', description: `+${EV_PER_SESSION} EV in Velocità` },
  pv: { label: 'Resistenza', chip: 'star', description: `+${EV_PER_SESSION} EV in PV` },
  sparring: { label: 'Sparring', chip: 'lilac', description: `+${SPARRING_EXP} punti esperienza` },
};

/**
 * Statistica dei giochi allenata dalla sessione. ATT e DIF del calcio sono il massimo tra
 * fisico e speciale, quindi si allena quella già più alta.
 */
export function drillStat(p: OwnedPokemon, drill: Drill): keyof BaseStats | null {
  const r = realStats(POKEDEX[p.speciesKey], p);
  switch (drill) {
    case 'att': return r.atk >= r.spa ? 'atk' : 'spa';
    case 'dif': return r.def >= r.spd ? 'def' : 'spd';
    case 'vel': return 'spe';
    case 'pv': return 'hp';
    case 'sparring': return null;
  }
}

export const evTotal = (p: OwnedPokemon) => Object.values(p.evs).reduce((a, b) => a + b, 0);

export function drillBlock(save: SaveData, p: OwnedPokemon, drill: Drill): string | null {
  if (save.sessionsLeft <= 0) return 'Sessioni finite: gioca la prossima partita';
  if (drill === 'sparring') return p.level >= MAX_LEVEL ? 'Livello massimo' : null;
  const stat = drillStat(p, drill)!;
  if (p.evs[stat] >= EV_STAT_CAP) return 'Statistica già al massimo dell\'allenamento';
  if (evTotal(p) >= EV_TOTAL_CAP) return 'Ha raggiunto il limite totale di allenamento (510 EV)';
  return null;
}

/** Anteprima del guadagno di una sessione, per il bottone ("+2", "+150 EXP"). */
export function drillPreview(p: OwnedPokemon, drill: Drill): string {
  if (drill === 'sparring') return `+${SPARRING_EXP} EXP`;
  const stat = drillStat(p, drill)!;
  const add = Math.min(EV_PER_SESSION, EV_STAT_CAP - p.evs[stat], EV_TOTAL_CAP - evTotal(p));
  if (add <= 0) return '';
  const before = currentStats(p)[drill];
  const after = currentStats({ ...p, evs: { ...p.evs, [stat]: p.evs[stat] + add } })[drill];
  return `+${after - before}`;
}

/** Sessione consigliata: quella che serve al ruolo in cui gioca; le riserve fanno esperienza. */
export function suggestedDrill(role: Role | null): Drill {
  if (!role) return 'sparring';
  return ({ POR: 'dif', DIF: 'dif', CEN: 'vel', ATT: 'att' } as const)[role];
}

/** Esegue la sessione e restituisce un riepilogo per l'interfaccia. */
export function applyDrill(save: SaveData, p: OwnedPokemon, drill: Drill): string {
  const name = POKEDEX[p.speciesKey].name;
  const before = currentStats(p);
  save.sessionsLeft--;
  if (drill === 'sparring') {
    const lv = p.level;
    addExp(p, SPARRING_EXP);
    return p.level > lv ? `${name} sale al livello ${p.level}!` : `${name} guadagna ${SPARRING_EXP} punti esperienza.`;
  }
  const stat = drillStat(p, drill)!;
  const add = Math.min(EV_PER_SESSION, EV_STAT_CAP - p.evs[stat], EV_TOTAL_CAP - evTotal(p));
  p.evs[stat] += add;
  const after = currentStats(p);
  const key = ({ att: 'att', dif: 'dif', vel: 'vel', pv: 'pv' } as const)[drill];
  const delta = after[key] - before[key];
  return delta > 0
    ? `${name}: ${DRILLS[drill].label} ${before[key]} → ${after[key]}`
    : `${name}: +${add} EV in ${DRILLS[drill].label} (si vedrà salendo di livello)`;
}

// ───────────────────────────── dopo la partita ─────────────────────────────

export interface ExpReport {
  uid: string;
  speciesKey: string;
  name: string;
  played: boolean;
  exp: number;
  fromLevel: number;
  toLevel: number;
  /** Evoluzioni in partita sbloccate da questo salto di livello. */
  unlocked: string[];
  /** Avanzamento verso il livello successivo, 0-100. */
  expPct: number;
}

/** Assegna esperienza, aggiorna il record e ricarica le sessioni. Modifica il salvataggio. */
export function awardMatch(save: SaveData, match: Match, team: 0 | 1): ExpReport[] {
  const us = match.score[team];
  const them = match.score[team === 0 ? 1 : 0];
  const result = us > them ? 'w' : us < them ? 'l' : 'd';
  save.record[result]++;
  save.record.gf += us;
  save.record.ga += them;
  save.matchday++;
  save.sessionsLeft = SESSIONS_PER_MATCHDAY;

  const bonus = { w: 100, d: 50, l: 0 }[result];
  // come nei giochi: avversari più deboli di te rendono meno, più forti rendono di più
  const startAvg = (t: 0 | 1) => {
    const starters = match.appearances.filter((p) => p.team === t && p.enteredAt === null);
    return starters.reduce((a, p) => a + p.inst.level, 0) / starters.length;
  };
  // e, come nei giochi, un avversario di livello alto rende più esperienza: così si cresce a ritmo costante
  const oppLevel = startAvg(team === 0 ? 1 : 0);
  const levelFactor = (oppLevel / EXP_REF_LEVEL) * Math.min(1.5, Math.max(0.25, (oppLevel / startAvg(team)) ** 3));
  return save.roster.map((p) => {
    const mp = match.appearances.find((x) => x.team === team && x.inst.uid === p.uid);
    let exp = 40; // le riserve imparano guardando
    if (mp) {
      const t = mp.tally;
      exp = 150 + bonus + t.goals * 40 + t.assists * 25 + t.saves * 15 + t.tackles * 10;
    }
    exp = Math.round(exp * levelFactor);
    const fromLevel = p.level;
    addExp(p, exp);
    const unlocked = descendants(p.speciesKey)
      .filter((s) => fromLevel < s.level && p.level >= s.level)
      .map((s) => POKEDEX[s.key].name);
    const expPct = p.level >= MAX_LEVEL ? 100 : (p.exp / expToNext(p.level)) * 100;
    return { uid: p.uid, speciesKey: p.speciesKey, name: POKEDEX[p.speciesKey].name, played: !!mp, exp, fromLevel, toLevel: p.level, unlocked, expPct };
  });
}
