import type { Weather } from './weather';
/**
 * La regione di Kanto: città, percorsi e luoghi come in Rosso/Blu, con i Pokémon selvatici della zona
 * (in forma base) e un paio di allenatori iconici per percorso, da battere una volta sola.
 *
 * Coordinate su una mappa 1000×700. `badges` = medaglie necessarie per entrare (sblocchi come nei giochi).
 * `level` = livello degli allenatori del luogo: sale tra una palestra e l'altra, così battendo gli
 * allenatori lungo la strada si arriva a ogni palestra più o meno al suo livello.
 */
export type LocationKind = 'city' | 'route' | 'dungeon';

export interface RouteTrainer {
  id: string;
  /** Classe e nome, come nei giochi ("Pigliamosche", "Recluta Team Rocket"…). */
  name: string;
  /** Pokémon caratteristici (forme base); la squadra si completa con i selvatici della zona. */
  team: string[];
  /** Livello rispetto a quello del luogo (il rivale è un po' più forte). */
  levelBonus?: number;
}

/**
 * Evento di un luogo, come in Pokémon Giallo: qualcuno ti regala un Pokémon (o te ne fa scegliere
 * uno), una volta sola. Può servire aver battuto certi allenatori o avere abbastanza medaglie.
 */
export interface PlaceEvent {
  id: string;
  /** Chi te lo dà, in breve ("La ragazza di Celestopoli"). */
  title: string;
  text: string;
  /** Una specie (regalo) o più (ne scegli una, come i fossili). */
  species: string[];
  /** Livelli sotto quello del luogo (default 2). */
  levelGap?: number;
  /** Allenatori da battere prima (id). */
  beat?: string[];
  /** Medaglie necessarie. */
  badges?: number;
  /** Livelli della scorta sopra il luogo, nella sfida (default 2): tarato per vincere ~55-65%. */
  escortLevels?: number;
}

export const eventLevel = (loc: KantoLocation, ev: PlaceEvent) => Math.max(5, loc.level - (ev.levelGap ?? 2));

export interface KantoLocation {
  id: string;
  /** Meteo fisso del luogo (solo nelle partite all'aperto). */
  weather?: Weather;
  name: string;
  kind: LocationKind;
  x: number;
  y: number;
  badges: number;
  level: number;
  /** Indice in GYMS della palestra che si trova qui. */
  gym?: number;
  /** L'Altopiano Blu: sede della Lega. */
  league?: boolean;
  /** Si apre solo dopo aver vinto la Lega (la Grotta Ignota di Mewtwo). */
  requiresChampion?: boolean;
  /**
   * Leggendario che sta qui, come in Rosso/Blu: partita extra contro di lui e i selvatici della zona;
   * se vinci si unisce a te (niente tasso di cattura). `levelGap` = livelli sotto quelli del luogo
   * (negativo = sopra: come in Rosso/Blu i leggendari sono più alti dei selvatici intorno).
   */
  /** `escortLevels`: livelli sopra il luogo della sua scorta (già evoluta), tarati per vincere ~55-60%. */
  legendary?: { key: string; levelGap: number; escortLevels?: number };
  wild: string[];
  trainers: RouteTrainer[];
  /** Pokémon regalati una volta sola (vedi PlaceEvent). */
  events?: PlaceEvent[];
  /** Si entra solo dopo aver battuto questo allenatore (le sfide con il rivale, vedi RIVAL_STEPS). */
  requiresTrainer?: string;
  /** La palestra di questa città riceve solo dopo aver battuto questo allenatore. */
  gymRequiresTrainer?: string;
}

/**
 * Le sfide con il rivale Blu sono tappe fondamentali, come nei giochi: senza batterlo non si
 * prosegue. `blocks` è la palestra (indice) che non si può raggiungere o sfidare prima: 8 = la Lega.
 */
export const RIVAL_STEPS: { trainer: string; location: string; blocks: number; what: string }[] = [
  { trainer: 'blu-1', location: 'percorso-22', blocks: 0, what: 'Senza batterlo non si va oltre Smeraldopoli.' },
  { trainer: 'blu-2', location: 'celestopoli', blocks: 2, what: 'Senza batterlo non si esce da Celestopoli.' },
  { trainer: 'blu-3', location: 'aranciopoli', blocks: 2, what: 'Senza batterlo Lt. Surge non ti riceve.' },
  { trainer: 'blu-4', location: 'lavandonia', blocks: 4, what: 'Senza batterlo Fucsiapoli resta chiusa.' },
  { trainer: 'blu-5', location: 'zafferanopoli', blocks: 5, what: 'Senza batterlo Sabrina non ti riceve.' },
  { trainer: 'blu-6', location: 'percorso-23', blocks: 8, what: 'Senza batterlo la Via Vittoria resta chiusa.' },
];

const BLU = 'Rivale Blu';

export const KANTO: KantoLocation[] = [
  // ── verso Brock (Lv 30) ──
  { id: 'biancavilla', name: 'Biancavilla', kind: 'city', x: 200, y: 560, badges: 0, level: 26, wild: [], trainers: [] },
  { id: 'percorso-1', name: 'Percorso 1', kind: 'route', x: 200, y: 480, badges: 0, level: 26, wild: ['pidgey', 'rattata'], trainers: [] },
  { id: 'smeraldopoli', name: 'Smeraldopoli', kind: 'city', x: 200, y: 400, badges: 0, level: 27, gym: 7, wild: [], trainers: [] },
  {
    id: 'percorso-22', name: 'Percorso 22', kind: 'route', x: 95, y: 400, badges: 0, level: 27,
    wild: ['rattata', 'spearow', 'mankey', 'nidoran-f', 'nidoran-m'],
    trainers: [{ id: 'blu-1', name: BLU, team: ['pidgey', 'squirtle', 'rattata'], levelBonus: 1 }],
  },
  { id: 'percorso-2', name: 'Percorso 2', kind: 'route', x: 200, y: 320, badges: 0, level: 27, requiresTrainer: 'blu-1', wild: ['pidgey', 'rattata', 'caterpie', 'weedle'], trainers: [] },
  {
    id: 'bosco-smeraldo', name: 'Bosco Smeraldo', kind: 'dungeon', x: 200, y: 250, badges: 0, level: 28,
    wild: ['caterpie', 'weedle', 'pikachu'],
    trainers: [
      { id: 'bosco-pigliamosche-1', name: 'Pigliamosche', team: ['caterpie', 'weedle'] },
      { id: 'bosco-pigliamosche-2', name: 'Pigliamosche', team: ['weedle', 'caterpie', 'pikachu'] },
    ],
  },
  { id: 'plumbeopoli', name: 'Plumbeopoli', kind: 'city', x: 200, y: 170, badges: 0, level: 29, gym: 0, wild: [], trainers: [] },

  // ── verso Misty (Lv 34) ──
  {
    id: 'percorso-3', name: 'Percorso 3', kind: 'route', x: 315, y: 170, badges: 1, level: 31,
    wild: ['spearow', 'jigglypuff', 'nidoran-f', 'nidoran-m', 'mankey', 'sandshrew'],
    trainers: [
      { id: 'p3-bulletto', name: 'Bullo', team: ['rattata', 'ekans'] },
      { id: 'p3-pigliamosche', name: 'Pigliamosche', team: ['caterpie', 'weedle', 'paras'] },
    ],
  },
  {
    id: 'monte-luna', name: 'Monte Luna', kind: 'dungeon', x: 430, y: 140, badges: 1, level: 32,
    // Onix non è tra gli starter (è il portiere migliore): si guadagna qui, subito dopo Brock
    wild: ['zubat', 'geodude', 'paras', 'clefairy', 'onix'],
    events: [{
      id: 'ev-fossile', title: 'I fossili del Monte Luna',
      text: 'Battuto il Sapientone, puoi tenere uno dei due fossili: rinasce come Pokémon.',
      species: ['omanyte', 'kabuto'], beat: ['luna-sapientone'],
    }],
    trainers: [
      { id: 'luna-rocket', name: 'Recluta Team Rocket', team: ['rattata', 'zubat', 'ekans'] },
      { id: 'luna-sapientone', name: 'Sapientone', team: ['grimer', 'voltorb', 'koffing', 'omanyte', 'kabuto'] },
    ],
  },
  { id: 'percorso-4', weather: 'sabbia', name: 'Percorso 4', kind: 'route', x: 540, y: 150, badges: 1, level: 32, wild: ['rattata', 'spearow', 'ekans', 'sandshrew', 'mankey'], trainers: [] },
  {
    id: 'celestopoli', weather: 'pioggia', name: 'Celestopoli', kind: 'city', x: 650, y: 160, badges: 1, level: 33, gym: 1, wild: [],
    events: [{
      id: 'ev-bulbasaur', title: 'La ragazza di Celestopoli',
      text: 'Ha in casa un Bulbasaur che non riesce a crescere come vorrebbe: lo affida a chi ha già una medaglia.',
      species: ['bulbasaur'],
    }],
    trainers: [{ id: 'blu-2', name: BLU, team: ['pidgey', 'abra', 'rattata', 'squirtle'], levelBonus: 1 }],
  },
  {
    id: 'ponte-pepita', name: 'Ponte Pepita', kind: 'route', x: 660, y: 60, badges: 1, level: 33, requiresTrainer: 'blu-2',
    wild: ['oddish', 'bellsprout', 'venonat', 'abra', 'pidgey'],
    events: [{
      id: 'ev-charmander', title: 'Il ragazzo del Ponte Pepita',
      text: 'Il suo Charmander è stato abbandonato da un allenatore: lo dà a chi batte la recluta del ponte.',
      species: ['charmander'], beat: ['pepita-rocket'],
    }],
    trainers: [{ id: 'pepita-rocket', name: 'Recluta Team Rocket', team: ['ekans', 'zubat'] }],
  },

  // ── verso Lt. Surge (Lv 38) ──
  { id: 'percorso-5', name: 'Percorso 5', kind: 'route', x: 650, y: 240, badges: 2, level: 35, requiresTrainer: 'blu-2', wild: ['oddish', 'bellsprout', 'pidgey', 'meowth', 'mankey'], trainers: [] },
  {
    id: 'percorso-6', name: 'Percorso 6', kind: 'route', x: 650, y: 410, badges: 2, level: 36,
    // Poliwag e Goldeen: si pescano con l'Amo Buono, come in Rosso/Blu
    wild: ['oddish', 'bellsprout', 'pidgey', 'meowth', 'psyduck', 'poliwag', 'goldeen'],
    trainers: [
      { id: 'p6-campeggiatore', name: 'Campeggiatore', team: ['squirtle', 'sandshrew'] },
      { id: 'p6-allieva', name: 'Pupa', team: ['pidgey', 'oddish', 'bellsprout'] },
    ],
  },
  {
    id: 'aranciopoli', name: 'Aranciopoli', kind: 'city', x: 650, y: 490, badges: 2, level: 37, gymRequiresTrainer: 'blu-3', gym: 2, wild: ['magikarp', 'shellder', 'krabby'],
    events: [{
      id: 'ev-squirtle', title: "L'Agente Jenny",
      text: 'Gli Squirtle del corpo dei vigili del fuoco cercano un allenatore: ne affida uno a chi ha la Medaglia Tuono.',
      species: ['squirtle'], badges: 3, escortLevels: 10,
    }],
    trainers: [{ id: 'blu-3', name: `${BLU} (M/N Anna)`, team: ['pidgey', 'abra', 'rattata', 'squirtle'], levelBonus: 1 }],
  },
  {
    id: 'percorso-11', name: 'Percorso 11', kind: 'route', x: 770, y: 490, badges: 2, level: 37,
    wild: ['spearow', 'ekans', 'sandshrew', 'drowzee'],
    trainers: [{ id: 'p11-giocatore', name: 'Giocatore', team: ['poliwag', 'horsea'] }],
  },
  { id: 'grotta-diglett', name: 'Grotta Diglett', kind: 'dungeon', x: 860, y: 520, badges: 2, level: 37, wild: ['diglett'], trainers: [] },

  // ── verso Erika (Lv 43) ──
  {
    id: 'percorso-9', name: 'Percorso 9', kind: 'route', x: 780, y: 160, badges: 3, level: 39, requiresTrainer: 'blu-2',
    wild: ['rattata', 'spearow', 'ekans', 'sandshrew'],
    trainers: [{ id: 'p9-montanaro', name: 'Montanaro', team: ['geodude', 'machop', 'onix'] }],
  },
  {
    id: 'tunnel-roccioso', name: 'Tunnel Roccioso', kind: 'dungeon', x: 880, y: 210, badges: 3, level: 40,
    wild: ['zubat', 'geodude', 'machop', 'onix'],
    trainers: [{ id: 'tunnel-pokefanatico', name: 'Pokéfanatico', team: ['slowpoke', 'clefairy', 'jigglypuff'] }],
  },
  {
    id: 'centrale-elettrica', name: 'Centrale Elettrica', kind: 'dungeon', x: 950, y: 110, badges: 5, level: 52,
    wild: ['pikachu', 'magnemite', 'voltorb', 'electabuzz'], trainers: [], legendary: { key: 'zapdos', levelGap: -4, escortLevels: 8 },
  },
  {
    id: 'lavandonia', name: 'Lavandonia', kind: 'city', x: 880, y: 330, badges: 3, level: 41, wild: ['gastly', 'cubone'],
    trainers: [
      { id: 'blu-4', name: `${BLU} (Torre Pokémon)`, team: ['pidgey', 'growlithe', 'exeggcute', 'abra', 'squirtle'], levelBonus: 1 },
      { id: 'torre-medium', name: 'Medium', team: ['gastly', 'gastly'] },
    ],
  },
  { id: 'percorso-8', weather: 'sole', name: 'Percorso 8', kind: 'route', x: 770, y: 330, badges: 3, level: 41, wild: ['pidgey', 'meowth', 'ekans', 'sandshrew', 'vulpix', 'growlithe'], trainers: [] },
  { id: 'percorso-7', name: 'Percorso 7', kind: 'route', x: 540, y: 330, badges: 3, level: 41, wild: ['pidgey', 'oddish', 'bellsprout', 'meowth', 'vulpix', 'growlithe'], trainers: [] },
  {
    id: 'azzurropoli', name: 'Azzurropoli', kind: 'city', x: 430, y: 330, badges: 3, level: 42, gym: 3, wild: [],
    events: [{
      id: 'ev-eevee', title: 'Il palazzo di Azzurropoli',
      text: "All'ultimo piano c'è un Eevee che aspetta qualcuno: è tuo.",
      species: ['eevee'], escortLevels: 7,
    }],
    trainers: [{ id: 'covo-rocket', name: 'Recluta Team Rocket (Covo)', team: ['koffing', 'zubat', 'rattata', 'ekans'] }],
  },

  // ── verso Koga (Lv 48) ──
  {
    id: 'pista-ciclabile', weather: 'sole', name: 'Pista Ciclabile', kind: 'route', x: 320, y: 460, badges: 4, level: 45,
    // Lickitung: in Rosso/Blu si aveva con lo scambio in fondo alla Pista
    wild: ['rattata', 'spearow', 'doduo', 'lickitung'],
    trainers: [
      { id: 'pista-centauro', name: 'Centauro', team: ['koffing', 'grimer'] },
      { id: 'pista-teppista', name: 'Teppista', team: ['machop', 'rattata'] },
    ],
  },
  {
    id: 'percorso-12', weather: 'pioggia', name: 'Percorsi 12-15', kind: 'route', x: 880, y: 450, badges: 4, level: 45,
    wild: ['oddish', 'bellsprout', 'venonat', 'pidgey', 'ditto', 'snorlax', 'farfetchd'],
    trainers: [
      { id: 'p12-pescatore', name: 'Pescatore', team: ['magikarp', 'goldeen', 'tentacool'] },
      { id: 'p13-ornitologo', name: 'Ornitologo', team: ['pidgey', 'spearow', 'farfetchd'] },
    ],
  },
  {
    id: 'fucsiapoli', name: 'Fucsiapoli', kind: 'city', x: 500, y: 590, badges: 4, level: 47, requiresTrainer: 'blu-4', gym: 4,
    // Zona Safari
    wild: ['nidoran-f', 'nidoran-m', 'exeggcute', 'rhyhorn', 'chansey', 'kangaskhan', 'scyther', 'pinsir', 'tauros', 'dratini'],
    trainers: [],
  },

  // ── verso Sabrina (Lv 53) ──
  {
    id: 'zafferanopoli', name: 'Zafferanopoli', kind: 'city', x: 650, y: 330, badges: 5, level: 51, gymRequiresTrainer: 'blu-5', gym: 5, wild: [],
    events: [
      {
        id: 'ev-dojo', title: 'Il Dojo Karate',
        text: 'Battuto il maestro, puoi portare via uno dei suoi due campioni.',
        species: ['hitmonlee', 'hitmonchan'], beat: ['dojo-karateka'], escortLevels: 8,
      },
      {
        id: 'ev-lapras', title: 'La Silph SpA',
        text: 'Liberata la Silph dal Team Rocket, un dipendente ti ringrazia con un Lapras.',
        species: ['lapras'], beat: ['silph-scienziato', 'blu-5'], levelGap: 4, escortLevels: 5,
      },
    ],
    trainers: [
      { id: 'dojo-karateka', name: 'Karateka (Dojo)', team: ['hitmonlee', 'hitmonchan', 'machop', 'mankey'] },
      { id: 'silph-scienziato', name: 'Scienziato (Silph SpA)', team: ['magnemite', 'voltorb', 'porygon'] },
      { id: 'blu-5', name: `${BLU} (Silph SpA)`, team: ['pidgey', 'growlithe', 'exeggcute', 'abra', 'squirtle', 'eevee'], levelBonus: 1 },
    ],
  },

  // ── verso Blaine (Lv 58) ──
  {
    id: 'percorsi-19-20', weather: 'pioggia', name: 'Percorsi 19-20', kind: 'route', x: 400, y: 640, badges: 5, level: 55,
    wild: ['tentacool', 'magikarp', 'shellder', 'horsea', 'staryu', 'krabby'],
    trainers: [
      { id: 'p19-nuotatore', name: 'Nuotatore', team: ['tentacool', 'shellder', 'horsea'] },
      { id: 'p20-nuotatrice', name: 'Nuotatrice', team: ['staryu', 'goldeen', 'seel'] },
    ],
  },
  {
    id: 'isole-spumarine', weather: 'grandine', name: 'Isole Spumarine', kind: 'dungeon', x: 300, y: 660, badges: 5, level: 56,
    wild: ['seel', 'psyduck', 'slowpoke', 'zubat', 'krabby', 'jynx'], trainers: [], legendary: { key: 'articuno', levelGap: -6, escortLevels: 5 },
  },
  {
    id: 'isola-cannella', weather: 'sole', name: 'Isola Cannella', kind: 'city', x: 200, y: 650, badges: 5, level: 57, gym: 6,
    // Villa Pokémon
    wild: ['grimer', 'koffing', 'ponyta', 'growlithe', 'vulpix', 'magmar'],
    events: [{
      id: 'ev-ambra', title: "L'Ambra Antica",
      text: "Battuto lo Scienziato della Villa Pokémon, il laboratorio di Cannella rianima l'Ambra Antica: ne nasce un Aerodactyl.",
      // Aerodactyl è già nella forma finale e fortissimo: scorta più bassa per restare sul ~55%
      species: ['aerodactyl'], beat: ['villa-scassinatore'], escortLevels: -2,
    }],
    trainers: [{ id: 'villa-scassinatore', name: 'Scienziato (Villa Pokémon)', team: ['growlithe', 'vulpix', 'ponyta'] }],
  },

  // ── verso Giovanni (Lv 63) ──
  {
    id: 'percorso-21', name: 'Percorso 21', kind: 'route', x: 200, y: 605, badges: 6, level: 61,
    // Mr. Mime (nei giochi si aveva con uno scambio): qui solo dopo la 6ª medaglia, perché è tanto
    // forte contro Erika, Koga e Sabrina da renderle troppo facili (vedi npm run counter)
    wild: ['tentacool', 'tangela', 'rattata', 'pidgey', 'magikarp', 'mr-mime'],
    trainers: [
      { id: 'p21-pescatore', name: 'Pescatore', team: ['goldeen', 'shellder', 'poliwag'] },
      { id: 'p21-nuotatore', name: 'Nuotatore', team: ['tentacool', 'horsea', 'staryu'] },
    ],
  },

  // ── verso la Lega (dopo 8 medaglie) ──
  {
    id: 'percorso-23', weather: 'sabbia', name: 'Percorso 23', kind: 'route', x: 70, y: 280, badges: 8, level: 64,
    wild: ['spearow', 'ekans', 'sandshrew', 'mankey'],
    trainers: [{ id: 'blu-6', name: `${BLU} (Percorso 22)`, team: ['pidgey', 'growlithe', 'exeggcute', 'abra', 'squirtle', 'rhyhorn'], levelBonus: 1 }],
  },
  {
    id: 'via-vittoria', name: 'Via Vittoria', kind: 'dungeon', x: 70, y: 180, badges: 8, level: 65, requiresTrainer: 'blu-6', legendary: { key: 'moltres', levelGap: 0, escortLevels: 16 },
    wild: ['machop', 'geodude', 'onix', 'zubat', 'cubone'],
    trainers: [
      { id: 'vittoria-fantallenatore', name: 'Fantallenatore', team: ['dratini', 'rhyhorn', 'exeggcute'] },
      { id: 'vittoria-fantallenatrice', name: 'Fantallenatrice', team: ['lapras', 'growlithe', 'kangaskhan'] },
    ],
  },
  // dopo la Lega, come in Rosso/Blu
  {
    id: 'grotta-ignota', name: 'Grotta Ignota', kind: 'dungeon', x: 740, y: 70, badges: 8, level: 70, requiresChampion: true,
    wild: ['abra', 'voltorb', 'ditto', 'rhyhorn', 'paras', 'magnemite', 'zubat', 'jigglypuff', 'chansey'], trainers: [],
    legendary: { key: 'mewtwo', levelGap: -2, escortLevels: 9 },
  },
  { id: 'altopiano-blu', name: 'Altopiano Blu', kind: 'city', x: 70, y: 80, badges: 8, level: 66, league: true, wild: [], trainers: [] },
];

/** Collegamenti tra i luoghi (si va solo nei luoghi vicini; dopo la Medaglia Tuono c'è il Volo). */
export const KANTO_LINKS: [string, string][] = [
  ['biancavilla', 'percorso-1'], ['percorso-1', 'smeraldopoli'], ['smeraldopoli', 'percorso-22'], ['smeraldopoli', 'percorso-2'],
  ['percorso-2', 'bosco-smeraldo'], ['bosco-smeraldo', 'plumbeopoli'], ['plumbeopoli', 'percorso-3'], ['percorso-3', 'monte-luna'],
  ['monte-luna', 'percorso-4'], ['percorso-4', 'celestopoli'], ['celestopoli', 'ponte-pepita'], ['celestopoli', 'percorso-5'],
  ['percorso-5', 'zafferanopoli'], ['zafferanopoli', 'percorso-6'], ['percorso-6', 'aranciopoli'], ['aranciopoli', 'percorso-11'],
  ['percorso-11', 'grotta-diglett'], ['celestopoli', 'percorso-9'], ['percorso-9', 'tunnel-roccioso'], ['tunnel-roccioso', 'centrale-elettrica'],
  ['tunnel-roccioso', 'lavandonia'], ['lavandonia', 'percorso-8'], ['percorso-8', 'zafferanopoli'], ['zafferanopoli', 'percorso-7'],
  ['percorso-7', 'azzurropoli'],
  // i sotterranei: si gira intorno a Zafferanopoli finché è chiusa
  ['percorso-5', 'percorso-6'], ['percorso-7', 'percorso-8'], ['azzurropoli', 'pista-ciclabile'], ['pista-ciclabile', 'fucsiapoli'], ['lavandonia', 'percorso-12'],
  ['percorso-12', 'fucsiapoli'], ['fucsiapoli', 'percorsi-19-20'], ['percorsi-19-20', 'isole-spumarine'], ['isole-spumarine', 'isola-cannella'],
  ['isola-cannella', 'percorso-21'], ['percorso-21', 'biancavilla'], ['percorso-22', 'percorso-23'], ['percorso-23', 'via-vittoria'],
  ['via-vittoria', 'altopiano-blu'], ['celestopoli', 'grotta-ignota'],
];

/** Medaglie dopo le quali si può volare verso le città già visitate (Medaglia Tuono, come la MN02 in Rosso/Blu). */
export const FLY_BADGES = 3;

export const locationById = (id: string) => KANTO.find((l) => l.id === id)!;

export function neighbors(id: string): string[] {
  return KANTO_LINKS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}

/** Livello di un allenatore del percorso. */
/** Livelli in più degli allenatori sul luogo: la tua squadra parte già al 30 e cresce fino al tetto. */
export const TRAINER_LEVEL = { bonus: 2 };
export const trainerLevel = (loc: KantoLocation, t: RouteTrainer) => loc.level + TRAINER_LEVEL.bonus + (t.levelBonus ?? 0);
