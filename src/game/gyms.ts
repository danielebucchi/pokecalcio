import type { PokeType } from '../data/pokedex';
import type { FormationKey } from './formations';

/**
 * Le 8 Palestre di Kanto, da battere in ordine. Livello fisso (non segue la tua rosa):
 * per batterle bisogna crescere, anche con le amichevoli sul percorso.
 * I capipalestra schierano forme base, che evolvono in partita come le tue.
 *
 * Squadra: il Pokémon simbolo (l'asso) c'è sempre, gli altri 6 si pescano a ogni sfida da un gruppo di 9.
 * Il gruppo parte dalla squadra di Rosso/Blu (in forma base) e si completa con specie del tipo della
 * palestra che ne coprono le debolezze. Una sola specie è di un altro tipo: la contromossa, che batte i
 * tipi che mettono in difficoltà il capopalestra (Misty → Numel, Fuoco/Terra; per Sabrina è il suo Venonat).
 * Una specie è "del tipo" se lo è la forma base o tutte le forme finali (i Nidoran di Giovanni sì).
 */
export interface Gym {
  leader: string;
  city: string;
  type: PokeType;
  badge: string;
  level: number;
  color: string;
  formation: FormationKey;
  /** Sempre in squadra. */
  signature: string;
  /** 9 specie: squadra dei giochi + aggiunte del tipo, con una sola contromossa fuori tipo. */
  pool: string[];
}

export const GYMS: Gym[] = [
  {
    leader: 'Brock', city: 'Plumbeopoli', type: 'rock', badge: 'Medaglia Sasso', level: 30, color: '#9c8a6e',
    formation: 'quadrato', signature: 'onix',
    // Rosso/Blu: Geodude, Onix
    pool: ['geodude', 'chewtle', 'archen', 'aerodactyl', 'aron', 'lileep', 'corsola', 'shuckle', 'oddish'],
  },
  {
    leader: 'Misty', city: 'Celestopoli', type: 'water', badge: 'Medaglia Cascata', level: 34, color: '#6aaecb',
    formation: 'rombo', signature: 'staryu',
    // Rosso/Blu: Staryu, Starmie
    pool: ['barboach', 'wimpod', 'tentacool', 'dracovish', 'tatsugiri', 'qwilfish', 'lotad', 'chinchou', 'numel'],
  },
  {
    leader: 'Lt. Surge', city: 'Aranciopoli', type: 'electric', badge: 'Medaglia Tuono', level: 38, color: '#e8a317',
    formation: 'rombo', signature: 'pikachu',
    // Rosso/Blu: Voltorb, Pikachu, Raichu
    pool: ['voltorb', 'grubbin', 'chinchou', 'wattrel', 'magnemite', 'stunfisk', 'joltik', 'dracozolt', 'spheal'],
  },
  {
    leader: 'Erika', city: 'Azzurropoli', type: 'grass', badge: 'Medaglia Arcobaleno', level: 43, color: '#4fb393',
    formation: 'rombo', signature: 'oddish',
    // Rosso/Blu: Victreebel, Tangela, Vileplume
    pool: ['bellsprout', 'tangela', 'ferroseed', 'lileep', 'lotad', 'snover', 'rowlet', 'toedscool', 'roggenrola'],
  },
  {
    leader: 'Koga', city: 'Fucsiapoli', type: 'poison', badge: 'Medaglia Anima', level: 48, color: '#a890d8',
    formation: 'quadrato', signature: 'koffing',
    // Rosso/Blu: Koffing, Muk, Koffing, Weezing
    pool: ['grimer', 'stunky', 'zubat', 'varoom', 'bulbasaur', 'tentacool', 'oddish', 'qwilfish', 'sneasel'],
  },
  {
    leader: 'Sabrina', city: 'Zafferanopoli', type: 'psychic', badge: 'Medaglia Palude', level: 53, color: '#c77dd8',
    formation: 'rombo', signature: 'abra',
    // Rosso/Blu: Kadabra, Mr. Mime, Venomoth, Alakazam
    pool: ['mr-mime', 'venonat', 'staryu', 'stantler', 'beldum', 'blipbug', 'fennekin', 'baltoy', 'inkay'],
  },
  {
    leader: 'Blaine', city: 'Isola Cannella', type: 'fire', badge: 'Medaglia Vulcano', level: 58, color: '#f08a5d',
    formation: 'rombo', signature: 'growlithe',
    // Rosso/Blu: Growlithe, Ponyta, Rapidash, Arcanine
    pool: ['ponyta', 'capsakid', 'rolycoly', 'fletchling', 'numel', 'oricorio', 'turtonator', 'larvesta', 'turtwig'],
  },
  {
    leader: 'Giovanni', city: 'Smeraldopoli', type: 'ground', badge: 'Medaglia Terra', level: 63, color: '#c49a5a',
    formation: 'quadrato', signature: 'rhyhorn',
    // Rosso/Blu: Rhyhorn, Dugtrio, Nidoqueen, Nidoking, Rhydon
    pool: ['diglett', 'nidoran-f', 'nidoran-m', 'mudkip', 'turtwig', 'tympole', 'nincada', 'shellos', 'houndour'],
  },
];

/** Prossima palestra da sfidare, o null se hai già tutte le medaglie. */
export const nextGym = (badges: number): Gym | null => GYMS[badges] ?? null;
