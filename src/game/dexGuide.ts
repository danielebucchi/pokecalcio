import { POKEDEX, descendants } from '../data/pokedex';
import { KANTO } from './kanto';
import { SIDE_MISSIONS } from './rewards';
import { STARTER_POOL } from './save';

/**
 * Guida del Pokédex: dove si prende ogni specie. Le specie degli eventi restano un segreto
 * (gli eventi sono nascosti finché non li trovi).
 */

/** Specie che si possono avere in carriera: scelte, selvatiche, leggendarie, eventi, premi e le loro evoluzioni. */
const OBTAINABLE = new Set<string>([
  ...STARTER_POOL,
  ...KANTO.flatMap((l) => [...l.wild, ...(l.legendary ? [l.legendary.key] : []), ...(l.events ?? []).flatMap((e) => e.species)]),
  ...SIDE_MISSIONS.flatMap((m) => ('pokemon' in m.reward ? [m.reward.pokemon] : [])),
]);
for (const k of [...OBTAINABLE]) for (const d of descendants(k)) OBTAINABLE.add(d.key);

/** Forma ottenibile da cui si evolve ogni specie (solo il passo precedente). */
const PARENT = new Map<string, string>();
for (const key of OBTAINABLE) for (const d of descendants(key)) if (d.depth === 1 && !PARENT.has(d.key)) PARENT.set(d.key, key);

export function whereToFind(key: string): string {
  const where: string[] = [];
  if (STARTER_POOL.includes(key)) where.push('si può scegliere a inizio carriera');
  const wild = KANTO.filter((l) => l.wild.includes(key)).map((l) => l.name);
  if (wild.length) where.push(`selvatico: ${wild.join(', ')}`);
  const legend = KANTO.find((l) => l.legendary?.key === key);
  if (legend) where.push(`leggendario: ${legend.name}`);
  if (SIDE_MISSIONS.some((m) => 'pokemon' in m.reward && m.reward.pokemon === key)) where.push('premio di una missione facoltativa');
  const parent = PARENT.get(key);
  if (parent) where.push(`si evolve in partita da ${POKEDEX[parent].name.replace(/\.$/, '')}`);
  if (!where.length && KANTO.some((l) => l.events?.some((e) => e.species.includes(key)))) where.push('un segreto di Kanto: cerca bene');
  if (!where.length) where.push('non si trova a Kanto');
  const text = where.join(' · ');
  return text[0].toUpperCase() + text.slice(1) + '.';
}
