import { POKEDEX, bst, type PokeType } from '../data/pokedex';
import {
  gameStats, headerRating, keeperRating, reachOf, realStats, roleRatings,
  type GameStats, type PokemonInstance, type Role,
} from '../game/stats';
import { typeMultiplier } from '../game/typechart';

export type { Role };

export interface TeamSetup {
  name: string;
  color: string;
  /** true = le evoluzioni le decide il giocatore; false = IA. */
  controlled: boolean;
  /** home: posizione base in metri, vista dalla squadra che attacca verso destra. */
  roster: { inst: PokemonInstance; role: Role; home: [number, number] }[];
  /** Panchina: chi può entrare con una sostituzione. */
  bench?: PokemonInstance[];
  /** Bonus delle medaglie su tutta la squadra (moltiplicatori), come in Rosso/Blu. */
  bonus?: Partial<Record<keyof GameStats, number>>;
}

// Campo da calcio a 5 "ingrandito": 100 × 60, coordinate in metri.
export const FIELD_W = 100;
export const FIELD_H = 60;
export const CY = FIELD_H / 2;
export const GOAL_HALF = 9;
export const BOX_DEPTH = 15;
export const BOX_HALF = 17;

/** Durata della partita in secondi di simulazione (a velocità 1× = secondi reali). */
export const MATCH_SECONDS = 180;
export const GAME_MINUTES = 40;
export const SIM_PER_MINUTE = MATCH_SECONDS / GAME_MINUTES;
const KO_MINUTES = 6;
export const MAX_SUBS = 2;
/**
 * Livello su cui sono tarati velocità e potenza dei tiri. Il ritmo di una partita si riscala sul
 * livello medio in campo: chi è più alto di livello resta più veloce, ma una partita tra Lv 67
 * non va al doppio della velocità di una tra Lv 30.
 */
const PACE_LEVEL = 32;
const SHOT_RANGE = 36;
/** Quanto sale ogni ruolo quando la squadra ha palla. */
/**
 * Quanto ogni ruolo si sposta dalla sua posizione base secondo la fase di gioco (metri verso la porta
 * avversaria in possesso, verso la propria senza palla) e quanto stringe al centro senza palla.
 * Dipende dal modulo, come nel calcio a 5 vero:
 * - Rombo (1-2-1): i centrocampisti in possesso attaccano quasi in linea con la punta, senza palla
 *   scendono a dare man forte al difensore.
 * - Quadrato (2-2): in possesso i difensori salgono a fare i centrocampisti, senza palla sono gli
 *   attaccanti a tornare a centrocampo.
 * Dosati perché con gli stessi Pokémon i due moduli si equivalgano (/tmp/shapes: ~47% contro ~45%).
 */
export const PHASE_SHIFT: Record<'rombo' | 'quadrato', Record<Role, { attack: number; defend: number; narrow: number }>> = {
  rombo: {
    POR: { attack: 0, defend: 0, narrow: 0 },
    DIF: { attack: 8, defend: 3, narrow: 0 },
    CEN: { attack: 16, defend: 6, narrow: 0.1 },
    ATT: { attack: 6, defend: 6, narrow: 0.2 },
  },
  quadrato: {
    POR: { attack: 0, defend: 0, narrow: 0 },
    DIF: { attack: 10, defend: 3, narrow: 0 },
    CEN: { attack: 14, defend: 6, narrow: 0.2 },
    ATT: { attack: 6, defend: 6, narrow: 0.15 },
  },
};

/** Probabilità base di fallo in un contrasto (scalata da quanto è "irruento" chi entra). */
const FOUL_BASE = 0.1;
/** Distanza massima dalla porta per una punizione pericolosa. */
const FREEKICK_RANGE = 32;
export const PENALTY_DIST = 10;
const SETUP_SECONDS = 2.5;
const KICKIN_SETUP_SECONDS = 1.3;
/** Distanza minima degli avversari sulla rimessa laterale (regola del calcio a 5). */
const KICKIN_DISTANCE = 5;

export type SetPieceKind = 'corner' | 'freekick' | 'penalty' | 'kickin';
type FinishKind = 'header' | 'penalty' | 'freekick';

export interface SetPiece {
  kind: SetPieceKind;
  /** Squadra che batte. */
  team: 0 | 1;
  x: number;
  y: number;
  taker: Player;
  /** Punizione: true = tiro diretto, false = cross. */
  direct: boolean;
  timer: number;
  spots: Map<number, [number, number]>;
}

interface Cross {
  team: 0 | 1;
  target: Player;
  marker: Player | null;
  landX: number;
  landY: number;
  timer: number;
}

interface PassOption {
  target: Player;
  score: number;
  shotQ: number;
  blocked: number;
}

export interface Player {
  id: number;
  team: 0 | 1;
  role: Role;
  inst: PokemonInstance;
  /** Forma attuale in partita (cambia con l'evoluzione). */
  formKey: string;
  /** Forma più evoluta raggiunta durante la partita. */
  peakForm: string;
  /** Ramo evolutivo scelto quando ce n'è più di uno (Eevee…); null = il più forte. */
  evoTarget: string | null;
  stage: number;
  stats: GameStats;
  types: PokeType[];
  reach: number;
  maxHp: number;
  hp: number;
  koTimer: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  /** Barra evoluzione 0-100. */
  evo: number;
  stun: number;
  duelCd: number;
  pickupCd: number;
  decideCd: number;
  gkHold: number;
  flash: number;
  /** Altezza della forma attuale in decimetri. */
  heightDm: number;
  tally: {
    goals: number; assists: number; saves: number; tackles: number; kos: number;
    evolutions: number; shots: number; fouls: number;
  };
  /** Minuto di ingresso (null = titolare) e di uscita (null = finito in campo). */
  enteredAt: number | null;
  leftAt: number | null;
}

interface Shot {
  shooter: Player;
  power: number;
  tried: Set<number>;
  from?: FinishKind;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: Player | null;
  lastTouch: Player | null;
  shot: Shot | null;
  intended: Player | null;
}

export type EventKind = 'goal' | 'save' | 'ko' | 'recover' | 'evo' | 'setpiece' | 'sub' | 'info';

export interface MatchEvent {
  minute: number;
  kind: EventKind;
  team?: 0 | 1;
  text: string;
}

const attackDir = (team: 0 | 1) => (team === 0 ? 1 : -1);
const ownGoalX = (team: 0 | 1) => (team === 0 ? 0 : FIELD_W);
const oppGoalX = (team: 0 | 1) => (team === 0 ? FIELD_W : 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const randn = () => {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
};

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return dist(px, py, ax + t * dx, ay + t * dy);
}

/** Nome in partita: il soprannome se c'è, altrimenti la forma attuale. */
export const formName = (p: Player) => p.inst.nickname || POKEDEX[p.formKey].name;
const emptyTally = (): Player['tally'] => ({ goals: 0, assists: 0, saves: 0, tackles: 0, kos: 0, evolutions: 0, shots: 0, fouls: 0 });
export const isActive = (p: Player) => p.koTimer <= 0;

export class Match {
  readonly teams: [TeamSetup, TeamSetup];
  readonly players: Player[] = [];
  readonly ball: Ball = { x: FIELD_W / 2, y: CY, vx: 0, vy: 0, owner: null, lastTouch: null, shot: null, intended: null };
  readonly events: MatchEvent[] = [];
  readonly score: [number, number] = [0, 0];
  /** Chi è ancora in panchina, per squadra. */
  readonly bench: [PokemonInstance[], PokemonInstance[]];
  readonly subsLeft: [number, number] = [MAX_SUBS, MAX_SUBS];
  /** Pokémon sostituiti: restano qui con le loro statistiche di partita. */
  readonly retired: Player[] = [];
  /** Contatori di partita (usati dal simulatore di bilanciamento). */
  readonly counts = { kickins: 0, corners: 0, fouls: 0, freekicks: 0, penalties: 0, headerGoals: 0, freekickGoals: 0, penaltyGoals: 0 };
  /** Gol in ordine, per il resoconto: chi ha segnato (forma del momento) e se è autogol. */
  readonly goals: { team: 0 | 1; minute: number; scorer: string | null; own: boolean }[] = [];
  /** Partita a eliminazione diretta: in caso di pareggio si tirano i rigori. */
  readonly knockout: boolean;
  /** Rigori di fine partita, se ci sono stati. */
  shootout: { kicks: { team: 0 | 1; taker: string; scored: boolean }[]; score: [number, number] } | null = null;
  /** Calcio piazzato in preparazione (il renderer lo mostra). */
  setPiece: SetPiece | null = null;
  time = 0;
  finished = false;
  onEvent?: (e: MatchEvent) => void;

  private halftimeDone = false;
  private freeze = 0;
  private pendingKickoff: 0 | 1 | null = null;
  private lastPass: { from: Player; time: number } | null = null;
  private lastFinish: { shooter: Player; from: FinishKind | undefined; time: number } | null = null;
  private cross: Cross | null = null;
  private dt = 1 / 60;
  private nextAiSubCheck = 0;
  /** Fattore di ritmo: PACE_LEVEL / livello medio dei titolari. */
  private readonly pace: number;
  /** Modulo di ogni squadra, dal ruolo dei titolari: con centrocampisti è il Rombo, senza il Quadrato. */
  private readonly shape: ['rombo' | 'quadrato', 'rombo' | 'quadrato'];

  constructor(teams: [TeamSetup, TeamSetup], opts: { knockout?: boolean } = {}) {
    this.teams = teams;
    this.knockout = opts.knockout ?? false;
    this.shape = teams.map((t) => (t.roster.some((r) => r.role === 'CEN') ? 'rombo' : 'quadrato')) as Match['shape'];
    this.bench = [[...(teams[0].bench ?? [])], [...(teams[1].bench ?? [])]];
    let id = 0;
    teams.forEach((t, ti) => {
      const team = ti as 0 | 1;
      for (const r of t.roster) {
        const p: Player = {
          id: id++, team, role: r.role, inst: r.inst,
          formKey: r.inst.speciesKey, peakForm: r.inst.speciesKey, evoTarget: null, stage: 0,
          stats: { att: 0, dif: 0, vel: 0, pv: 0 }, types: [], reach: 0,
          maxHp: 0, hp: 0, koTimer: 0,
          x: 0, y: 0, vx: 0, vy: 0,
          homeX: team === 0 ? r.home[0] : FIELD_W - r.home[0], homeY: r.home[1],
          evo: 0, stun: 0, duelCd: 0, pickupCd: 0, decideCd: 0, gkHold: 0, flash: 0, heightDm: 0,
          tally: emptyTally(),
          enteredAt: null, leftAt: null,
        };
        this.recompute(p, false);
        this.players.push(p);
      }
    });
    const avgLevel = this.players.reduce((a, p) => a + p.inst.level, 0) / this.players.length;
    this.pace = PACE_LEVEL / avgLevel;
    this.kickoff(0);
    this.log('info', "Calcio d'inizio!");
  }

  /** Chi ha vinto (rigori compresi), o null per il pareggio. */
  get winner(): 0 | 1 | null {
    if (this.score[0] !== this.score[1]) return this.score[0] > this.score[1] ? 0 : 1;
    if (this.shootout) return this.shootout.score[0] > this.shootout.score[1] ? 0 : 1;
    return null;
  }

  /** Tutti quelli che sono scesi in campo: in campo adesso più i sostituiti. */
  get appearances(): Player[] {
    return [...this.players, ...this.retired];
  }

  get minute(): number {
    return Math.min(GAME_MINUTES, Math.floor(this.time / SIM_PER_MINUTE));
  }

  // ───────────────────────────── evoluzione ─────────────────────────────

  /** Evoluzioni sbloccate dal livello, dalla più forte. */
  evoOptions(p: Player): string[] {
    return POKEDEX[p.formKey].evolutions
      .filter((e) => p.inst.level >= e.level)
      .map((e) => e.key)
      .sort((a, b) => bst(POKEDEX[b]) - bst(POKEDEX[a]));
  }

  /** Forma in cui evolverebbe adesso: il ramo scelto se valido, altrimenti il più forte. */
  evoTargetOf(p: Player): string | null {
    const options = this.evoOptions(p);
    return p.evoTarget && options.includes(p.evoTarget) ? p.evoTarget : (options[0] ?? null);
  }

  /** Passa al ramo evolutivo successivo (solo se ce n'è più di uno). */
  cycleEvoTarget(p: Player) {
    const options = this.evoOptions(p);
    if (options.length < 2) return;
    const current = this.evoTargetOf(p);
    p.evoTarget = options[(options.indexOf(current!) + 1) % options.length];
  }

  /** Motivo per cui il Pokémon non può evolvere ora, oppure null se può. */
  evolveBlock(p: Player): string | null {
    const evos = POKEDEX[p.formKey].evolutions;
    if (this.finished) return 'Partita finita';
    if (!evos.length) return 'Forma finale';
    if (!this.evoOptions(p).length) return `Serve Lv ${Math.min(...evos.map((e) => e.level))}`;
    if (!isActive(p)) return 'È KO';
    if (p.evo < 100) return 'Barra non piena';
    return null;
  }

  evolve(p: Player): boolean {
    if (this.evolveBlock(p) !== null) return false;
    const from = formName(p);
    p.formKey = this.evoTargetOf(p)!;
    p.evoTarget = null;
    p.peakForm = p.formKey;
    p.stage++;
    p.evo = 0;
    p.flash = 1.2;
    p.tally.evolutions++;
    this.recompute(p, true);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
    // come nei giochi: ai tuoi Pokémon i complimenti
    const congrats = this.teams[p.team].controlled ? 'Congratulazioni! ' : '';
    this.log('evo', `${congrats}${from} si è evoluto in ${formName(p)}!`, p.team);
    return true;
  }

  // ───────────────────────────── sostituzioni ─────────────────────────────

  /** Motivo per cui non si può sostituire ora, oppure null. */
  subBlock(team: 0 | 1): string | null {
    if (this.finished) return 'Partita finita';
    if (this.subsLeft[team] <= 0) return 'Cambi finiti';
    if (!this.bench[team].length) return 'Panchina vuota';
    return null;
  }

  /**
   * Fa entrare `inUid` dalla panchina al posto di `out`. Il Player resta lo stesso oggetto (stesso
   * ruolo e posizione), ma diventa il nuovo Pokémon; quello uscito va in `retired` con le sue statistiche.
   */
  substitute(out: Player, inUid: string): boolean {
    const bench = this.bench[out.team];
    const i = bench.findIndex((b) => b.uid === inUid);
    if (i < 0 || this.subBlock(out.team) !== null) return false;
    const [inst] = bench.splice(i, 1);
    const outName = formName(out);
    this.retired.push({ ...out, tally: { ...out.tally }, leftAt: this.minute });
    if (this.ball.owner === out) Object.assign(this.ball, { owner: null, vx: 0, vy: 0 });
    if (this.lastPass?.from === out) this.lastPass = null;
    if (this.lastFinish?.shooter === out) this.lastFinish = null;
    Object.assign(out, {
      inst, formKey: inst.speciesKey, peakForm: inst.speciesKey, evoTarget: null, stage: 0, evo: 0,
      koTimer: 0, stun: 0, duelCd: 0, pickupCd: 0, gkHold: 0, flash: 1.2, maxHp: 0,
      tally: emptyTally(), enteredAt: this.minute, leftAt: null,
      // entra dalla zona cambi, sulla fascia a metà campo della propria metà
      x: FIELD_W / 2 - attackDir(out.team) * 6, y: FIELD_H - 1.5, vx: 0, vy: 0,
    });
    this.recompute(out, false);
    this.subsLeft[out.team]--;
    this.log('sub', `Cambio: entra ${formName(out)}, esce ${outName}.`, out.team);
    return true;
  }

  /** La CPU sostituisce chi è KO a lungo o quasi senza PV. */
  private aiSubstitutions() {
    for (const team of [0, 1] as const) {
      if (this.teams[team].controlled || this.subBlock(team) !== null) continue;
      const tired = this.players
        .filter((p) => p.team === team)
        .filter((p) => p.koTimer > 2 * SIM_PER_MINUTE || (this.minute >= 15 && isActive(p) && p.hp / p.maxHp < 0.2))
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!tired) continue;
      const score = (inst: PokemonInstance) => {
        const sp = POKEDEX[inst.speciesKey];
        return roleRatings(gameStats(realStats(sp, inst)), sp.heightDm)[tired.role];
      };
      const best = [...this.bench[team]].sort((a, b) => score(b) - score(a))[0];
      this.substitute(tired, best.uid);
    }
  }

  private recompute(p: Player, keepHpRatio: boolean) {
    const sp = POKEDEX[p.formKey];
    const base = gameStats(realStats(sp, p.inst));
    // bonus delle medaglie della squadra e tecnica Scatto
    const bonus = this.teams[p.team].bonus ?? {};
    const g: GameStats = {
      att: Math.round(base.att * (bonus.att ?? 1)),
      dif: Math.round(base.dif * (bonus.dif ?? 1)),
      vel: Math.round(base.vel * (bonus.vel ?? 1) * (p.inst.technique === 'scatto' ? 1.1 : 1)),
      pv: Math.round(base.pv * (bonus.pv ?? 1)),
    };
    const ratio = keepHpRatio && p.maxHp > 0 ? p.hp / p.maxHp : 1;
    p.stats = g;
    p.maxHp = g.pv;
    p.hp = g.pv * ratio;
    p.types = sp.types;
    p.reach = reachOf(sp.heightDm);
    p.heightDm = sp.heightDm;
  }

  private addEvo(p: Player, amount: number) {
    if (isActive(p)) p.evo = Math.min(100, p.evo + amount);
  }

  // ───────────────────────────── ciclo ─────────────────────────────

  step(dt: number) {
    if (this.finished) return;
    this.dt = dt;
    for (const p of this.players) p.flash = Math.max(0, p.flash - dt);

    if (this.freeze > 0) {
      this.freeze -= dt;
      if (this.freeze <= 0 && this.pendingKickoff !== null) {
        this.kickoff(this.pendingKickoff);
        this.pendingKickoff = null;
      }
      return;
    }

    if (this.setPiece) {
      // durante la preparazione il cronometro è fermo
      this.updateSetPiece(dt);
      return;
    }

    this.time += dt;
    // tecnica Rigenerazione: recupera il 2% dei PV per minuto di gioco
    for (const p of this.players) {
      if (p.inst.technique === 'rigenerazione' && isActive(p)) p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.02 * dt) / SIM_PER_MINUTE);
    }
    if (!this.halftimeDone && this.time >= MATCH_SECONDS / 2) {
      this.halftimeDone = true;
      for (const p of this.players) if (isActive(p)) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
      this.log('info', 'Intervallo: tutti recuperano il 25% dei PV.');
      this.freeze = 1.5;
      this.pendingKickoff = 1;
      return;
    }
    if (this.time >= MATCH_SECONDS) {
      this.finish();
      return;
    }

    this.updateTimers(dt);
    if (this.time >= this.nextAiSubCheck) {
      this.nextAiSubCheck = this.time + 1;
      this.aiSubstitutions();
    }
    const chasers = this.findChasers();
    for (const p of this.players) if (isActive(p)) this.think(p, dt, chasers);
    this.move(dt);
    this.updateBall(dt);
    if (this.freeze > 0 || this.setPiece) return;
    this.updateCross(dt);
    this.checkKeeperSave();
    if (this.setPiece) return; // parata in angolo
    this.checkPickup();
    if (this.setPiece) return; // tiro murato in angolo
    this.checkDuels();

    for (const p of this.players) {
      if (!this.teams[p.team].controlled && this.evolveBlock(p) === null) {
        // tra evoluzioni ugualmente forti (le Eeveeluzioni) la CPU ne sceglie una a caso
        const options = this.evoOptions(p);
        const top = options.filter((k) => bst(POKEDEX[k]) === bst(POKEDEX[options[0]]));
        if (!p.evoTarget && top.length > 1) p.evoTarget = top[Math.floor(Math.random() * top.length)];
        this.evolve(p);
      }
    }
  }

  private updateTimers(dt: number) {
    for (const p of this.players) {
      if (p.koTimer > 0) {
        p.koTimer -= dt;
        if (p.koTimer <= 0) {
          p.koTimer = 0;
          // al primo KO si rientra con metà dei PV, dal secondo con un quarto
          const first = p.tally.kos <= 1;
          p.hp = p.maxHp * (first ? 0.5 : 0.25);
          this.log('recover', `${formName(p)} si rialza con ${first ? 'metà' : 'un quarto'} dei PV.`, p.team);
        }
        continue;
      }
      p.stun = Math.max(0, p.stun - dt);
      p.duelCd = Math.max(0, p.duelCd - dt);
      p.pickupCd = Math.max(0, p.pickupCd - dt);
      p.evo = Math.min(100, p.evo + 0.35 * dt);
    }
  }

  private kickoff(team: 0 | 1) {
    this.setPiece = null;
    this.cross = null;
    for (const p of this.players) {
      p.vx = p.vy = 0;
      p.stun = 0;
      p.gkHold = 0;
      if (!isActive(p)) continue;
      p.x = p.team === 0 ? Math.min(p.homeX, 46) : Math.max(p.homeX, 54);
      p.y = p.homeY;
      if (p.team !== team && dist(p.x, p.y, FIELD_W / 2, CY) < 10) p.x = FIELD_W / 2 - attackDir(p.team) * 10;
    }
    const order: Role[] = ['ATT', 'CEN', 'DIF', 'POR'];
    const pick = (t: 0 | 1) =>
      order.map((r) => this.players.find((p) => p.team === t && p.role === r && isActive(p))).find(Boolean);
    // se la squadra è tutta KO batte l'altra
    const kicker = pick(team) ?? pick(team === 0 ? 1 : 0);
    if (!kicker) {
      Object.assign(this.ball, { x: FIELD_W / 2, y: CY, vx: 0, vy: 0, owner: null, shot: null, intended: null });
      return;
    }
    kicker.x = FIELD_W / 2 - attackDir(kicker.team) * 1.5;
    kicker.y = CY;
    Object.assign(this.ball, { x: FIELD_W / 2, y: CY, vx: 0, vy: 0, owner: kicker, lastTouch: kicker, shot: null, intended: null });
    this.lastPass = null;
  }

  private finish() {
    this.finished = true;
    this.ball.owner = null;
    this.setPiece = null;
    this.cross = null;
    this.log('info', `Fischio finale: ${this.teams[0].name} ${this.score[0]} - ${this.score[1]} ${this.teams[1].name}`);
    // i rigori si tirano con le forme del momento, prima di tornare allo stadio base
    if (this.knockout && this.score[0] === this.score[1]) this.penaltyShootout();
    for (const p of this.players) {
      p.formKey = p.inst.speciesKey;
      p.stage = 0;
      p.koTimer = 0;
      p.evo = 0;
      this.recompute(p, false);
    }
    this.log('info', 'Tutti i Pokémon tornano allo stadio base.');
  }

  /** 5 rigori a testa, poi a oltranza. Tira chi ha più Attacco; conta il portiere avversario. */
  private penaltyShootout() {
    const so: NonNullable<Match['shootout']> = { kicks: [], score: [0, 0] };
    const takers = ([0, 1] as const).map((t) =>
      this.players.filter((p) => p.team === t && p.role !== 'POR').sort((a, b) => b.stats.att - a.stats.att),
    );
    const keeper = (t: 0 | 1) => this.players.find((p) => p.team === t && p.role === 'POR');
    for (let round = 0; ; round++) {
      for (const t of [0, 1] as const) {
        const taker = takers[t][round % takers[t].length];
        const k = keeper(t === 0 ? 1 : 0);
        const kr = k ? keeperRating(k.stats) * typeMultiplier(k.types, taker.types) : 40;
        const scored = Math.random() < clamp(0.55 + (0.35 * taker.stats.att) / (taker.stats.att + kr), 0.55, 0.9);
        so.kicks.push({ team: t, taker: formName(taker), scored });
        if (scored) so.score[t]++;
      }
      const diff = Math.abs(so.score[0] - so.score[1]);
      // nei primi 5 si chiude appena uno non può più recuperare, poi basta un errore
      if (round < 4 ? diff > 4 - round : diff > 0) break;
    }
    this.shootout = so;
    const winner = so.score[0] > so.score[1] ? 0 : 1;
    this.log('info', `Rigori: ${so.score[0]}-${so.score[1]}, passa ${this.teams[winner].name}.`, winner);
  }

  private log(kind: EventKind, text: string, team?: 0 | 1) {
    const e: MatchEvent = { minute: this.minute, kind, team, text };
    this.events.push(e);
    this.onEvent?.(e);
  }

  // ───────────────────────────── IA ─────────────────────────────

  private findChasers() {
    const b = this.ball;
    const bx = b.x + b.vx * 0.25;
    const by = b.y + b.vy * 0.25;
    const chaser: (Player | null)[] = [null, null];
    const presser: (Player | null)[] = [null, null];
    for (const team of [0, 1] as const) {
      const sorted = this.players
        .filter((p) => p.team === team && p.role !== 'POR' && isActive(p))
        .sort((a, c) => dist(a.x, a.y, bx, by) - dist(c.x, c.y, bx, by));
      chaser[team] = sorted[0] ?? null;
      presser[team] = sorted[1] ?? null;
    }
    return { chaser, presser };
  }

  private think(p: Player, dt: number, ctx: ReturnType<Match['findChasers']>) {
    if (p.stun > 0) {
      p.vx *= 0.9;
      p.vy *= 0.9;
      return;
    }
    const b = this.ball;
    if (this.cross) return this.thinkCross(p, this.cross);
    if (b.owner === p) return this.thinkOwner(p, dt);
    if (p.role === 'POR') return this.thinkKeeper(p);

    if (!b.owner) {
      if (ctx.chaser[p.team] === p || b.intended === p) {
        return this.steer(p, b.x + b.vx * 0.2, b.y + b.vy * 0.2, 1);
      }
    } else if (b.owner.team !== p.team) {
      if (ctx.chaser[p.team] === p) return this.steer(p, b.owner.x, b.owner.y, 1);
      if (ctx.presser[p.team] === p) {
        // copre tra palla e porta
        const gx = ownGoalX(p.team);
        const t = 8 / Math.max(8, dist(b.x, b.y, gx, CY));
        return this.steer(p, b.x + (gx - b.x) * t, b.y + (CY - b.y) * t, 0.9);
      }
    }

    const [tx, ty, effort] = this.positionalTarget(p);
    this.steer(p, tx, ty, effort);
  }

  /** Posizione di squadra (senza palla) in base a dove si trova il pallone e a chi ne ha il possesso. */
  private positionalTarget(p: Player): [number, number, number] {
    const b = this.ball;
    const dir = attackDir(p.team);
    // durante un passaggio il possesso resta a chi ha toccato per ultimo
    const attacking = (b.owner ?? b.lastTouch)?.team === p.team;
    const shift = PHASE_SHIFT[this.shape[p.team]][p.role];
    let tx = p.homeX + (b.x - FIELD_W / 2) * 0.5 + (attacking ? dir * shift.attack : -dir * shift.defend);
    // senza palla chi rientra stringe verso il centro, a coprire la linea di passaggio verso la porta
    const homeY = attacking ? p.homeY : p.homeY + (CY - p.homeY) * shift.narrow;
    let ty = homeY + (b.y - CY) * 0.45;
    const progress = (b.x - ownGoalX(p.team)) * dir;
    if (attacking && p.role === 'CEN' && progress > 50) {
      // inserimento: il centrocampista entra in area sul suo lato
      tx = oppGoalX(p.team) - dir * 13;
      ty = CY + Math.sign(p.homeY - CY) * 10;
    } else if (attacking && p.role === 'DIF' && progress > 50) {
      // il difensore sale al limite per lo scarico e il tiro da fuori
      tx = oppGoalX(p.team) - dir * 30;
      ty = CY + (b.y - CY) * 0.2;
    }
    if (attacking) {
      const opp = this.nearestOpponent(p);
      if (opp.p && opp.d < 6) {
        tx += ((p.x - opp.p.x) / opp.d) * 3;
        ty += ((p.y - opp.p.y) / opp.d) * 3;
      }
    }
    return [clamp(tx, 3, FIELD_W - 3), clamp(ty, 3, FIELD_H - 3), attacking ? 0.8 : 0.75];
  }

  private thinkKeeper(p: Player) {
    const b = this.ball;
    const gx = ownGoalX(p.team);
    const dir = attackDir(p.team);
    const ballInBox = Math.abs(b.x - gx) < BOX_DEPTH && Math.abs(b.y - CY) < BOX_HALF;

    if (!b.owner && !b.shot && ballInBox) return this.steer(p, b.x, b.y, 1);

    if (b.shot && b.shot.shooter.team !== p.team && (gx - b.x) * b.vx > 0) {
      // tuffo verso il punto in cui arriverà il tiro
      const t = Math.max(0, (p.x - b.x) / b.vx);
      const py = b.y + b.vy * t;
      return this.steer(p, gx + dir * 2.5, clamp(py, CY - GOAL_HALF, CY + GOAL_HALF), 1.2);
    }

    const threat = b.owner && b.owner.team !== p.team && Math.abs(b.x - gx) < 30;
    const ty = CY + clamp((b.y - CY) * 0.35, -(GOAL_HALF - 1.5), GOAL_HALF - 1.5);
    this.steer(p, gx + dir * (threat ? 4.5 : 2.5), ty, 0.8);
  }

  private thinkOwner(p: Player, dt: number) {
    const dir = attackDir(p.team);
    const gx = oppGoalX(p.team);

    if (p.role === 'POR') {
      p.vx *= 0.8;
      p.vy *= 0.8;
      p.gkHold += dt;
      if (p.gkHold > 0.9) {
        const best = this.bestPass(p, true);
        if (best) this.pass(p, best.target);
        else this.clearBall(p);
      }
      return;
    }

    p.decideCd -= dt;
    const press = this.nearestOpponent(p);
    if (p.decideCd <= 0) {
      p.decideCd = 0.3;
      const best = this.bestPass(p, false);
      const myQ = this.shotQuality(p, press.d);
      // se un compagno ha un tiro molto migliore, servilo invece di tirare
      const layoff = best && best.blocked === 0 && best.shotQ > myQ * 1.4 + 0.05;
      if (layoff) return this.pass(p, best.target);
      if (myQ > 0 && Math.random() < myQ * (press.d < 4 ? 0.9 : 0.6)) return this.shoot(p);
      const threshold = press.d < 3 ? -2 : press.d < 6 ? 2 : 5;
      if (best && best.score > threshold && Math.random() < 0.5) return this.pass(p, best.target);
      // pressato nella propria metà campo senza passaggi sicuri: spazza lungo e largo
      const ownHalf = Math.abs(p.x - ownGoalX(p.team)) < FIELD_W / 2;
      if (ownHalf && press.d < 2.5 && (!best || best.score < threshold) && Math.random() < 0.5) {
        return this.clearBall(p);
      }
    }

    // dribbling verso la porta evitando gli avversari
    let dx = gx - dir * 4 - p.x;
    // si tiene la propria fascia, stringendo verso il centro solo vicino alla porta
    const width = clamp(Math.abs(p.x - gx) / 40, 0.3, 0.85);
    let dy = CY + (p.y - CY) * width - p.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    for (const o of this.players) {
      if (o.team === p.team || !isActive(o)) continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < 7 && d > 0.01) {
        const w = ((7 - d) / 7) * 1.2;
        dy += ((p.y - o.y) / d) * w;
        dx += ((p.x - o.x) / d) * w * 0.3;
      }
    }
    if (dx * dir < 0.2) dx = dir * 0.2;
    this.steer(p, p.x + dx * 5, p.y + dy * 5, 1);
  }

  private bestPass(p: Player, fromKeeper: boolean): PassOption | null {
    const dir = attackDir(p.team);
    let best: PassOption | null = null;
    for (const t of this.players) {
      if (t === p || t.team !== p.team || t.role === 'POR' || !isActive(t)) continue;
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < 5 || d > (fromKeeper ? 65 : 40)) continue;
      const progress = (t.x - p.x) * dir;
      const openD = this.nearestOpponent(t).d;
      const open = Math.min(10, openD);
      let blocked = 0;
      for (const o of this.players) {
        if (o.team !== p.team && isActive(o) && distToSegment(o.x, o.y, p.x, p.y, t.x, t.y) < 2.2) blocked++;
      }
      const shotQ = this.shotQuality(t, openD);
      const score = progress * 0.5 + open * 1.2 - blocked * 12 - d * 0.05 + shotQ * 25;
      if (!best || score > best.score) best = { target: t, score, shotQ, blocked };
    }
    return best;
  }

  /**
   * Quanto è buono un tiro da dove si trova p (0 = impossibile, ~0.6 = occasione da gol).
   * Conta distanza, angolo, marcatura e l'ATT del Pokémon.
   */
  private shotQuality(p: Player, pressD: number): number {
    const dGoal = dist(p.x, p.y, oppGoalX(p.team), CY);
    if (dGoal > SHOT_RANGE) return 0;
    const near = Math.pow((SHOT_RANGE - dGoal) / SHOT_RANGE, 1.3);
    const angle = Math.abs(p.y - CY) < 20 ? 1 : 0.3;
    const marking = pressD < 2.5 ? 0.6 : 1;
    const skill = (2 * p.stats.att) / (p.stats.att + 70);
    return near * angle * marking * skill * 0.7;
  }

  private nearestOpponent(p: Player): { p: Player | null; d: number } {
    let best: Player | null = null;
    let bd = Infinity;
    for (const o of this.players) {
      if (o.team === p.team || !isActive(o)) continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return { p: best, d: bd };
  }

  private speedOf(p: Player): number {
    const hpFactor = 0.75 + (0.25 * p.hp) / p.maxHp;
    const withBall = this.ball.owner === p ? 0.85 : 1;
    return (6 + p.stats.vel * 0.14 * this.pace) * hpFactor * withBall;
  }

  private steer(p: Player, tx: number, ty: number, effort: number) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    const max = this.speedOf(p) * effort;
    const s = d < 2 ? (max * d) / 2 : max;
    const dvx = d > 0.01 ? (dx / d) * s : 0;
    const dvy = d > 0.01 ? (dy / d) * s : 0;
    const k = Math.min(1, this.dt * 8);
    p.vx += (dvx - p.vx) * k;
    p.vy += (dvy - p.vy) * k;
  }

  private move(dt: number) {
    const active = this.players.filter(isActive);
    for (const p of active) {
      p.x = clamp(p.x + p.vx * dt, 1, FIELD_W - 1);
      p.y = clamp(p.y + p.vy * dt, 1, FIELD_H - 1);
      if (p.role === 'POR') {
        const gx = ownGoalX(p.team);
        p.x = gx === 0 ? Math.min(p.x, BOX_DEPTH + 4) : Math.max(p.x, FIELD_W - BOX_DEPTH - 4);
      }
    }
    // separazione tra compagni
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const c = active[j];
        if (a.team !== c.team) continue;
        const d = dist(a.x, a.y, c.x, c.y);
        if (d < 2.4 && d > 0.001) {
          const push = ((2.4 - d) / d) * 0.25;
          a.x += (a.x - c.x) * push;
          a.y += (a.y - c.y) * push;
          c.x -= (a.x - c.x) * push;
          c.y -= (a.y - c.y) * push;
        }
      }
    }
  }

  // ───────────────────────────── azioni ─────────────────────────────

  private release(p: Player, vx: number, vy: number) {
    const b = this.ball;
    b.owner = null;
    b.vx = vx;
    b.vy = vy;
    b.lastTouch = p;
    b.shot = null;
    b.intended = null;
    p.pickupCd = 0.35;
  }

  private pass(p: Player, t: Player) {
    const tx = t.x + t.vx * 0.35;
    const ty = t.y + t.vy * 0.35;
    const d = dist(p.x, p.y, tx, ty);
    const speed = clamp(14 + d * 0.9, 16, 40);
    const err = randn() * 0.05 * (1.3 - (0.3 * p.hp) / p.maxHp);
    const ang = Math.atan2(ty - this.ball.y, tx - this.ball.x) + err;
    this.release(p, Math.cos(ang) * speed, Math.sin(ang) * speed);
    this.ball.intended = t;
    this.lastPass = { from: p, time: this.time };
  }

  /** Spazzata: in avanti e verso la fascia più vicina, spesso finisce fuori. */
  private clearBall(p: Player) {
    const side = p.y < CY ? -1 : 1;
    const ang = (0.25 + Math.random() * 0.55) * side;
    const speed = 26 + Math.random() * 8;
    this.release(p, attackDir(p.team) * Math.cos(ang) * speed, Math.sin(ang) * speed);
  }

  private shoot(p: Player, opts: { from?: FinishKind; aim?: number; power?: number; speed?: number; accuracy?: number } = {}) {
    const gx = oppGoalX(p.team);
    const aim = opts.aim ?? CY + (Math.random() * 2 - 1) * (GOAL_HALF - 1.5);
    const err = randn() * Math.max(1.2, 5 - (opts.accuracy ?? p.stats.att) * 0.035);
    const ty = aim + err;
    const tx = gx + attackDir(p.team) * 2;
    const speed = opts.speed ?? 28 + p.stats.att * 0.22 * this.pace;
    const ang = Math.atan2(ty - this.ball.y, tx - this.ball.x);
    this.release(p, Math.cos(ang) * speed, Math.sin(ang) * speed);
    const power = (opts.power ?? p.stats.att) * (0.85 + Math.random() * 0.3) * (p.inst.technique === 'potenza' ? 1.12 : 1);
    this.ball.shot = { shooter: p, power, tried: new Set([p.id]), from: opts.from };
    this.lastFinish = { shooter: p, from: opts.from, time: this.time };
    p.pickupCd = 0.5;
    p.tally.shots++;
  }

  private updateBall(dt: number) {
    const b = this.ball;
    if (b.owner) {
      const p = b.owner;
      const sp = Math.hypot(p.vx, p.vy);
      const fx = sp > 0.5 ? p.vx / sp : attackDir(p.team);
      const fy = sp > 0.5 ? p.vy / sp : 0;
      b.x = clamp(p.x + fx * 1.6, 0.6, FIELD_W - 0.6);
      b.y = clamp(p.y + fy * 1.6, 0.6, FIELD_H - 0.6);
      b.vx = p.vx;
      b.vy = p.vy;
      return;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (this.cross) return; // il cross vola dritto fino al punto di caduta
    const f = Math.exp(-0.45 * dt);
    b.vx *= f;
    b.vy *= f;
    const sp = Math.hypot(b.vx, b.vy);
    if (b.shot && sp < 14) b.shot = null;
    if (b.intended && sp < 6) b.intended = null;
    if (sp < 0.2) b.vx = b.vy = 0;

    if (b.y < 0 || b.y > FIELD_H) {
      // rimessa laterale per chi non ha toccato per ultimo
      const team: 0 | 1 = b.lastTouch?.team === 0 ? 1 : 0;
      this.startSetPiece('kickin', team, clamp(b.x, 2, FIELD_W - 2), b.y < 0 ? 0.5 : FIELD_H - 0.5);
      return;
    }
    if (b.x <= 0 || b.x >= FIELD_W) {
      const defending: 0 | 1 = b.x <= 0 ? 0 : 1;
      if (Math.abs(b.y - CY) <= GOAL_HALF) {
        this.goal(defending === 0 ? 1 : 0);
        return;
      }
      b.x = clamp(b.x, 0.5, FIELD_W - 0.5);
      const attacking: 0 | 1 = defending === 0 ? 1 : 0;
      if (b.lastTouch?.team === defending) {
        this.startSetPiece('corner', attacking, b.x, b.y < CY ? 1 : FIELD_H - 1);
        return;
      }
      const keeper = this.players.find((p) => p.team === defending && p.role === 'POR' && isActive(p));
      if (keeper) {
        // rimessa dal fondo
        Object.assign(b, { owner: keeper, lastTouch: keeper, shot: null, intended: null });
        keeper.x = ownGoalX(defending) + attackDir(defending) * 3;
        keeper.y = CY;
        keeper.gkHold = 0;
        return;
      }
      b.vx = -b.vx * 0.6;
    }
  }

  private goal(team: 0 | 1) {
    this.score[team]++;
    const scorer = this.ball.lastTouch;
    let text: string;
    if (scorer && scorer.team === team) {
      scorer.tally.goals++;
      this.addEvo(scorer, 60);
      const lf = this.lastFinish;
      const from = lf && lf.shooter === scorer && this.time - lf.time < 3 ? lf.from : undefined;
      const how = { header: ' di testa', penalty: ' su rigore', freekick: ' su punizione' };
      text = `GOL${from ? how[from] : ''}! ${formName(scorer)}`;
      if (from) this.counts[`${from}Goals`]++;
      const lp = this.lastPass;
      if (lp && lp.from.team === team && lp.from !== scorer && this.time - lp.time < 6) {
        lp.from.tally.assists++;
        this.addEvo(lp.from, 35);
        text += ` (assist ${formName(lp.from)})`;
      }
    } else {
      text = `Autogol${scorer ? ` di ${formName(scorer)}` : ''}!`;
    }
    this.log('goal', text, team);
    this.goals.push({ team, minute: this.minute, scorer: scorer ? formName(scorer) : null, own: !scorer || scorer.team !== team });
    Object.assign(this.ball, { vx: 0, vy: 0, owner: null, shot: null, intended: null });
    this.cross = null;
    this.freeze = 2;
    this.pendingKickoff = team === 0 ? 1 : 0;
  }

  private checkKeeperSave() {
    const b = this.ball;
    if (!b.shot) return;
    const shooter = b.shot.shooter;
    const defTeam: 0 | 1 = shooter.team === 0 ? 1 : 0;
    const k = this.players.find((p) => p.team === defTeam && p.role === 'POR');
    if (!k || !isActive(k) || k.stun > 0 || b.shot.tried.has(k.id)) return;
    const d = dist(b.x, b.y, k.x, k.y);
    if (d > k.reach) return;
    const gx = ownGoalX(defTeam);
    if ((gx - b.x) * b.vx <= 0) return;
    const projY = b.y + b.vy * ((gx - b.x) / b.vx);
    if (Math.abs(projY - CY) > GOAL_HALF + 1) return; // va fuori, il portiere lascia sfilare

    b.shot.tried.add(k.id);
    const par = keeperRating(k.stats) * typeMultiplier(k.types, shooter.types) * (0.7 + (0.3 * k.hp) / k.maxHp)
      * (k.inst.technique === 'riflessi' ? 1.15 : 1) * (shooter.inst.technique === 'giro' ? 0.85 : 1);
    const edge = 1 - 0.35 * (d / k.reach);
    // sul rigore il portiere deve indovinare l'angolo
    const guess = b.shot.from === 'penalty' ? 0.45 : 1;
    const pSave = clamp((par / (par + b.shot.power * 0.9)) * edge * 1.7 * guess, 0.05, 0.92);
    if (Math.random() >= pSave) return;

    k.tally.saves++;
    this.addEvo(k, 30);
    this.log('save', `Parata di ${formName(k)} su ${formName(shooter)}!`, defTeam);
    b.shot = null;
    b.lastTouch = k;
    if (Math.random() < 0.5 + 0.004 * k.stats.dif) {
      b.owner = k;
      k.gkHold = 0;
      b.vx = b.vy = 0;
    } else if (Math.random() < 0.6) {
      // deviata in angolo
      this.damage(shooter, k, 0.6);
      this.startSetPiece('corner', shooter.team, b.x, b.y < CY ? 1 : FIELD_H - 1);
      return;
    } else {
      b.vx = attackDir(defTeam) * (8 + Math.random() * 8);
      b.vy = (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 10);
    }
    // parare un tiro potente fa male
    this.damage(shooter, k, 0.6);
  }

  private checkPickup() {
    const b = this.ball;
    if (b.owner || this.cross) return;
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (!isActive(p) || p.stun > 0 || p.pickupCd > 0) continue;
      const d = dist(p.x, p.y, b.x, b.y);
      const inOwnBox = Math.abs(p.x - ownGoalX(p.team)) < BOX_DEPTH;
      if (d > (p.role === 'POR' && inOwnBox ? 2.2 : 1.6)) continue;
      if (b.shot) {
        if (p.team === b.shot.shooter.team || p.role === 'POR' || b.shot.tried.has(p.id)) continue;
        b.shot.tried.add(p.id);
        if (Math.random() < 0.25 + p.stats.dif * 0.002) {
          // tiro murato: a volte finisce in angolo
          if (Math.random() < 0.5) {
            this.addEvo(p, 10);
            this.startSetPiece('corner', b.shot.shooter.team, b.x, b.y < CY ? 1 : FIELD_H - 1);
            return;
          }
          b.shot = null;
          b.vx *= -0.3;
          b.vy = randn() * 10;
          b.lastTouch = p;
          this.addEvo(p, 10);
        }
        continue;
      }
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;
    const prev = b.lastTouch;
    if (prev && prev.team !== best.team && this.lastPass?.from === prev && this.time - this.lastPass.time < 2) {
      // intercetto: un pallone veloce non sempre si controlla, a volte carambola via
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 15 && Math.random() < 0.4) {
        const ang = Math.atan2(b.vy, b.vx) + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.8);
        b.vx = Math.cos(ang) * sp * 0.6;
        b.vy = Math.sin(ang) * sp * 0.6;
        b.lastTouch = best;
        best.pickupCd = 0.4;
        return;
      }
      this.addEvo(best, 8);
    }
    b.owner = best;
    b.lastTouch = best;
    b.shot = null;
    b.intended = null;
    best.decideCd = 0.15;
    best.gkHold = 0;
  }

  private checkDuels() {
    const o = this.ball.owner;
    if (!o || o.role === 'POR' || o.duelCd > 0) return;
    for (const q of this.players) {
      if (q.team === o.team || !isActive(q) || q.stun > 0 || q.duelCd > 0) continue;
      if (dist(o.x, o.y, q.x, q.y) < 1.9) {
        this.duel(o, q);
        return;
      }
    }
  }

  // ───────────────────────────── calci piazzati ─────────────────────────────

  private headerOf(p: Player): number {
    return headerRating(p.stats, p.heightDm) * (p.inst.technique === 'testa' ? 1.2 : 1);
  }

  private outfield(team: 0 | 1, except?: Player): Player[] {
    return this.players.filter((p) => p.team === team && p.role !== 'POR' && isActive(p) && p !== except);
  }

  private keeperOf(team: 0 | 1): Player | undefined {
    return this.players.find((p) => p.team === team && p.role === 'POR' && isActive(p));
  }

  private awardFoul(fouled: Player, by: Player) {
    by.tally.fouls++;
    this.counts.fouls++;
    const team = fouled.team;
    const gx = oppGoalX(team);
    const who = `${formName(by)} su ${formName(fouled)}`;
    if (Math.abs(fouled.x - gx) < BOX_DEPTH && Math.abs(fouled.y - CY) < BOX_HALF) {
      this.log('setpiece', `Fallo in area di ${who}: RIGORE!`, team);
      return this.startSetPiece('penalty', team, fouled.x, fouled.y);
    }
    if (dist(fouled.x, fouled.y, gx, CY) < FREEKICK_RANGE) {
      this.log('setpiece', `Fallo di ${who}: punizione pericolosa.`, team);
      return this.startSetPiece('freekick', team, fouled.x, fouled.y);
    }
    // lontano dalla porta: ripresa veloce, chi è vicino deve allontanarsi
    this.log('setpiece', `Fallo di ${who}.`, team);
    for (const o of this.players) {
      if (o.team !== team && dist(o.x, o.y, fouled.x, fouled.y) < 6) o.stun = Math.max(o.stun, 1);
    }
  }

  /** Ferma il gioco e dispone tutti per il calcio piazzato. x/y = punto del fallo o della palla uscita. */
  private startSetPiece(kind: SetPieceKind, team: 0 | 1, x: number, y: number) {
    const dir = attackDir(team);
    const gx = oppGoalX(team);
    const defTeam: 0 | 1 = team === 0 ? 1 : 0;
    const mates = this.outfield(team);
    if (!mates.length) return; // tutti KO: si gioca la palla dov'è

    if (kind === 'kickin') {
      // batte il compagno più vicino; gli altri restano in posizione di gioco
      const taker = mates.sort((a, c) => dist(a.x, a.y, x, y) - dist(c.x, c.y, x, y))[0];
      Object.assign(this.ball, { x, y, vx: 0, vy: 0, owner: null, shot: null, intended: null, lastTouch: taker });
      this.cross = null;
      for (const p of this.players) p.gkHold = 0;
      this.setPiece = { kind, team, x, y, taker, direct: false, timer: KICKIN_SETUP_SECONDS, spots: new Map() };
      this.counts.kickins++;
      return;
    }

    const bx = kind === 'corner' ? gx - dir * 0.5 : kind === 'penalty' ? gx - dir * PENALTY_DIST : x;
    const by = kind === 'penalty' ? CY : y;
    const byAtt = [...mates].sort((a, c) => c.stats.att - a.stats.att);
    const direct =
      kind === 'penalty' ||
      (kind === 'freekick' && Math.abs(by - CY) < 18 && dist(bx, by, gx, CY) < 26 && Math.random() < 0.6);
    // tiri: il miglior ATT; cross: il miglior centrocampista
    const taker = direct ? byAtt[0] : (byAtt.find((p) => p.role === 'CEN') ?? byAtt[0]);

    const spots = new Map<number, [number, number]>();
    const theirKeeper = this.keeperOf(defTeam);
    const ourKeeper = this.keeperOf(team);
    if (theirKeeper) spots.set(theirKeeper.id, [gx - dir * 1.5, CY]);
    if (ourKeeper) spots.set(ourKeeper.id, [ownGoalX(team) + dir * 3, CY]);
    const defenders = this.outfield(defTeam).sort((a, c) => this.headerOf(c) - this.headerOf(a));
    const runners = mates.filter((p) => p !== taker).sort((a, c) => this.headerOf(c) - this.headerOf(a));

    if (kind === 'penalty') {
      const lineX = gx - dir * (BOX_DEPTH + 3);
      const ys = [CY - 14, CY - 5, CY + 5, CY + 14];
      [...runners, ...defenders].forEach((p, i) => spots.set(p.id, [lineX - dir * (i % 2) * 3, ys[i % 4]]));
    } else {
      // i più forti di testa vanno in area
      const boxSpots: [number, number][] = [[gx - dir * 6, CY - 3], [gx - dir * 8, CY + 4], [gx - dir * 10, CY - 7]];
      runners.forEach((p, i) => spots.set(p.id, boxSpots[i] ?? [gx - dir * 20, CY]));
      const free = [...defenders];
      if (kind === 'freekick' && direct) {
        // barriera a 6 m sulla linea palla-porta, con i due più deboli di testa
        const ang = Math.atan2(CY - by, gx - bx);
        const wx = bx + Math.cos(ang) * 6;
        const wy = by + Math.sin(ang) * 6;
        free.splice(-2).forEach((p, i) => {
          const off = i === 0 ? -1.2 : 1.2;
          spots.set(p.id, [wx - Math.sin(ang) * off, wy + Math.cos(ang) * off]);
        });
      }
      // marcature: ogni difensore si mette tra il suo uomo e la porta
      for (const r of runners) {
        const d = free.shift();
        if (!d) break;
        const [rx, ry] = spots.get(r.id)!;
        spots.set(d.id, [rx + dir * 1.5, ry]);
      }
      free.forEach((p, i) => spots.set(p.id, i === 0 ? [gx - dir * 3, by < CY ? CY - 5 : CY + 5] : [gx - dir * 18, CY]));
    }

    Object.assign(this.ball, { x: bx, y: by, vx: 0, vy: 0, owner: null, shot: null, intended: null, lastTouch: taker });
    this.cross = null;
    for (const p of this.players) {
      p.stun = 0;
      p.gkHold = 0;
    }
    this.setPiece = { kind, team, x: bx, y: by, taker, direct, timer: SETUP_SECONDS, spots };
    if (kind === 'corner') {
      this.counts.corners++;
      this.log('setpiece', `Calcio d'angolo per ${this.teams[team].name}.`, team);
    } else if (kind === 'freekick') {
      this.counts.freekicks++;
    } else {
      this.counts.penalties++;
    }
  }

  private updateSetPiece(dt: number) {
    const sp = this.setPiece!;
    sp.timer -= dt;
    const dir = attackDir(sp.team);
    for (const p of this.players) {
      if (!isActive(p)) continue;
      if (p === sp.taker) {
        this.steer(p, clamp(sp.x - dir * 1.5, 1, FIELD_W - 1), clamp(sp.y, 1, FIELD_H - 1), 1.4);
        continue;
      }
      const spot = sp.spots.get(p.id);
      if (spot) {
        this.steer(p, clamp(spot[0], 1, FIELD_W - 1), clamp(spot[1], 1, FIELD_H - 1), 1.4);
        continue;
      }
      let [tx, ty, effort] = p.role === 'POR' ? [ownGoalX(p.team) + attackDir(p.team) * 2.5, CY, 0.8] : this.positionalTarget(p);
      if (p.team !== sp.team) {
        const d = dist(tx, ty, sp.x, sp.y);
        if (d < KICKIN_DISTANCE + 0.5) {
          // fuori dai 5 m (verso la propria porta se si è proprio sul pallone)
          const ux = d > 0.1 ? (tx - sp.x) / d : -attackDir(p.team);
          const uy = d > 0.1 ? (ty - sp.y) / d : 0;
          tx = sp.x + ux * (KICKIN_DISTANCE + 0.5);
          ty = sp.y + uy * (KICKIN_DISTANCE + 0.5);
        }
      }
      this.steer(p, clamp(tx, 1, FIELD_W - 1), clamp(ty, 1, FIELD_H - 1), Math.max(effort, 1));
    }
    this.move(dt);
    if (sp.timer <= 0) this.executeSetPiece(sp);
  }

  private executeSetPiece(sp: SetPiece) {
    this.setPiece = null;
    const t = sp.taker;
    const dir = attackDir(sp.team);
    // il battitore lento potrebbe non essere arrivato: lo mettiamo sul pallone
    t.x = clamp(sp.x - dir * 1.5, 1, FIELD_W - 1);
    t.y = sp.y;
    t.vx = t.vy = 0;

    if (sp.kind === 'kickin') {
      for (const o of this.players) {
        // chi non ha fatto in tempo a uscire dai 5 m non può intervenire subito
        if (o.team !== sp.team && dist(o.x, o.y, sp.x, sp.y) < KICKIN_DISTANCE) o.stun = Math.max(o.stun, 0.5);
      }
      const best = this.bestPass(t, false);
      if (best) return this.pass(t, best.target);
      this.ball.owner = t; // nessun compagno libero: la gioca lui
      return;
    }
    if (sp.kind === 'penalty') {
      const side = Math.random() < 0.5 ? -1 : 1;
      return this.shoot(t, { from: 'penalty', aim: CY + side * (GOAL_HALF - 2.5), power: t.stats.att * 1.1 });
    }
    if (sp.direct) return this.shoot(t, { from: 'freekick', power: t.stats.att * 1.05 });

    // cross: sceglie il saltatore migliore, con un po' di imprevedibilità
    const gx = oppGoalX(sp.team);
    const targets = this.outfield(sp.team, t).filter((p) => Math.abs(p.x - gx) < BOX_DEPTH + 2);
    if (!targets.length) {
      this.ball.owner = t;
      return;
    }
    const target = targets
      .map((p) => ({ p, w: this.headerOf(p) * (0.6 + Math.random() * 0.8) }))
      .sort((a, c) => c.w - a.w)[0].p;
    const err = 4 - Math.min(3, t.stats.att * 0.025);
    const landX = clamp(target.x + randn() * err * 0.5, 1, FIELD_W - 1);
    const landY = clamp(target.y + randn() * err, 1, FIELD_H - 1);
    const d = Math.max(1, dist(this.ball.x, this.ball.y, landX, landY));
    const speed = 24;
    this.release(t, ((landX - this.ball.x) / d) * speed, ((landY - this.ball.y) / d) * speed);
    const defTeam: 0 | 1 = sp.team === 0 ? 1 : 0;
    const marker =
      this.outfield(defTeam).sort((a, c) => dist(a.x, a.y, landX, landY) - dist(c.x, c.y, landX, landY))[0] ?? null;
    this.cross = { team: sp.team, target, marker, landX, landY, timer: d / speed };
    this.lastPass = { from: t, time: this.time };
  }

  private thinkCross(p: Player, c: Cross) {
    const keeperComesOut = p.role === 'POR' && p.team !== c.team && Math.abs(c.landX - ownGoalX(p.team)) < 6;
    if (p === c.target || p === c.marker || keeperComesOut) return this.steer(p, c.landX, c.landY, 1.2);
    p.vx *= 0.9;
    p.vy *= 0.9;
  }

  /** Arrivo del cross: uscita del portiere, poi duello aereo tra saltatore e marcatore. */
  private updateCross(dt: number) {
    const c = this.cross;
    if (!c) return;
    c.timer -= dt;
    if (c.timer > 0) return;
    this.cross = null;
    const b = this.ball;
    b.x = c.landX;
    b.y = c.landY;
    b.vx *= 0.2;
    b.vy *= 0.2;
    const defTeam: 0 | 1 = c.team === 0 ? 1 : 0;
    const near = (p: Player | null) => (p && isActive(p) && dist(p.x, p.y, b.x, b.y) < 3.5 ? p : null);
    const att = near(c.target);

    const keeper = this.keeperOf(defTeam);
    if (keeper && dist(keeper.x, keeper.y, b.x, b.y) < keeper.reach) {
      const kr = keeperRating(keeper.stats);
      if (Math.random() < (att ? (0.6 * kr) / (kr + this.headerOf(att)) : 0.9)) {
        Object.assign(b, { owner: keeper, lastTouch: keeper, vx: 0, vy: 0 });
        keeper.gkHold = 0;
        this.addEvo(keeper, 10);
        this.log('save', `${formName(keeper)} esce e blocca il cross!`, defTeam);
        return;
      }
    }
    if (!att) return; // nessuno ci arriva: palla libera in area

    const def = near(c.marker);
    if (def) {
      const ha = this.headerOf(att) * (0.75 + Math.random() * 0.5);
      const hd = this.headerOf(def) * (0.75 + Math.random() * 0.5);
      // lo scontro aereo costa PV a entrambi
      this.damage(att, def, 0.3);
      this.damage(def, att, 0.3);
      if (!isActive(att)) return;
      if (hd > ha && isActive(def)) {
        this.release(def, attackDir(defTeam) * 22, randn() * 14);
        this.addEvo(def, 10);
        return;
      }
    }
    const hr = this.headerOf(att);
    this.shoot(att, { from: 'header', power: hr, speed: 22 + hr * 0.12 * this.pace, accuracy: hr });
  }

  /** Contrasto: ATT di chi ha palla contro DIF di chi interviene. Entrambi perdono PV. */
  private duel(o: Player, q: Player) {
    const hpO = 0.6 + (0.4 * o.hp) / o.maxHp;
    const hpQ = 0.6 + (0.4 * q.hp) / q.maxHp;
    const defPow = q.stats.dif * typeMultiplier(q.types, o.types) * hpQ * (q.inst.technique === 'pressing' ? 1.15 : 1);
    const attPow = o.stats.att * typeMultiplier(o.types, q.types) * hpO * 1.15;
    o.duelCd = q.duelCd = 1;
    // chi entra con tanto ATT e poca DIF è irruento e fa più falli
    if (Math.random() < (FOUL_BASE * 2 * q.stats.att) / (q.stats.att + q.stats.dif)) {
      q.stun = 0.8;
      this.damage(q, o, 1.2);
      if (isActive(o)) this.awardFoul(o, q);
      return;
    }
    const steal = Math.random() < defPow / (defPow + attPow);
    // non tutti i contrasti vinti sono puliti: spesso la palla schizza via
    if (steal && Math.random() < 0.55 - q.stats.dif * 0.002) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 10 + Math.random() * 12;
      Object.assign(this.ball, { owner: null, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, lastTouch: q });
      o.stun = 0.4;
      q.pickupCd = 0.2;
      this.addEvo(q, 8);
      this.damage(q, o, 0.6);
      this.damage(o, q, 0.25);
      return;
    }
    if (steal) {
      this.ball.owner = q;
      this.ball.lastTouch = q;
      q.decideCd = 0.2;
      o.stun = 0.6;
      q.tally.tackles++;
      this.addEvo(q, 15);
      this.damage(q, o, 1);
      this.damage(o, q, 0.25);
    } else {
      q.stun = 0.9;
      this.addEvo(o, 8);
      this.damage(o, q, 1);
      this.damage(q, o, 0.25);
    }
  }

  /** Formula dei danni Pokémon semplificata (potenza 28, rapporto ATT/DIF attenuato). */
  private damage(attacker: Player, target: Player, mult: number) {
    if (!isActive(target)) return;
    if (target.inst.technique === 'muro') mult *= 0.75;
    const L = attacker.inst.level;
    const raw = (((2 * L) / 5 + 2) * 28 * Math.sqrt(attacker.stats.att / target.stats.dif)) / 50 + 1;
    target.hp -= raw * typeMultiplier(attacker.types, target.types) * (0.85 + Math.random() * 0.15) * mult;
    // il portiere non va mai KO: stremato para peggio, ma una porta vuota sarebbe gol a ogni tiro
    if (target.role === 'POR') target.hp = Math.max(1, target.hp);
    else if (target.hp <= 0) this.knockOut(target);
  }

  private knockOut(p: Player) {
    p.hp = 0;
    p.koTimer = KO_MINUTES * SIM_PER_MINUTE;
    p.vx = p.vy = 0;
    p.stun = 0;
    p.tally.kos++;
    if (this.ball.owner === p) {
      this.ball.owner = null;
      this.ball.vx = randn() * 4;
      this.ball.vy = randn() * 4;
    }
    this.log('ko', `${formName(p)} è esausto! Fermo per ${KO_MINUTES}'.`, p.team);
  }
}
