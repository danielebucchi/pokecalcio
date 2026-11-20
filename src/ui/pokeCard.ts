import { POKEDEX, TYPE_NAMES } from '../data/pokedex';
import { MAX_LEVEL, expToNext } from '../game/progression';
import { ratingsOf, type OwnedPokemon, type SaveData } from '../game/save';
import type { Role } from '../game/stats';
import { techniqueById } from '../game/techniques';
import { esc, evoLine, natureLabel, statsOf } from './common';
import { spriteUrl } from './sprites';

/**
 * Scheda di un tuo Pokémon: si apre toccando il suo sprite (elementi con `data-poke="uid"`) e mette
 * insieme quello che altrove è sparso: tipi, natura, statistiche, talento e allenamento, voti per
 * ruolo, evoluzioni, MT, numeri di carriera e da quando è con te.
 */
const ROLE_NAMES: Record<Role, string> = { POR: 'Portiere', DIF: 'Difensore', CEN: 'Centrocampista', ATT: 'Attaccante' };

function cardHtml(save: SaveData, p: OwnedPokemon): string {
  const sp = POKEDEX[p.speciesKey];
  const g = statsOf(p);
  const ratings = ratingsOf(p);
  const best = (Object.keys(ratings) as Role[]).reduce((a, b) => (ratings[b] > ratings[a] ? b : a));
  const where = save.lineup.includes(p.uid) ? 'titolare' : save.bench.includes(p.uid) ? 'in panchina' : save.box.some((b) => b.uid === p.uid) ? 'nel PC di Bill' : 'in tribuna';
  const ivSum = Object.values(p.ivs).reduce((a, b) => a + b, 0);
  // talento come nei giochi recenti (il "giudice"): somma degli IV su 186
  const talent = ivSum >= 160 ? 'eccezionale' : ivSum >= 120 ? 'ottimo' : ivSum >= 80 ? 'buono' : 'modesto';
  const evTotal = Object.values(p.evs).reduce((a, b) => a + b, 0);
  const max = Math.max(g.att, g.dif, g.vel, g.pv);
  const stat = (label: string, v: number) =>
    `<div class="pk-stat"><span>${label}</span><span class="bar"><i style="width:${(v / max) * 100}%"></i></span><b>${v}</b></div>`;
  const c = p.career;
  const exp = p.level >= MAX_LEVEL ? 100 : Math.round((p.exp / expToNext(p.level)) * 100);
  const met = p.metAt
    ? `${new Date(p.metAt.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(p.metAt.place)}`
    : 'da prima che il gioco lo segnasse';
  return `<div class="pk-head">
      <img src="${spriteUrl(sp.dex, p.shiny)}" alt="">
      <div>
        <small class="muted">#${String(sp.dex).padStart(3, '0')} ${esc(sp.name)}${p.shiny ? ' · ✨ shiny' : ''} · ${where}</small>
        <h2>${esc(p.nickname || sp.name)} <small>Lv ${p.level}</small></h2>
        <div class="pk-types">${sp.types.map((t) => `<span class="chip type-tag" data-type="${t}">${TYPE_NAMES[t]}</span>`).join(' ')}</div>
        <div class="bar exp" title="Esperienza verso il livello ${p.level + 1}"><i style="width:${exp}%"></i></div>
      </div>
      <button class="pk-close" data-pk-close aria-label="Chiudi">✕</button>
    </div>
    <div class="pk-grid">
      <section>
        <h4>Statistiche</h4>
        ${stat('ATT', g.att)}${stat('DIF', g.dif)}${stat('VEL', g.vel)}${stat('PV', g.pv)}
        <p class="muted">Natura <b>${esc(natureLabel(p) || '—')}</b></p>
        <p class="muted">Talento <b>${talent}</b> · allenamento ${evTotal}/510 EV</p>
      </section>
      <section>
        <h4>Ruoli</h4>
        ${(['POR', 'DIF', 'CEN', 'ATT'] as Role[])
          .map((r) => `<div class="pk-role ${r === best ? 'best' : ''}"><span class="role role-${r}">${r}</span> ${ROLE_NAMES[r]} <b>${Math.round(ratings[r])}</b></div>`)
          .join('')}
      </section>
      <section>
        <h4>Evoluzioni in partita</h4>
        <p class="pk-evo">${evoLine(p)}</p>
        <h4>MT</h4>
        <p>${(p.techniques ?? []).length
          ? (p.techniques ?? []).map((id) => `<span class="chip chip-star" title="${esc(techniqueById(id)!.description)}">${esc(techniqueById(id)!.name)}</span>`).join(' ')
          : '<span class="muted">nessuna</span>'}</p>
      </section>
      <section>
        <h4>Carriera</h4>
        <p>${c?.matches ? `${c.matches} partite · <b>${c.goals}</b> gol · ${c.assists} assist · ${c.saves} parate` : '<span class="muted">non ha ancora giocato</span>'}</p>
        <h4>Con te dal</h4>
        <p class="muted">${met}</p>
      </section>
    </div>`;
}

let overlay: HTMLDivElement | null = null;
const close = () => {
  overlay?.remove();
  overlay = null;
};

/** Da chiamare una volta all'avvio: `getSave` restituisce la carriera attuale. */
export function installPokeCard(getSave: () => SaveData) {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-poke]');
    if (!el) return;
    const save = getSave();
    const p = [...save.roster, ...save.box].find((x) => x.uid === el.dataset.poke);
    if (!p) return;
    // la scheda si apre al posto dell'azione del bottone che contiene lo sprite
    e.preventDefault();
    e.stopPropagation();
    close();
    overlay = document.createElement('div');
    overlay.className = 'pk-overlay';
    overlay.innerHTML = `<div class="card pk-card" role="dialog" aria-label="Scheda del Pokémon">${cardHtml(save, p)}</div>`;
    overlay.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t === overlay || t.closest('[data-pk-close]')) close();
    });
    document.body.append(overlay);
  }, true);
  window.addEventListener('keydown', (e) => e.key === 'Escape' && close());
}
