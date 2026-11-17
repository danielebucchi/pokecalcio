import { POKEDEX, TYPE_NAMES } from '../data/pokedex';
import { STARTER_COUNT, STARTER_LEVEL, STARTER_POOL, ratingsOf } from '../game/save';
import { createInstance, gameStats, realStats, type Role } from '../game/stats';
import { esc, evoLine } from './common';
import { spriteUrl } from './sprites';
import { bindThemeToggle, themeToggleHtml } from './theme';

const ROLE_NAMES: Record<Role, string> = { POR: 'Portiere', DIF: 'Difensore', CEN: 'Centrocampista', ATT: 'Attaccante' };
/** Da questo voto in su un Pokémon è un vero portiere (nel gruppo: Onix e Geodude). */
const GOOD_KEEPER = 58;
/** I voti dei ruoli non sono sulla stessa scala: il ruolo "migliore" si sceglie tra quelli di movimento. */
const FIELD_ROLES: Role[] = ['DIF', 'CEN', 'ATT'];

/** Pokémon "medio" del gruppo (IV a metà) per mostrare statistiche e voti al livello di partenza. */
function preview(key: string) {
  const inst = createInstance(key, STARTER_LEVEL);
  inst.ivs = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
  const g = gameStats(realStats(POKEDEX[key], inst));
  const ratings = ratingsOf(inst);
  const best = FIELD_ROLES.reduce((a, b) => (ratings[b] > ratings[a] ? b : a));
  return { inst, g, ratings, best };
}

/** Schermata d'inizio carriera: scegli i 5 Pokémon della tua prima squadra. */
export function renderStarterPick(app: HTMLElement, onConfirm: (keys: string[]) => void) {
  const picked: string[] = [];
  const previews = Object.fromEntries(STARTER_POOL.map((k) => [k, preview(k)]));

  const draw = () => {
    const full = picked.length === STARTER_COUNT;
    const keeper = Math.max(0, ...picked.map((k) => previews[k].ratings.POR));
    const cards = STARTER_POOL.map((k) => {
      const sp = POKEDEX[k];
      const { g, ratings, best } = previews[k];
      const on = picked.includes(k);
      return `<button class="starter ${on ? 'picked' : ''}" data-key="${k}" ${!on && full ? 'disabled' : ''}>
        <img src="${spriteUrl(sp.dex)}" alt="">
        <span class="st-body">
          <span class="st-title"><b>${esc(sp.name)}</b> ${sp.types.map((t) => `<span class="chip">${TYPE_NAMES[t]}</span>`).join(' ')}</span>
          <span class="st-role"><span class="role role-${best}">${best}</span> ${ROLE_NAMES[best]} · voto ${Math.round(ratings[best])}
            ${ratings.POR >= GOOD_KEEPER ? `<span class="role role-POR">POR</span> buon portiere` : ''}</span>
          <span class="pick-stats"><span>ATT <b>${g.att}</b></span><span>DIF <b>${g.dif}</b></span><span>VEL <b>${g.vel}</b></span><span>PV <b>${g.pv}</b></span></span>
          <span class="pick-evo">${evoLine(previews[k].inst)}</span>
        </span>
        ${on ? '<span class="st-check">✦</span>' : ''}
      </button>`;
    }).join('');

    const slots = Array.from({ length: STARTER_COUNT }, (_, i) => {
      const k = picked[i];
      return k
        ? `<button class="st-slot filled" data-key="${k}" title="Togli ${esc(POKEDEX[k].name)}"><img src="${spriteUrl(POKEDEX[k].dex)}" alt=""></button>`
        : '<span class="st-slot"></span>';
    }).join('');

    const hint = !full
      ? `Scegline ancora ${STARTER_COUNT - picked.length}.`
      : keeper < GOOD_KEEPER
        ? 'Attenzione: nessuno è davvero adatto alla porta (Onix e Geodude sono i portieri migliori del gruppo).'
        : 'Squadra pronta: la formazione si sistema da sola, potrai cambiarla quando vuoi.';

    app.innerHTML = `
      <div class="topbar">
        <span class="brand">Poké<span>.</span>Calcio</span>
        <span class="sparkle">✦</span>
        <span>Nuova carriera</span>
        ${themeToggleHtml()}
      </div>
      <section class="card welcome">
        <h2>Scegli la tua prima squadra <span class="sparkle">✦</span></h2>
        <p class="muted">Prendi <b>${STARTER_COUNT} Pokémon</b> tra questi: saranno tutta la tua squadra (livello ${STARTER_LEVEL}), altri arriveranno più avanti con le catture.
        Pensa ai ruoli: serve un portiere, qualcuno che difenda e qualcuno che segni. Tipi diversi ti aiutano contro le palestre: la prima è Brock, tipo Roccia.</p>
      </section>
      <div class="starter-grid">${cards}</div>
      <div class="st-bar card">
        <div class="st-slots">${slots}</div>
        <div class="st-info"><b>${picked.length}/${STARTER_COUNT}</b> <span class="muted">${hint}</span></div>
        <button id="st-go" class="primary big" ${full ? '' : 'disabled'}>Inizia l'avventura</button>
      </div>`;

    bindThemeToggle(app);
    app.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.key!;
        const i = picked.indexOf(k);
        if (i >= 0) picked.splice(i, 1);
        else if (picked.length < STARTER_COUNT) picked.push(k);
        draw();
      };
    });
    document.getElementById('st-go')!.onclick = () => {
      if (picked.length === STARTER_COUNT) onConfirm([...picked]);
    };
  };
  draw();
}
