import type { PokeType } from '../data/pokedex';
import type { FormationKey } from './formations';

/**
 * Le 8 Palestre di Kanto, da battere in ordine. Livello fisso (non segue la tua rosa):
 * per batterle bisogna crescere, anche con le amichevoli sul percorso.
 * Come nei giochi le squadre dei capipalestra sono già evolute quanto il livello permette (le tue partono
 * dalla forma base ed evolvono in partita): così i Pokémon forti che non evolvono (Snorlax…) non le travolgono.
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
  /** L'asso: sempre in squadra e sempre in campo. */
  signature: string;
  /** La contromossa: l'unica specie fuori tipo del gruppo, anche lei sempre in campo. */
  counter: string;
  /** 9 specie: squadra dei giochi + aggiunte del tipo, con una sola contromossa fuori tipo. */
  pool: string[];
  /**
   * Quanto è allenata la squadra, 0-1 (talento e EV). Tarato palestra per palestra con
   * `npm run career` sulla rosa che si ha a quella tappa (con le riserve): ~45-50% di vittorie a sfida.
   */
  training: number;
  /**
   * Livelli in più della squadra rispetto al livello della palestra (che fissa il tuo tetto): per le
   * palestre che una squadra costruita apposta batterebbe troppo facilmente (`npm run counter`).
   */
  extraLevels?: number;
}

export const GYMS: Gym[] = [
  {
    leader: 'Brock', city: 'Plumbeopoli', type: 'rock', badge: 'Medaglia Sasso', level: 30, color: '#9c8a6e', training: 0.05,
    formation: 'quadrato', signature: 'onix', counter: 'oddish',
    // Rosso/Blu: Geodude, Onix
    pool: ['geodude', 'chewtle', 'archen', 'aerodactyl', 'aron', 'lileep', 'corsola', 'shuckle', 'oddish'],
  },
  {
    leader: 'Misty', city: 'Celestopoli', type: 'water', badge: 'Medaglia Cascata', level: 34, color: '#6aaecb', training: 0.5,
    formation: 'rombo', signature: 'staryu', counter: 'numel',
    // Rosso/Blu: Staryu, Starmie
    pool: ['barboach', 'wimpod', 'tentacool', 'dracovish', 'tatsugiri', 'qwilfish', 'lotad', 'chinchou', 'numel'],
  },
  {
    leader: 'Lt. Surge', city: 'Aranciopoli', type: 'electric', badge: 'Medaglia Tuono', level: 38, color: '#e8a317', training: 1, extraLevels: 1,
    formation: 'rombo', signature: 'pikachu', counter: 'spheal',
    // Rosso/Blu: Voltorb, Pikachu, Raichu
    // contro chi porta tanti Terra: Chinchou (Acqua), Wattrel ed Emolga (Volante, immuni) e Spheal (la contromossa)
    pool: ['voltorb', 'grubbin', 'chinchou', 'wattrel', 'emolga', 'stunfisk', 'joltik', 'dracozolt', 'spheal'],
  },
  {
    leader: 'Erika', city: 'Azzurropoli', type: 'grass', badge: 'Medaglia Arcobaleno', level: 43, color: '#4fb393', training: 1, extraLevels: 4,
    formation: 'rombo', signature: 'oddish', counter: 'roggenrola',
    // Rosso/Blu: Victreebel, Tangela, Vileplume
    pool: ['bellsprout', 'tangela', 'ferroseed', 'lileep', 'lotad', 'snover', 'rowlet', 'toedscool', 'roggenrola'],
  },
  {
    leader: 'Koga', city: 'Fucsiapoli', type: 'poison', badge: 'Medaglia Anima', level: 48, color: '#a890d8', training: 0.5,
    formation: 'quadrato', signature: 'koffing', counter: 'sneasel',
    // Rosso/Blu: Koffing, Muk, Koffing, Weezing
    pool: ['grimer', 'stunky', 'zubat', 'varoom', 'bulbasaur', 'tentacool', 'oddish', 'qwilfish', 'sneasel'],
  },
  {
    leader: 'Sabrina', city: 'Zafferanopoli', type: 'psychic', badge: 'Medaglia Palude', level: 53, color: '#c77dd8', training: 0.65,
    formation: 'rombo', signature: 'abra', counter: 'venonat',
    // Rosso/Blu: Kadabra, Mr. Mime, Venomoth, Alakazam
    pool: ['mr-mime', 'venonat', 'staryu', 'stantler', 'beldum', 'blipbug', 'fennekin', 'baltoy', 'inkay'],
  },
  {
    leader: 'Blaine', city: 'Isola Cannella', type: 'fire', badge: 'Medaglia Vulcano', level: 58, color: '#f08a5d', training: 0.85,
    formation: 'rombo', signature: 'growlithe', counter: 'turtwig',
    // Rosso/Blu: Growlithe, Ponyta, Rapidash, Arcanine
    pool: ['ponyta', 'capsakid', 'rolycoly', 'fletchling', 'numel', 'oricorio', 'turtonator', 'larvesta', 'turtwig'],
  },
  {
    leader: 'Giovanni', city: 'Smeraldopoli', type: 'ground', badge: 'Medaglia Terra', level: 63, color: '#c49a5a', training: 0.8,
    formation: 'quadrato', signature: 'rhyhorn', counter: 'houndour',
    // Rosso/Blu: Rhyhorn, Dugtrio, Nidoqueen, Nidoking, Rhydon
    pool: ['diglett', 'nidoran-f', 'nidoran-m', 'mudkip', 'turtwig', 'tympole', 'nincada', 'shellos', 'houndour'],
  },
];

/** Prossima palestra da sfidare, o null se hai già tutte le medaglie. */
export const nextGym = (badges: number): Gym | null => GYMS[badges] ?? null;
