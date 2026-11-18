import { POKEDEX, TYPE_NAMES, descendants } from '../data/pokedex';
import { gameStats, reachOf, realStats, roleRatings, type PokemonInstance } from '../game/stats';
import type { TeamSetup } from '../match/engine';
import { spriteUrl } from './sprites';

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function statsOf(inst: PokemonInstance) {
  return gameStats(realStats(POKEDEX[inst.speciesKey], inst));
}

/** Linea evolutiva: un gruppo per stadio, con i rami separati da "/" (Eevee → Vaporeon / Jolteon / …). */
export function evoLine(inst: PokemonInstance): string {
  const all = descendants(inst.speciesKey);
  if (!all.length) return '<span class="muted">nessuna evoluzione</span>';
  const depths = [...new Set(all.map((e) => e.depth))];
  return depths
    .map((d) => {
      const forms = all
        .filter((e) => e.depth === d)
        .map((e) => {
          const ok = inst.level >= e.level;
          return `<span class="${ok ? 'ok' : 'locked'}">${POKEDEX[e.key].name} <small>Lv${e.level}</small></span>`;
        })
        .join(' / ');
      return `→ ${forms}`;
    })
    .join(' ');
}

export function teamTable(t: TeamSetup): string {
  const rows = t.roster
    .map(({ inst, role }) => {
      const sp = POKEDEX[inst.speciesKey];
      const g = statsOf(inst);
      const rating = roleRatings(g, sp.heightDm)[role];
      const extra = role === 'POR' ? ` · portata ${reachOf(sp.heightDm).toFixed(1)} m` : '';
      return `<tr>
        <td><img class="mini" src="${spriteUrl(sp.dex)}" alt=""></td>
        <td><b>${sp.name}</b> <small>Lv${inst.level}</small><div class="types">${sp.types.map((t) => `<span class="type-tag" data-type="${t}">${TYPE_NAMES[t]}</span>`).join(' / ')}</div></td>
        <td><span class="role role-${role}">${role}</span></td>
        <td>${g.att}</td><td>${g.dif}</td><td>${g.vel}</td><td>${g.pv}</td>
        <td><b>${Math.round(rating)}</b><small>${extra}</small></td>
        <td class="evo-line">${evoLine(inst)}</td>
      </tr>`;
    })
    .join('');
  return `<div class="team-card" style="--team:${t.color}">
    <h2>${esc(t.name)} ${t.controlled ? '<small>(tu)</small>' : '<small>(CPU)</small>'}</h2>
    <table>
      <thead><tr><th></th><th>Pokémon</th><th>Ruolo</th><th>ATT</th><th>DIF</th><th>VEL</th><th>PV</th><th>Voto ruolo</th><th>Evoluzioni in partita</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
