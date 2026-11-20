// Genera src/data/pokedex.json dai CSV di PokeAPI (https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).
// Uso: npm run import-pokedex -- /percorso/cartella-csv
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('Indica la cartella con i CSV di PokeAPI');

/** CSV con campi tra virgolette (i nomi delle specie possono contenere virgole). */
function readCsv(name: string): Record<string, string>[] {
  const text = readFileSync(join(dir, `${name}.csv`), 'utf8');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...data] = rows.filter((r) => r.length > 1);
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const STAT_KEYS: Record<string, string> = { '1': 'hp', '2': 'atk', '3': 'def', '4': 'spa', '5': 'spd', '6': 'spe' };

const languages = readCsv('languages');
const langId = (code: string) => languages.find((l) => l.identifier === code)!.id;
const IT = langId('it');
const EN = langId('en');

const types = new Map(readCsv('types').map((t) => [t.id, t.identifier]));
const triggers = new Map(readCsv('evolution_triggers').map((t) => [t.id, t.identifier]));
const defaultPokemon = new Map(
  readCsv('pokemon').filter((p) => p.is_default === '1').map((p) => [p.species_id, p]),
);

const statsByPokemon = new Map<string, Record<string, number>>();
for (const s of readCsv('pokemon_stats')) {
  const key = STAT_KEYS[s.stat_id];
  if (!key) continue;
  const m = statsByPokemon.get(s.pokemon_id) ?? {};
  m[key] = Number(s.base_stat);
  statsByPokemon.set(s.pokemon_id, m);
}

const typesByPokemon = new Map<string, { slot: number; type: string }[]>();
for (const t of readCsv('pokemon_types')) {
  const list = typesByPokemon.get(t.pokemon_id) ?? [];
  list.push({ slot: Number(t.slot), type: types.get(t.type_id)! });
  typesByPokemon.set(t.pokemon_id, list);
}

const names = new Map<string, { it?: string; en?: string }>();
for (const n of readCsv('pokemon_species_names')) {
  const entry = names.get(n.pokemon_species_id) ?? {};
  if (n.local_language_id === IT) entry.it = n.name;
  if (n.local_language_id === EN) entry.en = n.name;
  names.set(n.pokemon_species_id, entry);
}

const evoRows = new Map<string, Record<string, string>[]>();
for (const e of readCsv('pokemon_evolution')) {
  const list = evoRows.get(e.evolved_species_id) ?? [];
  list.push(e);
  evoRows.set(e.evolved_species_id, list);
}

const species = readCsv('pokemon_species');
const byId = new Map(species.map((s) => [s.id, s]));
const bstOf = (speciesId: string) =>
  Object.values(statsByPokemon.get(defaultPokemon.get(speciesId)!.id)!).reduce((a, b) => a + b, 0);

/**
 * Livello di gioco a cui una specie si sblocca in partita. Se nei giochi evolve di livello si usa
 * quello; altrimenti (pietre, scambio, amicizia…) si stima dalla potenza della forma evoluta.
 * In ogni caso viene dopo lo stadio precedente.
 */
const levelCache = new Map<string, number>();
function unlockLevel(speciesId: string): { level: number; method: string } {
  const sp = byId.get(speciesId)!;
  const prev = sp.evolves_from_species_id;
  if (!prev) return { level: 0, method: 'base' }; // forma base: disponibile da subito
  const prevLevel = levelCache.get(prev) ?? unlockLevel(prev).level;
  const rows = evoRows.get(speciesId) ?? [];
  const levels = rows.map((r) => Number(r.minimum_level)).filter((l) => l > 0);
  let level: number;
  let method: string;
  if (levels.length) {
    level = Math.min(...levels);
    method = 'level';
  } else {
    const row = rows.find((r) => r.is_default === '1') ?? rows[0];
    method = row ? (triggers.get(row.evolution_trigger_id) ?? 'other') : 'other';
    level = Math.round(10 + (bstOf(speciesId) - 250) * 0.12);
  }
  level = Math.max(5, Math.min(70, Math.max(level, prevLevel + 5)));
  levelCache.set(speciesId, level);
  return { level, method };
}

/**
 * Evoluzioni che nei giochi nascono solo da una forma regionale: PokeAPI le lega alla specie, quindi
 * sembrerebbe che anche la forma normale ci arrivi (Farfetch'd → Sirfetch'd). Qui si usano solo le
 * forme normali, perciò queste evoluzioni non ci sono.
 */
const REGIONAL_ONLY = new Set([
  'sirfetchd', // Farfetch'd di Galar
  'mr-rime', // Mr. Mime di Galar
  'perrserker', // Meowth di Galar
  'cursola', // Corsola di Galar
  'obstagoon', // Linoone di Galar
  'runerigus', // Yamask di Galar
  'overqwil', // Qwilfish di Hisui
  'sneasler', // Sneasel di Hisui
  'basculegion', // Basculin a strisce bianche (Hisui)
  'clodsire', // Wooper di Paldea
]);

const out = species
  .filter((s) => defaultPokemon.has(s.id))
  .map((s) => {
    const p = defaultPokemon.get(s.id)!;
    const n = names.get(s.id) ?? {};
    const base = statsByPokemon.get(p.id)!;
    const evolutions = species
      .filter((c) => c.evolves_from_species_id === s.id && !REGIONAL_ONLY.has(c.identifier))
      .map((c) => ({ key: c.identifier, ...unlockLevel(c.id) }));
    const pre = s.evolves_from_species_id && !REGIONAL_ONLY.has(s.identifier) ? byId.get(s.evolves_from_species_id)!.identifier : undefined;
    return {
      key: s.identifier,
      dex: Number(s.id),
      name: n.it ?? n.en ?? s.identifier,
      types: (typesByPokemon.get(p.id) ?? []).sort((a, b) => a.slot - b.slot).map((t) => t.type),
      base: { hp: base.hp, atk: base.atk, def: base.def, spa: base.spa, spd: base.spd, spe: base.spe },
      heightDm: Number(p.height),
      generation: Number(s.generation_id),
      captureRate: Number(s.capture_rate),
      legendary: s.is_legendary === '1',
      mythical: s.is_mythical === '1',
      baby: s.is_baby === '1',
      ...(pre ? { preEvolution: pre } : {}),
      evolutions,
    };
  })
  .sort((a, b) => a.dex - b.dex);

const target = new URL('../src/data/pokedex.json', import.meta.url);
writeFileSync(target, JSON.stringify(out));
console.log(`Scritte ${out.length} specie in ${target.pathname}`);
