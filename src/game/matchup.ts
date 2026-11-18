import { POKEDEX, type PokeType } from '../data/pokedex';
import type { TeamSetup } from '../match/engine';
import { evolvedForm } from '../match/teams';
import { autoBench, autoLineup, type OwnedPokemon, type SaveData } from './save';
import { typeMultiplier } from './typechart';

/**
 * Confronto prima di una sfida: per ogni Pokémon avversario chi dei tuoi lo batte di tipo e chi ne
 * soffre, più una formazione consigliata che tiene conto dei tipi. Si guardano le forme che i Pokémon
 * raggiungono in partita a quel livello (Charmander gioca da Charizard, che vola).
 */

const formTypes = (key: string, level: number): PokeType[] => POKEDEX[evolvedForm(key, level)].types;

export interface MatchupRow {
  /** Forma con cui l'avversario gioca. */
  form: string;
  level: number;
  types: PokeType[];
  strong: OwnedPokemon[];
  weak: OwnedPokemon[];
}

export function matchupRows(save: SaveData, them: TeamSetup): MatchupRow[] {
  return them.roster.map(({ inst }) => {
    const form = evolvedForm(inst.speciesKey, inst.level);
    const theirs = POKEDEX[form].types;
    const mineTypes = (p: OwnedPokemon) => formTypes(p.speciesKey, p.level);
    return {
      form,
      level: inst.level,
      types: theirs,
      strong: save.roster.filter((p) => typeMultiplier(mineTypes(p), theirs) > 1),
      weak: save.roster.filter((p) => typeMultiplier(theirs, mineTypes(p)) > 1),
    };
  });
}

/** Vantaggio di tipo medio di un tuo Pokémon contro tutta la squadra (0 = neutro). */
function edge(p: OwnedPokemon, them: TeamSetup): number {
  const mine = formTypes(p.speciesKey, p.level);
  const all = them.roster.map(({ inst }) => formTypes(inst.speciesKey, inst.level));
  return all.reduce((a, t) => a + Math.log(typeMultiplier(mine, t)) - Math.log(typeMultiplier(t, mine)), 0) / all.length;
}

/** Quanto pesa il tipo rispetto al voto nel ruolo: un buon vantaggio vale circa un 15% di voto. */
const EDGE_WEIGHT = 0.6;

/** Formazione e panchina consigliate contro questa squadra (stesso modulo che hai scelto). */
export function suggestedLineup(save: SaveData, them: TeamSetup): { lineup: (string | null)[]; bench: string[] } {
  const w = (p: OwnedPokemon) => Math.exp(EDGE_WEIGHT * edge(p, them));
  const lineup = autoLineup(save, w);
  return { lineup, bench: autoBench({ ...save, lineup }, w) };
}
