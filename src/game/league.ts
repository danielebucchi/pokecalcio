import type { PokeType } from '../data/pokedex';
import type { FormationKey } from './formations';

/**
 * Lega Pokémon, dopo l'8ª medaglia: torneo a eliminazione diretta a 8. A ogni edizione si
 * sorteggiano 7 allenatori tra i più famosi della serie (campioni, rivali, Superquattro, Ash),
 * poi il tabellone. In caso di pareggio si va ai rigori.
 * Le squadre partono da quelle che hanno nei videogiochi (in forma base; per le linee che iniziano
 * con un "baby" si usa il primo stadio non baby: Pikachu, Lucario, Roselia…). Il gruppo si completa
 * con Pokémon che si integrano bene: coprono le debolezze della squadra originale, ne condividono
 * i tipi (gli specialisti restano nel loro tipo) e hanno una forma finale forte.
 * Simbolo = l'asso dell'allenatore; portiere = il più solido del gruppo. A ogni sfida si pescano gli altri.
 */
export interface LeagueTrainer {
  id: string;
  name: string;
  title: string;
  /** Tipo in cui è specializzato (Superquattro, Adriano…); assente = squadra mista. */
  type?: PokeType;
  color: string;
  level: number;
  formation: FormationKey;
  signature: string;
  /** Portiere fisso (se diverso dal simbolo): le squadre forti in attacco ne hanno bisogno. */
  keeper?: string;
  /** Leggendari del personaggio: uno, sorteggiato a ogni sfida, è sempre in squadra (N: Zekrom o Reshiram). */
  legendary?: string[];
  pool: string[];
}

/**
 * Superquattro, Campioni e rivali di tutte le regioni (più Rosso e Ash): a ogni edizione se ne
 * sorteggiano 7. Nomi italiani da Pokémon Central; il commento indica la squadra originale.
 */
export const LEAGUE: LeagueTrainer[] = [
  {
    // Spada e Scudo: honedge, dreepy, axew, tympole, scorbunny, charmander
    id: 'dandel', name: 'Dandel', title: 'Campione di Galar', color: '#e879a8', level: 70, formation: 'rombo',
    signature: 'charmander', keeper: 'honedge', pool: ['honedge', 'dreepy', 'axew', 'tympole', 'scorbunny', 'treecko', 'zorua', 'chespin', 'flabebe'],
  },
  {
    // HeartGold e SoulSilver: pikachu, eevee, snorlax, bulbasaur, charmander, squirtle
    id: 'rosso', name: 'Rosso', title: 'La leggenda del Monte Argento', color: '#5b8def', level: 70, formation: 'rombo',
    signature: 'pikachu', keeper: 'snorlax', pool: ['eevee', 'snorlax', 'bulbasaur', 'charmander', 'squirtle', 'grookey', 'hippopotas', 'basculin', 'farfetchd'],
  },
  {
    // Esploratori Pokémon (Masters 8): pikachu, lucario, dratini, gastly, farfetchd, dracovish
    id: 'ash', name: 'Ash', title: 'Campione del mondo', color: '#e8a317', level: 69, formation: 'rombo',
    signature: 'pikachu', keeper: 'dracovish', pool: ['lucario', 'dratini', 'gastly', 'farfetchd', 'dracovish', 'cetoddle', 'yanma', 'feebas', 'trapinch'],
  },
  {
    // Platino: spiritomb, roselia, togetic, lucario, feebas, gible
    id: 'camilla', name: 'Camilla', title: 'Campionessa di Sinnoh', color: '#4fb393', level: 69, formation: 'rombo',
    signature: 'gible', keeper: 'tangela', pool: ['spiritomb', 'roselia', 'togetic', 'lucario', 'feebas', 'kabuto', 'oddish', 'tirtouga', 'tangela'],
  },
  {
    // Smeraldo: wailmer, tentacool, lotad, barboach, magikarp, feebas
    id: 'adriano', name: 'Adriano', title: 'Campione di Hoenn', type: 'water', color: '#6aaecb', level: 68, formation: 'rombo',
    signature: 'feebas', keeper: 'qwilfish', pool: ['wailmer', 'tentacool', 'lotad', 'barboach', 'magikarp', 'qwilfish', 'wimpod', 'omanyte', 'mareanie'],
  },
  {
    // Scarlatto e Violetto: flittle, skiddo, veluza, bergmite, pawniard, glimmet
    id: 'alisma', name: 'Alisma', title: 'Campionessa di Paldea', color: '#f08a5d', level: 68, formation: 'rombo',
    signature: 'glimmet', keeper: 'veluza', pool: ['flittle', 'skiddo', 'veluza', 'bergmite', 'pawniard', 'rufflet', 'rhyhorn', 'yanma', 'piplup'],
  },
  {
    // Rosso e Blu: pidgey, abra, rhyhorn, exeggcute, magikarp, charmander
    id: 'blu', name: 'Blu', title: 'Campione di Kanto', color: '#6aaecb', level: 68, formation: 'rombo',
    signature: 'pidgey', keeper: 'carbink', pool: ['abra', 'rhyhorn', 'exeggcute', 'magikarp', 'charmander', 'carbink', 'smoliv', 'binacle', 'feebas'],
  },
  {
    // X e Y: hawlucha, tyrunt, amaura, pumpkaboo, goomy, ralts
    id: 'diantha', name: 'Diantha', title: 'Campionessa di Kalos', color: '#b03a48', level: 68, formation: 'rombo',
    signature: 'ralts', keeper: 'hawlucha', pool: ['hawlucha', 'tyrunt', 'amaura', 'pumpkaboo', 'goomy', 'litleo', 'klink', 'zubat', 'squirtle'],
  },
  {
    // Nero 2 e Bianco 2: deino, druddigon, aron, archen, lapras, axew
    id: 'iris', name: 'Iris', title: 'Campionessa di Unima', type: 'dragon', color: '#6b7fd8', level: 68, formation: 'rombo',
    signature: 'axew', keeper: 'lapras', pool: ['deino', 'druddigon', 'aron', 'archen', 'lapras', 'noibat', 'duraludon', 'dreepy', 'goomy'],
  },
  {
    // Sole e Luna: rockruff, vulpix, rufflet, magnemite, snorlax, litten
    id: 'kukui', name: 'Kukui', title: 'Campione di Alola', color: '#5b8def', level: 68, formation: 'rombo',
    signature: 'rockruff', keeper: 'snorlax', pool: ['vulpix', 'rufflet', 'magnemite', 'snorlax', 'litten', 'exeggcute', 'skiddo', 'bellsprout', 'totodile'],
  },
  {
    // Oro e Argento: magikarp, dratini, aerodactyl, charmander
    id: 'lance', name: 'Lance', title: 'Campione di Johto', type: 'dragon', color: '#6b7fd8', level: 68, formation: 'rombo',
    signature: 'dratini', keeper: 'duraludon', pool: ['magikarp', 'aerodactyl', 'charmander', 'duraludon', 'applin', 'gible', 'dracovish', 'noibat', 'tyrunt'],
  },
  {
    // Nero e Bianco: shelmet, bouffalant, druddigon, vanillite, karrablast, larvesta
    id: 'nardo', name: 'Nardo', title: 'Campione di Unima', color: '#4fb393', level: 68, formation: 'rombo',
    signature: 'larvesta', keeper: 'bouffalant', pool: ['shelmet', 'bouffalant', 'druddigon', 'vanillite', 'karrablast', 'geodude', 'larvitar', 'magikarp', 'mudkip'],
  },
  {
    // Scarlatto e Violetto: rockruff, goomy, dunsparce, orthworm, pawmi, sprigatito
    id: 'nemona', name: 'Nemi', title: 'Campionessa di Paldea', color: '#c77dd8', level: 68, formation: 'rombo',
    signature: 'pawmi', keeper: 'orthworm', pool: ['rockruff', 'goomy', 'dunsparce', 'orthworm', 'sprigatito', 'scyther', 'slowpoke', 'milcery', 'slakoth'],
  },
  {
    // Rubino e Zaffiro: skarmory, baltoy, aron, lileep, anorith, beldum
    id: 'rocco', name: 'Rocco', title: 'Campione di Hoenn', type: 'steel', color: '#8a9bb0', level: 68, formation: 'quadrato',
    signature: 'beldum', keeper: 'skarmory', pool: ['skarmory', 'baltoy', 'aron', 'lileep', 'anorith', 'pawniard', 'cufant', 'tinkatink', 'magnemite'],
  },
  {
    // Nero e Bianco: tirtouga, vanillite, archen, zorua, klink
    id: 'n', name: 'N', title: 'Rivale di Unima', color: '#6aaecb', level: 66, formation: 'rombo',
    signature: 'zorua', keeper: 'tirtouga', legendary: ['zekrom', 'reshiram'], pool: ['tirtouga', 'vanillite', 'archen', 'klink', 'baltoy', 'sewaddle', 'poliwag', 'rookidee', 'drilbur'],
  },
  {
    // Platino: wurmple, combee, heracross, skorupi
    id: 'aaron', name: 'Aaron', title: 'Superquattro di Sinnoh', type: 'bug', color: '#9bb55a', level: 65, formation: 'rombo',
    signature: 'skorupi', keeper: 'shuckle', pool: ['wurmple', 'combee', 'heracross', 'shuckle', 'anorith', 'wimpod', 'sewaddle', 'larvesta', 'sizzlipede'],
  },
  {
    // Rosso e Blu: gastly, zubat, ekans
    id: 'agatha', name: 'Agatha', title: 'Superquattro di Kanto', type: 'ghost', color: '#7a62b8', level: 65, formation: 'rombo',
    signature: 'gastly', keeper: 'dhelmise', pool: ['zubat', 'ekans', 'honedge', 'dhelmise', 'litwick', 'poltchageist', 'dreepy', 'gimmighoul', 'duskull'],
  },
  {
    // Sole e Luna: relicanth, carbink, geodude, nosepass, rockruff
    id: 'olivia', name: 'Alyxia', title: 'Superquattro di Alola', type: 'rock', color: '#9c8a6e', level: 65, formation: 'quadrato',
    signature: 'rockruff', keeper: 'shuckle', pool: ['relicanth', 'carbink', 'geodude', 'nosepass', 'archen', 'aerodactyl', 'lileep', 'corsola', 'shuckle'],
  },
  {
    // Nero e Bianco: yamask, frillish, golett, litwick
    id: 'shauntal', name: 'Antemia', title: 'Superquattro di Unima', type: 'ghost', color: '#7a62b8', level: 65, formation: 'rombo',
    signature: 'litwick', keeper: 'dhelmise', pool: ['yamask', 'frillish', 'golett', 'dhelmise', 'dreepy', 'honedge', 'poltchageist', 'gimmighoul', 'duskull'],
  },
  {
    // Oro e Argento: sneasel, zubat, magnemite, gastly, abra, totodile
    id: 'silver', name: 'Argento', title: 'Rivale di Johto', color: '#4fb393', level: 65, formation: 'rombo',
    signature: 'totodile', keeper: 'sneasel', pool: ['sneasel', 'zubat', 'magnemite', 'gastly', 'abra', 'sandile', 'froakie', 'sprigatito', 'popplio'],
  },
  {
    // Rosso e Blu: onix, hitmonchan, hitmonlee, machop
    id: 'bruno', name: 'Bruno', title: 'Superquattro di Kanto', type: 'fighting', color: '#d9785f', level: 65, formation: 'quadrato',
    signature: 'machop', keeper: 'onix', pool: ['onix', 'hitmonchan', 'hitmonlee', 'croagunk', 'heracross', 'mankey', 'mienfoo', 'timburr', 'hawlucha'],
  },
  {
    // Scarlatto e Violetto: barboach, numel, phanpy, diglett, wooper
    id: 'rika', name: 'Capsi', title: 'Superquattro di Paldea', type: 'ground', color: '#c49a5a', level: 65, formation: 'quadrato',
    signature: 'wooper', keeper: 'onix', pool: ['barboach', 'numel', 'phanpy', 'diglett', 'toedscool', 'gligar', 'rhyhorn', 'gible', 'onix'],
  },
  {
    // Nero e Bianco: munna, sigilyph, solosis, gothita
    id: 'caitlin', name: 'Catlina', title: 'Superquattro di Unima', type: 'psychic', color: '#c77dd8', level: 65, formation: 'rombo',
    signature: 'gothita', keeper: 'oranguru', pool: ['munna', 'sigilyph', 'solosis', 'ralts', 'bronzor', 'girafarig', 'oranguru', 'exeggcute', 'beldum'],
  },
  {
    // Rubino e Zaffiro: bagon, swablu, horsea, trapinch
    id: 'drake', name: 'Drake', title: 'Superquattro di Hoenn', type: 'dragon', color: '#6b7fd8', level: 65, formation: 'rombo',
    signature: 'bagon', keeper: 'duraludon', pool: ['swablu', 'horsea', 'trapinch', 'duraludon', 'dratini', 'goomy', 'dracovish', 'jangmo-o', 'axew'],
  },
  {
    // Rubino e Zaffiro: duskull, shuppet, sableye
    id: 'phoebe', name: 'Ester', title: 'Superquattro di Hoenn', type: 'ghost', color: '#7a62b8', level: 65, formation: 'rombo',
    signature: 'duskull', keeper: 'misdreavus', pool: ['shuppet', 'sableye', 'gastly', 'pumpkaboo', 'litwick', 'sinistea', 'drifloon', 'honedge', 'misdreavus'],
  },
  {
    // Rubino e Zaffiro: poochyena, seedot, cacnea, corphish, absol
    id: 'sidney', name: 'Fosco', title: 'Superquattro di Hoenn', type: 'dark', color: '#5a5470', level: 65, formation: 'rombo',
    signature: 'absol', keeper: 'vullaby', pool: ['poochyena', 'seedot', 'cacnea', 'corphish', 'houndour', 'pawniard', 'murkrow', 'vullaby', 'impidimp'],
  },
  {
    // Rubino e Zaffiro: spheal, snorunt
    id: 'glacia', name: 'Frida', title: 'Superquattro di Hoenn', type: 'ice', color: '#8ec5d8', level: 65, formation: 'rombo',
    signature: 'spheal', keeper: 'lapras', pool: ['snorunt', 'swinub', 'lapras', 'frigibax', 'arctovish', 'snover', 'amaura', 'arctozolt', 'vanillite'],
  },
  {
    // Sole e Luna: makuhita, mankey, stufful, poliwag, crabrawler
    id: 'hala', name: 'Hala', title: 'Superquattro di Alola', type: 'fighting', color: '#d9785f', level: 65, formation: 'quadrato',
    signature: 'crabrawler', keeper: 'passimian', pool: ['makuhita', 'mankey', 'stufful', 'poliwag', 'croagunk', 'passimian', 'heracross', 'mienfoo', 'machop'],
  },
  {
    // Sole e Luna: skarmory, zubat, oricorio, vullaby, pikipek
    id: 'kahili', name: 'Kahili', title: 'Superquattro di Alola', type: 'flying', color: '#7fb3e0', level: 65, formation: 'rombo',
    signature: 'pikipek', keeper: 'skarmory', pool: ['skarmory', 'zubat', 'oricorio', 'vullaby', 'gligar', 'rowlet', 'hawlucha', 'flamigo', 'wattrel'],
  },
  {
    // Oro e Argento: eevee, oddish, gastly, murkrow, houndour
    id: 'karen', name: 'Karen', title: 'Superquattro di Johto', type: 'dark', color: '#5a5470', level: 65, formation: 'rombo',
    signature: 'houndour', keeper: 'vullaby', pool: ['eevee', 'oddish', 'gastly', 'murkrow', 'pawniard', 'vullaby', 'sandile', 'impidimp', 'deino'],
  },
  {
    // Oro e Argento: spinarak, venonat, pineco, grimer, zubat
    id: 'koga', name: 'Koga', title: 'Superquattro di Johto', type: 'poison', color: '#a890d8', level: 65, formation: 'rombo',
    signature: 'zubat', keeper: 'qwilfish', pool: ['spinarak', 'venonat', 'pineco', 'grimer', 'varoom', 'glimmet', 'tentacool', 'bulbasaur', 'qwilfish'],
  },
  {
    // X e Y: skrelp, druddigon, swablu, noibat
    id: 'drasna', name: 'Lilia', title: 'Superquattro di Kalos', type: 'dragon', color: '#6b7fd8', level: 65, formation: 'rombo',
    signature: 'noibat', keeper: 'duraludon', pool: ['skrelp', 'druddigon', 'swablu', 'duraludon', 'bagon', 'dracozolt', 'cyclizar', 'frigibax', 'applin'],
  },
  {
    // Rosso e Blu: seel, shellder, slowpoke, jynx, lapras
    id: 'lorelei', name: 'Lorelei', title: 'Superquattro di Kanto', type: 'ice', color: '#8ec5d8', level: 65, formation: 'rombo',
    signature: 'lapras', keeper: 'lapras', pool: ['seel', 'shellder', 'slowpoke', 'jynx', 'frigibax', 'swinub', 'snover', 'arctozolt', 'spheal'],
  },
  {
    // Platino: mr-mime, eevee, bronzor, abra, ralts
    id: 'lucian', name: 'Luciano', title: 'Superquattro di Sinnoh', type: 'psychic', color: '#c77dd8', level: 65, formation: 'rombo',
    signature: 'ralts', keeper: 'oranguru', pool: ['mr-mime', 'eevee', 'bronzor', 'abra', 'girafarig', 'slowpoke', 'oranguru', 'sigilyph', 'beldum'],
  },
  {
    // Sole e Luna: sableye, drifloon, dhelmise, snorunt, sandygast
    id: 'acerola', name: 'Malpi', title: 'Superquattro di Alola', type: 'ghost', color: '#7a62b8', level: 65, formation: 'rombo',
    signature: 'sandygast', keeper: 'dhelmise', pool: ['sableye', 'drifloon', 'dhelmise', 'snorunt', 'litwick', 'sinistea', 'gastly', 'misdreavus', 'honedge'],
  },
  {
    // X e Y: litleo, torkoal, litwick, fletchling
    id: 'malva', name: 'Malva', title: 'Superquattro di Kalos', type: 'fire', color: '#f08a5d', level: 65, formation: 'rombo',
    signature: 'fletchling', keeper: 'torkoal', pool: ['litleo', 'torkoal', 'litwick', 'chimchar', 'fennekin', 'torchic', 'larvesta', 'litten', 'sizzlipede'],
  },
  {
    // Nero e Bianco: purrloin, scraggy, sandile, pawniard
    id: 'grimsley', name: 'Marzio', title: 'Superquattro di Unima', type: 'dark', color: '#5a5470', level: 65, formation: 'rombo',
    signature: 'pawniard', keeper: 'sneasel', pool: ['purrloin', 'scraggy', 'sandile', 'murkrow', 'houndour', 'vullaby', 'impidimp', 'sneasel', 'deino'],
  },
  {
    // Nero e Bianco: throh, sawk, mienfoo, timburr
    id: 'marshal', name: 'Mirton', title: 'Superquattro di Unima', type: 'fighting', color: '#d9785f', level: 65, formation: 'quadrato',
    signature: 'timburr', keeper: 'heracross', pool: ['throh', 'sawk', 'mienfoo', 'croagunk', 'heracross', 'machop', 'stufful', 'flamigo', 'pancham'],
  },
  {
    // X e Y: klefki, nosepass, scyther, honedge
    id: 'wikstrom', name: 'Narciso', title: 'Superquattro di Kalos', type: 'steel', color: '#8a9bb0', level: 65, formation: 'quadrato',
    signature: 'honedge', keeper: 'duraludon', pool: ['klefki', 'nosepass', 'scyther', 'aron', 'magnemite', 'shieldon', 'tinkatink', 'duraludon', 'varoom'],
  },
  {
    // Scarlatto e Violetto: noibat, axew, skrelp, applin, frigibax
    id: 'hassel', name: 'Oranzio', title: 'Superquattro di Paldea', type: 'dragon', color: '#6b7fd8', level: 65, formation: 'rombo',
    signature: 'frigibax', keeper: 'duraludon', pool: ['noibat', 'axew', 'skrelp', 'applin', 'duraludon', 'tyrunt', 'dratini', 'bagon', 'dracovish'],
  },
  {
    // Oro e Argento: natu, jynx, exeggcute, slowpoke
    id: 'will', name: 'Pino', title: 'Superquattro di Johto', type: 'psychic', color: '#c77dd8', level: 65, formation: 'rombo',
    signature: 'natu', keeper: 'oranguru', pool: ['jynx', 'exeggcute', 'slowpoke', 'girafarig', 'ralts', 'beldum', 'oranguru', 'bronzor', 'sigilyph'],
  },
  {
    // Ultrasole e Ultraluna: klefki, pawniard, magnemite, beldum, diglett
    id: 'molayne', name: 'Tapso', title: 'Superquattro di Alola', type: 'steel', color: '#8a9bb0', level: 65, formation: 'quadrato',
    signature: 'diglett', keeper: 'klefki', pool: ['klefki', 'pawniard', 'magnemite', 'beldum', 'aron', 'tinkatink', 'shieldon', 'bronzor', 'klink'],
  },
  {
    // Platino: barboach, gligar, hippopotas, geodude, rhyhorn
    id: 'bertha', name: 'Terrie', title: 'Superquattro di Sinnoh', type: 'ground', color: '#c49a5a', level: 65, formation: 'quadrato',
    signature: 'rhyhorn', keeper: 'gligar', pool: ['barboach', 'gligar', 'hippopotas', 'geodude', 'toedscool', 'gible', 'swinub', 'baltoy', 'larvitar'],
  },
  {
    // X e Y: clauncher, staryu, magikarp, binacle
    id: 'siebold', name: 'Timeus', title: 'Superquattro di Kalos', type: 'water', color: '#6aaecb', level: 65, formation: 'rombo',
    signature: 'binacle', keeper: 'dracovish', pool: ['clauncher', 'staryu', 'magikarp', 'mareanie', 'wimpod', 'dracovish', 'skrelp', 'horsea', 'tentacool'],
  },
  {
    // Scarlatto e Violetto: tropius, oricorio, swablu, starly, flamigo
    id: 'larry', name: 'Ubaldo', title: 'Superquattro di Paldea', type: 'flying', color: '#7fb3e0', level: 65, formation: 'rombo',
    signature: 'flamigo', keeper: 'gligar', pool: ['tropius', 'oricorio', 'swablu', 'starly', 'gligar', 'wattrel', 'rowlet', 'archen', 'hawlucha'],
  },
  {
    // Scarlatto e Violetto: cufant, magnemite, bronzor, rookidee, tinkatink
    id: 'poppy', name: 'Verina', title: 'Superquattro di Paldea', type: 'steel', color: '#8a9bb0', level: 65, formation: 'quadrato',
    signature: 'tinkatink', keeper: 'duraludon', pool: ['cufant', 'magnemite', 'bronzor', 'rookidee', 'aron', 'shieldon', 'varoom', 'duraludon', 'beldum'],
  },
  {
    // Platino: houndour, eevee, ponyta, chimchar, magmar
    id: 'flint', name: 'Vulcano', title: 'Superquattro di Sinnoh', type: 'fire', color: '#f08a5d', level: 65, formation: 'rombo',
    signature: 'chimchar', keeper: 'magmar', pool: ['houndour', 'eevee', 'ponyta', 'magmar', 'larvesta', 'sizzlipede', 'growlithe', 'charmander', 'cyndaquil'],
  },
  {
    // Platino: starly, buizel, roselia, heracross, snorlax, chimchar
    id: 'barry', name: 'Barry', title: 'Rivale di Sinnoh', color: '#b03a48', level: 64, formation: 'rombo',
    signature: 'starly', keeper: 'onix', pool: ['buizel', 'roselia', 'heracross', 'snorlax', 'chimchar', 'onix', 'cufant', 'blipbug', 'oshawott'],
  },
  {
    // Spada e Scudo: mawile, ralts, ponyta, hatenna
    id: 'bede', name: 'Beet', title: 'Rivale di Galar', type: 'fairy', color: '#e879a8', level: 64, formation: 'rombo',
    signature: 'hatenna', keeper: 'carbink', pool: ['mawile', 'ralts', 'ponyta', 'flabebe', 'milcery', 'tinkatink', 'impidimp', 'carbink', 'magikarp'],
  },
  {
    // Nero e Bianco: lillipup, munna, mienfoo, litwick, pansear, oshawott
    id: 'bianca', name: 'Belle', title: 'Rivale di Unima', color: '#5b8def', level: 64, formation: 'rombo',
    signature: 'munna', keeper: 'shellder', pool: ['lillipup', 'mienfoo', 'litwick', 'pansear', 'oshawott', 'smoliv', 'shellder', 'shinx', 'staryu'],
  },
  {
    // Ultrasole e Ultraluna: pikachu, eevee, tauros, noibat, crabrawler, popplio
    id: 'hau', name: 'Hau', title: 'Rivale di Alola', color: '#e8a317', level: 64, formation: 'rombo',
    signature: 'pikachu', keeper: 'tauros', pool: ['eevee', 'tauros', 'noibat', 'crabrawler', 'popplio', 'skorupi', 'tadbulb', 'arrokuda', 'maschiff'],
  },
  {
    // Spada e Scudo: wooloo, rookidee, pincurchin, snorlax, sobble
    id: 'hop', name: 'Hop', title: 'Rivale di Galar', color: '#4fb393', level: 64, formation: 'rombo',
    signature: 'wooloo', keeper: 'snorlax', legendary: ['zacian'], pool: ['rookidee', 'pincurchin', 'snorlax', 'sobble', 'voltorb', 'karrablast', 'zigzagoon', 'yamper', 'horsea'],
  },
  {
    // Ultrasole e Ultraluna: zubat, zorua, lucario
    id: 'gladion', name: 'Iridio', title: 'Rivale di Alola', color: '#c77dd8', level: 64, formation: 'rombo',
    // Tipo Zero evolve in Silvally in partita (dal Lv 48)
    signature: 'type-null', keeper: 'tangela', pool: ['lucario', 'zubat', 'zorua', 'nosepass', 'pumpkaboo', 'charcadet', 'tangela', 'roggenrola', 'grubbin'],
  },
  {
    // Nero e Bianco: purrloin, pansage, pidove, roggenrola, axew, tepig
    id: 'cheren', name: 'Komor', title: 'Rivale di Unima', color: '#f08a5d', level: 64, formation: 'rombo',
    signature: 'purrloin', keeper: 'corsola', pool: ['pansage', 'pidove', 'roggenrola', 'axew', 'tepig', 'skrelp', 'turtwig', 'corsola', 'bounsweet'],
  },
  {
    // Rubino e Zaffiro: swablu, skitty, roselia, magnemite, ralts
    id: 'wally', name: 'Lino', title: 'Rivale di Hoenn', color: '#6aaecb', level: 64, formation: 'rombo',
    signature: 'ralts', keeper: 'dondozo', pool: ['swablu', 'skitty', 'roselia', 'magnemite', 'dondozo', 'teddiursa', 'hatenna', 'carbink', 'chikorita'],
  },
  {
    // Spada e Scudo: purrloin, croagunk, scraggy, morpeko, impidimp
    id: 'marnie', name: 'Mary', title: 'Rivale di Galar', type: 'dark', color: '#5a5470', level: 64, formation: 'rombo',
    signature: 'impidimp', keeper: 'sneasel', pool: ['purrloin', 'croagunk', 'scraggy', 'morpeko', 'murkrow', 'pawniard', 'vullaby', 'houndour', 'sneasel'],
  },
  {
    // Scarlatto e Violetto: solo evoluzioni di Eevee
    id: 'penny', name: 'Penny', title: 'Rivale di Paldea', color: '#e879a8', level: 64, formation: 'rombo',
    signature: 'eevee', keeper: 'carbink', pool: ['eevee', 'eevee', 'eevee', 'eevee', 'eevee', 'eevee', 'carbink', 'milcery', 'hatenna'],
  },
  {
    // Scarlatto e Violetto: skwovet, shellder, capsakid, toedscool, nacli, maschiff
    id: 'arven', name: 'Pepe', title: 'Rivale di Paldea', color: '#5b8def', level: 64, formation: 'rombo',
    signature: 'maschiff', keeper: 'aerodactyl', pool: ['skwovet', 'shellder', 'capsakid', 'toedscool', 'nacli', 'grimer', 'vulpix', 'aerodactyl', 'bulbasaur'],
  },
  {
    // Il disco indaco: dratini, poliwag, porygon, impidimp, litten, applin
    id: 'kieran', name: 'Riben', title: 'Rivale di Paldea', color: '#e8a317', level: 64, formation: 'rombo',
    signature: 'applin', keeper: 'lickitung', pool: ['dratini', 'poliwag', 'porygon', 'impidimp', 'litten', 'koffing', 'lickitung', 'zubat', 'binacle'],
  },
  {
    // X e Y: espurr, clefairy, eevee, absol, swablu, fennekin
    id: 'serena', name: 'Serena', title: 'Rivale di Kalos', color: '#4fb393', level: 64, formation: 'rombo',
    signature: 'fennekin', keeper: 'absol', pool: ['espurr', 'clefairy', 'eevee', 'absol', 'swablu', 'mudbray', 'psyduck', 'porygon', 'abra'],
  },
  {
    // X e Y: skitty, goomy, froakie
    id: 'shauna', name: 'Shana', title: 'Rivale di Kalos', color: '#c77dd8', level: 64, formation: 'rombo',
    signature: 'skitty', keeper: 'wailmer', pool: ['goomy', 'froakie', 'nidoran-f', 'fletchling', 'wailmer', 'hippopotas', 'tepig', 'eevee', 'gothita'],
  },
  {
    // X e Y: fletchling, roselia, corphish
    id: 'tierno', name: 'Tierno', title: 'Rivale di Kalos', color: '#f08a5d', level: 64, formation: 'rombo',
    signature: 'corphish', keeper: 'dunsparce', pool: ['fletchling', 'roselia', 'tynamo', 'clauncher', 'stantler', 'dunsparce', 'solosis', 'stufful', 'mareep'],
  },
  {
    // Nero 2 e Bianco 2: pidove, panpour, bouffalant, trapinch, tynamo, tepig
    id: 'hugh', name: 'Toni', title: 'Rivale di Unima', color: '#6aaecb', level: 64, formation: 'rombo',
    signature: 'bouffalant', keeper: 'bouffalant', pool: ['pidove', 'panpour', 'trapinch', 'tynamo', 'tepig', 'tympole', 'pansage', 'phanpy', 'fuecoco'],
  },
  {
    // X e Y: pikachu, aerodactyl, flabebe
    id: 'trevor', name: 'Trovato', title: 'Rivale di Kalos', color: '#b03a48', level: 64, formation: 'rombo',
    signature: 'flabebe', keeper: 'aerodactyl', pool: ['pikachu', 'aerodactyl', 'panpour', 'blitzle', 'swablu', 'geodude', 'buizel', 'pinsir', 'magnemite'],
  },
  {
    // Rubino e Zaffiro: taillow, wailmer, shroomish, torchic
    id: 'may', name: 'Vera', title: 'Rivale di Hoenn', color: '#e879a8', level: 64, formation: 'rombo',
    signature: 'torchic', keeper: 'wailmer', pool: ['taillow', 'wailmer', 'shroomish', 'trapinch', 'sobble', 'silicobra', 'scorbunny', 'quaxly', 'snivy'],
  },
];

/** Quanti allenatori della rosa partecipano a ogni edizione (più te fanno 8). */
export const LEAGUE_FIELD = 7;

export const YOU = 'you';
export const ROUND_NAMES = ['Quarti di finale', 'Semifinale', 'Finale'];

export interface LeagueResult {
  round: number;
  a: string;
  b: string;
  winner: string;
  score: [number, number];
  /** Rigori, se la partita è finita in parità. */
  pens: [number, number] | null;
}

export interface LeagueRun {
  edition: number;
  /** rounds[0] = gli 8 sorteggiati (in coppie: 0-1, 2-3…), rounds[1] = i 4 vincitori, … */
  rounds: string[][];
  results: LeagueResult[];
  /** Turno in cui sei uscito, o null. */
  eliminatedIn: number | null;
  champion: string | null;
}

export const trainerById = (id: string) => LEAGUE.find((t) => t.id === id);

export function newLeagueRun(edition: number): LeagueRun {
  const shuffle = (ids: string[]) => ids.map((id) => [Math.random(), id] as const).sort((a, b) => a[0] - b[0]).map(([, id]) => id);
  // 7 allenatori sorteggiati dalla rosa, poi il tabellone
  const field = shuffle([YOU, ...shuffle(LEAGUE.map((t) => t.id)).slice(0, LEAGUE_FIELD)]);
  return { edition, rounds: [field], results: [], eliminatedIn: null, champion: null };
}

export const currentRound = (run: LeagueRun) => run.rounds.length - 1;

/** Coppie del turno: [a, b][]. */
export function pairs(run: LeagueRun, round: number): [string, string][] {
  const r = run.rounds[round];
  return Array.from({ length: r.length / 2 }, (_, i) => [r[2 * i], r[2 * i + 1]]);
}

/** Avversario di `id` nel turno corrente, o null se non è in gara. */
export function opponentOf(run: LeagueRun, id: string): string | null {
  if (run.champion) return null;
  const pair = pairs(run, currentRound(run)).find(([a, b]) => a === id || b === id);
  return pair ? (pair[0] === id ? pair[1] : pair[0]) : null;
}

/**
 * Registra la tua partita, gioca in automatico le altre del turno (e, se sei eliminato, tutti i
 * turni seguenti) e fa avanzare il tabellone. `simulate` gioca una partita senza grafica.
 */
export function advanceLeague(
  run: LeagueRun,
  mine: LeagueResult,
  simulate: (a: string, b: string, round: number) => LeagueResult,
) {
  const playRound = (round: number, own: LeagueResult | null) => {
    const results = pairs(run, round).map(([a, b]) => (own && (own.a === a || own.a === b) ? own : simulate(a, b, round)));
    run.results.push(...results);
    const winners = results.map((r) => r.winner);
    if (own && own.winner !== YOU) run.eliminatedIn = round;
    if (winners.length === 1) run.champion = winners[0];
    else run.rounds.push(winners);
  };
  playRound(currentRound(run), mine);
  // eliminato: il torneo si conclude da solo
  while (!run.champion && run.eliminatedIn !== null) playRound(currentRound(run), null);
}
