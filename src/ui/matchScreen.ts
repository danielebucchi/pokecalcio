import { POKEDEX, TYPE_NAMES } from '../data/pokedex';
import { resultPenaltyText, type ExpReport } from '../game/progression';
import type { RecruitOffer } from '../game/recruit';
import { statsFor, type PokemonInstance } from '../game/stats';
import { TO_BOX, ratingsOf } from '../game/save';
import { Match, MAX_SUBS, SIM_PER_MINUTE, formName, isActive, type MatchEvent, type Player, type TeamSetup } from '../match/engine';
import { ACHIEVEMENT_SESSIONS, type Achievement } from '../game/achievements';
import { Renderer } from '../match/renderer';
import { WEATHER, weatherText, type Weather } from '../game/weather';
import { closeCoach, coach, type CoachStep } from './coach';
import { ReplayRecorder, clipDuration, frameAt, type Snapshot } from '../match/replay';
import { esc, natureLabel } from './common';
import { medalHtml, spriteUrl } from './sprites';
import {
  canVibrate, musicEnabled, playSfx, setMusic, setSfx, setVibe, sfxEnabled, startMusic, stopMusic, vibeEnabled, vibrate, type Sfx,
} from './sound';
import { AUTO_EVO_KEY, COACH_KEY, REPLAY_TIP_KEY, SPEEDS, SPEED_KEY, distinctFrom, savedSpeed } from './settings';
import { bindThemeToggle, themeToggleHtml } from './theme';


/** Etichetta della cronaca per tipo di evento: [testo, colore della chip]. */
const EVENT_TAGS: Partial<Record<MatchEvent['kind'], [string, string]>> = {
  goal: ['Gol', 'pink'],
  save: ['Parata', 'sky'],
  ko: ['KO', 'star'],
  recover: ['Rientro', 'mint'],
  evo: ['Evoluzione', 'lilac'],
  setpiece: ['Piazzato', 'mint'],
  sub: ['Cambio', 'sky'],
};

interface CardRefs {
  root: HTMLElement;
  img: HTMLImageElement;
  name: HTMLElement;
  hp: HTMLElement;
  evo: HTMLElement;
  stats: HTMLElement;
  btn: HTMLButtonElement;
  cycle: HTMLButtonElement;
  sub: HTMLButtonElement;
  /** uid + forma mostrati: cambiano con un'evoluzione o una sostituzione. */
  form: string;
  label: string;
}

/** Messaggio speciale a fine partita (medaglia vinta, sconfitta in palestra). */
export interface MatchBanner {
  title: string;
  text: string;
  color: string;
  /** true = traguardo raggiunto (medaglia, leggendario, titolo). */
  badge?: boolean;
  /** Medaglia di palestra vinta (indice): si mostra il suo sprite. */
  medal?: number;
}

export interface MatchCallbacks {
  /** Eliminazione diretta: in caso di pareggio si tirano i rigori. */
  knockout?: boolean;
  /** Meteo del luogo (solo all'aperto). */
  weather?: Weather;
  /** A fine partita: aggiorna la carriera e restituisce l'esperienza guadagnata. */
  onFinish(match: Match): { report: ExpReport[]; banner?: MatchBanner; offers?: RecruitOffer[]; achievements?: Achievement[] };
  /**
   * Un Pokémon che ha chiesto di unirsi è stato accettato; con la rosa piena `releaseUid` è chi
   * lascia il posto. Restituisce false se non c'è spazio.
   */
  recruit?(inst: PokemonInstance, releaseUid?: string): boolean;
  /** Stato della rosa, per chiedere chi lasciare andare quando è piena. */
  roster?(): RosterState;
  /** Torna all'hub: `counted` è false se la partita è stata abbandonata. */
  onLeave(counted?: boolean): void;
}


/** Fumetti della prima partita. */
const MATCH_TOUR: CoachStep[] = [
  { target: '#pitch', title: 'La partita si gioca da sola', text: 'I tuoi Pokémon corrono, passano e tirano da soli: tu fai l\'allenatore, con evoluzioni e cambi.' },
  { target: '.pcard', title: 'Evoluzioni', text: 'La barra viola si riempie giocando: quando la carta si illumina tocca Evolvi (o premi 1–5). Evolvere rende più forti e fa recuperare un po\' di PV.' },
  { target: '.sub-btn', title: 'Cambi', text: 'Fai entrare una riserva della panchina. Ne hai due a partita e chi esce non rientra: tienili per chi va KO o è stanco.' },
  { target: '.speed', title: 'Velocità', text: 'Accelera fino a 8×: la scelta resta per le prossime partite. Con Spazio metti in pausa.' },
  { target: '.controls .toggle', title: 'Evoluzione automatica', text: 'Se non vuoi pensarci, i tuoi Pokémon evolvono da soli appena possono.' },
];

/** Nel resoconto: il nuovo arrivato è andato direttamente nel PC. */
const BOX_LABEL = '\u0000box';

export interface RosterState {
  count: number;
  max: number;
  /** Chi si può lasciare andare (non chi è in formazione). */
  releasable: { uid: string; speciesKey: string; level: number; name: string }[];
  /** Specie di tutta la rosa e del PC di Bill, per dire subito se ce n'è già uno uguale. */
  species: string[];
  boxSpecies: string[];
}

/** Gioca la partita dentro `app`. Restituisce una funzione che ferma il ciclo. */
export function runMatch(app: HTMLElement, teams: [TeamSetup, TeamSetup], cb: MatchCallbacks): () => void {
  // se l'avversario ha un colore troppo simile al tuo, in campo ne usa un altro
  teams = [teams[0], { ...teams[1], color: distinctFrom(teams[0].color, teams[1].color) }];
  const match = new Match(teams, { knockout: cb.knockout, weather: cb.weather });
  const [t0, t1] = match.teams;
  const humanTeam = t0.controlled ? 0 : 1;
  // sul telefono in verticale il campo si disegna in verticale: i Pokémon vengono molto più grandi
  const portrait = window.matchMedia('(max-width: 700px) and (orientation: portrait)').matches;

  app.innerHTML = `
    <div class="topbar">
      <span class="brand">Poké<span>.</span>Calcio</span>
      <span class="sparkle">✦</span>
      <span class="tb-extra">${esc(t0.name)} contro ${esc(t1.name)}</span>
      ${themeToggleHtml()}
    </div>
    <div class="match ${portrait ? 'portrait' : ''}">
      <div class="scoreboard">
        <div class="sb-team" style="--team:${t0.color}">${esc(t0.name)}</div>
        <div class="sb-score"><span id="s0">0</span> - <span id="s1">0</span></div>
        <div class="sb-team" style="--team:${t1.color}">${esc(t1.name)}</div>
        <div class="sb-clock" id="clock">0'</div>
        ${cb.weather ? `<div class="sb-weather" title="${esc(weatherText(cb.weather))}">${WEATHER[cb.weather].icon} ${WEATHER[cb.weather].name}</div>` : ''}
      </div>
      <div class="controls">
        <button id="pause">Pausa</button>
        <span class="speed">${SPEEDS.map((s) => `<button data-speed="${s}" class="${s === savedSpeed() ? 'on' : ''}">${s}×</button>`).join('')}</span>
        <span id="subsLeft" class="chip chip-sky" title="Sostituzioni rimaste: chi esce non rientra"></span>
        <label class="toggle" title="Fa evolvere i tuoi Pokémon appena possibile, scegliendo il ramo più forte">
          <input type="checkbox" id="autoevo"> <span class="lbl-long">Evoluzione automatica</span><span class="lbl-short">Auto-evo</span>
        </label>
        <span class="hint"><kbd>Spazio</kbd> pausa · <kbd>1</kbd>–<kbd>5</kbd> evolvi</span>
        <button id="replay" title="Rivedi l'ultimo gol al rallentatore" hidden>🎬 Replay</button>
        <button id="sfx" class="icon-btn ${sfxEnabled() ? 'on' : ''}" title="Effetti sonori">🔊</button>
        ${canVibrate() ? `<button id="vibe" class="icon-btn ${vibeEnabled() ? 'on' : ''}" title="Vibrazione">📳</button>` : ''}
        <button id="music" class="icon-btn ${musicEnabled() ? 'on' : ''}" title="Musica">🎵</button>
        <button id="quit" title="La partita non verrà conteggiata">Abbandona</button>
      </div>
      <div class="arena">
        <div class="pitch-wrap"><canvas id="pitch"></canvas><button id="evo-callout" class="callout" hidden></button><div id="sub-panel" class="sub-panel card" hidden></div></div>
        <aside class="log"><h3>Cronaca</h3><ol id="log"></ol></aside>
      </div>
      <div class="bench" id="bench"></div>
    </div>`;

  bindThemeToggle(app);
  const canvas = document.getElementById('pitch') as HTMLCanvasElement;
  canvas.onclick = () => replaying && stopReplay();
  const renderer = new Renderer(canvas, match, portrait);
  canvas.style.aspectRatio = `${renderer.width} / ${renderer.height}`;

  const logEl = document.getElementById('log')!;
  const addLog = (e: MatchEvent) => {
    const li = document.createElement('li');
    li.className = `ev-${e.kind}`;
    if (e.team !== undefined) li.style.setProperty('--team', match.teams[e.team].color);
    const tag = EVENT_TAGS[e.kind];
    li.innerHTML = `<span class="min">${e.minute}'</span>${tag ? `<span class="chip chip-${tag[1]}">${tag[0]}</span>` : ''} ${esc(e.text)}`;
    logEl.prepend(li);
    return li;
  };
  match.events.forEach(addLog);
  // suoni: ogni evento nuovo della cronaca ha il suo
  const soundFor = (e: MatchEvent): Sfx | null => {
    if (e.kind === 'goal') return e.team === humanTeam ? 'goal' : 'goalAgainst';
    if (e.kind === 'save') return 'save';
    if (e.kind === 'ko') return 'ko';
    if (e.kind === 'evo') return 'evo';
    if (e.kind === 'sub') return 'sub';
    if (e.kind === 'setpiece') return 'setpiece';
    if (e.kind === 'info') {
      if (e.text.startsWith("Calcio d'inizio")) return 'kickoff';
      if (e.text.startsWith('Intervallo')) return 'halftime';
      if (e.text.startsWith('Fischio finale')) return 'fulltime';
    }
    return null;
  };
  // replay dei gol: ogni gol nella cronaca ha il suo ▶, il bottone in alto rivede l'ultimo
  const recorder = new ReplayRecorder();
  const replayBtn = document.getElementById('replay') as HTMLButtonElement;
  let lastClip: Snapshot[] | null = null;
  let replaying: { clip: Snapshot[]; start: number } | null = null;
  const playReplay = (clip: Snapshot[]) => {
    replaying = { clip, start: performance.now() };
    replayBtn.textContent = '⏹ Fine replay';
  };
  const stopReplay = () => {
    replaying = null;
    renderer.replay = null;
    replayBtn.textContent = '🎬 Replay';
  };
  replayBtn.onclick = () => (replaying ? stopReplay() : lastClip && playReplay(lastClip));
  match.onEvent = (e) => {
    const li = addLog(e);
    const s = soundFor(e);
    if (s) {
      playSfx(s);
      vibrate(s);
    }
    if (e.kind === 'goal') {
      recorder.goal((clip) => {
        lastClip = clip;
        replayBtn.hidden = false;
        // il primo replay disponibile: un fumetto lo segnala, una volta sola
        if (!localStorage.getItem(REPLAY_TIP_KEY) && localStorage.getItem(COACH_KEY)) {
          localStorage.setItem(REPLAY_TIP_KEY, '1');
          const was = paused;
          setPaused(true);
          coach([{ target: '#replay', title: 'Rivedi il gol', text: 'Dopo ogni gol puoi rivederlo al rallentatore da qui, o con il ▶ accanto al gol nella cronaca.' }], () => setPaused(was));
        }
        const b = document.createElement('button');
        b.className = 'replay-btn';
        b.title = 'Rivedi il gol al rallentatore';
        b.textContent = '▶';
        b.onclick = () => playReplay(clip);
        li.append(b);
      });
    }
  };
  playSfx('kickoff');
  startMusic();
  const sfxBtn = document.getElementById('sfx')!;
  sfxBtn.onclick = () => {
    setSfx(!sfxEnabled());
    sfxBtn.classList.toggle('on', sfxEnabled());
  };
  const vibeBtn = document.getElementById('vibe');
  if (vibeBtn)
    vibeBtn.onclick = () => {
      setVibe(!vibeEnabled());
      vibeBtn.classList.toggle('on', vibeEnabled());
      vibrate('goalAgainst');
    };
  const musicBtn = document.getElementById('music')!;
  musicBtn.onclick = () => {
    setMusic(!musicEnabled());
    musicBtn.classList.toggle('on', musicEnabled());
  };

  // carte dei Pokémon controllati
  const bench = document.getElementById('bench')!;
  const mine = match.players.filter((p) => p.team === humanTeam);
  const cards = new Map<Player, CardRefs>();
  mine.forEach((p, i) => {
    const root = document.createElement('div');
    root.className = 'pcard';
    root.style.setProperty('--team', match.teams[p.team].color);
    root.innerHTML = `
      <img alt="">
      <div class="pc-body">
        <div class="pc-name"></div>
        <div class="bar hp"><i></i></div>
        <div class="bar evo"><i></i></div>
        <div class="pc-stats"></div>
      </div>
      <div class="evo-row">
        <button class="evo-btn"><kbd>${i + 1}</kbd> Evolvi</button>
        <button class="evo-cycle" title="Cambia evoluzione">⇄</button>
        <button class="sub-btn" title="Sostituisci con una riserva">Cambio</button>
      </div>`;
    const btn = root.querySelector<HTMLButtonElement>('.evo-btn')!;
    btn.onclick = () => match.evolve(p);
    const cycle = root.querySelector<HTMLButtonElement>('.evo-cycle')!;
    cycle.onclick = () => match.cycleEvoTarget(p);
    const sub = root.querySelector<HTMLButtonElement>('.sub-btn')!;
    sub.onclick = () => openSub(p);
    bench.appendChild(root);
    cards.set(p, {
      root,
      img: root.querySelector('img')!,
      name: root.querySelector('.pc-name')!,
      hp: root.querySelector('.hp i')!,
      evo: root.querySelector('.evo i')!,
      stats: root.querySelector('.pc-stats')!,
      btn,
      cycle,
      sub,
      form: '',
      label: '',
    });
  });

  let speed = savedSpeed();
  let paused = false;
  const pauseBtn = document.getElementById('pause')!;
  const setPaused = (v: boolean) => {
    paused = v;
    pauseBtn.textContent = paused ? 'Riprendi' : 'Pausa';
  };
  pauseBtn.onclick = () => setPaused(!paused);
  // esci dall'app (o arriva una chiamata): la partita si ferma e ti aspetta
  const onHide = () => {
    if (document.hidden && !paused) setPaused(true);
  };
  document.addEventListener('visibilitychange', onHide);
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
    b.onclick = () => {
      speed = Number(b.dataset.speed);
      localStorage.setItem(SPEED_KEY, String(speed));
      document.querySelectorAll('[data-speed]').forEach((o) => o.classList.toggle('on', o === b));
    };
  });
  document.getElementById('quit')!.onclick = () => {
    cleanup();
    cb.onLeave(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (replaying) stopReplay();
      else setPaused(!paused);
    }
    const n = Number(e.key);
    if (n >= 1 && n <= mine.length) match.evolve(mine[n - 1]);
  };
  window.addEventListener('keydown', onKey);

  // evoluzione automatica: scelta ricordata tra le partite
  const autoBox = document.getElementById('autoevo') as HTMLInputElement;
  autoBox.checked = localStorage.getItem(AUTO_EVO_KEY) === '1';
  autoBox.onchange = () => localStorage.setItem(AUTO_EVO_KEY, autoBox.checked ? '1' : '0');
  const callout = document.getElementById('evo-callout') as HTMLButtonElement;
  let calloutAction: (() => void) | null = null;
  callout.onclick = () => calloutAction?.();

  // ── sostituzioni: pannello sopra il campo, la partita resta in pausa mentre scegli ──
  const subPanel = document.getElementById('sub-panel')!;
  let resumeAfterSub = false;
  const closeSub = () => {
    subPanel.hidden = true;
    if (resumeAfterSub) setPaused(false);
  };
  function openSub(out: Player) {
    if (match.subBlock(humanTeam) !== null) return;
    if (subPanel.hidden) resumeAfterSub = !paused;
    setPaused(true);
    const options = [...match.bench[humanTeam]]
      .sort((a, b) => ratingsOf(b)[out.role] - ratingsOf(a)[out.role])
      .map((inst) => {
        const sp = POKEDEX[inst.speciesKey];
        return `<button class="pick" data-in="${inst.uid}">
          <img src="${spriteUrl(sp.dex)}" alt="">
          <span class="pick-body"><span class="pick-title"><b>${esc(sp.name)}</b> <small>Lv${inst.level}</small></span></span>
          <span class="pick-rating" title="Voto nel ruolo ${out.role}"><b>${Math.round(ratingsOf(inst)[out.role])}</b></span>
        </button>`;
      })
      .join('');
    const state = isActive(out) ? `${Math.round((out.hp / out.maxHp) * 100)}% PV` : 'KO';
    subPanel.innerHTML = `
      <div class="sub-head">
        <div><h3>Chi entra al posto di ${esc(formName(out))}?</h3>
        <p class="muted"><span class="role role-${out.role}">${out.role}</span> ${state} · cambi rimasti ${match.subsLeft[humanTeam]}/${MAX_SUBS} · chi esce non rientra</p></div>
        <button data-cancel>Annulla</button>
      </div>
      <div class="pick-list">${options}</div>`;
    subPanel.hidden = false;
    subPanel.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = closeSub;
    subPanel.querySelectorAll<HTMLButtonElement>('[data-in]').forEach((b) => {
      b.onclick = () => {
        match.substitute(out, b.dataset.in!);
        closeSub();
      };
    });
  }

  const s0 = document.getElementById('s0')!;
  const s1 = document.getElementById('s1')!;
  const clock = document.getElementById('clock')!;
  const subsLeft = document.getElementById('subsLeft')!;

  const setCallout = (html: string | null, action: (() => void) | null) => {
    calloutAction = action;
    callout.hidden = !html || !subPanel.hidden;
    if (html && callout.innerHTML !== html) callout.innerHTML = html;
  };

  const updateHud = () => {
    const ready = mine.filter((p) => match.evolveBlock(p) === null);
    if (autoBox.checked) ready.forEach((p) => match.evolve(p));
    const evoFor = autoBox.checked ? null : (ready[0] ?? null);
    // un tuo Pokémon resterà fermo a lungo: suggerisci il cambio
    const koFor = match.subBlock(humanTeam) === null ? mine.find((p) => p.koTimer > 2 * SIM_PER_MINUTE) : undefined;
    if (evoFor) {
      const text = `${formName(evoFor)} può evolvere in ${POKEDEX[match.evoTargetOf(evoFor)!].name}`;
      const more = ready.length > 1 ? ` · altri ${ready.length - 1} pronti` : '';
      setCallout(
        `<span class="sparkle">✦</span> <b>${esc(text)}</b>${more} <span class="callout-key">premi <kbd>${mine.indexOf(evoFor) + 1}</kbd> o tocca qui</span>`,
        () => match.evolve(evoFor),
      );
    } else if (koFor) {
      const mins = Math.ceil(koFor.koTimer / SIM_PER_MINUTE);
      setCallout(
        `<b>${esc(formName(koFor))} è KO per ${mins}'</b> <span class="callout-key">tocca qui per fare un cambio</span>`,
        () => openSub(koFor),
      );
    } else {
      setCallout(null, null);
    }
    s0.textContent = String(match.score[0]);
    s1.textContent = String(match.score[1]);
    clock.textContent = `${match.minute}' · ${match.minute < 20 ? '1° T' : '2° T'}`;
    subsLeft.textContent = `Cambi ${match.subsLeft[humanTeam]}/${MAX_SUBS}`;
    const subBlock = match.subBlock(humanTeam);
    for (const [p, c] of cards) {
      c.sub.disabled = subBlock !== null;
      c.sub.title = subBlock ?? 'Sostituisci con una riserva';
      if (c.form !== `${p.inst.uid}:${p.formKey}`) {
        c.form = `${p.inst.uid}:${p.formKey}`;
        c.img.src = spriteUrl(POKEDEX[p.formKey].dex, p.inst.shiny);
        c.name.innerHTML = `<b>${formName(p)}</b>${p.inst.shiny ? ' <span class="shiny-star" title="Shiny">✨</span>' : ''} <small>Lv${p.inst.level} · ${p.role}</small>`;
      }
      c.hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
      c.evo.style.width = `${p.evo}%`;
      c.stats.textContent = isActive(p)
        ? `ATT ${p.stats.att} · DIF ${p.stats.dif} · VEL ${p.stats.vel} · PV ${Math.ceil(p.hp)}/${p.maxHp}`
        : `KO – rientra tra ${Math.ceil(p.koTimer / SIM_PER_MINUTE)}'`;
      const block = match.evolveBlock(p);
      const target = match.evoTargetOf(p);
      const label = target ? `Evolvi ▸ ${POKEDEX[target].name}` : 'Evolvi';
      if (label !== c.label) {
        c.label = label;
        c.btn.innerHTML = `<kbd>${mine.indexOf(p) + 1}</kbd> ${esc(label)}`;
      }
      c.cycle.hidden = match.evoOptions(p).length < 2;
      c.btn.disabled = block !== null;
      c.btn.title = block ?? 'Evolvi ora!';
      c.root.classList.toggle('ready', block === null);
      c.root.classList.toggle('ko', !isActive(p));
    }
  };

  const DT = 1 / 60;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  const frame = (now: number) => {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (replaying) {
      const t = (now - replaying.start) / 1000;
      if (t >= clipDuration(replaying.clip)) stopReplay();
      else renderer.replay = frameAt(replaying.clip, t);
    } else if (!paused) {
      acc += elapsed * speed;
      while (acc >= DT && !match.finished) {
        match.step(DT);
        recorder.tick(match, DT);
        acc -= DT;
      }
    }
    renderer.draw();
    updateHud();
    if (match.finished) {
      cleanup();
      const { report, banner, offers, achievements } = cb.onFinish(match);
      showPostMatch(app, match, humanTeam, report, banner, cb.onLeave, offers ?? [], cb.recruit, cb.roster, achievements);
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  const cleanup = () => {
    closeCoach();
    document.removeEventListener('visibilitychange', onHide);
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    stopMusic();
  };
  // la prima partita: fumetti che spiegano cosa puoi fare (a partita ferma)
  if (!localStorage.getItem(COACH_KEY)) {
    setPaused(true);
    coach(MATCH_TOUR, () => {
      localStorage.setItem(COACH_KEY, '1');
      setPaused(false);
    });
  }
  raf = requestAnimationFrame(frame);
  return cleanup;
}

/**
 * Partita saltata: si gioca tutta subito, senza vederla, e si passa al resoconto. La tua squadra la
 * gestisce la CPU (cambi ed evoluzioni), come fa con l'avversario.
 */
export function skipMatch(app: HTMLElement, teams: [TeamSetup, TeamSetup], cb: MatchCallbacks) {
  const humanTeam = teams[0].controlled ? 0 : 1;
  const match = new Match([{ ...teams[0], controlled: false }, { ...teams[1], controlled: false }], { knockout: cb.knockout, weather: cb.weather });
  while (!match.finished) match.step(1 / 60);
  const { report, banner, offers, achievements } = cb.onFinish(match);
  showPostMatch(app, match, humanTeam, report, banner, cb.onLeave, offers ?? [], cb.recruit, cb.roster, achievements);
}

/** Poké Ball accanto al nome se hai già la stessa specie, in rosa o nel PC (come nel Pokédex dei giochi). */
function ownedBall(inRoster: number, inBox: number): string {
  const count = inRoster + inBox;
  if (!count) return '';
  const where = inBox && !inRoster ? ' nel PC di Bill' : inBox ? ` (${inRoster} in rosa, ${inBox} nel PC)` : '';
  const title = `Ce l'hai già${count > 1 ? `: ne hai ${count}` : ''}${where}`;
  return ` <span class="owned-ball" title="${title}" aria-label="${title}"></span>${count > 1 ? `<small class="owned-count">×${count}</small>` : ''}${inBox && !inRoster ? '<small class="owned-count">PC</small>' : ''}`;
}

function showPostMatch(
  app: HTMLElement, match: Match, humanTeam: 0 | 1, report: ExpReport[], banner: MatchBanner | undefined, onLeave: () => void,
  offers: RecruitOffer[] = [], recruit?: MatchCallbacks['recruit'], roster?: MatchCallbacks['roster'],
  achievements: Achievement[] = [],
) {
  const offerCards = offers.map((o, i) => {
    const sp = POKEDEX[o.inst.speciesKey];
    const g = statsFor(sp, o.inst);
    const ratings = ratingsOf(o.inst);
    const best = (['DIF', 'CEN', 'ATT'] as const).reduce((a, b) => (ratings[b] > ratings[a] ? b : a));
    return `<div class="offer ${o.inst.shiny ? 'shiny' : ''}" data-offer="${i}">
      <img src="${spriteUrl(sp.dex, o.inst.shiny)}" alt="">
      <div class="offer-body">
        ${o.inst.shiny ? '<span class="chip chip-lilac shiny-chip">✨ Shiny!</span>' : ''}
        <span class="offer-title"><b>${esc(sp.name)}</b>${ownedBall(roster?.().species.filter((k) => k === o.inst.speciesKey).length ?? 0, roster?.().boxSpecies.filter((k) => k === o.inst.speciesKey).length ?? 0)} <small>Lv${o.inst.level}</small> ${sp.types.map((t) => `<span class="chip type-tag" data-type="${t}">${TYPE_NAMES[t]}</span>`).join(' ')}</span>
        <div class="pick-stats"><span>ATT <b>${g.att}</b></span><span>DIF <b>${g.dif}</b></span><span>VEL <b>${g.vel}</b></span><span>PV <b>${g.pv}</b></span>
          <span><span class="role role-${best}">${best}</span> voto ${Math.round(ratings[best])}</span></div>
        ${o.inst.nature ? `<small class="nature-line">Natura ${esc(natureLabel(o.inst))}</small>` : ''}
        <small class="muted">Vuole unirsi a te: ${esc(o.reason)}.</small>

      </div>
      <div class="offer-actions">
        <button class="primary" data-accept="${i}">Cattura</button>
        <button data-decline="${i}">Libera</button>
      </div>
    </div>`;
  }).join('');
  const offersHtml = offers.length
    ? `<section class="card offers"><h3>Vogliono unirsi a te <span class="sparkle">✦</span>${roster ? ` <small>rosa ${roster().count}/${roster().max}</small>` : ''}</h3>${offerCards}</section>`
    : match.winner === humanTeam && match.teams[humanTeam === 0 ? 1 : 0].name.startsWith('Selvatici')
      ? '<section class="card offers"><p class="muted">Bella vittoria, ma questa volta nessuno ha chiesto di unirsi. Riprova!</p></section>'
      : '';
  const [t0, t1] = match.teams;
  const them: 0 | 1 = humanTeam === 0 ? 1 : 0;
  const verdict =
    match.winner === humanTeam ? ['Vittoria', 'chip-mint'] : match.winner === them ? ['Sconfitta', 'chip-pink'] : ['Pareggio', 'chip-sky'];
  const penalty = resultPenaltyText(match.winner === humanTeam ? 'w' : match.winner === them ? 'l' : 'd');
  const so = match.shootout;
  const shootoutHtml = so
    ? `<div class="shootout">
        <small class="muted">Rigori ${so.score[0]}–${so.score[1]}</small>
        ${([0, 1] as const).map((t) => `<div class="so-row" style="--team:${match.teams[t].color}">
          ${so.kicks.filter((k) => k.team === t).map((k) => `<i class="${k.scored ? 'in' : 'out'}" title="${esc(k.taker)}: ${k.scored ? 'segna' : 'sbaglia'}"></i>`).join('')}
        </div>`).join('')}
      </div>`
    : '';

  const scorers = (team: 0 | 1) => {
    const goals = match.goals.filter((g) => g.team === team);
    if (!goals.length) return 'nessun gol';
    const who = (g: (typeof goals)[number]) => (g.own ? `autogol${g.scorer ? ` di ${g.scorer}` : ''}` : g.scorer!);
    if (goals.length <= 6) return goals.map((g) => `${who(g)} ${g.minute}'`).join(' · ');
    // tanti gol: riassunto per marcatore, dal più prolifico
    const count = new Map<string, number>();
    for (const g of goals) count.set(who(g), (count.get(who(g)) ?? 0) + 1);
    return [...count].sort((x, y) => y[1] - x[1]).map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(' · ');
  };

  const rows = (team: 0 | 1) =>
    match.appearances
      .filter((p) => p.team === team)
      .map((p) => {
        const evolved = p.peakForm !== p.inst.speciesKey;
        const moves = [
          p.enteredAt !== null ? `entrato ${p.enteredAt}'` : '',
          p.leftAt !== null ? `uscito ${p.leftAt}'` : '',
        ].filter(Boolean).join(' · ');
        const form = (evolved
          ? `${POKEDEX[p.peakForm].name} <span class="muted">→ torna</span> ${POKEDEX[p.inst.speciesKey].name}`
          : POKEDEX[p.inst.speciesKey].name) + (moves ? ` <small class="muted">${moves}</small>` : '');
        const t = p.tally;
        return `<tr><td>${form}</td><td><span class="role role-${p.role}">${p.role}</span></td><td>${t.goals}</td><td>${t.assists}</td><td>${t.shots}</td><td>${t.tackles}</td><td>${t.fouls}</td><td>${t.saves}</td><td>${t.kos}</td></tr>`;
      })
      .join('');
  const table = (team: 0 | 1) => `
    <h3 style="--team:${match.teams[team].color}">${esc(match.teams[team].name)}</h3>
    <table class="boxscore"><thead><tr><th>Pokémon</th><th>Ruolo</th><th>Gol</th><th>Assist</th><th>Tiri</th><th>Contrasti</th><th>Falli</th><th>Parate</th><th>KO</th></tr></thead>
    <tbody>${rows(team)}</tbody></table>`;

  const expCards = [...report]
    .sort((a, b) => Number(b.played) - Number(a.played))
    .map((r) => {
      const up = r.toLevel > r.fromLevel;
      return `<div class="exp-card ${up ? 'up' : ''}">
        <img src="${spriteUrl(POKEDEX[r.speciesKey].dex, r.shiny)}" alt="">
        <div>
          <b>${esc(r.name)}</b> ${r.played ? '' : '<span class="chip">riserva</span>'}
          <div class="exp-line">
            ${up ? `<span class="chip chip-mint">sale al Lv. ${r.toLevel}!</span>` : `<small>Lv. ${r.toLevel}</small>`}
            <small class="muted">${r.capped && !up ? 'al tetto di livello' : `+${r.exp} Punti Esp.`}</small>
          </div>
          <div class="bar exp"><i style="width:${r.expPct}%"></i></div>
          ${r.unlocked.length ? `<span class="chip chip-lilac">ora può evolvere in ${esc(r.unlocked.join(', '))}</span>` : ''}
        </div>
      </div>`;
    })
    .join('');

  app.innerHTML = `
    <div class="topbar">
      <span class="brand">Poké<span>.</span>Calcio</span>
      <span class="sparkle">✦</span>
      <span>Fischio finale</span>
      ${themeToggleHtml()}
    </div>
    ${banner ? `<section class="card result-banner ${banner.badge ? 'won' : ''}" style="--team:${banner.color}">
      ${banner.medal !== undefined ? medalHtml(banner.medal, true) : banner.badge ? '<span class="badge-medal big"></span>' : ''}
      <div><h2>${esc(banner.title)}</h2><p class="muted">${esc(banner.text)}</p></div>
    </section>` : ''}
    ${achievements.map((a) => `<section class="card achievement-unlocked">
      <span class="ach-icon">🏆</span>
      <div><small class="muted">Obiettivo raggiunto · +${ACHIEVEMENT_SESSIONS} sessione di allenamento</small>
      <h3>${esc(a.name)}</h3><p class="muted">${esc(a.description)}</p></div>
    </section>`).join('')}
    <section class="card result-hero">
      <span class="chip ${verdict[1]}">${verdict[0]}</span>
      <div class="result-score">
        <div class="rs-team" style="--team:${t0.color}"><b>${esc(t0.name)}</b><small>${esc(scorers(0))}</small></div>
        <div class="rs-num">${match.score[0]} – ${match.score[1]}${so ? `<small>d.c.r. ${so.score[0]}–${so.score[1]}</small>` : ''}</div>
        <div class="rs-team" style="--team:${t1.color}"><b>${esc(t1.name)}</b><small>${esc(scorers(1))}</small></div>
      </div>
      ${shootoutHtml}
      ${penalty ? `<p class="penalty">${esc(penalty)}</p>` : ''}
      <p class="muted">Tutti i Pokémon sono tornati allo stadio base.</p>
      <button class="primary big" data-continue>Continua</button>
    </section>
    ${offersHtml}
    ${report.length ? `<h3>Esperienza guadagnata</h3>
    <div class="exp-grid">${expCards}</div>` : ''}
    <details class="card boxscores">
      <summary>Tabellino della partita</summary>
      ${table(0)}${table(1)}
    </details>
    <div class="actions"><button class="primary" data-continue>Continua</button></div>`;
  bindThemeToggle(app);
  app.querySelectorAll<HTMLButtonElement>('[data-continue]').forEach((b) => (b.onclick = () => onLeave()));
  const joined = (i: number, released?: string) => {
    const name = POKEDEX[offers[i].inst.speciesKey].name;
    app.querySelector(`[data-offer="${i}"] .offer-actions`)!.innerHTML =
      released === BOX_LABEL
        ? `<span class="chip chip-mint">Preso! ✦</span> <small class="muted">${esc(name)} è stato trasferito nel PC di Bill!</small>`
        : `<span class="chip chip-mint">Preso! ✦</span>${released ? ` <small class="muted">${esc(released)} è stato trasferito nel PC di Bill!</small>` : ''}`;
  };
  // ogni offerta: Cattura (con la rosa piena si sceglie chi va nel PC) o Libera (annullabile)
  const bindOffer = (i: number, box: HTMLElement, buttons: string) => {
    const restore = () => {
      box.classList.remove('swap');
      box.innerHTML = buttons;
      bindOffer(i, box, buttons);
    };
    box.querySelector<HTMLButtonElement>('[data-accept]')!.onclick = () => {
      const st = roster?.();
      if (!st || st.count < st.max) {
        if (recruit?.(offers[i].inst) !== false) joined(i);
        return;
      }
      box.classList.add('swap');
      box.innerHTML = `<p class="swap-title">Rosa piena (${st.count}/${st.max}): chi mandi nel PC di Bill?</p>
        <div class="swap-list"><button data-release="${TO_BOX}">📦 Lui direttamente</button>${st.releasable
          .map((r) => `<button data-release="${r.uid}"><img src="${spriteUrl(POKEDEX[r.speciesKey].dex)}" alt=""> ${esc(r.name)} <small>Lv${r.level}</small></button>`)
          .join('')}</div>
        <button class="link" data-cancel>Annulla</button>`;
      box.querySelectorAll<HTMLButtonElement>('[data-release]').forEach((r) => {
        r.onclick = () => {
          const uid = r.dataset.release!;
          const out = uid === TO_BOX ? BOX_LABEL : st.releasable.find((x) => x.uid === uid)!.name;
          box.classList.remove('swap');
          if (recruit?.(offers[i].inst, uid) !== false) joined(i, out);
        };
      });
      box.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = restore;
    };
    box.querySelector<HTMLButtonElement>('[data-decline]')!.onclick = () => {
      box.innerHTML = '<span class="chip">Liberato</span> <button class="link" data-undo-free>Annulla</button>';
      box.querySelector<HTMLButtonElement>('[data-undo-free]')!.onclick = restore;
    };
  };
  app.querySelectorAll<HTMLElement>('[data-offer]').forEach((o) => {
    const box = o.querySelector<HTMLElement>('.offer-actions')!;
    bindOffer(Number(o.dataset.offer), box, box.innerHTML);
  });
  window.scrollTo({ top: 0 });
}
