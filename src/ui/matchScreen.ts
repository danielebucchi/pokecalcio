import { POKEDEX, TYPE_NAMES } from '../data/pokedex';
import type { ExpReport } from '../game/progression';
import type { RecruitOffer } from '../game/recruit';
import { gameStats, realStats, type PokemonInstance } from '../game/stats';
import { ratingsOf } from '../game/save';
import { Match, MAX_SUBS, SIM_PER_MINUTE, formName, isActive, type MatchEvent, type Player, type TeamSetup } from '../match/engine';
import { Renderer } from '../match/renderer';
import { esc } from './common';
import { spriteUrl } from './sprites';
import { bindThemeToggle, themeToggleHtml } from './theme';

const AUTO_EVO_KEY = 'pokecalcio-autoevo';

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
  /** true = medaglia ottenuta. */
  badge?: boolean;
}

export interface MatchCallbacks {
  /** Eliminazione diretta: in caso di pareggio si tirano i rigori. */
  knockout?: boolean;
  /** A fine partita: aggiorna la carriera e restituisce l'esperienza guadagnata. */
  onFinish(match: Match): { report: ExpReport[]; banner?: MatchBanner; offers?: RecruitOffer[] };
  /** Un selvatico che ha chiesto di unirsi è stato accettato. */
  recruit?(inst: PokemonInstance): void;
  /** Torna all'hub: `counted` è false se la partita è stata abbandonata. */
  onLeave(counted?: boolean): void;
}

/** Gioca la partita dentro `app`. Restituisce una funzione che ferma il ciclo. */
export function runMatch(app: HTMLElement, teams: [TeamSetup, TeamSetup], cb: MatchCallbacks): () => void {
  const match = new Match(teams, { knockout: cb.knockout });
  const [t0, t1] = match.teams;
  const humanTeam = t0.controlled ? 0 : 1;

  app.innerHTML = `
    <div class="topbar">
      <span class="brand">Poké<span>.</span>Calcio</span>
      <span class="sparkle">✦</span>
      <span>${esc(t0.name)} contro ${esc(t1.name)}</span>
      ${themeToggleHtml()}
    </div>
    <div class="match">
      <div class="scoreboard">
        <div class="sb-team" style="--team:${t0.color}">${esc(t0.name)}</div>
        <div class="sb-score"><span id="s0">0</span> - <span id="s1">0</span></div>
        <div class="sb-team" style="--team:${t1.color}">${esc(t1.name)}</div>
        <div class="sb-clock" id="clock">0'</div>
      </div>
      <div class="controls">
        <button id="pause">Pausa</button>
        <span class="speed">${[1, 2, 4].map((s) => `<button data-speed="${s}" class="${s === 1 ? 'on' : ''}">${s}×</button>`).join('')}</span>
        <span id="subsLeft" class="chip chip-sky" title="Sostituzioni rimaste: chi esce non rientra"></span>
        <label class="toggle" title="Fa evolvere i tuoi Pokémon appena possibile, scegliendo il ramo più forte">
          <input type="checkbox" id="autoevo"> <span>Evoluzione automatica</span>
        </label>
        <span class="hint"><kbd>Spazio</kbd> pausa · <kbd>1</kbd>–<kbd>5</kbd> evolvi</span>
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
  const renderer = new Renderer(canvas, match);
  canvas.style.aspectRatio = `${renderer.width} / ${renderer.height}`;

  const logEl = document.getElementById('log')!;
  const addLog = (e: MatchEvent) => {
    const li = document.createElement('li');
    li.className = `ev-${e.kind}`;
    if (e.team !== undefined) li.style.setProperty('--team', match.teams[e.team].color);
    const tag = EVENT_TAGS[e.kind];
    li.innerHTML = `<span class="min">${e.minute}'</span>${tag ? `<span class="chip chip-${tag[1]}">${tag[0]}</span>` : ''} ${esc(e.text)}`;
    logEl.prepend(li);
  };
  match.events.forEach(addLog);
  match.onEvent = addLog;

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

  let speed = 1;
  let paused = false;
  const pauseBtn = document.getElementById('pause')!;
  const setPaused = (v: boolean) => {
    paused = v;
    pauseBtn.textContent = paused ? 'Riprendi' : 'Pausa';
  };
  pauseBtn.onclick = () => setPaused(!paused);
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
    b.onclick = () => {
      speed = Number(b.dataset.speed);
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
      setPaused(!paused);
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
        c.img.src = spriteUrl(POKEDEX[p.formKey].dex);
        c.name.innerHTML = `<b>${formName(p)}</b> <small>Lv${p.inst.level} · ${p.role}</small>`;
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
    if (!paused) {
      acc += elapsed * speed;
      while (acc >= DT && !match.finished) {
        match.step(DT);
        acc -= DT;
      }
    }
    renderer.draw();
    updateHud();
    if (match.finished) {
      cleanup();
      const { report, banner, offers } = cb.onFinish(match);
      showPostMatch(app, match, humanTeam, report, banner, cb.onLeave, offers ?? [], cb.recruit);
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  const cleanup = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
  };
  raf = requestAnimationFrame(frame);
  return cleanup;
}

/**
 * Partita saltata: si gioca tutta subito, senza vederla, e si passa al resoconto. La tua squadra la
 * gestisce la CPU (cambi ed evoluzioni), come fa con l'avversario.
 */
export function skipMatch(app: HTMLElement, teams: [TeamSetup, TeamSetup], cb: MatchCallbacks) {
  const humanTeam = teams[0].controlled ? 0 : 1;
  const match = new Match([{ ...teams[0], controlled: false }, { ...teams[1], controlled: false }], { knockout: cb.knockout });
  while (!match.finished) match.step(1 / 60);
  const { report, banner, offers } = cb.onFinish(match);
  showPostMatch(app, match, humanTeam, report, banner, cb.onLeave, offers ?? [], cb.recruit);
}

function showPostMatch(
  app: HTMLElement, match: Match, humanTeam: 0 | 1, report: ExpReport[], banner: MatchBanner | undefined, onLeave: () => void,
  offers: RecruitOffer[] = [], recruit?: (inst: PokemonInstance) => void,
) {
  const offerCards = offers.map((o, i) => {
    const sp = POKEDEX[o.inst.speciesKey];
    const g = gameStats(realStats(sp, o.inst));
    const ratings = ratingsOf(o.inst);
    const best = (['DIF', 'CEN', 'ATT'] as const).reduce((a, b) => (ratings[b] > ratings[a] ? b : a));
    return `<div class="offer" data-offer="${i}">
      <img src="${spriteUrl(sp.dex)}" alt="">
      <div class="offer-body">
        <span class="offer-title"><b>${esc(sp.name)}</b> <small>Lv${o.inst.level}</small> ${sp.types.map((t) => `<span class="chip">${TYPE_NAMES[t]}</span>`).join(' ')}</span>
        <div class="pick-stats"><span>ATT <b>${g.att}</b></span><span>DIF <b>${g.dif}</b></span><span>VEL <b>${g.vel}</b></span><span>PV <b>${g.pv}</b></span>
          <span><span class="role role-${best}">${best}</span> voto ${Math.round(ratings[best])}</span></div>
        <small class="muted">Vuole unirsi a te: ${esc(o.reason)}.</small>
      </div>
      <div class="offer-actions">
        <button class="primary" data-accept="${i}">Accetta</button>
        <button data-decline="${i}">Lascia andare</button>
      </div>
    </div>`;
  }).join('');
  const offersHtml = offers.length
    ? `<section class="card offers"><h3>Vogliono unirsi a te <span class="sparkle">✦</span></h3>${offerCards}</section>`
    : match.winner === humanTeam && match.teams[humanTeam === 0 ? 1 : 0].name.startsWith('Selvatici')
      ? '<section class="card offers"><p class="muted">Bella vittoria, ma questa volta nessuno ha chiesto di unirsi. Riprova!</p></section>'
      : '';
  const [t0, t1] = match.teams;
  const them: 0 | 1 = humanTeam === 0 ? 1 : 0;
  const verdict =
    match.winner === humanTeam ? ['Vittoria', 'chip-mint'] : match.winner === them ? ['Sconfitta', 'chip-pink'] : ['Pareggio', 'chip-sky'];
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
        <img src="${spriteUrl(POKEDEX[r.speciesKey].dex)}" alt="">
        <div>
          <b>${esc(r.name)}</b> ${r.played ? '' : '<span class="chip">riserva</span>'}
          <div class="exp-line">
            ${up ? `<span class="chip chip-mint">Lv ${r.fromLevel} → ${r.toLevel}</span>` : `<small>Lv ${r.toLevel}</small>`}
            <small class="muted">${r.capped && !up ? 'al tetto di livello' : `+${r.exp} exp`}</small>
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
      ${banner.badge ? '<span class="badge-medal big"></span>' : ''}
      <div><h2>${esc(banner.title)}</h2><p class="muted">${esc(banner.text)}</p></div>
    </section>` : ''}
    <section class="card result-hero">
      <span class="chip ${verdict[1]}">${verdict[0]}</span>
      <div class="result-score">
        <div class="rs-team" style="--team:${t0.color}"><b>${esc(t0.name)}</b><small>${esc(scorers(0))}</small></div>
        <div class="rs-num">${match.score[0]} – ${match.score[1]}${so ? `<small>d.c.r. ${so.score[0]}–${so.score[1]}</small>` : ''}</div>
        <div class="rs-team" style="--team:${t1.color}"><b>${esc(t1.name)}</b><small>${esc(scorers(1))}</small></div>
      </div>
      ${shootoutHtml}
      <p class="muted">Tutti i Pokémon sono tornati allo stadio base.</p>
      <button class="primary big" data-continue>Continua</button>
    </section>
    ${offersHtml}
    <h3>Esperienza guadagnata</h3>
    <div class="exp-grid">${expCards}</div>
    <details class="card boxscores">
      <summary>Tabellino della partita</summary>
      ${table(0)}${table(1)}
    </details>
    <div class="actions"><button class="primary" data-continue>Continua</button></div>`;
  bindThemeToggle(app);
  app.querySelectorAll<HTMLButtonElement>('[data-continue]').forEach((b) => (b.onclick = () => onLeave()));
  app.querySelectorAll<HTMLButtonElement>('[data-accept]').forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.accept);
      recruit?.(offers[i].inst);
      app.querySelector(`[data-offer="${i}"] .offer-actions`)!.innerHTML = '<span class="chip chip-mint">Si è unito alla squadra ✦</span>';
    };
  });
  app.querySelectorAll<HTMLButtonElement>('[data-decline]').forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.decline);
      app.querySelector(`[data-offer="${i}"] .offer-actions`)!.innerHTML = '<span class="chip">Lasciato andare</span>';
    };
  });
  window.scrollTo({ top: 0 });
}
