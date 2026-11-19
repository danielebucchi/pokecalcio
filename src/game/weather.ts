import { TYPE_NAMES, type PokeType } from '../data/pokedex';

/**
 * Meteo dei luoghi all'aperto, come nei giochi: la pioggia rafforza l'Acqua e spegne il Fuoco, il sole
 * il contrario, la tempesta di sabbia irrobustisce Roccia, Terra e Acciaio, la grandine il Ghiaccio.
 * In palestra e in Lega si gioca al chiuso: niente meteo.
 */
export type Weather = 'pioggia' | 'sole' | 'sabbia' | 'grandine';

export const WEATHER: Record<Weather, { name: string; icon: string; boost: PokeType[]; nerf: PokeType[]; stat: 'att' | 'dif' }> = {
  pioggia: { name: 'Pioggia', icon: '🌧️', boost: ['water'], nerf: ['fire'], stat: 'att' },
  sole: { name: 'Sole', icon: '☀️', boost: ['fire'], nerf: ['water'], stat: 'att' },
  sabbia: { name: 'Tempesta di sabbia', icon: '🌪️', boost: ['rock', 'ground', 'steel'], nerf: [], stat: 'dif' },
  grandine: { name: 'Grandine', icon: '🌨️', boost: ['ice'], nerf: [], stat: 'att' },
};

/** Quanto cambia la statistica interessata: +15% per chi è favorito, −15% per chi è sfavorito. */
const BOOST = 1.15;
const NERF = 0.85;

/** Moltiplicatori di ATT e DIF per un Pokémon di questi tipi con questo meteo. */
export function weatherFactor(types: PokeType[], w: Weather | undefined): { att: number; dif: number } {
  if (!w) return { att: 1, dif: 1 };
  const info = WEATHER[w];
  const m = types.some((t) => info.boost.includes(t)) ? BOOST : types.some((t) => info.nerf.includes(t)) ? NERF : 1;
  return info.stat === 'att' ? { att: m, dif: 1 } : { att: 1, dif: m };
}

/** Descrizione breve: "Acqua più forte, Fuoco più debole". */
export function weatherText(w: Weather): string {
  const info = WEATHER[w];
  const up = info.boost.map((t) => TYPE_NAMES[t]).join(', ');
  const what = info.stat === 'att' ? 'più forte in attacco' : 'più resistente';
  return `${up} ${what}${info.nerf.length ? `, ${info.nerf.map((t) => TYPE_NAMES[t]).join(', ')} più debole` : ''}`;
}
