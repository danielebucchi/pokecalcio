import { POKEDEX, TYPE_NAMES, descendants } from '../data/pokedex';
import { natureById } from '../game/natures';
import { gameStats, reachOf, realStats, roleRatings, type PokemonInstance } from '../game/stats';
import type { TeamSetup } from '../match/engine';
import { spriteUrl } from './sprites';

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Natura e suo effetto vero su questo Pokémon, nelle 4 statistiche del gioco: "Decisa · ATT +10%".
 * (ATT è il massimo tra Attacco e Attacco Speciale: una natura può toccare quello che non usa.)
 */
export function natureLabel(inst: PokemonInstance): string {
  const n = natureById(inst.nature);
  if (!n) return '';
  const sp = POKEDEX[inst.speciesKey];
  const withN = gameStats(realStats(sp, inst));
  const without = gameStats(realStats(sp, { ...inst, nature: undefined }));
  const names = { att: 'ATT', dif: 'DIF', vel: 'VEL', pv: 'PV' } as const;
  const parts = (Object.keys(names) as (keyof typeof names)[])
    .map((k) => {
      const d = withN[k] / without[k] - 1;
      // arrotondato a 5: per gli arrotondamenti della formula un +10% può risultare +9%
      return Math.abs(d) < 0.02 ? '' : `${names[k]} ${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) * 20) * 5}%`;
    })
    .filter(Boolean);
  return `${n.name}${parts.length ? ` · ${parts.join(', ')}` : n.up ? ' · nessun effetto su di lui' : ' · neutra'}`;
}

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
