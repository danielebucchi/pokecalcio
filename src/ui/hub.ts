import { POKEDEX, TYPE_NAMES, type PokeType } from '../data/pokedex';
import { GYMS, type Gym } from '../game/gyms';
import {
  FLY_BADGES, KANTO, KANTO_LINKS, locationById, neighbors, trainerLevel, type KantoLocation, type RouteTrainer,
} from '../game/kanto';
import {
  ROUND_NAMES, YOU, currentRound, pairs, trainerById, type LeagueRun, type LeagueTrainer,
} from '../game/league';
import { typeMultiplier } from '../game/typechart';
import { FORMATIONS, type FormationKey } from '../game/formations';
import {
  DRILLS, EV_STAT_CAP, MAX_LEVEL,
  applyDrill, currentStats, drillBlock, drillPreview, drillStat, expToNext, suggestedDrill, type Drill,
} from '../game/progression';
import {
  SESSIONS_PER_MATCHDAY, autoLineup, findOwned, lineupProblem, ratingsOf,
  type OwnedPokemon, type SaveData,
} from '../game/save';
import type { PokemonInstance, Role } from '../game/stats';
import { MAX_SUBS, type TeamSetup } from '../match/engine';
import { clubTeam } from '../match/teams';
import { esc, evoLine, teamTable } from './common';
import { spriteUrl } from './sprites';
import { bindThemeToggle, themeToggleHtml } from './theme';

export type HubTab = 'squad' | 'training' | 'map';

export type ChallengeKind = 'gym' | 'league' | 'trainer' | 'wild' | 'legendary';

/** Cosa si può fare nel luogo di Kanto in cui ti trovi. */
export interface Challenges {
  location: KantoLocation;
  /** La palestra di questa città, se è la prossima da sfidare. */
  gym: Gym | null;
  gymTeam: TeamSetup | null;
  /** Allenatori del luogo (una sola vittoria ciascuno). */
  trainers: { trainer: RouteTrainer; team: TeamSetup; defeated: boolean }[];
  /** Partitella con i selvatici: ripetibile, fa esperienza e vincendo qualcuno chiede di unirsi. */
  wild: TeamSetup;
  /** Squadra del leggendario del luogo, se c'è e non si è ancora unito a te. */
  legendary: TeamSetup | null;
  /** Solo all'Altopiano Blu, con tutte le medaglie. */
  league: { run: LeagueRun | null; opponent: LeagueTrainer | null; team: TeamSetup | null } | null;
}

export interface HubState {
  tab: HubTab;
  /** Esito dell'ultima sessione di allenamento. */
  message: string | null;
  /** Posizione della formazione selezionata sul campo. */
  slot: number;
}

export interface HubActions {
  /** Il salvataggio è cambiato: salva e ridisegna. */
  changed(): void;
  play(kind: ChallengeKind, trainerId?: string): void;
  /** Spostati in un luogo della mappa. */
  travel(id: string): void;
  canTravel(id: string): boolean;
  /** Nuova edizione della Lega, con nuovo sorteggio. */
  joinLeague(): void;
  reset(): void;
}

const WELCOME_KEY = 'pokecalcio-welcome-seen';

export const ROLE_INFO: Record<Role, { name: string; needs: string }> = {
  POR: { name: 'Portiere', needs: 'Conta soprattutto la Difesa, poi PV e Velocità. Più è alto, più porta copre.' },
  DIF: { name: 'Difensore', needs: 'Conta la Difesa per vincere i contrasti, poi PV e Velocità.' },
  CEN: { name: 'Centrocampista', needs: 'Serve equilibrio: Attacco, Difesa e Velocità contano quasi uguale.' },
  ATT: { name: 'Attaccante', needs: "Conta l'Attacco per tirare e saltare l'uomo, poi la Velocità." },
};

/** Spiegazioni delle sigle, usate come tooltip ovunque. */
export const STAT_HELP = {
  att: 'Attacco: il più alto tra Attacco e Attacco Speciale. Serve per tirare e vincere i dribbling.',
  dif: 'Difesa: la più alta tra Difesa e Difesa Speciale. Serve per i contrasti e le parate.',
  vel: 'Velocità: quanto corre in campo.',
  pv: 'Punti vita: a zero il Pokémon resta fermo 6 minuti.',
};

const STAT_NAMES: Record<Exclude<Drill, 'sparring'>, string> = { att: 'Attacco', dif: 'Difesa', vel: 'Velocità', pv: 'PV' };
const sprite = (p: PokemonInstance) => spriteUrl(POKEDEX[p.speciesKey].dex);
const nameOf = (p: PokemonInstance) => POKEDEX[p.speciesKey].name;

function statLine(p: OwnedPokemon): string {
  const g = currentStats(p);
  return (['att', 'dif', 'vel', 'pv'] as const)
    .map((k) => `<span title="${esc(STAT_HELP[k])}">${k.toUpperCase()} <b>${g[k]}</b></span>`)
    .join('');
}

/** Media dei voti nel ruolo dei 5 in campo: un'idea veloce di chi è favorito. */
function strength(team: TeamSetup): number {
  return team.roster.reduce((a, r) => a + ratingsOf(r.inst)[r.role], 0) / team.roster.length;
}

export function renderHub(app: HTMLElement, save: SaveData, ch: Challenges, state: HubState, actions: HubActions) {
  const r = save.record;
  const problem = lineupProblem(save);
  const tabs: [HubTab, string, string][] = [
    ['squad', 'Formazione', ''],
    ['training', 'Allenamento', save.sessionsLeft ? `<span class="badge">${save.sessionsLeft}</span>` : ''],
    ['map', 'Mappa di Kanto', ''],
  ];
  const showWelcome = save.matchday === 1 && !localStorage.getItem(WELCOME_KEY);

  app.innerHTML = `
    <div class="topbar">
      <span class="brand">Poké<span>.</span>Calcio</span>
      <span class="sparkle">✦</span>
      <span>Calcio a 5 con le statistiche di Bulbapedia</span>
      <span class="sparkle">✦</span>
      <span>Medaglie ${save.badges}/${GYMS.length}</span>
      ${save.titles ? `<span class="sparkle">✦</span><span>Campione della Lega ×${save.titles}</span>` : ''}
      ${themeToggleHtml()}
    </div>
    <header class="hub-head" style="--team:${save.color}">
      <div class="club">
        <h1>${esc(save.clubName)}</h1>
        <div class="record">
          <span class="chip chip-mint" title="Vittorie">${r.w} V</span>
          <span class="chip" title="Pareggi">${r.d} P</span>
          <span class="chip chip-pink" title="Sconfitte">${r.l} S</span>
          <span class="muted">gol ${r.gf}–${r.ga}</span>
        </div>
      </div>
      ${headerGoal(save, ch, problem)}
    </header>
    ${showWelcome ? welcomeHtml() : ''}
    <nav class="tabs">${tabs.map(([k, l, extra]) => `<button data-tab="${k}" class="${state.tab === k ? 'on' : ''}">${l}${extra}</button>`).join('')}</nav>
    <main id="tab"></main>
    <footer class="hub-foot">
      <button id="reset" class="link">Ricomincia la carriera da zero</button>
    </footer>`;

  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    b.onclick = () => {
      state.tab = b.dataset.tab as HubTab;
      state.message = null;
      renderHub(app, save, ch, state, actions);
    };
  });
  bindThemeToggle(app);
  const headerPlay = document.getElementById('play');
  if (headerPlay) {
    headerPlay.onclick = () => {
      if (!lineupProblem(save)) actions.play(ch.gym ? 'gym' : 'league');
    };
  }
  document.getElementById('join')?.addEventListener('click', actions.joinLeague);
  document.getElementById('open-map')?.addEventListener('click', () => {
    state.tab = 'map';
    renderHub(app, save, ch, state, actions);
  });
  document.getElementById('welcome-ok')?.addEventListener('click', () => {
    localStorage.setItem(WELCOME_KEY, '1');
    renderHub(app, save, ch, state, actions);
  });
  document.getElementById('reset')!.onclick = () => {
    if (confirm('Cancellare la carriera (rosa, livelli, risultati) e ripartire da zero?')) actions.reset();
  };

  const main = document.getElementById('tab')!;
  if (state.tab === 'squad') renderSquad(main, save, state, actions);
  else if (state.tab === 'training') renderTraining(main, save, state, actions);
  else renderMap(main, save, ch, actions);
}

/** Testata: dove sei e il prossimo obiettivo, con il bottone giusto per il luogo in cui ti trovi. */
function headerGoal(save: SaveData, ch: Challenges, problem: string | null): string {
  const here = `Sei a ${esc(ch.location.name)}`;
  if (ch.gym) {
    return `<div class="next" style="--team:${ch.gym.color}">
        <small>${here} · palestra di livello ${ch.gym.level}</small>
        <span class="next-name">${esc(ch.gym.leader)} <span class="chip type-chip" style="--team:${ch.gym.color}">${TYPE_NAMES[ch.gym.type]}</span></span>
      </div>
      <button id="play" class="primary big" ${problem ? 'disabled' : ''} title="${esc(problem ?? `Sfida ${ch.gym.leader} per la ${ch.gym.badge}`)}">Sfida ${esc(ch.gym.leader)}</button>`;
  }
  if (ch.league?.opponent && ch.league.run) {
    return `<div class="next" style="--team:${ch.league.opponent.color}">
        <small>${here} · Lega Pokémon, ${ROUND_NAMES[currentRound(ch.league.run)]}</small>
        <span class="next-name">${esc(ch.league.opponent.name)}</span>
      </div>
      <button id="play" class="primary big" ${problem ? 'disabled' : ''}>Gioca ${ROUND_NAMES[currentRound(ch.league.run)].toLowerCase()}</button>`;
  }
  if (ch.league) {
    return `<div class="next"><small>${here}</small><span class="next-name">Lega Pokémon</span></div>
      <button id="join" class="primary big">Iscriviti alla Lega</button>`;
  }
  const gym = GYMS[save.badges];
  const goal = gym
    ? `Prossima palestra: <b>${esc(gym.leader)}</b> a ${esc(KANTO.find((l) => l.gym === save.badges)!.name)}`
    : 'Prossima meta: <b>Altopiano Blu</b>';
  return `<div class="next"><small>${here}</small><span class="next-goal">${goal}</span></div>
    <button id="open-map" class="primary big">Apri la mappa</button>`;
}

function welcomeHtml(): string {
  return `<section class="welcome card">
    <h2>Benvenuto, allenatore <span class="sparkle">✦</span></h2>
    <ol class="steps">
      <li><b>Formazione</b><span>Tocca una posizione sul campo e scegli chi ci gioca. Il voto ti dice quanto è adatto al ruolo.</span></li>
      <li><b>Allenamento</b><span>Prima di ogni partita hai ${SESSIONS_PER_MATCHDAY} sessioni per migliorare i tuoi Pokémon.</span></li>
      <li><b>Mappa di Kanto</b><span>Viaggia da Biancavilla, batti gli allenatori sui percorsi e gli 8 capipalestra per le medaglie: ognuna apre nuovi luoghi. In partita, quando una carta si illumina, puoi evolvere.</span></li>
    </ol>
    <button id="welcome-ok" class="primary">Ho capito</button>
  </section>`;
}

// ───────────────────────────── formazione ─────────────────────────────

function renderSquad(main: HTMLElement, save: SaveData, state: HubState, actions: HubActions) {
  const formation = FORMATIONS[save.formation];
  state.slot = Math.min(state.slot, formation.slots.length - 1);
  const selected = formation.slots[state.slot];
  const slotOf = new Map(save.lineup.map((uid, i) => [uid, i]));

  const pitch = formation.slots
    .map((slot, i) => {
      const p = findOwned(save, save.lineup[i]);
      const left = ((slot.home[0] + 3) / 68) * 100;
      const top = (slot.home[1] / 60) * 100;
      return `<button class="pm-slot ${i === state.slot ? 'selected' : ''}" data-slot="${i}" style="left:${left}%;top:${top}%" title="${ROLE_INFO[slot.role].name}">
        ${p ? `<img src="${sprite(p)}" alt="">` : '<span class="pm-empty">?</span>'}
        <span class="role role-${slot.role}">${slot.role}</span>
        <small>${p ? nameOf(p) : 'vuoto'}</small>
      </button>`;
    })
    .join('');

  const ranked = [...save.roster].sort((a, b) => ratingsOf(b)[selected.role] - ratingsOf(a)[selected.role]);
  const top = ratingsOf(ranked[0])[selected.role];
  const picks = ranked
    .map((p) => {
      const rating = ratingsOf(p)[selected.role];
      const at = slotOf.get(p.uid);
      const here = at === state.slot;
      const status = here
        ? '<span class="chip chip-lilac">in questa posizione</span>'
        : at !== undefined
          ? `<span class="chip chip-pink">in campo · ${formation.slots[at].role}</span>`
          : '<span class="chip">riserva</span>';
      return `<button class="pick ${here ? 'current' : ''}" data-uid="${p.uid}">
        <img src="${sprite(p)}" alt="">
        <span class="pick-body">
          <span class="pick-title"><b>${nameOf(p)}</b> <small>Lv${p.level}</small> ${status}</span>
          <span class="pick-stats">${statLine(p)}</span>
          <span class="pick-evo">${evoLine(p)}</span>
        </span>
        <span class="pick-rating" title="Voto come ${ROLE_INFO[selected.role].name.toLowerCase()}">
          <b>${Math.round(rating)}</b>
          <span class="bar"><i style="width:${(rating / top) * 100}%"></i></span>
        </span>
      </button>`;
    })
    .join('');

  main.innerHTML = `
    <div class="squad">
      <div>
        <div class="pitch-mini">${pitch}</div>
        <div class="squad-controls">
          <label>Modulo
            <select id="formation">${(Object.keys(FORMATIONS) as FormationKey[])
              .map((k) => `<option value="${k}" ${k === save.formation ? 'selected' : ''}>${FORMATIONS[k].name}</option>`)
              .join('')}</select>
          </label>
          <button id="auto" title="Sceglie da solo la combinazione con i voti più alti">Formazione automatica</button>
        </div>
        <p class="muted">${formation.description}</p>
      </div>
      <div class="card pick-panel">
        <div class="pick-head">
          <span class="role role-${selected.role}">${selected.role}</span>
          <div>
            <h3>Chi gioca come ${ROLE_INFO[selected.role].name.toLowerCase()}?</h3>
            <p class="muted">${ROLE_INFO[selected.role].needs} Tocca un Pokémon per metterlo in questa posizione.</p>
          </div>
        </div>
        <div class="pick-list">${picks}</div>
      </div>
    </div>`;

  main.querySelectorAll<HTMLButtonElement>('.pm-slot').forEach((b) => {
    b.onclick = () => {
      state.slot = Number(b.dataset.slot);
      renderSquad(main, save, state, actions);
    };
  });
  main.querySelectorAll<HTMLButtonElement>('.pick').forEach((b) => {
    b.onclick = () => {
      const uid = b.dataset.uid!;
      const i = state.slot;
      const j = save.lineup.indexOf(uid);
      if (j === i) return;
      if (j >= 0) save.lineup[j] = save.lineup[i]; // era già in campo: si scambiano di posto
      save.lineup[i] = uid;
      actions.changed();
    };
  });
  (document.getElementById('formation') as HTMLSelectElement).onchange = (e) => {
    save.formation = (e.target as HTMLSelectElement).value as FormationKey;
    // stessi Pokémon, ruoli nuovi: si riparte dalla formazione migliore per il modulo
    save.lineup = autoLineup(save);
    actions.changed();
  };
  document.getElementById('auto')!.onclick = () => {
    save.lineup = autoLineup(save);
    actions.changed();
  };
}

// ───────────────────────────── allenamento ─────────────────────────────

function renderTraining(main: HTMLElement, save: SaveData, state: HubState, actions: HubActions) {
  const roleOf = new Map(save.lineup.map((uid, i) => [uid, FORMATIONS[save.formation].slots[i]?.role ?? null]));
  const card = (p: OwnedPokemon) => {
    const g = currentStats(p);
    const role = roleOf.get(p.uid) ?? null;
    const suggestion = suggestedDrill(role);
    const expPct = p.level >= MAX_LEVEL ? 100 : (p.exp / expToNext(p.level)) * 100;
    const statRows = (Object.keys(STAT_NAMES) as (keyof typeof STAT_NAMES)[])
      .map((d) => {
        const ev = p.evs[drillStat(p, d)!];
        return `<div class="tstat" title="${esc(STAT_HELP[d])}"><span>${STAT_NAMES[d]}</span><b>${g[d]}</b>
          <div class="bar ev" title="Allenamento fatto: ${ev}/${EV_STAT_CAP}"><i style="width:${(ev / EV_STAT_CAP) * 100}%"></i></div></div>`;
      })
      .join('');
    const drills = (Object.keys(DRILLS) as Drill[])
      .map((d) => {
        const block = drillBlock(save, p, d);
        const gain = block ? '' : drillPreview(p, d);
        const suggest = d === suggestion && !block;
        return `<button data-uid="${p.uid}" data-drill="${d}" class="${suggest ? 'suggest' : ''}" ${block ? 'disabled' : ''}
          title="${esc(block ?? DRILLS[d].description)}"><i class="dot dot-${DRILLS[d].chip}"></i>${DRILLS[d].label}${gain ? ` <em>${gain}</em>` : ''}</button>`;
      })
      .join('');
    return `<div class="tcard ${role ? '' : 'reserve'}">
      <div class="tc-head">
        <img src="${sprite(p)}" alt="">
        <div>
          <b>${nameOf(p)}</b> <small>Lv${p.level}</small>
          ${role ? `<span class="role role-${role}">${role}</span>` : '<span class="chip">riserva</span>'}
          <div class="bar exp" title="Esperienza verso il livello ${p.level + 1}"><i style="width:${expPct}%"></i></div>
          <small>${p.level >= MAX_LEVEL ? 'livello massimo' : `${p.exp}/${expToNext(p.level)} esperienza`}</small>
        </div>
      </div>
      ${statRows}
      <div class="drills">${drills}</div>
    </div>`;
  };

  const starters = save.lineup.map((uid) => findOwned(save, uid)).filter((p) => p !== undefined);
  const reserves = save.roster.filter((p) => !save.lineup.includes(p.uid));
  const dots = Array.from({ length: SESSIONS_PER_MATCHDAY }, (_, i) => `<i class="${i < save.sessionsLeft ? 'full' : ''}"></i>`).join('');

  main.innerHTML = `
    <div class="card training-head">
      <span class="session-dots" title="Sessioni rimaste">${dots}</span>
      <div>
        <b>${save.sessionsLeft ? `${save.sessionsLeft} ${save.sessionsLeft === 1 ? 'sessione rimasta' : 'sessioni rimaste'}` : 'Sessioni finite per questa giornata'}</b>
        <p class="muted">Ogni sessione migliora una statistica di un Pokémon (o gli dà esperienza con lo sparring) e si ricarica dopo ogni partita.
        Il bottone evidenziato è quello che serve di più al suo ruolo.</p>
      </div>
      ${save.sessionsLeft ? '' : '<button class="primary" id="go-play">Gioca la partita</button>'}
    </div>
    ${state.message ? `<div class="toast">${esc(state.message)}</div>` : ''}
    <h3>Titolari</h3>
    <div class="tgrid">${starters.map(card).join('')}</div>
    ${reserves.length ? `<h3>Riserve <small>— in partita guadagnano meno esperienza: lo sparring le fa crescere</small></h3>
    <div class="tgrid">${reserves.map(card).join('')}</div>` : ''}`;

  document.getElementById('go-play')?.addEventListener('click', () => document.getElementById('play')!.click());
  main.querySelectorAll<HTMLButtonElement>('button[data-drill]').forEach((b) => {
    b.onclick = () => {
      const p = findOwned(save, b.dataset.uid!);
      const drill = b.dataset.drill as Drill;
      if (!p || drillBlock(save, p, drill)) return;
      state.message = applyDrill(save, p, drill);
      actions.changed();
    };
  });
}

// ───────────────────────────── sfide ─────────────────────────────

function forecastHtml(mine: TeamSetup, them: TeamSetup): string {
  const a = strength(mine);
  const b = strength(them);
  const diff = (a - b) / Math.max(a, b);
  const verdict = diff > 0.05 ? 'Sei favorito' : diff < -0.05 ? 'Sono favoriti loro' : 'Partita equilibrata';
  return `<div class="forecast">
    <div class="fc-side" style="--team:${mine.color}"><small>${esc(mine.name)}</small><b>${Math.round(a)}</b></div>
    <div class="fc-mid">
      <span class="fc-bar"><i style="width:${(a / (a + b)) * 100}%; background:${mine.color}"></i><i style="background:${them.color}"></i></span>
      <b>${verdict}</b>
      <small class="muted">media dei voti nel ruolo · tipi ed evoluzioni in partita possono ribaltarla</small>
    </div>
    <div class="fc-side" style="--team:${them.color}"><small>${esc(them.name)}</small><b>${Math.round(b)}</b></div>
  </div>`;
}

/** Chi della tua rosa ha il tipo giusto (o sbagliato) contro la palestra. */
function typeHints(save: SaveData, type: PokeType): string {
  const name = (p: OwnedPokemon) => esc(nameOf(p));
  const strong = save.roster.filter((p) => typeMultiplier(POKEDEX[p.speciesKey].types, [type]) > 1);
  const weak = save.roster.filter((p) => typeMultiplier([type], POKEDEX[p.speciesKey].types) > 1);
  const list = (ps: OwnedPokemon[], cls: string) =>
    ps.length ? ps.map((p) => `<span class="chip ${cls}">${name(p)}</span>`).join(' ') : '<span class="muted">nessuno</span>';
  return `<div class="type-hints">
    <div><small>Forti contro il tipo ${TYPE_NAMES[type]}</small><div>${list(strong, 'chip-mint')}</div></div>
    <div><small>Deboli contro il tipo ${TYPE_NAMES[type]}</small><div>${list(weak, 'chip-pink')}</div></div>
  </div>`;
}

const trainerTypeLabel = (t: LeagueTrainer) => (t.type ? TYPE_NAMES[t.type] : 'Mista');

function leagueCard(save: SaveData, league: NonNullable<Challenges['league']>, mine: TeamSetup | null, problem: string | null): string {
  const { run, opponent, team } = league;
  const label = (id: string) =>
    id === YOU
      ? `<b class="you">${esc(save.clubName)}</b>`
      : `${esc(trainerById(id)!.name)} <span class="chip type-chip mini-chip" style="--team:${trainerById(id)!.color}">${trainerTypeLabel(trainerById(id)!)}</span>`;

  let status: string;
  let action: string;
  if (!run || run.champion) {
    status = run
      ? run.champion === YOU
        ? `Hai vinto l'edizione ${run.edition}! Puoi difendere il titolo in una nuova edizione.`
        : `Edizione ${run.edition} vinta da ${esc(trainerById(run.champion!)!.name)}. Iscriviti a una nuova edizione per riprovare.`
      : 'Torneo a eliminazione diretta a 8: quarti, semifinale e finale. Sorteggio a ogni edizione; in caso di pareggio, rigori.';
    action = `<button class="primary big" data-join>${run ? 'Nuova edizione' : 'Iscriviti alla Lega'}</button>`;
  } else {
    const round = ROUND_NAMES[currentRound(run)];
    status = `Edizione ${run.edition} · ${round}: affronti <b>${esc(opponent!.name)}</b> (${esc(opponent!.title)}, ${opponent!.type ? `tipo ${TYPE_NAMES[opponent!.type]}` : 'squadra mista'}), livello ${opponent!.level}. Se perdi sei eliminato.`;
    action = `<button class="primary big" data-play="league" ${problem ? 'disabled' : ''}>Gioca ${round.toLowerCase()}</button>`;
  }

  // tabellone: una colonna per turno, più il campione
  const columns = ROUND_NAMES.map((name, r) => {
    const matches = run && run.rounds[r]
      ? pairs(run, r).map(([a, b]) => {
          const res = run.results.find((x) => x.round === r && x.a === a && x.b === b) ?? run.results.find((x) => x.round === r && x.a === b && x.b === a);
          const score = (id: string) => {
            if (!res) return '';
            const i = res.a === id ? 0 : 1;
            return `${res.score[i]}${res.pens ? ` <small>(${res.pens[i]})</small>` : ''}`;
          };
          const row = (id: string) => `<div class="bk-row ${res?.winner === id ? 'win' : res ? 'lose' : ''}">
            <span>${label(id)}</span><span class="bk-score">${score(id)}</span></div>`;
          return `<div class="bk-match ${a === YOU || b === YOU ? 'mine' : ''}">${row(a)}${row(b)}</div>`;
        }).join('')
      : Array.from({ length: 4 >> r }, () => '<div class="bk-match empty"><div class="bk-row"><span class="muted">da decidere</span></div><div class="bk-row"><span class="muted">da decidere</span></div></div>').join('');
    return `<div class="bk-col"><small class="muted">${name}</small><div class="bk-list">${matches}</div></div>`;
  }).join('');
  const champ = run?.champion ? label(run.champion) : '<span class="muted">?</span>';

  return `<section class="card challenge league" style="--team:#e8a317">
    <div class="challenge-head">
      <span class="badge-medal big"></span>
      <div>
        <small class="muted">Altopiano Blu · ${save.titles ? `titoli vinti: ${save.titles}` : 'nessun titolo ancora'}</small>
        <h2>Lega Pokémon</h2>
        <p class="muted">${status}</p>
      </div>
      ${action}
    </div>
    ${run ? `<div class="bracket">${columns}<div class="bk-col bk-champ"><small class="muted">Campione</small><div class="bk-list"><div class="bk-match"><div class="bk-row win">${champ}</div></div></div></div></div>` : ''}
    ${opponent?.type ? typeHints(save, opponent.type) : ''}
    ${mine && team && opponent ? forecastHtml(mine, team) : ''}
    ${team && opponent ? `<details><summary>Squadra di ${esc(opponent.name)}</summary>${teamTable(team)}</details>` : ''}
  </section>`;
}

const KIND_LABEL = { city: 'Città', route: 'Percorso', dungeon: 'Luogo' } as const;

/** Mappa illustrata di Kanto: luoghi, collegamenti, dove sei e dove puoi andare. */
function mapSvg(save: SaveData, ch: Challenges, actions: HubActions): string {
  const links = KANTO_LINKS.map(([a, b]) => {
    const la = locationById(a);
    const lb = locationById(b);
    const open = la.badges <= save.badges && lb.badges <= save.badges;
    return `<line x1="${la.x}" y1="${la.y}" x2="${lb.x}" y2="${lb.y}" class="km-link ${open ? 'open' : ''}" />`;
  }).join('');
  const nodes = KANTO.map((l) => {
    const locked = l.badges > save.badges || (!!l.requiresChampion && !save.titles);
    const here = l.id === ch.location.id;
    const go = actions.canTravel(l.id);
    const gymDone = l.gym !== undefined && l.gym < save.badges;
    const r = l.kind === 'city' ? 15 : 9;
    const color = l.gym !== undefined ? GYMS[l.gym].color : l.league ? '#e8a317' : l.kind === 'dungeon' ? 'var(--lilac-deep)' : 'var(--mint-deep)';
    const title = locked
      ? l.requiresChampion && l.badges <= save.badges ? `${l.name}: si apre dopo aver vinto la Lega` : `${l.name}: servono ${l.badges} medaglie`
      : here ? `${l.name}: sei qui` : go ? `Vai a ${l.name}` : `${l.name}: non è collegato a dove sei`;
    const shape = l.kind === 'dungeon'
      ? `<rect x="${l.x - r}" y="${l.y - r}" width="${r * 2}" height="${r * 2}" rx="5" transform="rotate(45 ${l.x} ${l.y})" style="fill:${color}" />`
      : `<circle cx="${l.x}" cy="${l.y}" r="${r}" style="fill:${color}" />`;
    return `<g class="km-node ${l.kind} ${locked ? 'locked' : ''} ${here ? 'here' : ''} ${go ? 'go' : ''}" ${go ? `data-go="${l.id}"` : ''}>
      <title>${esc(title)}</title>
      ${here ? `<circle cx="${l.x}" cy="${l.y}" r="${r + 9}" class="km-here" />` : ''}
      ${shape}
      ${gymDone ? `<text x="${l.x}" y="${l.y + 5}" class="km-star">✦</text>` : ''}
      ${locked ? `<text x="${l.x}" y="${l.y + 4}" class="km-lock">${l.requiresChampion && l.badges <= save.badges ? '★' : l.badges}</text>` : ''}
      <text x="${l.x}" y="${l.y + r + 15}" class="km-label">${esc(l.name)}</text>
    </g>`;
  }).join('');
  return `<svg viewBox="0 0 1000 700" class="kanto-map" role="img" aria-label="Mappa di Kanto">
    <rect x="0" y="0" width="1000" height="700" rx="28" class="km-sea" />
    <path d="M40 36 H962 V548 Q880 600 760 572 Q660 548 590 600 Q520 640 440 606 Q340 586 250 600 Q150 612 110 570 L40 570 Z" class="km-land" />
    <circle cx="200" cy="652" r="34" class="km-land" />
    <circle cx="300" cy="664" r="22" class="km-land" />
    ${links}${nodes}
  </svg>`;
}

function trainerCard(loc: KantoLocation, t: Challenges['trainers'][number], problem: string | null): string {
  const all = [...t.team.roster.map((r) => r.inst), ...(t.team.bench ?? [])];
  return `<div class="trainer ${t.defeated ? 'done' : ''}">
    <div>
      <b>${esc(t.trainer.name)}</b> <small>Lv ${trainerLevel(loc, t.trainer)}</small>
      <div class="mini-team">${all.map((i) => `<img src="${spriteUrl(POKEDEX[i.speciesKey].dex)}" alt="" title="${esc(POKEDEX[i.speciesKey].name)}">`).join('')}</div>
    </div>
    ${t.defeated
      ? '<span class="chip chip-mint">Battuto ✦</span>'
      : `<button class="primary" data-trainer="${t.trainer.id}" ${problem ? 'disabled' : ''}>Sfida</button>`}
  </div>`;
}

function renderMap(main: HTMLElement, save: SaveData, ch: Challenges, actions: HubActions) {
  const problem = lineupProblem(save);
  const mine = problem ? null : clubTeam(save);
  const loc = ch.location;

  const badges = GYMS.map((g, i) => {
    const won = i < save.badges;
    const current = i === save.badges;
    return `<div class="badge-slot ${won ? 'won' : ''} ${current ? 'current' : ''}" style="--team:${g.color}" title="${esc(`${g.badge} · ${g.leader}, ${g.city}`)}">
      <span class="badge-medal"></span>
      <b>${esc(g.badge.replace('Medaglia ', ''))}</b>
      <small>${esc(g.leader)}</small>
    </div>`;
  }).join('');

  // palestra della città: chiusa, da sfidare o già vinta
  let gymSection = '';
  if (loc.gym !== undefined) {
    const g = GYMS[loc.gym];
    if (ch.gym && ch.gymTeam) {
      gymSection = `<section class="card challenge" style="--team:${ch.gym.color}">
        <div class="challenge-head">
          <span class="badge-medal big"></span>
          <div>
            <small class="muted">Palestra di ${esc(ch.gym.city)} · livello ${ch.gym.level}</small>
            <h2>${esc(ch.gym.leader)} <span class="chip type-chip" style="--team:${ch.gym.color}">${TYPE_NAMES[ch.gym.type]}</span></h2>
            <p class="muted">Vinci per la <b>${esc(ch.gym.badge)}</b>. Schiera sempre <b>${esc(POKEDEX[ch.gym.signature].name)}</b>; gli altri cambiano a ogni sfida.</p>
          </div>
          <button class="primary big" data-play="gym" ${problem ? 'disabled' : ''}>Sfida ${esc(ch.gym.leader)}</button>
        </div>
        ${typeHints(save, ch.gym.type)}
        ${mine ? forecastHtml(mine, ch.gymTeam) : ''}
        <details><summary>Squadra di ${esc(ch.gym.leader)}</summary>${teamTable(ch.gymTeam)}</details>
      </section>`;
    } else if (loc.gym < save.badges) {
      gymSection = `<div class="toast">Palestra di ${esc(g.leader)}: ${esc(g.badge)} già ottenuta ✦</div>`;
    } else {
      gymSection = `<div class="toast warn">Palestra di ${esc(g.leader)} chiusa: prima serve la ${esc(GYMS[save.badges].badge)} di ${esc(GYMS[save.badges].leader)}.</div>`;
    }
  }

  let legendarySection = '';
  if (loc.legendary) {
    const sp = POKEDEX[loc.legendary.key];
    if (ch.legendary) {
      const boss = [...ch.legendary.roster.map((r) => r.inst), ...(ch.legendary.bench ?? [])].find((i) => i.speciesKey === sp.key)!;
      legendarySection = `<section class="card challenge legendary" style="--team:#e8a317">
        <div class="challenge-head">
          <img class="legend-sprite" src="${spriteUrl(sp.dex)}" alt="">
          <div>
            <small class="muted">Leggendario · livello ${boss.level}</small>
            <h2>${esc(sp.name)} ${sp.types.map((t) => `<span class="chip type-chip" style="--team:#e8a317">${TYPE_NAMES[t]}</span>`).join(' ')}</h2>
            <p class="muted">Guida una squadra di selvatici di questa zona. <b>Se vinci, si unisce a te.</b> Se perdi puoi riprovare quando vuoi.</p>
          </div>
          <button class="primary big" data-play="legendary" ${problem ? 'disabled' : ''}>Sfida ${esc(sp.name)}</button>
        </div>
        ${mine ? forecastHtml(mine, ch.legendary) : ''}
        <details><summary>La sua squadra</summary>${teamTable(ch.legendary)}</details>
      </section>`;
    } else {
      legendarySection = `<div class="toast">${esc(sp.name)} si è già unito alla tua squadra ✦</div>`;
    }
  }
  const trainers = ch.trainers.length
    ? `<section class="card"><h3>Allenatori</h3>${ch.trainers.map((t) => trainerCard(loc, t, problem)).join('')}</section>`
    : '';
  const wild = loc.wild.length
    ? `<section class="card"><h3>Pokémon selvatici</h3>
        <div class="wild">${loc.wild.map((k) => `<span class="wild-mon"><img src="${spriteUrl(POKEDEX[k].dex)}" alt=""><small>${esc(POKEDEX[k].name)}</small></span>`).join('')}</div>
      </section>`
    : '';
  const wildLevel = Math.round(ch.wild.roster.reduce((a, r) => a + r.inst.level, 0) / ch.wild.roster.length);
  const wildMatch = `<section class="card wild-match">
    <div>
      <b>Partitella con i selvatici</b> <small>livello ~${wildLevel} · ripetibile</small>
      <p class="muted">Gioca contro i Pokémon selvatici ${loc.wild.length ? 'di questa zona' : 'dei dintorni'}: se vinci, qualcuno può chiederti di unirsi alla squadra.
      Fa anche esperienza (poca, se sei già più forte di loro).</p>
      <div class="mini-team">${[...ch.wild.roster.map((r) => r.inst), ...(ch.wild.bench ?? [])].map((i) => `<img src="${spriteUrl(POKEDEX[i.speciesKey].dex)}" alt="" title="${esc(POKEDEX[i.speciesKey].name)}">`).join('')}</div>
    </div>
    <button class="primary" data-play="wild" ${problem ? 'disabled' : ''}>Gioca la partitella</button>
  </section>`;

  const destinations = neighbors(loc.id).map((id) => {
    const l = locationById(id);
    const champ = !!l.requiresChampion && !save.titles;
    const locked = l.badges > save.badges || champ;
    const why = l.badges > save.badges ? `${l.badges} medaglie` : 'dopo la Lega';
    return `<button data-go="${id}" ${locked ? 'disabled' : ''} title="${locked ? `Si apre: ${why}` : `Vai a ${esc(l.name)}`}">${esc(l.name)}${locked ? ` <small>${why}</small>` : ''}</button>`;
  }).join('');
  const fly = save.badges >= FLY_BADGES
    ? KANTO.filter((l) => l.kind === 'city' && l.id !== loc.id && save.visited.includes(l.id))
        .map((l) => `<button data-go="${l.id}">${esc(l.name)}</button>`).join('')
    : '';

  main.innerHTML = `
    ${problem ? `<div class="toast warn">${esc(problem)} Vai su Formazione.</div>` : ''}
    <div class="kanto">
      <div class="card map-card">
        ${mapSvg(save, ch, actions)}
        <p class="muted map-legend">Tocca un luogo evidenziato per spostarti. Cerchi grandi: città · cerchi piccoli: percorsi · rombi: grotte e luoghi speciali · il numero indica le medaglie che servono${save.badges >= FLY_BADGES ? ' · con la Medaglia Tuono puoi volare nelle città già visitate' : ''}.</p>
      </div>
      <div class="loc-panel">
        <section class="card loc-head">
          <small class="muted">${KIND_LABEL[loc.kind]} · allenatori di livello ~${loc.level}</small>
          <h2>${esc(loc.name)}</h2>
          <div class="destinations"><small>Vai a:</small>${destinations}</div>
          ${fly ? `<div class="destinations"><small>Volo:</small>${fly}</div>` : ''}
        </section>
        ${gymSection}
        ${ch.league ? leagueCard(save, ch.league, mine, problem) : ''}
        ${legendarySection}
        ${trainers}
        ${wild}
        ${wildMatch}
      </div>
    </div>
    <section class="card badge-case">
      <h3>Medaglie <small>${save.badges}/${GYMS.length}</small></h3>
      <div class="badges">${badges}</div>
    </section>
    <details class="rules card">
      <summary>Come funziona il gioco</summary>
      <ul>
        <li><b>Mappa</b>: ti sposti nei luoghi vicini; le medaglie aprono nuove zone come nei giochi e dalla Medaglia Tuono puoi volare nelle città già visitate. Sui percorsi ci sono allenatori da battere una volta e la partitella con i selvatici, ripetibile.</li>
        <li><b>Leggendari</b>: Zapdos alla Centrale Elettrica, Articuno alle Isole Spumarine, Moltres sulla Via Vittoria e Mewtwo nella Grotta Ignota (aperta dopo aver vinto la Lega). Guidano una squadra di selvatici: se vinci, si uniscono a te.</li>
        <li><b>Nuovi Pokémon</b>: niente lotte né Poké Ball. Se vinci la partitella con i selvatici, di solito uno chiede di unirsi alla squadra e tu decidi se accettare. Chi evolve si convince più facilmente, i Pokémon già forti e rari molto meno, e conta anche come ha giocato contro di te. La rosa non ha limiti.</li>
        <li><b>Palestre</b>: si battono in ordine, ognuna nella sua città; ognuna ha un tipo e un livello fisso. Vincere dà la medaglia.</li>
        <li><b>Esperienza</b>: come nei giochi, un avversario di livello più alto rende di più; uno più debole di te rende poco.</li>
        <li><b>Statistiche</b>: Attacco e Difesa sono il valore più alto tra fisico e speciale; Velocità è quanto corre; i PV sono la resistenza. Partono dalle statistiche di Bulbapedia e crescono con livello e allenamento.</li>
        <li><b>Tipi</b>: contano molto. Il vantaggio dei giochi qui vale ×1.25 (lo svantaggio ×0.8) e pesa su contrasti, danni e parate: contro una palestra schiera chi ha il tipo giusto.</li>
        <li><b>KO</b>: a 0 PV un Pokémon resta fermo per 6 minuti e rientra con metà dei PV; dal secondo KO solo con un quarto.</li>
        <li><b>Falli</b>: chi entra con tanto Attacco e poca Difesa è irruento. In area è rigore, vicino alla porta punizione, lontano si riparte subito.</li>
        <li><b>Calci piazzati</b>: rimesse laterali con i piedi come nel calcio a 5; sugli angoli e sui cross vince il duello aereo chi ha Difesa, PV e altezza.</li>
        <li><b>Portiere</b>: para con Difesa, PV e Velocità; più è alto, più porta copre (Onix!).</li>
        <li><b>Evoluzione</b>: la barra lilla si riempie con gol, assist, parate e contrasti vinti. Se il livello lo permette puoi evolvere, senza limiti. A fine gara tutti tornano allo stadio base.</li>
        <li><b>Cambi</b>: al massimo ${MAX_SUBS} sostituzioni a partita con le riserve; chi esce non rientra. Utili per rimpiazzare un Pokémon KO o senza PV.</li>
      </ul>
    </details>`;

  main.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((b) => {
    b.onclick = () => {
      if (!lineupProblem(save)) actions.play(b.dataset.play as ChallengeKind);
    };
  });
  main.querySelectorAll<HTMLButtonElement>('[data-trainer]').forEach((b) => {
    b.onclick = () => {
      if (!lineupProblem(save)) actions.play('trainer', b.dataset.trainer);
    };
  });
  main.querySelectorAll<HTMLElement>('[data-go]').forEach((el) => {
    el.addEventListener('click', () => actions.travel(el.dataset.go!));
  });
  main.querySelector<HTMLButtonElement>('[data-join]')?.addEventListener('click', actions.joinLeague);
}
