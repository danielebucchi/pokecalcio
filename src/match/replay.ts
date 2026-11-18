import type { Match, Player } from './engine';

/**
 * Replay dei gol: durante la partita si tengono in memoria le ultime posizioni di Pokémon e palla;
 * a ogni gol se ne mette da parte una copia, che si può rivedere al rallentatore.
 */

/** Quello che serve al renderer per disegnare un Pokémon. */
export type PlayerView = Pick<Player, 'id' | 'team' | 'role' | 'formKey' | 'stage' | 'hp' | 'maxHp' | 'koTimer' | 'x' | 'y' | 'evo' | 'flash'>;

export interface BallView {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shot: boolean;
}

export interface Snapshot {
  players: PlayerView[];
  ball: BallView;
}

/** Fotogrammi al secondo (di partita) registrati. */
export const REPLAY_FPS = 30;
/** Secondi di partita prima del gol tenuti nel replay, e dopo (la palla in rete). */
const BEFORE_S = 6;
const AFTER_S = 0.8;
/** Velocità del rallentatore. */
export const REPLAY_SPEED = 0.45;

export function snapshot(match: Match): Snapshot {
  const b = match.ball;
  return {
    players: match.players.map((p) => ({
      id: p.id, team: p.team, role: p.role, formKey: p.formKey, stage: p.stage, hp: p.hp, maxHp: p.maxHp,
      koTimer: p.koTimer, x: p.x, y: p.y, evo: p.evo, flash: p.flash,
    })),
    ball: { x: b.x, y: b.y, vx: b.vx, vy: b.vy, shot: !!b.shot },
  };
}

export class ReplayRecorder {
  private frames: Snapshot[] = [];
  private acc = 0;
  /** Gol in attesa di chiudere il replay (si registra ancora un attimo dopo). */
  private pending: { left: number; done: (clip: Snapshot[]) => void }[] = [];

  /** Da chiamare dopo ogni passo della simulazione. */
  tick(match: Match, dt: number) {
    this.acc += dt;
    if (this.acc < 1 / REPLAY_FPS) return;
    this.acc -= 1 / REPLAY_FPS;
    this.frames.push(snapshot(match));
    const max = Math.ceil((BEFORE_S + AFTER_S) * REPLAY_FPS);
    if (this.frames.length > max) this.frames.splice(0, this.frames.length - max);
    for (const p of this.pending) if (--p.left <= 0) p.done(this.frames.slice());
    this.pending = this.pending.filter((p) => p.left > 0);
  }

  /** C'è stato un gol: `done` riceve il replay appena è completo. */
  goal(done: (clip: Snapshot[]) => void) {
    this.pending.push({ left: Math.ceil(AFTER_S * REPLAY_FPS), done });
  }
}

/** Durata del replay in secondi reali. */
export const clipDuration = (clip: Snapshot[]) => clip.length / REPLAY_FPS / REPLAY_SPEED;

/** Il fotogramma al tempo `t` (secondi reali dall'inizio), interpolando le posizioni. */
export function frameAt(clip: Snapshot[], t: number): Snapshot {
  const f = Math.min(clip.length - 1, Math.max(0, t * REPLAY_SPEED * REPLAY_FPS));
  const i = Math.floor(f);
  const a = clip[i];
  const b = clip[Math.min(clip.length - 1, i + 1)];
  const k = f - i;
  if (k === 0 || a === b) return a;
  const lerp = (x: number, y: number) => x + (y - x) * k;
  const next = new Map(b.players.map((p) => [p.id, p]));
  return {
    players: a.players.map((p) => {
      const q = next.get(p.id);
      return q ? { ...p, x: lerp(p.x, q.x), y: lerp(p.y, q.y) } : p;
    }),
    ball: { ...a.ball, x: lerp(a.ball.x, b.ball.x), y: lerp(a.ball.y, b.ball.y) },
  };
}
