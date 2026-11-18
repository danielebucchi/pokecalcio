import { POKEDEX } from '../data/pokedex';
import { spriteFor, whiteSprite } from '../ui/sprites';
import { currentTheme } from '../ui/theme';
import {
  BOX_DEPTH, BOX_HALF, CY, FIELD_H, FIELD_W, GOAL_HALF, PENALTY_DIST, SIM_PER_MINUTE,
  isActive, type Match, type Player,
} from './engine';

const S = 10; // pixel per metro
const M = 30; // margine (deve contenere le porte, profonde 25 px)

// stessa palette dell'interfaccia (style.css), in versione chiara e scura
const PALETTES = {
  light: {
    bgA: '#f5f0fa', bgB: '#eef7f6', stripeA: '#c4ecdc', stripeB: '#b4e5d1',
    line: 'rgba(255,255,255,0.95)', ink: '#3d2a5c', shadowRgb: '61, 42, 92',
    pill: 'rgba(255,255,255,0.9)', ring: 'rgba(255,255,255,0.75)',
    goalFill: 'rgba(255,255,255,0.6)', goalFrame: '#3d2a5c', ballEdge: '#3d2a5c',
  },
  dark: {
    bgA: '#1c1429', bgB: '#141b24', stripeA: '#2a5246', stripeB: '#244a3f',
    line: 'rgba(232,240,255,0.7)', ink: '#f3ecff', shadowRgb: '0, 0, 0',
    pill: 'rgba(28,20,40,0.85)', ring: 'rgba(28,20,40,0.6)',
    goalFill: 'rgba(255,255,255,0.08)', goalFrame: '#d4c4f0', ballEdge: '#1a1326',
  },
};
type Palette = (typeof PALETTES)['light'];
const FONT_DISPLAY = "'Fredoka', system-ui, sans-serif";
const FONT_BODY = "'Manrope', system-ui, sans-serif";

/** Dimensioni del campo disegnato in orizzontale (il verso del motore). */
const LAND_W = FIELD_W * S + 2 * M;
const LAND_H = FIELD_H * S + 2 * M;

/** Durata dell'animazione dell'evoluzione, in millisecondi reali (non dipende dalla velocità). */
const EVO_ANIM_MS = 1100;
/** Prima parte: sagoma bianca che alterna vecchia e nuova forma, sempre più veloce. */
const EVO_FLICKER_MS = 700;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  /** Evoluzioni in corso di animazione: forma di partenza e istante (tempo reale). */
  private evoAnims = new Map<number, { from: string; start: number }>();
  /** Ultimo stadio visto per giocatore: se sale, è un'evoluzione (un cambio lo riporta a 0). */
  private lastStage = new Map<number, { stage: number; form: string }>();
  private t: Palette = PALETTES.light;
  readonly width: number;
  readonly height: number;

  /**
   * `portrait`: campo in verticale per i telefoni (la tua squadra difende in basso e attacca verso
   * l'alto). Si ruota solo il terreno di gioco: Pokémon, palla e scritte restano dritti.
   */
  constructor(canvas: HTMLCanvasElement, private match: Match, private portrait = false) {
    this.width = portrait ? LAND_H : LAND_W;
    this.height = portrait ? LAND_W : LAND_H;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = this.width * dpr;
    canvas.height = this.height * dpr;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  private px = (x: number) => M + x * S;
  private py = (y: number) => M + y * S;
  /** Posizione sullo schermo di un punto del campo, nel verso scelto. */
  private get zoom() {
    return this.portrait ? 1.5 : 1;
  }

  private pos(x: number, y: number): [number, number] {
    return this.portrait ? [M + y * S, M + (FIELD_W - x) * S] : [this.px(x), this.py(y)];
  }

  draw() {
    const c = this.ctx;
    this.t = PALETTES[currentTheme()];
    c.clearRect(0, 0, this.width, this.height);
    this.drawPitch();
    const sorted = [...this.match.players].sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || a.y - b.y);
    for (const p of sorted) this.drawPlayer(p);
    this.drawBall();
    this.drawSetPieceBanner();
  }

  private drawSetPieceBanner() {
    const sp = this.match.setPiece;
    if (!sp) return;
    const label = {
      corner: "CALCIO D'ANGOLO",
      freekick: sp.direct ? 'PUNIZIONE' : 'PUNIZIONE (CROSS)',
      penalty: 'RIGORE',
      kickin: 'RIMESSA LATERALE',
    }[sp.kind];
    const c = this.ctx;
    c.save();
    c.font = `600 22px ${FONT_DISPLAY}`;
    c.textAlign = 'center';
    const w = c.measureText(label).width + 64;
    const x0 = this.width / 2 - w / 2;
    c.shadowColor = `rgba(${this.t.shadowRgb}, 0.25)`;
    c.shadowBlur = 24;
    c.shadowOffsetY = 8;
    const grad = c.createLinearGradient(x0, 0, x0 + w, 0);
    grad.addColorStop(0, '#3d2a5c');
    grad.addColorStop(1, '#4f3672');
    c.fillStyle = grad;
    c.beginPath();
    c.roundRect(x0, 14, w, 42, 21);
    c.fill();
    c.shadowColor = 'transparent';
    c.fillStyle = this.match.teams[sp.team].color;
    c.beginPath();
    c.arc(x0 + 24, 35, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fdf5ff';
    c.fillText(label, this.width / 2 + 8, 43);
    c.restore();
  }

  private drawPitch() {
    const c = this.ctx;
    // bordo campo: crema con i "blob" pastello come lo sfondo della pagina
    const bg = c.createLinearGradient(0, 0, this.width, this.height);
    bg.addColorStop(0, this.t.bgA);
    bg.addColorStop(1, this.t.bgB);
    c.fillStyle = bg;
    c.fillRect(0, 0, this.width, this.height);
    // in verticale si disegna lo stesso terreno ruotato di 90°: (x, y) orizzontali → (y, larghezza - x)
    c.save();
    if (this.portrait) {
      c.translate(0, this.height);
      c.rotate(-Math.PI / 2);
    }
    this.drawField();
    c.restore();
  }

  private drawField() {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.roundRect(this.px(0), this.py(0), FIELD_W * S, FIELD_H * S, 18);
    c.clip();
    for (let i = 0; i < 10; i++) {
      c.fillStyle = i % 2 ? this.t.stripeB : this.t.stripeA;
      c.fillRect(this.px(i * 10), this.py(0), 10 * S, FIELD_H * S);
    }
    c.restore();
    c.strokeStyle = this.t.line;
    c.lineWidth = 2.5;
    c.beginPath();
    c.roundRect(this.px(0), this.py(0), FIELD_W * S, FIELD_H * S, 18);
    c.stroke();
    c.beginPath();
    c.moveTo(this.px(FIELD_W / 2), this.py(0));
    c.lineTo(this.px(FIELD_W / 2), this.py(FIELD_H));
    c.stroke();
    c.beginPath();
    c.arc(this.px(FIELD_W / 2), this.py(CY), 9 * S, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = this.t.line;
    c.beginPath();
    c.arc(this.px(FIELD_W / 2), this.py(CY), 3, 0, Math.PI * 2);
    c.fill();
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 0 : FIELD_W - BOX_DEPTH;
      c.strokeRect(this.px(x0), this.py(CY - BOX_HALF), BOX_DEPTH * S, BOX_HALF * 2 * S);
      // dischetto del rigore
      c.fillStyle = this.t.line;
      c.beginPath();
      c.arc(this.px(side === 0 ? PENALTY_DIST : FIELD_W - PENALTY_DIST), this.py(CY), 3, 0, Math.PI * 2);
      c.fill();
      // porta
      const gx = side === 0 ? this.px(0) - 2.5 * S : this.px(FIELD_W);
      const gy = this.py(CY - GOAL_HALF);
      c.fillStyle = this.t.goalFill;
      c.fillRect(gx, gy, 2.5 * S, GOAL_HALF * 2 * S);
      // rete
      c.strokeStyle = `rgba(${this.t.shadowRgb}, 0.15)`;
      c.lineWidth = 1;
      for (let ny = gy; ny <= gy + GOAL_HALF * 2 * S; ny += 6) {
        c.beginPath();
        c.moveTo(gx, ny);
        c.lineTo(gx + 2.5 * S, ny);
        c.stroke();
      }
      c.strokeStyle = this.t.goalFrame;
      c.lineWidth = 3;
      c.strokeRect(gx, gy, 2.5 * S, GOAL_HALF * 2 * S);
      c.lineWidth = 2.5;
      c.strokeStyle = this.t.line;
    }
  }

  private drawPlayer(p: Player) {
    const c = this.ctx;
    const m = this.match;
    const [sx, sy] = this.pos(p.x, p.y);
    // in verticale il campo è più stretto sullo schermo: Pokémon, basi e barre un po' più grandi
    c.save();
    c.translate(sx, sy);
    c.scale(this.zoom, this.zoom);
    const x = 0;
    const y = 0;
    const color = m.teams[p.team].color;
    const ko = !isActive(p);
    c.save();
    c.globalAlpha = ko ? 0.45 : 1;

    c.fillStyle = `rgba(${this.t.shadowRgb}, 0.18)`;
    c.beginPath();
    c.ellipse(x, y + 14, 17, 6, 0, 0, Math.PI * 2);
    c.fill();

    // base: anello bianco + colore squadra, come i "pallini" delle chip
    c.fillStyle = this.t.ring;
    c.beginPath();
    c.arc(x, y, 17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = color + '40';
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, 14, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    if (p.flash > 0) {
      c.strokeStyle = `rgba(168, 144, 216, ${p.flash / 1.2})`;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(x, y, 15 + (1.2 - p.flash) * 45, 0, Math.PI * 2);
      c.stroke();
    }

    const sp = POKEDEX[p.formKey];
    const img = spriteFor(sp.dex);
    const size = 76 + p.stage * 10;
    // evoluzione appena avvenuta: parte l'animazione (lo stadio sale; un cambio lo riporta a 0)
    const now = performance.now();
    const seen = this.lastStage.get(p.id);
    if (seen && p.stage > seen.stage) this.evoAnims.set(p.id, { from: seen.form, start: now });
    this.lastStage.set(p.id, { stage: p.stage, form: p.formKey });
    const anim = this.evoAnims.get(p.id);
    const t = anim ? now - anim.start : Infinity;
    if (anim && t >= EVO_ANIM_MS) this.evoAnims.delete(p.id);
    if (img && anim && t < EVO_ANIM_MS) {
      c.save();
      c.translate(x, y - 6);
      if (p.team === 0) c.scale(-1, 1);
      if (t < EVO_FLICKER_MS) {
        // come nei giochi: sagoma bianca che alterna vecchia e nuova forma, sempre più in fretta
        const ph = t / EVO_FLICKER_MS;
        const showNew = Math.floor(ph * ph * 16) % 2 === 1;
        const key = showNew ? p.formKey : anim.from;
        const s = (showNew ? size : 76 + Math.max(0, p.stage - 1) * 10) * (1 + 0.06 * Math.sin(t / 40));
        const white = whiteSprite(POKEDEX[key].dex);
        if (white) c.drawImage(white, -s / 2, -s / 2, s, s);
      } else {
        // la nuova forma emerge dal bianco
        c.drawImage(img, -size / 2, -size / 2, size, size);
        const white = whiteSprite(sp.dex);
        if (white) {
          c.globalAlpha = 1 - (t - EVO_FLICKER_MS) / (EVO_ANIM_MS - EVO_FLICKER_MS);
          c.drawImage(white, -size / 2, -size / 2, size, size);
        }
      }
      c.restore();
      // scintille intorno
      c.save();
      c.globalAlpha = Math.max(0, 1 - t / EVO_ANIM_MS);
      c.fillStyle = '#fff4a8';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t / 260;
        const r = 26 + (t / EVO_ANIM_MS) * 16;
        c.beginPath();
        c.arc(x + Math.cos(a) * r, y - 6 + Math.sin(a) * r, 2.6, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    } else if (img) {
      c.save();
      c.translate(x, y - 6);
      if (p.team === 0) c.scale(-1, 1); // gli sprite guardano a sinistra
      if (ko) c.rotate(Math.PI / 2);
      c.drawImage(img, -size / 2, -size / 2, size, size);
      c.restore();
    } else {
      c.fillStyle = this.t.ink;
      c.font = `600 13px ${FONT_DISPLAY}`;
      c.textAlign = 'center';
      c.fillText(sp.name.slice(0, 3), x, y + 4);
    }
    c.restore();

    // barre PV / evoluzione
    const bw = 38;
    const bx = x - bw / 2;
    const by = y - 34 - p.stage * 4;
    const hpR = p.hp / p.maxHp;
    c.fillStyle = this.t.pill;
    c.beginPath();
    c.roundRect(bx - 2, by - 2, bw + 4, 11, 6);
    c.fill();
    c.fillStyle = hpR > 0.5 ? '#7dd1b8' : hpR > 0.2 ? '#e8a317' : '#e879a8';
    c.beginPath();
    c.roundRect(bx, by, Math.max(2, bw * hpR), 4, 2);
    c.fill();
    const canEvo = m.evolveBlock(p) === null;
    if (p.evo > 0) {
      // pronta a evolvere: pulsa tra rosa e lilla
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
      c.fillStyle = canEvo ? `rgb(${Math.round(168 + 64 * pulse)}, ${Math.round(144 - 23 * pulse)}, ${Math.round(216 - 48 * pulse)})` : '#a890d8';
      c.beginPath();
      c.roundRect(bx, by + 5, Math.max(2, (bw * p.evo) / 100), 3, 1.5);
      c.fill();
    }

    // ruolo in una mini pillola
    c.font = `700 9px ${FONT_BODY}`;
    c.textAlign = 'center';
    const rw = c.measureText(p.role).width + 10;
    c.fillStyle = this.t.pill;
    c.beginPath();
    c.roundRect(x - rw / 2, y + 19, rw, 13, 6.5);
    c.fill();
    c.fillStyle = this.t.ink;
    c.fillText(p.role, x, y + 29);

    // il tuo Pokémon può evolvere: etichetta pulsante sopra la testa
    if (canEvo && m.teams[p.team].controlled) {
      const n = m.players.filter((q) => q.team === p.team).indexOf(p) + 1;
      const label = `✦ Evolvi ${n}`;
      c.font = `700 11px ${FONT_BODY}`;
      const lw = c.measureText(label).width + 16;
      const ly = by - 22 - Math.sin(performance.now() / 180) * 2;
      const grad = c.createLinearGradient(x - lw / 2, 0, x + lw / 2, 0);
      grad.addColorStop(0, '#e879a8');
      grad.addColorStop(1, '#a890d8');
      c.fillStyle = grad;
      c.beginPath();
      c.roundRect(x - lw / 2, ly, lw, 17, 8.5);
      c.fill();
      c.fillStyle = '#fff';
      c.fillText(label, x, ly + 12);
    }

    if (ko) {
      const mins = Math.ceil(p.koTimer / SIM_PER_MINUTE);
      c.fillStyle = '#e879a8';
      c.font = `600 13px ${FONT_DISPLAY}`;
      c.fillText(`KO ${mins}'`, x, by - 5);
    }
    c.restore();
  }

  private drawBall() {
    const c = this.ctx;
    const b = this.match.ball;
    const [x, y] = this.pos(b.x, b.y);
    if (b.shot) {
      // scia: dove era la palla un attimo fa (1,5 px per m/s)
      const [tx, ty] = this.pos(b.x - (b.vx * 1.5) / S, b.y - (b.vy * 1.5) / S);
      c.strokeStyle = 'rgba(248, 168, 200, 0.7)';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(tx, ty);
      c.stroke();
    }
    c.save();
    c.translate(x, y);
    c.scale(this.zoom, this.zoom);
    c.translate(-x, -y);
    c.fillStyle = `rgba(${this.t.shadowRgb}, 0.25)`;
    c.beginPath();
    c.ellipse(x + 2, y + 4, 6, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.strokeStyle = this.t.ballEdge;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = this.t.ballEdge;
    c.beginPath();
    c.arc(x, y, 2.2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}
