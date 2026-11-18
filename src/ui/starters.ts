import { POKEDEX, TYPE_NAMES } from '../data/pokedex';
import { STARTER_GROUPS, STARTER_LEVEL, ratingsOf } from '../game/save';
import { createInstance, gameStats, realStats, type Role } from '../game/stats';
import { esc, evoLine } from './common';
import { spriteUrl } from './sprites';
import { bindThemeToggle, themeToggleHtml } from './theme';

type GroupRole = (typeof STARTER_GROUPS)[number]['role'];

const ROLE_NAMES: Record<Role, string> = { POR: 'portiere', DIF: 'difensore', CEN: 'centrocampista', ATT: 'attaccante' };
const GROUP_HINTS: Record<GroupRole, string> = {
  POR: 'Para con Difesa, PV e Velocità; più è alto, più porta copre.',
  DIF: 'Contano Difesa e PV: devono rubare palla e reggere gli scontri.',
  ATT: 'Contano Attacco e Velocità: sono loro a segnare.',
};

/** Pokémon "medio" del gruppo (IV a metà) per mostrare statistiche e voti al livello di partenza. */
function preview(key: string) {
  const inst = createInstance(key, STARTER_LEVEL);
  inst.ivs = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
  return { inst, g: gameStats(realStats(POKEDEX[key], inst)), ratings: ratingsOf(inst) };
}

/**
 * Schermata d'inizio carriera: la prima squadra si sceglie per ruoli, 1 portiere su 5,
 * 2 difensori su 8 e 2 attaccanti su 8.
 */
export function renderStarterPick(app: HTMLElement, onConfirm: (keys: string[]) => void) {
  const picked: Record<GroupRole, string[]> = { POR: [], DIF: [], ATT: [] };
  const previews = Object.fromEntries(STARTER_GROUPS.flatMap((g) => g.pool).map((k) => [k, preview(k)]));
  const missing = () => STARTER_GROUPS.find((g) => picked[g.role].length < g.count);
  // sul telefono un ruolo alla volta: prima i portieri, poi i difensori, poi gli attaccanti
  const phone = () => window.matchMedia('(max-width: 700px)').matches;
  let step = 0;
  const groupFull = (i: number) => picked[STARTER_GROUPS[i].role].length >= STARTER_GROUPS[i].count;

  const draw = () => {
    const sections = STARTER_GROUPS.map((g, gi) => {
      const mine = picked[g.role];
      const full = mine.length >= g.count;
      // il miglior voto del gruppo, per le barre
      const top = Math.max(...g.pool.map((k) => previews[k].ratings[g.role]));
      const cards = g.pool
        .map((k) => {
          const sp = POKEDEX[k];
          const { g: st, ratings } = previews[k];
          const on = mine.includes(k);
          const rating = ratings[g.role];
          // il portiere è uno solo: toccandone un altro si cambia scelta
          const disabled = !on && full && g.count > 1;
          return `<button class="starter ${on ? 'picked' : ''}" data-role="${g.role}" data-key="${k}" ${disabled ? 'disabled' : ''}>
          <img src="${spriteUrl(sp.dex)}" alt="">
          <span class="st-body">
            <span class="st-title"><b>${esc(sp.name)}</b> ${sp.types.map((t) => `<span class="chip">${TYPE_NAMES[t]}</span>`).join(' ')}</span>
            <span class="st-role"><span class="role role-${g.role}">${g.role}</span> voto da ${ROLE_NAMES[g.role]} <b>${Math.round(rating)}</b>
              <span class="bar st-rating"><i style="width:${(rating / top) * 100}%"></i></span></span>
            <span class="pick-stats"><span>ATT <b>${st.att}</b></span><span>DIF <b>${st.dif}</b></span><span>VEL <b>${st.vel}</b></span><span>PV <b>${st.pv}</b></span></span>
            <span class="pick-evo">${evoLine(previews[k].inst)}</span>
          </span>
          ${on ? '<span class="st-check">✦</span>' : ''}
        </button>`;
        })
        .join('');
      return `<section class="st-group ${gi === step ? 'current' : ''}">
        <h3><span class="role role-${g.role}">${g.role}</span> ${g.label} <small>${mine.length}/${g.count} · scegline ${g.count === 1 ? 'uno' : g.count} su ${g.pool.length}</small></h3>
        <p class="muted">${GROUP_HINTS[g.role]}</p>
        <div class="starter-grid">${cards}</div>
      </section>`;
    }).join('');

    const order = STARTER_GROUPS.flatMap((g) => Array.from({ length: g.count }, (_, i) => [g.role, picked[g.role][i]] as const));
    const slots = order
      .map(([role, k]) => k
        ? `<button class="st-slot filled" data-role="${role}" data-key="${k}" title="Togli ${esc(POKEDEX[k].name)}"><img src="${spriteUrl(POKEDEX[k].dex)}" alt=""><span class="role role-${role}">${role}</span></button>`
        : `<span class="st-slot"><span class="role role-${role}">${role}</span></span>`)
      .join('');
    const need = missing();
    const count = order.filter(([, k]) => k).length;
    const last = step === STARTER_GROUPS.length - 1;
    const cur = STARTER_GROUPS[step];
    // pulsante in basso: sul telefono guida un ruolo alla volta, sul desktop parte a squadra completa
    const goLabel = !phone() || last ? "Inizia l'avventura" : groupFull(step) ? `Avanti: ${STARTER_GROUPS[step + 1].label.toLowerCase()} ›` : `Scegli ${cur.count === 1 ? 'il portiere' : `${cur.count} ${cur.label.toLowerCase()}`}`;
    const goDisabled = !phone() || last ? !!need : !groupFull(step);
    const steps = STARTER_GROUPS.map((g, i) => `<button class="st-step ${i === step ? 'on' : ''} ${groupFull(i) ? 'done' : ''}" data-step="${i}">
        <span>${groupFull(i) ? '✓' : i + 1}</span> ${g.label}</button>`).join('');
    const hint = need
      ? `Manca ${need.count - picked[need.role].length === 1 ? 'ancora uno' : `ancora ${need.count - picked[need.role].length}`}: ${need.label.toLowerCase()}.`
      : 'Squadra pronta: gioca nel Quadrato (2-2).';

    app.innerHTML = `
      <div class="topbar">
        <span class="brand">Poké<span>.</span>Calcio</span>
        <span class="sparkle">✦</span>
        <span>Nuova carriera</span>
        ${themeToggleHtml()}
      </div>
      <section class="card welcome">
        <h2>Scegli la tua prima squadra <span class="sparkle">✦</span></h2>
        <p class="muted">Un <b>portiere</b>, due <b>difensori</b> e due <b>attaccanti</b>, tutti al livello ${STARTER_LEVEL}: saranno tutta la tua squadra, altri arriveranno più avanti con le catture.
        Tipi diversi ti aiutano contro le palestre: la prima è Brock, tipo Roccia.</p>
      </section>
      <nav class="st-steps">${steps}</nav>
      ${sections}
      <div class="st-bar card">
        <div class="st-slots">${slots}</div>
        <div class="st-info"><b>${count}/5</b> <span class="muted">${hint}</span></div>
        <button id="st-go" class="primary big" ${goDisabled ? 'disabled' : ''}>${goLabel}</button>
      </div>`;

    bindThemeToggle(app);
    app.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) => {
      b.onclick = () => {
        const role = b.dataset.role as GroupRole;
        const k = b.dataset.key!;
        const group = STARTER_GROUPS.find((g) => g.role === role)!;
        const mine = picked[role];
        const i = mine.indexOf(k);
        if (i >= 0) mine.splice(i, 1);
        else if (mine.length < group.count) mine.push(k);
        else if (group.count === 1) mine.splice(0, 1, k);
        // sul telefono, completato il ruolo si passa da soli al successivo
        const gi = STARTER_GROUPS.indexOf(group);
        const advance = phone() && i < 0 && gi === step && groupFull(gi) && gi < STARTER_GROUPS.length - 1;
        if (advance) setTimeout(() => goTo(gi + 1), 350);
        draw();
      };
    });
    app.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) => {
      b.onclick = () => goTo(Number(b.dataset.step));
    });
    document.getElementById('st-go')!.onclick = () => {
      if (phone() && step < STARTER_GROUPS.length - 1) {
        if (groupFull(step)) goTo(step + 1);
        return;
      }
      if (!missing()) onConfirm(STARTER_GROUPS.flatMap((g) => picked[g.role]));
    };
  };
  const goTo = (i: number) => {
    step = i;
    draw();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  draw();
}
