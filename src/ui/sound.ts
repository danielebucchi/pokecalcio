/**
 * Suoni della partita, generati al volo con Web Audio (niente file da scaricare): fischi dell'arbitro,
 * folla, gol, parate, KO, evoluzioni e una musichetta chiptune. Effetti attivi di default, musica no;
 * le scelte restano tra una partita e l'altra.
 */
const SFX_KEY = 'pokecalcio-sfx';
const MUSIC_KEY = 'pokecalcio-music';

export const sfxEnabled = () => localStorage.getItem(SFX_KEY) !== '0';
export const musicEnabled = () => localStorage.getItem(MUSIC_KEY) === '1';
export const setSfx = (on: boolean) => localStorage.setItem(SFX_KEY, on ? '1' : '0');
export function setMusic(on: boolean) {
  localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
  if (on) startMusic();
  else stopMusic();
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Il contesto audio nasce al primo suono (i browser lo permettono solo dopo un tocco o un clic). */
function audio(): { ac: AudioContext; out: GainNode } | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { ac: ctx, out: master! };
  } catch {
    return null;
  }
}

/** Una nota con inviluppo rapido; `to` fa scivolare la frequenza. */
function tone(freq: number, at: number, dur: number, type: OscillatorType = 'square', vol = 0.08, to?: number) {
  const a = audio();
  if (!a) return;
  const t = a.ac.currentTime + at;
  const osc = a.ac.createOscillator();
  const g = a.ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Rumore filtrato: la folla, i colpi. */
function noise(at: number, dur: number, vol: number, freq: number, q = 0.8, swell = false) {
  const a = audio();
  if (!a) return;
  const t = a.ac.currentTime + at;
  const len = Math.ceil(a.ac.sampleRate * dur);
  const buf = a.ac.createBuffer(1, len, a.ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ac.createBufferSource();
  src.buffer = buf;
  const f = a.ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + (swell ? dur * 0.4 : 0.02));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + dur);
}

/** Fischio dell'arbitro: nota acuta con il trillo della pallina. */
function whistle(at: number, dur: number) {
  const a = audio();
  if (!a) return;
  const t = a.ac.currentTime + at;
  const osc = a.ac.createOscillator();
  const lfo = a.ac.createOscillator();
  const depth = a.ac.createGain();
  const g = a.ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = 2650;
  lfo.type = 'square';
  lfo.frequency.value = 32;
  depth.gain.value = 180;
  lfo.connect(depth).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
  g.gain.setValueAtTime(0.07, t + dur - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + dur);
  lfo.stop(t + dur);
}

export type Sfx = 'kickoff' | 'halftime' | 'fulltime' | 'setpiece' | 'goal' | 'goalAgainst' | 'save' | 'ko' | 'evo' | 'sub';

export function playSfx(kind: Sfx) {
  if (!sfxEnabled()) return;
  switch (kind) {
    case 'kickoff':
      whistle(0, 0.45);
      break;
    case 'halftime':
      whistle(0, 0.3);
      whistle(0.4, 0.3);
      break;
    case 'fulltime':
      whistle(0, 0.3);
      whistle(0.4, 0.3);
      whistle(0.8, 0.7);
      break;
    case 'setpiece':
      whistle(0, 0.22);
      break;
    case 'goal': {
      // boato della folla e motivetto allegro
      noise(0, 1.6, 0.22, 1100, 0.6, true);
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.05 + i * 0.09, 0.16, 'square', 0.06));
      tone(1319, 0.42, 0.35, 'square', 0.05);
      break;
    }
    case 'goalAgainst':
      noise(0, 0.9, 0.12, 500, 0.7, true);
      tone(392, 0.05, 0.22, 'triangle', 0.07);
      tone(311, 0.25, 0.4, 'triangle', 0.07);
      break;
    case 'save':
      tone(130, 0, 0.16, 'sine', 0.2, 60);
      noise(0, 0.12, 0.08, 800);
      break;
    case 'ko':
      tone(620, 0, 0.45, 'square', 0.05, 140);
      break;
    case 'evo':
      // arpeggio che sale, come il suono dell'evoluzione
      [392, 494, 587, 784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.18, 'triangle', 0.07));
      tone(2093, 0.5, 0.5, 'sine', 0.04);
      break;
    case 'sub':
      tone(880, 0, 0.12, 'sine', 0.06);
      tone(1175, 0.12, 0.18, 'sine', 0.06);
      break;
  }
}

// ── musichetta chiptune (in loop, a volume basso) ──

/** Giro di accordi (frequenze della fondamentale) e arpeggio sopra, in ottavi. */
const BASS = [196, 196, 165, 165, 175, 175, 147, 196];
const ARP = [
  [392, 494, 587, 494], [392, 494, 587, 494], [330, 392, 494, 392], [330, 392, 494, 392],
  [349, 440, 523, 440], [349, 440, 523, 440], [294, 370, 440, 370], [392, 494, 587, 659],
];
const STEP = 0.16; // secondi per ottavo
let timer: number | null = null;
let nextAt = 0;
let step = 0;

export function startMusic() {
  if (timer !== null || !musicEnabled()) return;
  const a = audio();
  if (!a) return;
  nextAt = a.ac.currentTime + 0.1;
  step = 0;
  // pianifica qualche nota in anticipo a ogni giro (non dipende dai frame della partita)
  timer = window.setInterval(() => {
    const now = a.ac.currentTime;
    while (nextAt < now + 0.4) {
      const bar = Math.floor(step / 4) % BASS.length;
      const at = nextAt - now;
      if (step % 4 === 0) tone(BASS[bar] / 2, at, STEP * 3.6, 'triangle', 0.05);
      tone(ARP[bar][step % 4], at, STEP * 0.9, 'square', 0.018);
      nextAt += STEP;
      step++;
    }
  }, 100);
}

export function stopMusic() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}
