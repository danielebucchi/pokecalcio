import { dailyPlan } from '../game/daily';
import { exportTeam } from '../game/friendCode';
import { WEATHER, weatherText } from '../game/weather';
import { AUTO_EVO_KEY, CLUB_COLORS, SPEEDS, SPEED_KEY, resetCoach, savedSpeed } from './settings';
import { canVibrate, musicEnabled, setSfx, setVibe, sfxEnabled, vibeEnabled } from './sound';
import { installMode, promptInstall } from './pwa';
import { matchupRows, suggestedLineup } from '../game/matchup';
import { whereToFind } from '../game/dexGuide';
import { ACHIEVEMENTS, ACHIEVEMENT_SESSIONS, achievementById } from '../game/achievements';
import { POKEDEX, TYPE_NAMES, type PokeType } from '../data/pokedex';
import { GYMS, type Gym } from '../game/gyms';
import {
  FLY_BADGES, KANTO, KANTO_LINKS, RIVAL_STEPS, eventLevel, locationById, neighbors, trainerLevel, type KantoLocation, type RouteTrainer,
} from '../game/kanto';
import {
  ROUND_NAMES, YOU, currentRound, pairs, trainerById, type LeagueRun, type LeagueTrainer,
} from '../game/league';
import { typeMultiplier } from '../game/typechart';
import { FORMATIONS, type FormationKey } from '../game/formations';
import {
  DRILLS, EV_STAT_CAP, MAX_LEVEL, levelCap,
  applyDrill, currentStats, drillBlock, drillPreview, drillStat, expToNext, suggestedDrill, type Drill,
} from '../game/progression';
import {
  BENCH_MAX, ROSTER_MAX, SESSIONS_PER_PLACE, autoBench, autoLineup, benchOf, bestRating, bestRole, eventChoices, eventState, eventsFound as eventsTaken, exportSave, releasable, depositPokemon, undoDeposit, boxLock, withdrawPokemon, TO_BOX, rivalGate, teachTechnique, techniquesAvailable, trainerById as routeTrainer, findOwned, lineupProblem, ratingsOf,
  type OwnedPokemon, type SaveData,
} from '../game/save';
import { MAX_TECHNIQUES, knows, type PokemonInstance, type Role } from '../game/stats';
import { MAX_SUBS, type TeamSetup } from '../match/engine';
import { clubTeam, evolvedForm, gymLevel } from '../match/teams';
import { SIDE_MISSIONS, claimReward, missionComplete, rewardLabel } from '../game/rewards';
import { BADGE_BONUS, BADGE_BONUS_PCT, TECHNIQUES, techniqueById, type TechniqueId } from '../game/techniques';
import { esc, evoLine, teamTable } from './common';
import { medalHtml, spriteUrl } from './sprites';
import { bindThemeToggle, currentTheme, setTheme, themeToggleHtml } from './theme';

export type HubTab = 'squad' | 'training' | 'map' | 'missions';

export type ChallengeKind = 'gym' | 'league' | 'trainer' | 'wild' | 'legendary' | 'event' | 'champion' | 'rematch';

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
  /** Il Campione Blu, quando hai vinto il torneo e manca l'ultima sfida. */
  champion: TeamSetup | null;
  /** Rivincita con il capopalestra della città, dopo aver vinto la Lega. */
  rematch: TeamSetup | null;
}

/** L'invito a installare l'app è stato chiuso (resta il link in fondo alla pagina). */
const INSTALL_DISMISS_KEY = 'pokecalcio-install-dismissed';

export interface HubState {
  tab: HubTab;
  /** Esito dell'ultima sessione di allenamento. */
  message: string | null;
  /** Posizione della formazione selezionata sul campo. */
  slot: number;
  /** Pokémon che stai per lasciare andare (aspetta il secondo tocco). */
  releasing?: string | null;
  /** Amichevole: il codice dell'amico incollato e l'eventuale errore. */
  friendCode?: string;
  friendError?: string | null;
  /** Ordine e filtro per tipo di tribuna e PC di Bill. */
  sort?: RosterSort;
  typeFilter?: PokeType | '';
  /** Pokémon appena mandato nel PC: si può annullare per qualche secondo. */
  undo?: string | null;
  /** Pokémon del Box da ritirare, in attesa di scegliere chi ci va al suo posto (rosa piena). */
  withdrawing?: string | null;
  /** Tecnica che stai per insegnare, "tecnica:uid" (aspetta il secondo tocco). */
  teaching?: string | null;
  /** Pokémon a cui stai dando un soprannome (uid). */
  renaming?: string | null;
  /** Pannello esporta/importa salvataggio aperto. */
  savePanel?: 'export' | 'import' | 'settings' | null;
  importCode?: string;
  importConfirm?: boolean;
  importError?: string | null;
}

export interface HubActions {
  /** Il salvataggio è cambiato: salva e ridisegna. */
  changed(): void;
  play(kind: ChallengeKind, trainerId?: string, skip?: boolean): void;
  /** Spostati in un luogo della mappa. */
  travel(id: string): void;
  canTravel(id: string): boolean;
  /** Nuova edizione della Lega, con nuovo sorteggio. */
  joinLeague(): void;
  reset(): void;
  /** Importa un codice di salvataggio: null se è andato bene, altrimenti il motivo. */
  importSave(code: string): string | null;
  /** Sfida del giorno. */
  playDaily(skip?: boolean): void;
  /** Amichevole contro la squadra di un amico (codice): null se parte, altrimenti il motivo. */
  playFriendly(code: string, skip?: boolean): string | null;
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

const STAT_NAMES: Record<Drill, string> = { att: 'Attacco', dif: 'Difesa', vel: 'Velocità', pv: 'PV' };
const sprite = (p: PokemonInstance) => spriteUrl(POKEDEX[p.speciesKey].dex, p.shiny);
/** Nome da mostrare: il soprannome se c'è, altrimenti la specie. */
const nameOf = (p: PokemonInstance) => esc(plainName(p)) + (p.shiny ? ' <span class="shiny-star" title="Shiny">✨</span>' : '');
/** Nome senza escape, per i messaggi (che vengono escapati quando si mostrano). */
const plainName = (p: PokemonInstance) => p.nickname || POKEDEX[p.speciesKey].name;

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
  // pallini sulle schede: qualcosa da fare lì dentro
  const rewardsReady = SIDE_MISSIONS.filter((m) => missionComplete(save, m) && !save.rewards.includes(m.id)).length;
  const tabs: [HubTab, string, string][] = [
    ['squad', 'Formazione', ''],
    ['training', 'Allenamento', save.sessionsLeft ? `<span class="badge">${save.sessionsLeft}</span>` : techniquesAvailable(save).length ? '<span class="badge" title="Tecniche da insegnare">!</span>' : ''],
    ['map', '<span class="lbl-long">Mappa di Kanto</span><span class="lbl-short">Mappa</span>', ''],
    ['missions', 'Missioni', rewardsReady ? `<span class="badge" title="Premi da ritirare">${rewardsReady}</span>` : ''],
  ];
  const showWelcome = save.matchday === 1 && !localStorage.getItem(WELCOME_KEY);

  app.innerHTML = `
    <div class="topbar">
      <span class="brand">Poké<span>.</span>Calcio</span>
      <span class="sparkle">✦</span>
      <span class="tb-extra">Calcio a 5 con le statistiche di Bulbapedia</span>
      <span class="sparkle">✦</span>
      <span class="tb-keep">Medaglie ${save.badges}/${GYMS.length}</span>
      ${save.titles ? `<span class="sparkle tb-extra">✦</span><span class="tb-extra">Campione della Lega ×${save.titles}</span>` : ''}
      ${themeToggleHtml()}
    </div>
    <header class="hub-head" style="--team:${save.color}">
      <div class="club">
        <h1>${esc(save.clubName)}</h1>
        ${achievementById(save.title) ? `<span class="club-title">🏆 ${esc(achievementById(save.title)!.name)}</span>` : ''}
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
    ${installMode() && !localStorage.getItem(INSTALL_DISMISS_KEY) ? `<section class="card install-card">
      <img src="/icons/icon-192.png" alt="">
      <div><b>Installa PokéCalcio</b>
      <small class="muted">${installMode() === 'ios'
        ? 'Si apre a schermo intero dalla Home, funziona anche senza rete e Safari non cancella il salvataggio. In Safari tocca <b>Condividi</b> (il quadrato con la freccia) e poi <b>«Aggiungi alla schermata Home»</b>.'
        : 'Si apre a schermo intero come un\'app, funziona anche senza rete e il salvataggio è più al sicuro.'}</small></div>
      <span class="nudge-actions">${installMode() === 'prompt' ? '<button class="primary" data-install>Installa</button>' : ''}<button class="link" data-install-dismiss>${installMode() === 'ios' ? 'Ho capito' : 'No grazie'}</button></span>
    </section>` : ''}
    ${save.badges > (save.backupBadges ?? 0) ? `<section class="card backup-nudge">
      <span class="ach-icon">💾</span>
      <div><b>Hai una medaglia in più: salva una copia della carriera</b>
      <small class="muted">Il salvataggio vive solo in questo browser: se cancelli i dati o cambi telefono lo perdi. Il codice si reimporta da «Importa salvataggio».</small></div>
      <span class="nudge-actions"><button class="primary" data-backup="export">Esporta ora</button><button class="link" data-backup="later">Più tardi</button></span>
    </section>` : ''}
    <nav class="tabs">${tabs.map(([k, l, extra]) => `<button data-tab="${k}" class="${state.tab === k ? 'on' : ''}">${l}${extra}</button>`).join('')}</nav>
    <main id="tab"></main>
    <footer class="hub-foot">
      ${savePanelHtml(save, state)}
      <button class="link" data-save-panel="settings">⚙️ Impostazioni</button>
      <button class="link" data-save-panel="export">Esporta salvataggio</button>
      <button class="link" data-save-panel="import">Importa salvataggio</button>
      ${installMode() ? '<button class="link" data-install-again>Installa l\'app</button>' : ''}
      <button id="reset" class="link">Ricomincia la carriera da zero</button>
    </footer>`;

  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    b.onclick = () => {
      state.tab = b.dataset.tab as HubTab;
      state.message = null;
      state.undo = null;
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
  // esporta / importa: un pannello sopra i link in fondo
  // installazione come app
  app.querySelector<HTMLButtonElement>('[data-install]')?.addEventListener('click', () => void promptInstall());
  app.querySelector<HTMLButtonElement>('[data-install-dismiss]')?.addEventListener('click', () => {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    renderHub(app, save, ch, state, actions);
  });
  app.querySelector<HTMLButtonElement>('[data-install-again]')?.addEventListener('click', () => {
    if (installMode() === 'prompt') return void promptInstall();
    localStorage.removeItem(INSTALL_DISMISS_KEY);
    renderHub(app, save, ch, state, actions);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  // promemoria di backup: una volta per medaglia
  app.querySelectorAll<HTMLButtonElement>('[data-backup]').forEach((b) => {
    b.onclick = () => {
      save.backupBadges = save.badges;
      if (b.dataset.backup === 'export') state.savePanel = 'export';
      actions.changed();
      if (state.savePanel === 'export') app.querySelector('.save-panel')?.scrollIntoView({ block: 'center' });
    };
  });
  app.querySelectorAll<HTMLButtonElement>('[data-save-panel]').forEach((b) => {
    b.onclick = () => {
      const which = b.dataset.savePanel as 'export' | 'import' | 'settings';
      state.savePanel = state.savePanel === which ? null : which;
      // esportata a mano: il promemoria aspetta la prossima medaglia
      if (state.savePanel === 'export' && save.badges > (save.backupBadges ?? 0)) {
        save.backupBadges = save.badges;
        actions.changed();
        app.querySelector('.save-panel')?.scrollIntoView({ block: 'center' });
        return;
      }
      state.importError = null;
      state.importConfirm = false;
      renderHub(app, save, ch, state, actions);
      app.querySelector('.save-panel')?.scrollIntoView({ block: 'center' });
    };
  });
  // impostazioni
  const reopen = () => {
    renderHub(app, save, ch, state, actions);
    app.querySelector('.save-panel')?.scrollIntoView({ block: 'center' });
  };
  app.querySelectorAll<HTMLButtonElement>('[data-club-color]').forEach((b) => {
    b.onclick = () => {
      save.color = b.dataset.clubColor!;
      actions.changed();
      app.querySelector('.save-panel')?.scrollIntoView({ block: 'center' });
    };
  });
  app.querySelector<HTMLInputElement>('[data-club-color-custom]')?.addEventListener('change', (e) => {
    save.color = (e.target as HTMLInputElement).value;
    actions.changed();
    app.querySelector('.save-panel')?.scrollIntoView({ block: 'center' });
  });
  app.querySelectorAll<HTMLButtonElement>('[data-set-theme]').forEach((b) => {
    b.onclick = () => {
      setTheme(b.dataset.setTheme as 'light' | 'dark');
      reopen();
    };
  });
  app.querySelectorAll<HTMLButtonElement>('[data-set-speed]').forEach((b) => {
    b.onclick = () => {
      localStorage.setItem(SPEED_KEY, b.dataset.setSpeed!);
      reopen();
    };
  });
  app.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((c) => {
    c.onchange = () => {
      const on = c.checked;
      if (c.dataset.setting === 'sfx') setSfx(on);
      else if (c.dataset.setting === 'music') localStorage.setItem('pokecalcio-music', on ? '1' : '0');
      else if (c.dataset.setting === 'vibe') setVibe(on);
      else if (c.dataset.setting === 'autoevo') localStorage.setItem(AUTO_EVO_KEY, on ? '1' : '0');
    };
  });
  app.querySelector<HTMLButtonElement>('[data-reset-coach]')?.addEventListener('click', (e) => {
    resetCoach();
    (e.currentTarget as HTMLButtonElement).textContent = 'Fatto: li rivedrai alla prossima partita ✓';
  });
  app.querySelector<HTMLButtonElement>('[data-copy-save]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const area = app.querySelector<HTMLTextAreaElement>('.save-panel textarea')!;
    try {
      await navigator.clipboard.writeText(area.value);
      btn.textContent = 'Copiato ✓';
    } catch {
      // niente permesso per gli appunti (http sul telefono): si seleziona e si copia a mano
      area.select();
      btn.textContent = 'Selezionato: copia a mano';
    }
  });
  app.querySelector<HTMLButtonElement>('[data-import-save]')?.addEventListener('click', () => {
    const code = app.querySelector<HTMLTextAreaElement>('.save-panel textarea')!.value;
    state.importCode = code;
    if (!state.importConfirm) {
      state.importConfirm = true;
      state.importError = null;
      renderHub(app, save, ch, state, actions);
      return;
    }
    const err = actions.importSave(code);
    if (err) {
      state.importError = err;
      state.importConfirm = false;
      renderHub(app, save, ch, state, actions);
    }
  });
  document.getElementById('reset')!.onclick = () => {
    if (confirm('Cancellare la carriera (rosa, livelli, risultati) e ripartire da zero?')) actions.reset();
  };

  const main = document.getElementById('tab')!;
  if (state.tab === 'squad') renderSquad(main, save, state, actions);
  else if (state.tab === 'training') renderTraining(main, save, state, actions);
  else if (state.tab === 'missions') renderMissions(main, save, state, actions);
  else renderMap(main, save, ch, actions, state);
}

// ───────────────────────────── missioni ─────────────────────────────

/**
 * Missioni: cosa fare adesso (con i consigli, ma senza dire la strada), il percorso completo verso la vittoria
 * (8 medaglie e Lega) e le missioni facoltative per chi vuole completare tutto.
 */
function renderMissions(main: HTMLElement, save: SaveData, state: HubState, actions: HubActions) {
  const lineupLv = (() => {
    const lv = save.lineup.map((uid) => findOwned(save, uid)?.level ?? 0);
    return lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : 0;
  })();
  const champion = save.titles > 0;
  const gym = save.badges < GYMS.length ? GYMS[save.badges] : null;

  // allenatori dei luoghi appena aperti (quelli della "zona" di questa medaglia)
  const zone = KANTO.filter((l) => l.badges === save.badges && !l.requiresChampion);
  // le sfide con Blu sono missioni principali: qui si contano solo gli altri allenatori
  const isRival = (id: string) => RIVAL_STEPS.some((r) => r.trainer === id);
  const zoneTrainers = zone.flatMap((l) => l.trainers).filter((t) => !isRival(t.id));
  const zoneBeaten = zoneTrainers.filter((t) => save.defeated.includes(t.id)).length;

  // il rivale che ti blocca adesso (la prima sfida con Blu non vinta tra quelle della tua tappa)
  const rival = RIVAL_STEPS.find((r) => !save.defeated.includes(r.trainer) && r.blocks <= save.badges);

  // missione attuale
  let title: string;
  let detail: string;
  if (rival) {
    const loc = locationById(rival.location);
    const t = routeTrainer(rival.trainer)!;
    const lvT = trainerLevel(loc, t);
    title = `Batti il rivale Blu a ${esc(loc.name)}`;
    detail = `<p class="muted"><b>Tappa fondamentale.</b> ${esc(rival.what)} Squadra mista, già evoluta come la tua.</p>
      <div class="mission-tips">
        <span class="chip ${lineupLv >= lvT ? 'chip-mint' : 'chip-pink'}">i tuoi titolari Lv ${lineupLv}, i suoi Lv ${lvT}</span>
        <span class="chip">tetto di livello ${levelCap(save)}</span></div>`;
  } else if (gym) {
    const lvTeam = gymLevel(gym);
    const levelTip = lineupLv >= lvTeam
      ? `<span class="chip chip-mint">i tuoi titolari (Lv ${lineupLv}) sono al suo livello</span>`
      : `<span class="chip chip-pink">i tuoi titolari sono Lv ${lineupLv}, la sua squadra Lv ${lvTeam}: fai esperienza</span>`;
    title = `Sconfiggi ${esc(gym.leader)} a ${esc(gym.city)}`;
    detail = `<p class="muted">In palio la <b>${esc(gym.badge)}</b>. Palestra di tipo <b>${TYPE_NAMES[gym.type]}</b>: porta chi è forte contro questo tipo, lui sceglie i suoi studiando la tua squadra.</p>
      <div class="mission-tips">${levelTip}
        ${zoneTrainers.length ? `<span class="chip">allenatori della zona battuti ${zoneBeaten}/${zoneTrainers.length}</span>` : ''}
        <span class="chip">tetto di livello ${levelCap(save)}</span></div>
      ${typeHints(save, gym.type)}`;
  } else if (!champion && save.league?.champion === YOU && save.league.championMatch === 'pending') {
    title = 'Batti il Campione Blu';
    detail = `<p class="muted">Hai vinto il torneo della Lega: all'Altopiano Blu ti aspetta l'ultima sfida, il Campione. Squadra mista, al massimo dell'allenamento.</p>
      <div class="mission-tips"><span class="chip">i tuoi titolari: Lv ${lineupLv}</span></div>`;
  } else if (!champion) {
    title = 'Vinci la Lega Pokémon';
    detail = `<p class="muted">All'Altopiano Blu: tre sfide a eliminazione diretta contro allenatori famosi di tutte le regioni, poi il Campione Blu. Se perdi, puoi iscriverti a una nuova edizione.</p>
      <div class="mission-tips"><span class="chip">i tuoi titolari: Lv ${lineupLv}</span><span class="chip">gli allenatori della Lega: Lv 64-70</span></div>`;
  } else {
    title = 'Sei il Campione di Kanto ✦';
    detail = `<p class="muted">Hai vinto la Lega ${save.titles === 1 ? 'una volta' : `${save.titles} volte`}. Ora si è aperta la Grotta Ignota, il tetto di livello è sparito, nelle città ti aspettano le rivincite con i capipalestra e puoi difendere il titolo in una nuova edizione (ogni titolo rende tutti più forti).</p>`;
  }
  // missioni principali: le 8 medaglie, le sfide con il rivale e la Lega
  const rivalsBeaten = RIVAL_STEPS.filter((r) => save.defeated.includes(r.trainer)).length;
  const mainTotal = GYMS.length + RIVAL_STEPS.length + 1;
  const mainDone = save.badges + rivalsBeaten + (champion ? 1 : 0);

  // facoltative, ognuna con il suo premio (sorpresa finché non la completi)
  const bar = (n: number, tot: number) => `<span class="bar"><i style="width:${tot ? Math.min(100, (n / tot) * 100) : 0}%"></i></span>`;
  const sideRows = SIDE_MISSIONS.map((m) => {
    const [n, tot] = m.progress(save);
    const complete = n >= tot;
    const claimed = save.rewards.includes(m.id);
    const prize = claimed
      ? `<span class="chip chip-mint">Premio ritirato: ${esc(rewardLabel(save, m))}</span>`
      : complete
        ? `<button class="primary" data-reward="${m.id}">🎁 Ritira il premio: ${esc(rewardLabel(save, m))}</button>`
        : '<span class="chip" title="Completa la missione per scoprirlo">🎁 premio</span>';
    return `<div class="${complete ? 'done' : ''}" data-mission="${m.id}">
      <span class="ms-side-head"><b>${m.name}</b> <span>${n}/${tot}${complete ? ' ✓' : ''}</span></span>
      ${bar(n, tot)}
      <div class="ms-prize">${prize}</div>
    </div>`;
  }).join('');

  main.innerHTML = `
    <section class="card mission-now" style="--team:${rival ? '#5b8def' : gym?.color ?? '#e8a317'}">
      <small class="muted">Prossima missione · medaglie ${save.badges}/${GYMS.length}</small>
      <h2>${title}</h2>
      ${detail}
      <div class="ms-progress" title="Le 8 medaglie, le sfide con il rivale e la Lega">
        <span>Progresso</span>
        ${bar(mainDone, mainTotal)}
        <b>${mainDone}/${mainTotal}${mainDone >= mainTotal ? ' ✓' : ''}</b>
      </div>
    </section>
    ${state.message ? `<div class="toast">${esc(state.message)}</div>` : ''}
    ${extraHtml(save, state)}
    <div class="missions-grid">
      <details class="card fold side-missions" ${SIDE_MISSIONS.some((m) => missionComplete(save, m) && !save.rewards.includes(m.id)) ? 'open' : ''}>
        <summary><b>Missioni facoltative</b> <small class="muted">${SIDE_MISSIONS.filter((m) => save.rewards.includes(m.id)).length}/${SIDE_MISSIONS.length} premi ritirati</small></summary>
        <div class="ms-side">${sideRows}</div>
      </details>
      ${hallOfFameHtml(save)}
      ${achievementsHtml(save)}
      ${pokedexHtml(save)}
      ${careerStatsHtml(save)}
    </div>`;

  // Pokédex: dove trovare il Pokémon toccato (il nome resta segreto finché non l'hai visto)
  const dexInfo = main.querySelector<HTMLElement>('.dex-info');
  main.querySelectorAll<HTMLButtonElement>('[data-dex]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.dex!;
      const sp = POKEDEX[k];
      const known = save.dex.seen.includes(k);
      main.querySelectorAll('.dex-cell.picked').forEach((c) => c.classList.remove('picked'));
      b.classList.add('picked');
      dexInfo!.innerHTML = `<b>#${String(sp.dex).padStart(3, '0')} ${known ? esc(sp.name) : '???'}</b> · ${esc(whereToFind(k))}`;
    };
  });

  // sfida del giorno e amichevole
  main.querySelectorAll<HTMLButtonElement>('[data-daily]').forEach((b) => {
    b.onclick = () => actions.playDaily(b.dataset.daily === 'skip');
  });
  main.querySelector<HTMLButtonElement>('[data-copy-team]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const area = main.querySelector<HTMLTextAreaElement>('[data-team-code]')!;
    try {
      await navigator.clipboard.writeText(area.value);
    } catch {
      area.select();
      document.execCommand('copy');
    }
    btn.textContent = 'Copiato ✓';
  });
  main.querySelector<HTMLTextAreaElement>('[data-friend-code]')?.addEventListener('input', (e) => {
    state.friendCode = (e.target as HTMLTextAreaElement).value;
  });
  main.querySelectorAll<HTMLButtonElement>('[data-friendly]').forEach((b) => {
    b.onclick = () => {
      const err = actions.playFriendly(state.friendCode ?? '', b.dataset.friendly === 'skip');
      if (err) {
        state.friendError = err;
        renderMissions(main, save, state, actions);
      } else state.friendError = null;
    };
  });
  // titolo del club: uno degli obiettivi raggiunti (toccando di nuovo lo si toglie)
  main.querySelectorAll<HTMLButtonElement>('[data-title]').forEach((b) => {
    b.onclick = () => {
      save.title = save.title === b.dataset.title ? undefined : b.dataset.title;
      actions.changed();
    };
  });

  // premi: se la rosa è piena, per un Pokémon in premio si sceglie chi lasciare andare
  main.querySelectorAll<HTMLButtonElement>('[data-reward]').forEach((b) => {
    b.onclick = () => {
      const m = SIDE_MISSIONS.find((x) => x.id === b.dataset.reward)!;
      const needsSpace = 'pokemon' in m.reward && save.roster.length >= ROSTER_MAX;
      if (!needsSpace) {
        state.message = claimReward(save, m);
        actions.changed();
        return;
      }
      const box = main.querySelector<HTMLElement>(`[data-mission="${m.id}"] .ms-prize`)!;
      box.innerHTML = `<p class="swap-title">Rosa piena (${save.roster.length}/${ROSTER_MAX}): chi mandi nel PC di Bill?</p>
        <div class="swap-list"><button data-release-for="${TO_BOX}">📦 Il nuovo arrivato</button>${releasable(save)
          .map((p) => `<button data-release-for="${p.uid}"><img src="${sprite(p)}" alt=""> ${nameOf(p)} <small>Lv${p.level}</small></button>`)
          .join('')}</div>`;
      box.querySelectorAll<HTMLButtonElement>('[data-release-for]').forEach((r) => {
        r.onclick = () => {
          state.message = claimReward(save, m, r.dataset.releaseFor);
          actions.changed();
        };
      });
    };
  });
}

/** Impostazioni: colore del club, tema, suoni, velocità ed evoluzione automatica, fumetti guida. */
function settingsHtml(save: SaveData): string {
  const toggle = (key: string, label: string, on: boolean) =>
    `<label class="set-toggle"><input type="checkbox" data-setting="${key}" ${on ? 'checked' : ''}> ${label}</label>`;
  return `<section class="card save-panel settings">
    <h3>Impostazioni</h3>
    <div class="set-row"><b>Colore del club</b>
      <div class="swatches">${CLUB_COLORS.map(([c, n]) => `<button class="swatch ${save.color === c ? 'on' : ''}" data-club-color="${c}" title="${n}" style="--c:${c}"></button>`).join('')}
        <label class="swatch custom" title="Un altro colore" style="--c:${save.color}"><input type="color" value="${save.color}" data-club-color-custom></label></div>
      <small class="muted">È il colore della tua squadra in campo e nell'intestazione. Se l'avversario ne ha uno troppo simile, in partita lui ne usa un altro.</small></div>
    <div class="set-row"><b>Tema</b>
      <div class="seg"><button data-set-theme="light" class="${currentTheme() === 'light' ? 'on' : ''}">Chiaro</button><button data-set-theme="dark" class="${currentTheme() === 'dark' ? 'on' : ''}">Scuro</button></div></div>
    <div class="set-row"><b>Suoni</b>
      ${toggle('sfx', 'Effetti sonori', sfxEnabled())}
      ${toggle('music', 'Musica in partita', musicEnabled())}
      ${canVibrate() ? toggle('vibe', 'Vibrazione', vibeEnabled()) : ''}</div>
    <div class="set-row"><b>Partite</b>
      <div class="seg">${SPEEDS.map((s) => `<button data-set-speed="${s}" class="${savedSpeed() === s ? 'on' : ''}">${s}×</button>`).join('')}</div>
      <small class="muted">Velocità con cui partono (in partita la cambi quando vuoi)</small>
      ${toggle('autoevo', 'Evoluzione automatica', localStorage.getItem(AUTO_EVO_KEY) === '1')}</div>
    <div class="set-row"><b>Fumetti guida</b>
      <button data-reset-coach>Rivedili alla prossima partita</button></div>
  </section>`;
}

/** Pannello per esportare o importare la carriera con un codice. */
function savePanelHtml(save: SaveData, state: HubState): string {
  if (state.savePanel === 'settings') return settingsHtml(save);
  if (state.savePanel === 'export') {
    return `<section class="card save-panel">
      <h3>Esporta salvataggio</h3>
      <p class="muted">Copia questo codice e incollalo in «Importa salvataggio» sull'altro dispositivo (o tienilo da parte come copia di sicurezza).</p>
      <textarea readonly rows="4">${esc(exportSave(save))}</textarea>
      <button class="primary" data-copy-save>Copia il codice</button>
    </section>`;
  }
  if (state.savePanel === 'import') {
    return `<section class="card save-panel">
      <h3>Importa salvataggio</h3>
      <p class="muted">Incolla il codice esportato da un altro dispositivo. <b>Sostituisce la carriera attuale</b>: se vuoi tenerla, esportala prima.</p>
      <textarea rows="4" placeholder="PKC1.…">${esc(state.importCode ?? '')}</textarea>
      ${state.importError ? `<p class="toast warn">${esc(state.importError)}</p>` : ''}
      <button class="${state.importConfirm ? 'danger' : 'primary'}" data-import-save>${state.importConfirm ? 'Sicuro? Sostituisce la carriera attuale' : 'Importa'}</button>
    </section>`;
  }
  return '';
}

/** Testata: dove sei e il prossimo obiettivo, con il bottone giusto per il luogo in cui ti trovi. */
function headerGoal(save: SaveData, ch: Challenges, problem: string | null): string {
  const here = `Sei a ${esc(ch.location.name)}`;
  if (ch.gym) {
    return `<div class="next" style="--team:${ch.gym.color}">
        <small>${here} · palestra di livello ${gymLevel(ch.gym)}</small>
        <span class="next-name">${esc(ch.gym.leader)} <span class="chip type-chip" data-type="${ch.gym.type}" style="--team:${ch.gym.color}">${TYPE_NAMES[ch.gym.type]}</span></span>
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
      <li><b>Allenamento</b><span>Ogni luogo nuovo ti dà ${SESSIONS_PER_PLACE} sessioni per migliorare le statistiche dei tuoi Pokémon.</span></li>
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
  const bench = benchOf(save);
  const onBench = new Set(bench.map((p) => p.uid));

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
          : onBench.has(p.uid) ? '<span class="chip chip-sky">in panchina</span>' : '<span class="chip">in tribuna</span>';
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

  const undone = state.undo ? save.box.find((p) => p.uid === state.undo) : undefined;
  main.innerHTML = `
    ${state.message ? `<div class="toast">${esc(state.message)}</div>` : ''}
    ${undone ? `<div class="toast undo-toast">${nameOf(undone)} è stato trasferito nel PC di Bill! <button data-undo>Annulla</button></div>` : ''}
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
        ${benchHtml(save, bench, state)}
        ${boxHtml(save, state)}
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
      const out = save.lineup[i];
      if (j >= 0) save.lineup[j] = out; // era già in campo: si scambiano di posto
      else if (out && save.bench.includes(uid)) save.bench[save.bench.indexOf(uid)] = out; // dalla panchina: chi esce prende il suo posto
      save.lineup[i] = uid;
      actions.changed();
    };
  });
  (document.getElementById('formation') as HTMLSelectElement).onchange = (e) => {
    save.formation = (e.target as HTMLSelectElement).value as FormationKey;
    // stessi Pokémon, ruoli nuovi: si riparte dalla formazione migliore per il modulo
    save.lineup = autoLineup(save);
    save.bench = autoBench(save);
    actions.changed();
  };
  document.getElementById('auto')!.onclick = () => {
    save.lineup = autoLineup(save);
    save.bench = autoBench(save);
    actions.changed();
  };
  // panchina: chi è in tribuna entra (se c'è posto), chi è in panchina esce
  main.querySelectorAll<HTMLButtonElement>('[data-bench]').forEach((b) => {
    b.onclick = () => {
      const uid = b.dataset.bench!;
      const now = benchOf(save).map((p) => p.uid);
      if (now.includes(uid)) save.bench = now.filter((u) => u !== uid);
      else if (now.length < BENCH_MAX) save.bench = [...now, uid];
      actions.changed();
    };
  });
  // mandare nel Box: secondo tocco per confermare (durante l'avventura non si ritira)
  main.querySelectorAll<HTMLButtonElement>('[data-release]').forEach((b) => {
    b.onclick = () => {
      const uid = b.dataset.release!;
      if (state.releasing !== uid) {
        state.releasing = uid;
        renderSquad(main, save, state, actions);
        return;
      }
      state.releasing = null;
      if (depositPokemon(save, uid)) {
        // si può tornare indietro per qualche secondo
        state.undo = uid;
        setTimeout(() => {
          if (state.undo !== uid) return;
          state.undo = null;
          if (main.isConnected && state.tab === 'squad') renderSquad(main, save, state, actions);
        }, UNDO_MS);
      }
      actions.changed();
    };
  });
  main.querySelector<HTMLButtonElement>('[data-undo]')?.addEventListener('click', () => {
    if (state.undo) undoDeposit(save, state.undo);
    state.undo = null;
    actions.changed();
  });
  // ordine e filtro di tribuna e PC
  main.querySelector<HTMLSelectElement>('[data-sort]')?.addEventListener('change', (e) => {
    state.sort = (e.target as HTMLSelectElement).value as RosterSort;
    renderSquad(main, save, state, actions);
  });
  main.querySelector<HTMLSelectElement>('[data-type-filter]')?.addEventListener('change', (e) => {
    state.typeFilter = (e.target as HTMLSelectElement).value as PokeType | '';
    renderSquad(main, save, state, actions);
  });
  // PC di Bill: ritiro (con la rosa piena si sceglie chi ci va al suo posto)
  main.querySelectorAll<HTMLButtonElement>('[data-withdraw]').forEach((b) => {
    b.onclick = () => {
      const uid = b.dataset.withdraw!;
      if (save.roster.length < ROSTER_MAX) {
        withdrawPokemon(save, uid);
        actions.changed();
        return;
      }
      state.withdrawing = state.withdrawing === uid ? null : uid;
      renderSquad(main, save, state, actions);
    };
  });
  main.querySelectorAll<HTMLButtonElement>('[data-swap-out]').forEach((b) => {
    b.onclick = () => {
      withdrawPokemon(save, state.withdrawing!, b.dataset.swapOut);
      state.withdrawing = null;
      actions.changed();
    };
  });
}

/** PC di Bill: chi non sta nei 14 della rosa. Durante l'avventura si deposita soltanto. */
function boxHtml(save: SaveData, state: HubState): string {
  if (!save.box.length) return '';
  const lock = boxLock(save);
  const rows = sortFilter(save.box, state)
    .map((p) => {
      const { role: best } = bestRole(p);
      const picking = state.withdrawing === p.uid;
      const swap = picking
        ? `<div class="swap-list">${releasable(save)
            .map((r) => `<button data-swap-out="${r.uid}"><img src="${sprite(r)}" alt=""> ${nameOf(r)} <small>Lv${r.level}</small></button>`)
            .join('')}</div>`
        : '';
      return `<div class="reserve">
        <img src="${sprite(p)}" alt="">
        <span class="reserve-body"><b>${nameOf(p)}</b> <small>Lv${p.level}</small>
          <small class="muted"><span class="role role-${best}">${best}</span> voto ${Math.round(bestRating(p))}</small></span>
        ${lock ? '' : `<span class="reserve-actions"><button data-withdraw="${p.uid}">${picking ? 'Annulla' : 'Ritira'}</button></span>`}
      </div>${picking ? `<p class="swap-title">Rosa piena: chi va nel PC al suo posto?</p>${swap}` : ''}`;
    })
    .join('');
  return `<details class="card fold box-card" ${state.withdrawing ? 'open' : ''}>
    <summary><b>PC di Bill</b> <small class="muted">${save.box.length} Pokémon${lock ? ' · ' + esc(lock) : ''}</small></summary>
    ${rows}
  </details>`;
}

/** Per quanto resta il bottone Annulla dopo un deposito nel PC. */
const UNDO_MS = 8000;

type RosterSort = 'voto' | 'livello' | 'dex' | 'nome';
const SORTS: [RosterSort, string][] = [['voto', 'Voto'], ['livello', 'Livello'], ['dex', 'N° Pokédex'], ['nome', 'Nome']];

/** Tribuna e PC ordinati e filtrati come scelto nella barra sopra la tribuna. */
function sortFilter(list: OwnedPokemon[], state: HubState): OwnedPokemon[] {
  const t = state.typeFilter;
  const out = t ? list.filter((p) => POKEDEX[p.speciesKey].types.includes(t)) : [...list];
  const key = state.sort ?? 'voto';
  const name = (p: OwnedPokemon) => p.nickname || POKEDEX[p.speciesKey].name;
  return out.sort((a, b) =>
    key === 'voto' ? bestRating(b) - bestRating(a)
    : key === 'livello' ? b.level - a.level || bestRating(b) - bestRating(a)
    : key === 'dex' ? POKEDEX[a.speciesKey].dex - POKEDEX[b.speciesKey].dex
    : name(a).localeCompare(name(b), 'it'));
}

function sortBarHtml(save: SaveData, state: HubState): string {
  const types = [...new Set([...save.roster, ...save.box].flatMap((p) => POKEDEX[p.speciesKey].types))].sort((a, b) => TYPE_NAMES[a].localeCompare(TYPE_NAMES[b], 'it'));
  return `<div class="sort-bar">
    <label>Ordina <select data-sort>${SORTS.map(([k, l]) => `<option value="${k}" ${(state.sort ?? 'voto') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Tipo <select data-type-filter><option value="">tutti</option>${types.map((t) => `<option value="${t}" ${state.typeFilter === t ? 'selected' : ''}>${TYPE_NAMES[t]}</option>`).join('')}</select></label>
  </div>`;
}

/** Panchina (le uniche riserve che entrano in partita) e il resto della rosa, in tribuna. */
function benchHtml(save: SaveData, bench: OwnedPokemon[], state: HubState): string {
  const allStands = save.roster.filter((p) => !save.lineup.includes(p.uid) && !bench.includes(p));
  const stands = sortFilter(allStands, state);
  const full = bench.length >= BENCH_MAX;
  const row = (p: OwnedPokemon, inBench: boolean) => {
    const { role: best } = bestRole(p);
    const confirm = state.releasing === p.uid;
    return `<div class="reserve ${inBench ? 'on-bench' : ''}">
      <img src="${sprite(p)}" alt="">
      <span class="reserve-body"><b>${nameOf(p)}</b> <small>Lv${p.level}</small>
        <small class="muted"><span class="role role-${best}">${best}</span> voto ${Math.round(bestRating(p))}</small></span>
      <span class="reserve-actions">
        <button data-bench="${p.uid}" ${!inBench && full ? 'disabled title="Panchina piena: togline uno"' : ''}>${inBench ? 'Togli' : 'In panchina'}</button>
        <button class="${confirm ? 'danger' : 'link'}" data-release="${p.uid}" title="Mandalo nel PC di Bill: libera un posto nella rosa${save.titles ? '' : ' (lo ritiri da Campione)'}">${confirm ? 'Sicuro?' : 'Nel PC'}</button>
      </span>
    </div>`;
  };
  return `<section class="card bench-card">
    <h3>Panchina <small>${bench.length}/${BENCH_MAX} · in partita possono entrare solo loro</small></h3>
    ${bench.length ? bench.map((p) => row(p, true)).join('') : '<p class="muted">Nessuno in panchina: senza riserve non potrai fare cambi.</p>'}
    <h3>Tribuna <small>rosa ${save.roster.length}/${ROSTER_MAX}</small></h3>
    ${allStands.length > 2 || save.box.length > 2 ? sortBarHtml(save, state) : ''}
    ${stands.length ? stands.map((p) => row(p, false)).join('') : allStands.length ? '<p class="muted">Nessuno di questo tipo in tribuna.</p>' : '<p class="muted">Tutta la rosa è in campo o in panchina.</p>'}
    ${save.roster.length > ROSTER_MAX ? `<p class="toast warn">La rosa supera il limite di ${ROSTER_MAX}: per far posto ai nuovi Pokémon mandane qualcuno nel PC.</p>` : ''}
  </section>`;
}

// ───────────────────────────── allenamento ─────────────────────────────

function renderTraining(main: HTMLElement, save: SaveData, state: HubState, actions: HubActions) {
  const cap = levelCap(save);
  const roleOf = new Map(save.lineup.map((uid, i) => [uid, FORMATIONS[save.formation].slots[i]?.role ?? null]));
  const card = (p: OwnedPokemon) => {
    const g = currentStats(p);
    const role = roleOf.get(p.uid) ?? null;
    const suggestion = suggestedDrill(role);
    const capped = p.level >= cap && p.level < MAX_LEVEL;
    const expPct = p.level >= MAX_LEVEL || capped ? 100 : (p.exp / expToNext(p.level)) * 100;
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
          ${state.renaming === p.uid
            ? `<span class="nick-edit"><input data-nick="${p.uid}" maxlength="12" value="${esc(p.nickname ?? '')}" placeholder="${esc(POKEDEX[p.speciesKey].name)}" autocomplete="off">
                <button class="primary" data-nick-save="${p.uid}">Salva</button><button data-nick-cancel>Annulla</button></span>`
            : `<b>${nameOf(p)}</b>${p.nickname ? ` <small class="muted">${esc(POKEDEX[p.speciesKey].name)}</small>` : ''}
               <button class="link nick-btn" data-nick-open="${p.uid}" title="Dai un soprannome">✎</button>`}
          <small>Lv${p.level}</small>
          ${role ? `<span class="role role-${role}">${role}</span>` : '<span class="chip">riserva</span>'}
          ${(p.techniques ?? []).map((id) => `<span class="chip chip-star" title="${esc(techniqueById(id)!.description)}">MT ${esc(techniqueById(id)!.name)}</span>`).join(' ')}
          ${p.career?.matches ? `<small class="muted career-line">${p.career.matches} pres. · ${p.career.goals} gol · ${p.career.assists} assist${p.career.saves ? ` · ${p.career.saves} parate` : ''}</small>` : ''}
          <div class="bar exp" title="Esperienza verso il livello ${p.level + 1}"><i style="width:${expPct}%"></i></div>
          <small>${p.level >= MAX_LEVEL ? 'livello massimo' : capped ? `al tetto: sale con la prossima medaglia` : `${p.exp}/${expToNext(p.level)} esperienza`}</small>
        </div>
      </div>
      ${statRows}
      <div class="drills">${drills}</div>
    </div>`;
  };

  const starters = save.lineup.map((uid) => findOwned(save, uid)).filter((p) => p !== undefined);
  const reserves = save.roster.filter((p) => !save.lineup.includes(p.uid));
  const dots = (n: number, min: number) => Array.from({ length: Math.max(min, n) }, (_, i) => `<i class="${i < n ? 'full' : ''}"></i>`).join('');
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  main.innerHTML = `
    <div class="card training-head">
      <div class="training-pools">
        <div>
          <span class="session-dots" title="Sessioni di allenamento">${dots(save.sessionsLeft, SESSIONS_PER_PLACE)}</span>
          <b>${save.sessionsLeft ? count(save.sessionsLeft, 'sessione', 'sessioni') : 'Nessuna sessione'}</b> <small class="muted">ATT · DIF · VEL · PV</small>
          <p class="muted">Migliorano le statistiche. Ne ricevi ${SESSIONS_PER_PLACE} la prima volta che arrivi in un luogo; quelle che non usi restano per dopo.</p>
        </div>
      </div>
      <div>
        <p class="muted">Il bottone evidenziato è quello che serve di più al ruolo.</p>
        ${cap < MAX_LEVEL ? `<p class="muted"><b>Tetto di livello: ${cap}</b>. Oltre non si guadagna esperienza: si alza a ogni medaglia${save.badges >= 8 ? ' e sparisce quando vinci la Lega' : ''}.</p>` : ''}
        ${bonusLine(save)}
      </div>
      ${save.sessionsLeft ? '' : '<button class="primary" id="go-play">Vai alla mappa</button>'}
    </div>
    ${state.message ? `<div class="toast">${esc(state.message)}</div>` : ''}
    ${techniquesHtml(save, state)}
    <h3>Titolari</h3>
    <div class="tgrid">${starters.map(card).join('')}</div>
    ${reserves.length ? `<h3>Riserve <small>— in partita guadagnano meno esperienza</small></h3>
    <div class="tgrid">${reserves.map(card).join('')}</div>` : ''}`;

  document.getElementById('go-play')?.addEventListener('click', () => document.querySelector<HTMLButtonElement>('[data-tab="map"]')!.click());
  main.querySelectorAll<HTMLButtonElement>('button[data-drill]').forEach((b) => {
    b.onclick = () => {
      const p = findOwned(save, b.dataset.uid!);
      const drill = b.dataset.drill as Drill;
      if (!p || drillBlock(save, p, drill)) return;
      state.message = applyDrill(save, p, drill);
      actions.changed();
    };
  });
  // soprannomi: ✎ apre il campo sulla carta, Invio o Salva conferma (vuoto = torna il nome della specie)
  main.querySelectorAll<HTMLButtonElement>('[data-nick-open]').forEach((b) => {
    b.onclick = () => {
      state.renaming = b.dataset.nickOpen!;
      renderTraining(main, save, state, actions);
      const input = main.querySelector<HTMLInputElement>(`[data-nick="${state.renaming}"]`);
      input?.focus();
      input?.select();
    };
  });
  const saveNick = (uid: string) => {
    const p = findOwned(save, uid);
    const value = main.querySelector<HTMLInputElement>(`[data-nick="${uid}"]`)?.value.trim() ?? '';
    if (p) p.nickname = value || undefined;
    state.renaming = null;
    actions.changed();
  };
  main.querySelectorAll<HTMLButtonElement>('[data-nick-save]').forEach((b) => (b.onclick = () => saveNick(b.dataset.nickSave!)));
  main.querySelectorAll<HTMLInputElement>('[data-nick]').forEach((i) => {
    i.onkeydown = (e) => {
      if (e.key === 'Enter') saveNick(i.dataset.nick!);
      if (e.key === 'Escape') {
        state.renaming = null;
        renderTraining(main, save, state, actions);
      }
    };
  });
  main.querySelector<HTMLButtonElement>('[data-nick-cancel]')?.addEventListener('click', () => {
    state.renaming = null;
    renderTraining(main, save, state, actions);
  });
  // tecniche: "Insegna ›" apre la scelta del Pokémon, poi si conferma (è per sempre)
  const redraw = () => {
    renderTraining(main, save, state, actions);
    main.querySelector('.technique .teach-grid, .technique .teach-confirm')?.closest('.technique')?.scrollIntoView({ block: 'nearest' });
  };
  main.querySelectorAll<HTMLButtonElement>('[data-teach-open]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.teachOpen!;
      // stesso pulsante: chiude (anche "Annulla" dalla conferma torna alla griglia)
      state.teaching = state.teaching === id ? null : id;
      redraw();
    };
  });
  main.querySelectorAll<HTMLButtonElement>('[data-teach-pick]').forEach((b) => {
    b.onclick = () => {
      state.teaching = b.dataset.teachPick!;
      redraw();
    };
  });
  main.querySelectorAll<HTMLButtonElement>('[data-teach-confirm]').forEach((b) => {
    b.onclick = () => {
      const [id, uid] = b.dataset.teachConfirm!.split(':') as [TechniqueId, string];
      state.teaching = null;
      if (teachTechnique(save, id, uid)) {
        state.message = `${plainName(findOwned(save, uid)!)} ha imparato ${techniqueById(id)!.name}!`;
        actions.changed();
      }
    };
  });
}

/** Statistiche della carriera: classifica della rosa e partite importanti. */
function careerStatsHtml(save: SaveData): string {
  const rows = [...save.roster, ...save.box]
    .filter((p) => p.career?.matches)
    .sort((a, b) => b.career!.goals - a.career!.goals || b.career!.assists - a.career!.assists || b.career!.matches - a.career!.matches)
    .map((p, i) => {
      const c = p.career!;
      return `<tr><td>${i === 0 && c.goals ? '👑 ' : ''}<img class="mini-sprite" src="${sprite(p)}" alt="">${nameOf(p)}</td>
        <td>${c.matches}</td><td><b>${c.goals}</b></td><td>${c.assists}</td><td>${c.saves}</td></tr>`;
    })
    .join('');
  const history = save.history
    .slice(0, 12)
    .map((h) => `<li class="${h.won ? 'won' : 'lost'}">
      <span class="h-res">${h.won ? 'V' : 'S'}</span>
      <span class="h-title">${esc(h.title)}</span>
      <b>${h.score[0]}–${h.score[1]}${h.penalties ? ` <small>(rig. ${h.penalties[0]}–${h.penalties[1]})</small>` : ''}</b>
    </li>`)
    .join('');
  const r = save.record;
  return `<details class="card career-stats">
    <summary><b>Statistiche</b> <small class="muted">${r.w + r.d + r.l} partite · ${r.w} vinte · gol ${r.gf}–${r.ga}</small></summary>
    ${rows
      ? `<div class="stats-table"><table><thead><tr><th>Pokémon</th><th title="Presenze">Pres.</th><th>Gol</th><th title="Assist">Ass.</th><th title="Parate">Par.</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p class="muted">Gioca qualche partita per vedere i numeri dei tuoi Pokémon.</p>'}
    <h4>Partite importanti</h4>
    ${history ? `<ol class="history">${history}</ol>` : '<p class="muted">Allenatori, rivale, palestre, Lega, leggendari ed eventi finiscono qui.</p>'}
  </details>`;
}

/** Un Pokémon di un luogo, con la Poké Ball se l'hai già preso (in rosa, nel PC o in passato). */
function wildMon(save: SaveData, k: string): string {
  const got = save.dex.caught.includes(k);
  const where = save.roster.some((p) => p.speciesKey === k) ? 'in rosa' : save.box.some((p) => p.speciesKey === k) ? 'nel PC di Bill' : 'già preso in passato';
  return `<span class="wild-mon ${got ? 'got' : ''}" title="${esc(POKEDEX[k].name)}${got ? ` · ${where}` : ''}"><img src="${spriteUrl(POKEDEX[k].dex)}" alt="">${got ? '<span class="owned-ball"></span>' : ''}<small>${esc(POKEDEX[k].name)}</small></span>`;
}

/** Sfida del giorno e amichevole con un amico: partite fuori dalla carriera, senza esperienza. */
function extraHtml(save: SaveData, state: HubState): string {
  const problem = lineupProblem(save);
  const plan = dailyPlan();
  const today = save.daily?.key === plan.key ? save.daily : null;
  const best = today?.best;
  const off = problem ? `disabled title="${esc(problem)}"` : '';
  return `<div class="extra-grid">
    <section class="card daily" style="--team:${plan.color}">
      <small class="muted">Sfida del giorno · ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} · uguale per tutti</small>
      <h3>Squadra di tipo ${typeChip(plan.type)}</h3>
      <div class="mini-team">${plan.species.map((k) => `<img src="${spriteUrl(POKEDEX[k].dex)}" alt="" title="${esc(POKEDEX[k].name)}">`).join('')}</div>
      <p class="muted">Già evoluti, al livello dei tuoi titolari. Gioca quante volte vuoi: conta il risultato migliore. Non dà esperienza.</p>
      <p>${best ? `Oggi: <b>${best.won ? 'vinta' : 'non ancora vinta'}</b>, miglior risultato <b>${best.gf}–${best.ga}</b> in ${today!.tries} ${today!.tries === 1 ? 'tentativo' : 'tentativi'}` : 'Oggi non l\'hai ancora giocata'}${save.dailyWins ? ` · giorni vinti: <b>${save.dailyWins}</b>` : ''}</p>
      <div class="event-actions"><button class="primary" data-daily="play" ${off}>Gioca la sfida</button><button data-daily="skip" ${off}>Salta ⏭</button></div>
    </section>
    <section class="card friendly">
      <small class="muted">Amichevole · senza server, con un codice</small>
      <h3>Sfida un amico</h3>
      <p class="muted">Manda il tuo codice squadra a un amico: incollandolo, gioca contro la tua formazione di adesso (titolari e panchina), guidata dal computer. Tu fai lo stesso con il suo. Non dà esperienza.</p>
      <label class="muted">Il tuo codice squadra</label>
      <textarea readonly rows="2" data-team-code>${problem ? '' : esc(exportTeam(save))}</textarea>
      <button data-copy-team ${off}>Copia il mio codice</button>
      <label class="muted">Il codice del tuo amico</label>
      <textarea rows="2" data-friend-code placeholder="PKS1.…">${esc(state.friendCode ?? '')}</textarea>
      ${state.friendError ? `<p class="toast warn">${esc(state.friendError)}</p>` : ''}
      <div class="event-actions"><button class="primary" data-friendly="play" ${off}>Gioca l'amichevole</button><button data-friendly="skip" ${off}>Salta ⏭</button></div>
    </section>
  </div>`;
}

/** Albo d'Oro: la squadra di ogni titolo, dal più recente. */
function hallOfFameHtml(save: SaveData): string {
  const hall = save.hallOfFame ?? [];
  if (!hall.length) return '';
  const entries = [...hall]
    .reverse()
    .map((h) => `<div class="hof-entry" style="--team:${h.color}">
      <div class="hof-head"><b>${h.title}° titolo</b> <small class="muted">${new Date(h.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(h.club)} · finale ${h.score[0]}–${h.score[1]} con Blu</small></div>
      <div class="hof-team">${h.members
        .map((m) => `<span class="hof-mon">
          <img src="${spriteUrl(POKEDEX[m.form].dex, m.shiny)}" alt="">
          <b>${esc(m.name)}${m.shiny ? ' ✨' : ''}</b>
          <small><span class="role role-${m.role}">${m.role}</span> Lv${m.level}${m.goals ? ` · ⚽ ${m.goals}` : ''}</small>
        </span>`)
        .join('')}</div>
    </div>`)
    .join('');
  return `<details class="card fold hall-of-fame" open>
    <summary><b>🏆 Albo d'Oro</b> <small class="muted">${hall.length} ${hall.length === 1 ? 'titolo' : 'titoli'}</small></summary>
    ${entries}
  </details>`;
}

/** Obiettivi: raggiunti in cima, ognuno si può mostrare come titolo del club. */
function achievementsHtml(save: SaveData): string {
  const done = new Set(save.achievements);
  const rows = [...ACHIEVEMENTS]
    .sort((a, b) => Number(done.has(b.id)) - Number(done.has(a.id)))
    .map((a) => {
      const got = done.has(a.id);
      const shown = save.title === a.id;
      return `<li class="${got ? 'done' : ''}">
        <span class="ach-icon">${got ? '🏆' : '🔒'}</span>
        <span class="ach-body"><b>${esc(a.name)}</b><small class="muted">${esc(a.description)}</small></span>
        ${got ? `<button class="${shown ? 'on' : ''}" data-title="${a.id}" title="${shown ? 'Togli il titolo' : 'Mostralo accanto al nome del club'}">${shown ? 'Titolo ✓' : 'Titolo'}</button>` : ''}
      </li>`;
    })
    .join('');
  return `<details class="card fold achievements">
    <summary><b>Obiettivi</b> <small class="muted">${done.size}/${ACHIEVEMENTS.length} · ognuno vale +${ACHIEVEMENT_SESSIONS} sessione</small></summary>
    <ul class="ach-list">${rows}</ul>
  </details>`;
}

/**
 * Pokédex: le 151 di Kanto sempre tutte in griglia (prese a colori, viste in grigio, mai viste come
 * sagoma), poi le specie delle altre regioni già viste. Toccando una casella si legge dove trovarla.
 */
function pokedexHtml(save: SaveData): string {
  const seen = new Set(save.dex.seen.filter((k) => POKEDEX[k]));
  const caught = new Set(save.dex.caught.filter((k) => POKEDEX[k]));
  const shinies = new Set(save.dex.shiny ?? []);
  const num = (dex: number) => `#${String(dex).padStart(3, '0')}`;
  const cell = (k: string) => {
    const sp = POKEDEX[k];
    const got = caught.has(k);
    const state = got ? 'caught' : seen.has(k) ? 'seen' : 'unseen';
    const shiny = shinies.has(k);
    return `<button class="dex-cell ${state}" data-dex="${k}" title="${esc(`${num(sp.dex)} ${state === 'unseen' ? '???' : sp.name}${shiny ? ' · shiny' : ''}`)}">
      <img src="${spriteUrl(sp.dex, shiny)}" alt="" loading="lazy">${got ? '<span class="owned-ball"></span>' : ''}${shiny ? '<span class="dex-shiny">✨</span>' : ''}
      <small>${num(sp.dex)}</small>
    </button>`;
  };
  const all = Object.keys(POKEDEX).sort((a, b) => POKEDEX[a].dex - POKEDEX[b].dex);
  const kanto = all.filter((k) => POKEDEX[k].dex <= 151);
  const others = all.filter((k) => POKEDEX[k].dex > 151 && seen.has(k));
  const kantoCaught = kanto.filter((k) => caught.has(k)).length;
  return `<details class="card pokedex">
    <summary><b>Pokédex</b> <small class="muted">Kanto ${kantoCaught}/151 · presi ${caught.size} · visti ${seen.size}</small></summary>
    <p class="dex-info muted">Tocca un Pokémon per sapere dove trovarlo.</p>
    <h4>Kanto</h4>
    <div class="dex-grid">${kanto.map(cell).join('')}</div>
    ${others.length ? `<h4>Altre regioni</h4><div class="dex-grid">${others.map(cell).join('')}</div>` : ''}
    <small class="muted">A colori (con la Poké Ball) i Pokémon presi: entrati in squadra o raggiunti evolvendo in partita. In grigio quelli visti in partita, in ombra quelli mai incontrati.</small>
  </details>`;
}

/** Ruolo in campo di un Pokémon (null se è una riserva). */
function slotRole(save: SaveData, uid: string): Role | null {
  const i = save.lineup.indexOf(uid);
  return i >= 0 ? FORMATIONS[save.formation].slots[i]?.role ?? null : null;
}

/** Bonus delle medaglie attivi sulla squadra, come in Rosso/Blu. */
function bonusLine(save: SaveData): string {
  const active = BADGE_BONUS.filter((b) => save.badges > b.badge);
  if (!active.length) return '';
  return `<p class="muted"><b>Bonus delle medaglie</b>: ${active.map((b) => `${b.label} +${BADGE_BONUS_PCT}%`).join(' · ')} su tutta la squadra.</p>`;
}

/** Tecniche delle medaglie (le "MT"): da insegnare, già insegnate o ancora da vincere. */
function techniquesHtml(save: SaveData, state: HubState): string {
  const learners = save.roster.filter((p) => (p.techniques?.length ?? 0) < MAX_TECHNIQUES);
  const rows = TECHNIQUES.map((t) => {
    const gym = GYMS[t.badge];
    const owner = [...save.roster, ...save.box].find((p) => knows(p, t.id));
    let right: string;
    if (t.badge >= save.badges) right = `<span class="chip">🔒 ${esc(gym.badge)}</span>`;
    else if (owner) right = `<span class="chip chip-mint">Insegnata a ${nameOf(owner)}</span>`;
    else if (save.techniquesUsed.includes(t.id)) right = '<span class="chip">Già usata</span>';
    else right = state.teaching?.split(':')[0] === t.id
      ? `<button data-teach-open="${t.id}">Chiudi</button>`
      : `<button class="primary" data-teach-open="${t.id}">Insegna ›</button>`;
    // scelta del Pokémon a tocchi (comoda anche sul telefono), poi conferma
    let picker = '';
    if (state.teaching?.split(':')[0] === t.id && !owner && t.badge < save.badges) {
      const chosen = state.teaching.split(':')[1];
      const who = chosen ? findOwned(save, chosen) : undefined;
      picker = who
        ? `<div class="teach-confirm">
            <img src="${sprite(who)}" alt="">
            <span><b>Insegna ${esc(t.name)} a ${nameOf(who)}?</b><small class="muted">È per sempre: la tecnica non si può più spostare.</small></span>
            <button class="primary" data-teach-confirm="${t.id}:${who.uid}">Insegna</button>
            <button data-teach-open="${t.id}">Annulla</button>
          </div>`
        : `<div class="teach-grid">${learners
            .map((p) => {
              const role = slotRole(save, p.uid);
              return `<button class="teach-pick" data-teach-pick="${t.id}:${p.uid}">
                <img src="${sprite(p)}" alt=""><b>${nameOf(p)}</b>
                <small>${role ? `<span class="role role-${role}">${role}</span>` : 'riserva'} Lv${p.level}${p.techniques?.length ? ` · MT ${p.techniques.length}/${MAX_TECHNIQUES}` : ''}</small>
              </button>`;
            })
            .join('') || `<p class="muted">Tutti i tuoi Pokémon conoscono già ${MAX_TECHNIQUES} tecniche.</p>`}</div>`;
    }
    return `<div class="technique ${t.badge >= save.badges ? 'locked' : ''}" title="${esc(t.description)}">
      <span class="tech-body"><b>${esc(t.name)}</b> <small class="muted">${esc(t.description)}</small></span>
      ${right}
      ${picker}
    </div>`;
  }).join('');
  const todo = techniquesAvailable(save).length;
  // chiusa di default: è una riga, si apre quando serve (con un avviso se ce n'è una da insegnare)
  return `<details class="card techniques" ${state.teaching ? 'open' : ''}>
    <summary><b>MT delle medaglie</b> <small class="muted">${save.techniquesUsed.length}/${TECHNIQUES.length} insegnate</small>
      ${todo ? `<span class="badge" title="Tecniche da insegnare">${todo}</span>` : ''}</summary>
    <div class="tech-list">${rows}</div>
    <small class="muted">Come le MT di Rosso/Blu: ognuna si usa una volta sola e resta per sempre al Pokémon a cui la insegni; un Pokémon ne impara fino a ${MAX_TECHNIQUES}, come le sue quattro mosse.</small>
  </details>`;
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
  const name = (p: OwnedPokemon) => nameOf(p);
  const strong = save.roster.filter((p) => typeMultiplier(POKEDEX[p.speciesKey].types, [type]) > 1);
  const weak = save.roster.filter((p) => typeMultiplier([type], POKEDEX[p.speciesKey].types) > 1);
  const list = (ps: OwnedPokemon[], cls: string) =>
    ps.length ? ps.map((p) => `<span class="chip ${cls}">${name(p)}</span>`).join(' ') : '<span class="muted">nessuno</span>';
  return `<div class="type-hints">
    <div><small>Forti contro il tipo ${TYPE_NAMES[type]}</small><div>${list(strong, 'chip-mint')}</div></div>
    <div><small>Deboli contro il tipo ${TYPE_NAMES[type]}</small><div>${list(weak, 'chip-pink')}</div></div>
  </div>`;
}

/** Etichetta di un tipo: toccandola si apre la sua tabella (vedi typeInfo.ts). */
export const typeChip = (t: PokeType) => `<span class="chip type-tag" data-type="${t}">${TYPE_NAMES[t]}</span>`;

/** Confronto di tipo con la squadra avversaria e formazione consigliata (`key`: quale sfida). */
function matchupHtml(save: SaveData, them: TeamSetup, key: string): string {
  const chips = (ps: OwnedPokemon[], cls: string) =>
    ps.length
      ? ps.map((p) => `<span class="chip ${cls} ${save.lineup.includes(p.uid) ? 'in-lineup' : ''}">${nameOf(p)}</span>`).join(' ')
      : '<span class="muted">nessuno</span>';
  const rows = matchupRows(save, them)
    .map((r) => `<div class="mu-row">
      <span class="mu-them"><img src="${spriteUrl(POKEDEX[r.form].dex)}" alt=""><span><b>${esc(POKEDEX[r.form].name)}</b> <small>Lv${r.level}</small> ${r.types.map(typeChip).join(' ')}</span></span>
      <span class="mu-list"><small>Lo battono</small><span>${chips(r.strong, 'chip-mint')}</span></span>
      <span class="mu-list"><small>Ne soffrono</small><span>${chips(r.weak, 'chip-pink')}</span></span>
    </div>`)
    .join('');
  return `<div class="matchup">
    <div class="mu-actions">
      <button class="primary" data-suggest="${key}">✦ Formazione consigliata</button>
      <small class="muted">sceglie titolari e panchina tenendo conto dei tipi, nel modulo che usi</small>
    </div>
    <details class="fold"><summary><b>Confronto di tipo</b> <small class="muted">chi dei tuoi è forte o debole contro ognuno · con il bordo i titolari</small></summary>${rows}</details>
  </div>`;
}

const trainerTypeLabel = (t: LeagueTrainer) => (t.type ? TYPE_NAMES[t.type] : 'Mista');

function leagueCard(save: SaveData, league: NonNullable<Challenges['league']>, mine: TeamSetup | null, problem: string | null, championTeam: TeamSetup | null): string {
  const { run, opponent } = league;
  let team = league.team;
  const label = (id: string) =>
    id === YOU
      ? `<b class="you">${esc(save.clubName)}</b>`
      : `${esc(trainerById(id)!.name)} <span class="chip type-chip mini-chip" style="--team:${trainerById(id)!.color}">${trainerTypeLabel(trainerById(id)!)}</span>`;

  let status: string;
  let action: string;
  if (run?.champion === YOU && run.championMatch === 'pending' && championTeam) {
    // vinto il torneo: l'ultima sfida è il Campione Blu
    status = `Hai vinto il torneo! <b>Ultima sfida: il Campione Blu</b>, il più forte di Kanto. Battilo e sei Campione; se perdi, l'edizione è persa.`;
    action = `<button class="primary big" data-play="champion" ${problem ? 'disabled' : ''}>Sfida il Campione</button>`;
    team = championTeam;
  } else if (!run || run.champion) {
    status = run
      ? run.champion === YOU && run.championMatch === 'lost'
        ? `Hai vinto il torneo dell'edizione ${run.edition}, ma Blu ha difeso il titolo. Iscriviti a una nuova edizione per riprovarci.`
        : run.champion === YOU
        ? `Hai vinto l'edizione ${run.edition} e battuto Blu! Puoi difendere il titolo in una nuova edizione.`
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
    ${mine && team && (opponent || team === championTeam) ? forecastHtml(mine, team) : ''}
    ${team && (opponent || team === championTeam) ? matchupHtml(save, team, 'league') : ''}
    ${team && (opponent || championTeam) ? `<details><summary>Squadra di ${esc(championTeam && team === championTeam ? 'Blu, Campione' : opponent!.name)}</summary>${teamTable(team)}</details>` : ''}
  </section>`;
}

const KIND_LABEL = { city: 'Città', route: 'Percorso', dungeon: 'Luogo' } as const;

/** Eventi trovati sul totale, per chi vuole completare tutto (senza dire dove sono). */
function eventsFound(save: SaveData): string {
  const total = KANTO.reduce((a, l) => a + (l.events?.length ?? 0), 0);
  return total ? ` <small class="events-found" title="Pokémon degli eventi nascosti che hai ottenuto">· eventi trovati ${eventsTaken(save)}/${total}</small>` : '';
}

/** Sul telefono la mappa disegnata è nascosta: si apre a richiesta e la scelta resta finché non ricarichi. */
let showMapOnPhone = false;

/**
 * Scheda di un luogo dove puoi andare (o chiuso), per il telefono: cosa c'è, se è nuovo e perché è
 * chiuso. Toccandola ci vai.
 */
function placeCard(save: SaveData, l: KantoLocation, fly = false): string {
  const champ = !!l.requiresChampion && !save.titles;
  const rival = rivalGate(save, l);
  const locked = l.badges > save.badges || champ || !!rival;
  const why = l.badges > save.badges ? (l.badges === 1 ? 'serve 1 medaglia' : `servono ${l.badges} medaglie`)
    : champ ? 'si apre dopo la Lega'
    : rival ? `prima batti ${rival.name.replace(/ \(.*\)$/, '')}` : '';
  const facts: string[] = [];
  if (l.gym !== undefined) {
    const g = GYMS[l.gym];
    const state = l.gym < save.badges ? '✓' : l.gym === save.badges ? 'da sfidare' : 'chiusa';
    facts.push(`<span class="chip" style="--team:${g.color}">Palestra ${esc(g.leader)} · ${state}</span>`);
  }
  if (l.league) facts.push('<span class="chip chip-star">Lega Pokémon</span>');
  if (l.legendary && !save.legendaries.includes(l.legendary.key)) facts.push(`<span class="chip chip-star">★ ${esc(POKEDEX[l.legendary.key].name)}</span>`);
  const todo = l.trainers.filter((t) => !save.defeated.includes(t.id)).length;
  if (l.trainers.length) facts.push(`<span class="chip">${todo ? `${todo} ${todo === 1 ? 'allenatore' : 'allenatori'}` : 'allenatori battuti ✓'}</span>`);
  if (!locked && !save.trainedAt.includes(l.id)) facts.push(`<span class="chip chip-mint">+${SESSIONS_PER_PLACE} sessioni</span>`);
  const wild = l.wild.slice(0, 5).map((k) => `<img src="${spriteUrl(POKEDEX[k].dex)}" alt="" title="${esc(POKEDEX[k].name)}">`).join('');
  return `<button class="place ${locked ? 'locked' : ''}" ${locked ? 'disabled' : `data-go="${l.id}"`}>
    <span class="place-head"><b>${esc(l.name)}</b>${!locked && !save.visited.includes(l.id) ? ' <span class="new-badge">Nuovo</span>' : ''} <small>${fly ? 'volo · ' : ''}${KIND_LABEL[l.kind]} · Lv ~${l.level}</small></span>
    ${locked ? `<small class="muted">Chiuso: ${why}</small>` : facts.length ? `<span class="place-facts">${facts.join('')}</span>` : ''}
    ${wild && !locked ? `<span class="place-wild">${wild}</span>` : ''}
    ${locked ? '' : '<span class="place-go">›</span>'}
  </button>`;
}

/** Mappa illustrata di Kanto: luoghi, collegamenti, dove sei e dove puoi andare. */
function mapSvg(save: SaveData, ch: Challenges, actions: HubActions): string {
  const links = KANTO_LINKS.map(([a, b]) => {
    const la = locationById(a);
    const lb = locationById(b);
    const open = la.badges <= save.badges && lb.badges <= save.badges;
    return `<line x1="${la.x}" y1="${la.y}" x2="${lb.x}" y2="${lb.y}" class="km-link ${open ? 'open' : ''}" />`;
  }).join('');
  const nodes = KANTO.map((l) => {
    const rival = rivalGate(save, l);
    const locked = l.badges > save.badges || (!!l.requiresChampion && !save.titles) || !!rival;
    const here = l.id === ch.location.id;
    const go = actions.canTravel(l.id);
    const gymDone = l.gym !== undefined && l.gym < save.badges;
    const fresh = !locked && !save.visited.includes(l.id);
    const r = l.kind === 'city' ? 15 : 9;
    const color = l.gym !== undefined ? GYMS[l.gym].color : l.league ? '#e8a317' : l.kind === 'dungeon' ? 'var(--lilac-deep)' : 'var(--mint-deep)';
    const title = locked
      ? rival && l.badges <= save.badges ? `${l.name}: prima batti il rivale ${rival.name}`
      : l.requiresChampion && l.badges <= save.badges ? `${l.name}: si apre dopo aver vinto la Lega` : `${l.name}: ${l.badges === 1 ? 'serve 1 medaglia' : `servono ${l.badges} medaglie`}`
      : here ? `${l.name}: sei qui` : go ? `Vai a ${l.name}` : `${l.name}: non è collegato a dove sei`;
    const shape = l.kind === 'dungeon'
      ? `<rect x="${l.x - r}" y="${l.y - r}" width="${r * 2}" height="${r * 2}" rx="5" transform="rotate(45 ${l.x} ${l.y})" style="fill:${color}" />`
      : `<circle cx="${l.x}" cy="${l.y}" r="${r}" style="fill:${color}" />`;
    return `<g class="km-node ${l.kind} ${locked ? 'locked' : ''} ${here ? 'here' : ''} ${go ? 'go' : ''}" ${go ? `data-go="${l.id}"` : ''}>
      <title>${esc(title)}</title>
      ${here ? `<circle cx="${l.x}" cy="${l.y}" r="${r + 9}" class="km-here" />` : ''}
      ${shape}
      ${gymDone ? `<text x="${l.x}" y="${l.y + 5}" class="km-star">✦</text>` : ''}
      ${locked ? `<text x="${l.x}" y="${l.y + 4}" class="km-lock">${rival && l.badges <= save.badges ? '!' : l.requiresChampion && l.badges <= save.badges ? '★' : l.badges}</text>` : ''}
      <text x="${l.x}" y="${l.y + r + 15}" class="km-label">${esc(l.name)}</text>
      ${fresh ? `<g class="km-new"><rect x="${l.x - 21}" y="${l.y - r - 19}" width="42" height="14" rx="7" /><text x="${l.x}" y="${l.y - r - 9}">NUOVO</text></g>` : ''}
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
      ${RIVAL_STEPS.some((r) => r.trainer === t.trainer.id) ? '<span class="chip chip-pink">Tappa fondamentale</span>' : ''}
      <div class="mini-team">${all.map((i) => `<img src="${spriteUrl(POKEDEX[i.speciesKey].dex)}" alt="" title="${esc(POKEDEX[i.speciesKey].name)}">`).join('')}</div>
    </div>
    ${t.defeated
      ? '<span class="chip chip-mint">Battuto ✦</span>'
      : `<button class="primary" data-trainer="${t.trainer.id}" ${problem ? 'disabled' : ''}>Sfida</button>`}
  </div>`;
}

function renderMap(main: HTMLElement, save: SaveData, ch: Challenges, actions: HubActions, state: HubState) {
  const message = state.message;
  const problem = lineupProblem(save);
  const mine = problem ? null : clubTeam(save);
  const loc = ch.location;

  const badges = GYMS.map((g, i) => {
    const won = i < save.badges;
    const current = i === save.badges;
    const tech = TECHNIQUES.find((t) => t.badge === i)!;
    const bonus = BADGE_BONUS.find((x) => x.badge === i);
    const prize = `MT ${tech.name}${bonus ? ` · ${bonus.label} +${BADGE_BONUS_PCT}% alla squadra` : ''}`;
    return `<div class="badge-slot ${won ? 'won' : ''} ${current ? 'current' : ''}" style="--team:${g.color}" title="${esc(`${g.badge} · ${g.leader}, ${g.city} · premio: ${prize}`)}">
      ${medalHtml(i, false, won)}
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
          ${medalHtml(loc.gym, true)}
          <div>
            <small class="muted">Palestra di ${esc(ch.gym.city)} · livello ${gymLevel(ch.gym)}</small>
            <h2>${esc(ch.gym.leader)} <span class="chip type-chip" data-type="${ch.gym.type}" style="--team:${ch.gym.color}">${TYPE_NAMES[ch.gym.type]}</span></h2>
            <p class="muted">Vinci per la <b>${esc(ch.gym.badge)}</b>. In campo sempre l'asso <b>${esc(POKEDEX[evolvedForm(ch.gym.signature, gymLevel(ch.gym))].name)}</b> e la contromossa <b>${esc(POKEDEX[evolvedForm(ch.gym.counter, gymLevel(ch.gym))].name)}</b>; gli altri li sceglie <b>studiando la tua squadra</b>: se porti tanti Pokémon di un tipo, lui porta chi li batte. La squadra è già evoluta quanto il livello permette.</p>
          </div>
          <button class="primary big" data-play="gym" ${problem ? 'disabled' : ''}>Sfida ${esc(ch.gym.leader)}</button>
        </div>
        ${mine ? forecastHtml(mine, ch.gymTeam) : ''}
        ${matchupHtml(save, ch.gymTeam, 'gym')}
        <details><summary>Squadra di ${esc(ch.gym.leader)}</summary>${teamTable(ch.gymTeam)}</details>
      </section>`;
    } else if (loc.gym < save.badges && ch.rematch) {
      // dopo il titolo: rivincita, ripetibile, più forte a ogni titolo
      gymSection = `<section class="card challenge" style="--team:${g.color}">
        <div class="challenge-head">
          ${medalHtml(loc.gym, true)}
          <div>
            <small class="muted">Rivincita · ${esc(g.badge)} già tua · livello ${ch.rematch.roster[0].inst.level}</small>
            <h2>${esc(g.leader)} <span class="chip type-chip" data-type="${g.type}" style="--team:${g.color}">${TYPE_NAMES[g.type]}</span></h2>
            <p class="muted">Dopo il tuo titolo ${esc(g.leader)} si è allenato: squadra evoluta e al massimo. Puoi sfidarlo quando vuoi.</p>
          </div>
          <button class="primary big" data-play="rematch" ${problem ? 'disabled' : ''}>Rivincita</button>
        </div>
        ${mine ? forecastHtml(mine, ch.rematch) : ''}
        ${matchupHtml(save, ch.rematch, 'rematch')}
        <details><summary>Squadra di ${esc(g.leader)}</summary>${teamTable(ch.rematch)}</details>
      </section>`;
    } else if (loc.gym < save.badges) {
      gymSection = `<div class="toast">Palestra di ${esc(g.leader)}: ${esc(g.badge)} già ottenuta ✦</div>`;
    } else if (loc.gym === save.badges && rivalGate(save, loc, true)) {
      gymSection = `<div class="toast warn">${esc(g.leader)} non ti riceve finché non batti il rivale: <b>${esc(rivalGate(save, loc, true)!.name)}</b>, qui sotto.</div>`;
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
            <h2>${esc(sp.name)} ${sp.types.map((t) => `<span class="chip type-chip" data-type="${t}" style="--team:#e8a317">${TYPE_NAMES[t]}</span>`).join(' ')}</h2>
            <p class="muted">Gioca con 4 selvatici di questa zona, senza cambi. <b>Se vinci, si unisce a te.</b> Se perdi puoi riprovare quando vuoi.</p>
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
  // allenatori tutti battuti: la sezione si chiude in una riga, così resta in vista dove andare
  const allBeaten = ch.trainers.length > 0 && ch.trainers.every((t) => t.defeated);
  const trainerList = ch.trainers.map((t) => trainerCard(loc, t, problem)).join('');
  // eventi del luogo, come in Pokémon Giallo: il Pokémon in palio si conquista con una sfida
  // gli eventi sono segreti: la scheda compare solo quando sei sul posto e la condizione è soddisfatta
  // (prima non si vede nulla, nemmeno il lucchetto); una volta ritirato, sparisce
  const events = (loc.events ?? [])
    .filter((ev) => {
      const st = eventState(save, ev);
      return !st.done && !st.missing;
    })
    .map((ev) => {
      const lv = eventLevel(loc, ev);
      const choices = eventChoices(save, ev);
      const again = save.events.includes(ev.id);
      const mons = choices
        .map((k) => wildMon(save, k))
        .join('');
      const buttons = choices
        .map((k) => `<span class="event-play">
          <button class="primary" data-event-play="${ev.id}:${k}" ${problem ? 'disabled' : ''}>Sfida per ${esc(POKEDEX[k].name)}</button>
          <button data-event-skip="${ev.id}:${k}" ${problem ? 'disabled' : ''} title="Si gioca subito senza vederla">Salta ⏭</button>
        </span>`)
        .join('');
      return `<section class="card event">
        <small class="muted">✦ Evento speciale · livello ${lv}${choices.length > 1 ? ' · ne scegli uno' : ''}</small>
        <h3>${esc(ev.title)}</h3>
        <p class="muted">${again ? 'Da Campione puoi avere anche quello che non avevi scelto.' : esc(ev.text)} Per averlo vinci la sua sfida: gioca con 4 selvatici di qui, senza cambi.</p>
        <div class="wild">${mons}</div>
        <div class="event-actions">${buttons}</div>
      </section>`;
    })
    .join('');
  const trainers = !ch.trainers.length
    ? ''
    : allBeaten
      ? `<details class="card trainers-done"><summary><h3>Allenatori <small>tutti battuti ✓</small></h3></summary>${trainerList}</details>`
      : `<section class="card"><h3>Allenatori</h3>${trainerList}</section>`;
  const wild = loc.wild.length
    ? `<section class="card"><h3>Pokémon selvatici</h3>
        <div class="wild">${loc.wild.map((k) => wildMon(save, k)).join('')}</div>
      </section>`
    : '';
  const wildLevel = Math.round(ch.wild.roster.reduce((a, r) => a + r.inst.level, 0) / ch.wild.roster.length);
  const wildAll = [...ch.wild.roster.map((r) => r.inst), ...(ch.wild.bench ?? [])];
  const wildShiny = wildAll.find((i) => i.shiny);
  const wildMatch = `<section class="card wild-match ${wildShiny ? 'has-shiny' : ''}">
    <div>
      <b>Partitella con i selvatici</b> <small>livello ~${wildLevel} · ripetibile</small>
      <p class="muted">Gioca contro i Pokémon selvatici ${loc.wild.length ? 'di questa zona' : 'dei dintorni'}: se vinci, qualcuno può chiederti di unirsi alla squadra.
      Fa anche esperienza (poca, se sei già più forte di loro).</p>
      <div class="mini-team">${wildAll.map((i) => `<img class="${i.shiny ? 'shiny' : ''}" src="${spriteUrl(POKEDEX[i.speciesKey].dex, i.shiny)}" alt="" title="${esc(POKEDEX[i.speciesKey].name)}${i.shiny ? ' ✨ shiny' : ''}">`).join('')}</div>
      ${wildShiny ? `<p class="shiny-note">✨ C'è un <b>${esc(POKEDEX[wildShiny.speciesKey].name)} shiny</b>! Vinci la partitella e chiederà di unirsi a te.</p>` : ''}
    </div>
    <div class="wild-actions">
      <button class="primary" data-play="wild" ${problem ? 'disabled' : ''}>Gioca la partitella</button>
      <button data-skip="wild" ${problem ? 'disabled' : ''} title="Si gioca subito senza vederla: cambi ed evoluzioni li decide la CPU">Salta ⏭ <small>solo risultato</small></button>
    </div>
  </section>`;

  const destinations = neighbors(loc.id).map((id) => {
    const l = locationById(id);
    const champ = !!l.requiresChampion && !save.titles;
    const rival = rivalGate(save, l);
    const locked = l.badges > save.badges || champ || !!rival;
    const why = l.badges > save.badges ? `${l.badges} ${l.badges === 1 ? 'medaglia' : 'medaglie'}` : champ ? 'dopo la Lega' : 'prima batti Blu';
    const fresh = !locked && !save.visited.includes(id);
    return `<button data-go="${id}" ${locked ? 'disabled' : ''} title="${locked ? `Si apre: ${why}` : `Vai a ${esc(l.name)}`}">${esc(l.name)}${locked ? ` <small>${why}</small>` : ''}${fresh ? ' <span class="new-badge">Nuovo</span>' : ''}</button>`;
  }).join('');
  const flyTargets = save.badges >= FLY_BADGES
    ? KANTO.filter((l) => l.kind === 'city' && l.id !== loc.id && save.visited.includes(l.id) && !neighbors(loc.id).includes(l.id))
    : [];
  const fly = flyTargets.map((l) => `<button data-go="${l.id}">${esc(l.name)}</button>`).join('');
  // per il telefono: i luoghi vicini (e il volo) come schede grandi, al posto della mappa disegnata
  const travel = `<section class="card travel">
    <div class="travel-head"><h3>Dove andare</h3><button class="link" id="toggle-map">${showMapOnPhone ? 'Nascondi la mappa' : 'Mostra la mappa'}</button></div>
    <div class="places">${neighbors(loc.id).map((id) => placeCard(save, locationById(id))).join('')}</div>
    ${flyTargets.length ? `<h3>Volo <small>città già visitate</small></h3><div class="places">${flyTargets.map((l) => placeCard(save, l, true)).join('')}</div>` : ''}
  </section>`;

  main.innerHTML = `
    ${problem ? `<div class="toast warn">${esc(problem)} Vai su Formazione.</div>` : ''}
    ${message ? `<div class="toast">${esc(message)}${message.includes('sessioni') ? ' Le trovi in Allenamento.' : ''}</div>` : ''}
    <div class="kanto ${showMapOnPhone ? 'show-map' : ''}">
      <div class="card map-card">
        ${mapSvg(save, ch, actions)}
        <p class="muted map-legend">Tocca un luogo evidenziato per spostarti. Cerchi grandi: città · cerchi piccoli: percorsi · rombi: grotte e luoghi speciali · il numero indica le medaglie che servono${save.badges >= FLY_BADGES ? ' · con la Medaglia Tuono puoi volare nelle città già visitate' : ''}.</p>
      </div>
      <div class="loc-panel">
        <section class="card loc-head">
          <small class="muted">${KIND_LABEL[loc.kind]} · allenatori di livello ~${loc.level}</small>
          <h2>${esc(loc.name)}</h2>
          ${loc.weather ? `<p class="weather-line">${WEATHER[loc.weather].icon} <b>${WEATHER[loc.weather].name}</b> <small class="muted">nelle partite all'aperto: ${esc(weatherText(loc.weather))}${loc.gym !== undefined ? ' (la palestra è al chiuso)' : ''}</small></p>` : ''}
          <div class="destinations"><small>Vai a:</small>${destinations}</div>
          ${fly ? `<div class="destinations"><small>Volo:</small>${fly}</div>` : ''}
        </section>
        ${gymSection}
        ${ch.league ? leagueCard(save, ch.league, mine, problem, ch.champion) : ''}
        ${legendarySection}
        ${events}
        ${trainers}
        ${travel}
        ${wildMatch}
        ${wild}
      </div>
    </div>
    <section class="card badge-case">
      <h3>Medaglie <small>${save.badges}/${GYMS.length}</small>${eventsFound(save)}</h3>
      <div class="badges">${badges}</div>
    </section>
    <details class="rules card">
      <summary>Come funziona il gioco</summary>
      <ul>
        <li><b>Mappa</b>: ti sposti nei luoghi vicini; le medaglie aprono nuove zone come nei giochi e dalla Medaglia Tuono puoi volare nelle città già visitate. Sui percorsi ci sono allenatori da battere una volta e la partitella con i selvatici, ripetibile.</li>
        <li><b>Sconfitta</b>: nessuno guadagna esperienza; col pareggio la metà.</li>
        <li><b>Allenamento</b>: le sessioni per le statistiche (EV) arrivano 3 per ogni luogo nuovo, quelle che non usi restano. L'esperienza invece arriva giocando: grindando sali di livello, ma gli EV crescono solo viaggiando.</li>
        <li><b>Tetto di livello</b>: si cresce fino a 2 livelli sopra la prossima palestra (68 prima della Lega), poi serve la medaglia. Da Campione il tetto sparisce.</li>
        <li><b>Eventi nascosti</b>: come in Pokémon Giallo, in Kanto ci sono Pokémon speciali che qualcuno ti affida, una volta sola. Non sono segnati da nessuna parte: compaiono quando sei nel posto giusto al momento giusto (a volte dopo aver battuto un allenatore o con abbastanza medaglie) e vanno conquistati vincendo la loro sfida. Il contatore accanto alle medaglie ti dice quanti ne hai trovati.</li>
        <li><b>Leggendari</b>: Zapdos alla Centrale Elettrica, Articuno alle Isole Spumarine, Moltres sulla Via Vittoria e Mewtwo nella Grotta Ignota (aperta dopo aver vinto la Lega). Guidano una squadra di selvatici: se vinci, chiedono di unirsi a te.</li>
        <li><b>Nuovi Pokémon</b>: niente lotte né Poké Ball. Se vinci la partitella con i selvatici, di solito uno chiede di unirsi alla squadra e tu decidi se catturarlo. Chi evolve si convince più facilmente, i Pokémon già forti e rari molto meno, e conta anche come ha giocato contro di te. La rosa ha al massimo ${ROSTER_MAX} Pokémon: se è piena, per accettare ne lasci andare uno.</li>
        <li><b>Palestre</b>: si battono in ordine, ognuna nella sua città; ognuna ha un tipo e un livello fisso. In campo ci sono sempre il suo asso e la sua contromossa (l'unico Pokémon di un altro tipo); gli altri li sceglie studiando la tua squadra (titolari e panchina), portando chi mette in difficoltà i tuoi tipi. Vincere dà la medaglia; in caso di pareggio si tirano i rigori.</li>
        <li><b>Esperienza</b>: come nei giochi, un avversario di livello più alto rende di più; uno più debole di te rende poco.</li>
        <li><b>Statistiche</b>: Attacco e Difesa sono il valore più alto tra fisico e speciale; Velocità è quanto corre; i PV sono la resistenza. Partono dalle statistiche di Bulbapedia e crescono con livello e allenamento.</li>
        <li><b>Tipi</b>: contano molto. Il vantaggio dei giochi qui vale ×1.25 (lo svantaggio ×0.8) e pesa su contrasti, danni e parate: contro una palestra schiera chi ha il tipo giusto.</li>
        <li><b>KO</b>: a 0 PV un Pokémon resta fermo per 6 minuti e rientra con metà dei PV; dal secondo KO solo con un quarto. Il portiere non va mai KO: stremato para peggio, ma resta in porta.</li>
        <li><b>Falli</b>: chi entra con tanto Attacco e poca Difesa è irruento. In area è rigore, vicino alla porta punizione, lontano si riparte subito.</li>
        <li><b>Calci piazzati</b>: rimesse laterali con i piedi come nel calcio a 5; sugli angoli e sui cross vince il duello aereo chi ha Difesa, PV e altezza.</li>
        <li><b>Portiere</b>: para con Difesa, PV e Velocità; più è alto, più porta copre (Onix!).</li>
        <li><b>Evoluzione</b>: la barra lilla si riempie con gol, assist, parate e contrasti vinti. Se il livello lo permette puoi evolvere, senza limiti. A fine gara tutti tornano allo stadio base.</li>
        <li><b>Panchina e cambi</b>: in partita vanno 5 titolari e ${BENCH_MAX} riserve in panchina, scelte in Formazione. Al massimo ${MAX_SUBS} sostituzioni; chi esce non rientra. Utili per rimpiazzare un Pokémon KO o senza PV.</li>
      </ul>
    </details>`;

  // sul telefono la mappa è più larga dello schermo e scorre: si parte centrati su dove sei
  const centerMap = () => {
    const mapCard = main.querySelector<HTMLElement>('.map-card');
    const here = main.querySelector('.km-here');
    if (mapCard && here && mapCard.scrollWidth > mapCard.clientWidth) {
      const r = here.getBoundingClientRect();
      const c = mapCard.getBoundingClientRect();
      mapCard.scrollLeft += r.left + r.width / 2 - (c.left + c.width / 2);
    }
  };
  centerMap();
  // formazione consigliata contro la squadra della sfida
  main.querySelectorAll<HTMLButtonElement>('[data-suggest]').forEach((b) => {
    b.onclick = () => {
      const key = b.dataset.suggest;
      const them = key === 'gym' ? ch.gymTeam : key === 'rematch' ? ch.rematch : (ch.champion ?? ch.league?.team ?? null);
      if (!them) return;
      const { lineup, bench } = suggestedLineup(save, them);
      save.lineup = lineup;
      save.bench = bench;
      state.message = `Formazione consigliata contro ${them.name}: fatto. Puoi ritoccarla in Formazione.`;
      actions.changed();
    };
  });
  main.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((b) => {
    b.onclick = () => {
      if (!lineupProblem(save)) actions.play(b.dataset.play as ChallengeKind);
    };
  });
  main.querySelectorAll<HTMLButtonElement>('[data-skip]').forEach((b) => {
    b.onclick = () => {
      if (!lineupProblem(save)) actions.play(b.dataset.skip as ChallengeKind, undefined, true);
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
  main.querySelectorAll<HTMLButtonElement>('[data-event-play]').forEach((b) => {
    b.onclick = () => {
      if (!lineupProblem(save)) actions.play('event', b.dataset.eventPlay);
    };
  });
  main.querySelectorAll<HTMLButtonElement>('[data-event-skip]').forEach((b) => {
    b.onclick = () => {
      if (!lineupProblem(save)) actions.play('event', b.dataset.eventSkip, true);
    };
  });
  main.querySelector<HTMLButtonElement>('#toggle-map')?.addEventListener('click', (e) => {
    showMapOnPhone = !showMapOnPhone;
    main.querySelector('.kanto')!.classList.toggle('show-map', showMapOnPhone);
    (e.currentTarget as HTMLButtonElement).textContent = showMapOnPhone ? 'Nascondi la mappa' : 'Mostra la mappa';
    if (showMapOnPhone) {
      centerMap();
      main.querySelector('.map-card')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
