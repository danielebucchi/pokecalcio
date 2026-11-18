import './style.css';
import { POKEDEX } from './data/pokedex';
import { GYMS, nextGym, type Gym } from './game/gyms';
import { FLY_BADGES, locationById, neighbors, type RouteTrainer } from './game/kanto';
import {
  CHAMPION_ID, ROUND_NAMES, YOU, advanceLeague, currentRound, newLeagueRun, opponentOf, trainerById, type LeagueResult,
} from './game/league';
import { awardMatch } from './game/progression';
import { registerMatch } from './game/dex';
import { recruitOffers, type RecruitOffer } from './game/recruit';
import { ROSTER_MAX, addToRoster, arriveAt, recordHistory, chooseStarters, importSave, lineupProblem, rivalGate, loadSave, newSave, releasable, storeSave, type SaveData } from './game/save';
import type { Match, TeamSetup } from './match/engine';
import {
  buildChampionTeam, buildEventTeam, buildGymTeam, buildRematchTeam, postGameLevels, buildLeagueTeam, buildLegendaryTeam, buildTrainerTeam, buildWildTeam, clubTeam, simulateMatch,
} from './match/teams';
import { renderHub, type ChallengeKind, type Challenges, type HubState } from './ui/hub';
import { runMatch, skipMatch, type MatchBanner } from './ui/matchScreen';
import { renderStarterPick } from './ui/starters';

const app = document.getElementById('app')!;
let save: SaveData = loadSave();
const hub: HubState = { tab: 'squad', message: null, slot: 0 };

// le squadre avversarie si generano una volta per partita: quella mostrata è quella che si affronta,
// e dopo ogni partita (nuova giornata) se ne generano di nuove
let cacheDay = -1;
const cache = new Map<string, TeamSetup>();
function cached(key: string, build: () => TeamSetup): TeamSetup {
  if (cacheDay !== save.matchday) {
    cache.clear();
    cacheDay = save.matchday;
  }
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key)!;
}

function challenges(): Challenges {
  const loc = locationById(save.location);
  // la palestra riceve solo se hai battuto il rivale che la precede (M/N Anna, Silph SpA)
  const gym = loc.gym === save.badges && !rivalGate(save, loc, true) ? (nextGym(save.badges) ?? null) : null;
  const trainers = loc.trainers.map((t) => ({
    trainer: t,
    team: cached(`trainer:${t.id}`, () => buildTrainerTeam(loc, t)),
    defeated: save.defeated.includes(t.id),
  }));
  let league: Challenges['league'] = null;
  if (loc.league && save.badges >= GYMS.length) {
    const run = save.league;
    const oppId = run ? opponentOf(run, YOU) : null;
    const trainer = oppId ? trainerById(oppId)! : null;
    const team = run && trainer ? cached(`league:${run.edition}:${currentRound(run)}:${scoutKey()}`, () => buildLeagueTeam(trainer, scout(), postGameLevels(save.titles))) : null;
    league = { run, opponent: trainer, team };
  }
  return {
    location: loc,
    gym,
    // il capopalestra studia la tua squadra: se la cambi, cambia anche lui chi porta
    gymTeam: gym ? cached(`gym:${save.badges}:${scoutKey()}`, () => buildGymTeam(gym, scout())) : null,
    trainers,
    // i selvatici stanno al massimo un livello sotto i tuoi titolari (nei luoghi già superati)
    wild: cached(`wild:${loc.id}`, () => buildWildTeam(loc, lineupLevel())),
    legendary: loc.legendary && !save.legendaries.includes(loc.legendary.key)
      ? cached(`legendary:${loc.id}`, () => buildLegendaryTeam(loc))
      : null,
    league,
    // vinto il torneo, manca il Campione Blu
    champion: loc.league && save.league?.champion === YOU && save.league.championMatch === 'pending'
      ? cached(`champion:${save.league.edition}:${scoutKey()}`, () => buildChampionTeam(trainerById(CHAMPION_ID)!, scout(), postGameLevels(save.titles)))
      : null,
    // dopo il titolo, rivincita con il capopalestra della città
    rematch: save.titles > 0 && loc.gym !== undefined && loc.gym < save.badges
      ? cached(`rematch:${loc.gym}:${scoutKey()}`, () => buildRematchTeam(GYMS[loc.gym!], scout(), postGameLevels(save.titles - 1)))
      : null,
  };
}

/** Si può andare in `id` da dove sei: luogo vicino aperto, oppure Volo verso una città già visitata. */
export function canTravel(id: string): boolean {
  const target = locationById(id);
  if (id === save.location || target.badges > save.badges) return false;
  if (target.requiresChampion && !save.titles) return false;
  // le sfide con il rivale sono tappe obbligate: chiudono la strada finché non lo batti
  if (rivalGate(save, target)) return false;
  if (neighbors(save.location).includes(id)) return true;
  return save.badges >= FLY_BADGES && target.kind === 'city' && save.visited.includes(id);
}

function showHub() {
  // carriera nuova: prima si sceglie la squadra
  if (!save.roster.length) {
    renderStarterPick(app, (keys, clubName) => {
      chooseStarters(save, keys);
      if (clubName) save.clubName = clubName;
      storeSave(save);
      showHub();
    });
    return;
  }
  renderHub(app, save, challenges(), hub, {
    changed() {
      storeSave(save);
      showHub();
    },
    play: playMatch,
    travel(id) {
      if (!canTravel(id)) return;
      const gained = arriveAt(save, id);
      hub.message = gained ? `${locationById(id).name}: ${gained} nuove sessioni di allenamento.` : null;
      storeSave(save);
      showHub();
      // sul telefono i luoghi sono in fondo alla pagina: si torna su, al luogo appena raggiunto
      if (window.matchMedia('(max-width: 700px)').matches) {
        document.querySelector('.loc-head')?.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -12);
      }
    },
    canTravel,
    joinLeague() {
      save.league = newLeagueRun((save.league?.edition ?? 0) + 1);
      storeSave(save);
      hub.tab = 'map';
      showHub();
    },
    importSave(code) {
      const err = importSave(code);
      if (err) return err;
      // ricarica con gli aggiornamenti dei salvataggi vecchi
      save = loadSave();
      cache.clear();
      hub.tab = 'squad';
      hub.message = 'Carriera importata ✓';
      hub.savePanel = null;
      hub.importCode = '';
      hub.importConfirm = false;
      hub.slot = 0;
      showHub();
      return null;
    },
    reset() {
      save = newSave();
      storeSave(save);
      cache.clear();
      hub.tab = 'squad';
      hub.message = null;
      hub.slot = 0;
      showHub();
    },
  });
}

/** La tua squadra vista dagli avversari che la studiano (palestre e Lega), se è schierabile. */
function scout(): TeamSetup | undefined {
  return lineupProblem(save) ? undefined : clubTeam(save);
}
const scoutKey = () => [...save.lineup, '|', ...save.bench].map((uid) => save.roster.find((p) => p.uid === uid)?.speciesKey ?? '').join(',');

/** Livello medio dei titolari. */
function lineupLevel(): number {
  const lv = save.lineup.map((uid) => save.roster.find((p) => p.uid === uid)?.level ?? 0);
  return lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0;
}

function playMatch(kind: ChallengeKind, trainerId?: string, skip = false) {
  const c = challenges();
  const route = kind === 'trainer' ? c.trainers.find((t) => t.trainer.id === trainerId) : undefined;
  // eventi: trainerId è "idEvento:specie" (per gli eventi a scelta si gioca per un Pokémon preciso)
  const [eventId, eventSpecies] = kind === 'event' ? trainerId!.split(':') : [];
  const event = kind === 'event' ? c.location.events!.find((e) => e.id === eventId)! : undefined;
  const opponent =
    kind === 'event' ? cached(`event:${eventId}:${eventSpecies}`, () => buildEventTeam(c.location, event!, eventSpecies))
    : kind === 'gym' ? c.gymTeam!
    : kind === 'league' ? c.league!.team!
    : kind === 'trainer' ? route!.team
    : kind === 'legendary' ? c.legendary!
    : kind === 'champion' ? c.champion!
    : kind === 'rematch' ? c.rematch!
    : c.wild;
  (skip ? skipMatch : runMatch)(app, [clubTeam(save), opponent], {
    // in palestra e in Lega non si pareggia: si va ai rigori
    knockout: kind === 'league' || kind === 'gym' || kind === 'champion' || kind === 'rematch',
    onFinish(match) {
      // titolo per lo storico, prima che gli esiti cambino lo stato (la Lega passa al turno dopo)
      const historyTitle =
        kind === 'gym' ? `Palestra di ${c.gym!.leader}`
        : kind === 'league' ? `Lega · ${ROUND_NAMES[currentRound(save.league!)]} contro ${c.league!.opponent!.name}`
        : kind === 'trainer' ? route!.trainer.name
        : kind === 'legendary' ? `Leggendario: ${POKEDEX[c.location.legendary!.key].name}`
        : kind === 'event' ? `Evento: ${event!.title}`
        : kind === 'champion' ? 'Lega · il Campione Blu'
        : kind === 'rematch' ? `Rivincita con ${GYMS[c.location.gym!].leader}`
        : null;
      if (historyTitle) {
        recordHistory(save, {
          matchday: save.matchday,
          title: historyTitle,
          score: [match.score[0], match.score[1]],
          penalties: match.shootout ? [match.shootout.score[0], match.shootout.score[1]] : undefined,
          won: match.winner === 0,
        });
      }
      // gli esiti vanno registrati prima di awardMatch, che fa avanzare la giornata
      const banner =
        kind === 'gym' ? gymOutcome(c.gym!, match)
        : kind === 'league' ? leagueOutcome(match)
        : kind === 'trainer' ? trainerOutcome(route!.trainer, match)
        : kind === 'legendary' ? legendaryOutcome(match)
        : kind === 'event' ? eventOutcome(event!.title, eventSpecies, match)
        : kind === 'champion' ? championOutcome(match)
        : kind === 'rematch' ? rematchOutcome(GYMS[c.location.gym!], match)
        : undefined;
      // dopo una partitella vinta qualche selvatico chiede di unirsi, battuto il leggendario è lui
      // a chiederlo: si accetta (o si fa posto nella rosa) nel resoconto
      const offers = kind === 'wild' ? recruitOffers(match, 0)
        : kind === 'legendary' ? legendaryOffer(match)
        : kind === 'event' ? eventOffer(eventSpecies, match)
        : [];
      const report = awardMatch(save, match, 0);
      registerMatch(save, match, 0);
      storeSave(save);
      return { report, banner, offers };
    },
    recruit(inst, releaseUid) {
      if (!addToRoster(save, inst, releaseUid)) return false;
      const legendary = locationById(save.location).legendary;
      if (kind === 'legendary' && legendary?.key === inst.speciesKey) save.legendaries.push(inst.speciesKey);
      // l'evento si chiude quando accetti il Pokémon (se lo lasci andare, puoi rigiocare la sfida)
      if (kind === 'event' && inst.speciesKey === eventSpecies && !save.events.includes(eventId)) save.events.push(eventId);
      storeSave(save);
      return true;
    },
    roster() {
      return {
        count: save.roster.length,
        max: ROSTER_MAX,
        releasable: releasable(save).map((p) => ({ uid: p.uid, speciesKey: p.speciesKey, level: p.level, name: p.nickname || POKEDEX[p.speciesKey].name })),
        species: save.roster.map((p) => p.speciesKey),
      };
    },
    onLeave(counted = true) {
      hub.message = null;
      // a fine partita, se hai sessioni da usare, si apre l'allenamento (altrimenti ce se ne dimentica)
      if (counted && save.sessionsLeft > 0) hub.tab = 'training';
      showHub();
    },
  });
}

function trainerOutcome(t: RouteTrainer, match: Match): MatchBanner {
  if (match.winner !== 0) {
    return { title: `${t.name} ti ha battuto`, text: 'Allenati e riprova quando vuoi: resta qui ad aspettarti.', color: '#8ec5d8' };
  }
  if (!save.defeated.includes(t.id)) save.defeated.push(t.id);
  return { title: `Hai battuto ${t.name}!`, text: `Allenatori battuti finora: ${save.defeated.length}.`, color: '#8ec5d8' };
}

/** Sfida di un evento: vinta, il Pokémon in palio chiede di unirsi a te. */
function eventOutcome(title: string, species: string, match: Match): MatchBanner {
  const name = POKEDEX[species].name;
  if (match.winner !== 0) {
    return { title: `${name} non è ancora convinto`, text: `${title}: riprova quando vuoi, la sfida resta aperta.`, color: '#e8a317' };
  }
  return { title: `${name} vuole unirsi alla tua squadra!`, text: `${title}: accetta qui sotto. Se lo lasci andare, puoi rigiocare la sfida.`, color: '#e8a317' };
}

function eventOffer(species: string, match: Match): RecruitOffer[] {
  if (match.winner !== 0) return [];
  const p = match.appearances.find((x) => x.team === 1 && x.inst.speciesKey === species);
  return p ? [{ inst: p.inst, reason: 'hai vinto la sua sfida' }] : [];
}

/** Battuto il leggendario, vuole unirsi a te: niente tasso di cattura, basta accettare. */
function legendaryOutcome(match: Match): MatchBanner {
  const name = POKEDEX[locationById(save.location).legendary!.key].name;
  if (match.winner !== 0) {
    return { title: `${name} è troppo forte, per ora`, text: 'Allenati e torna a sfidarlo: resterà qui ad aspettarti.', color: '#e8a317' };
  }
  return {
    title: `${name} vuole unirsi alla tua squadra!`,
    text: 'Ti ha messo alla prova e l\'hai superata: accetta qui sotto. Se lo lasci andare resta qui e potrai sfidarlo di nuovo.',
    color: '#e8a317',
    badge: true,
  };
}

function legendaryOffer(match: Match): RecruitOffer[] {
  const key = locationById(save.location).legendary!.key;
  if (match.winner !== 0) return [];
  const inst = match.appearances.find((p) => p.team === 1 && p.inst.speciesKey === key)!.inst;
  return [{ inst, reason: 'ti ha messo alla prova e l\'hai superata' }];
}

function gymOutcome(gym: Gym, match: Match): MatchBanner {
  if (match.winner !== 0) {
    return {
      title: `${gym.leader} ti ha battuto`,
      text: `Per la ${gym.badge} serve vincere: allenati, fai esperienza sul percorso e riprova quando vuoi.`,
      color: gym.color,
    };
  }
  save.badges++;
  const next = nextGym(save.badges);
  return {
    title: `Hai ottenuto la ${gym.badge}!`,
    text: next
      ? `${save.badges}/${GYMS.length} medaglie: si aprono nuovi luoghi sulla mappa. Prossima palestra: ${next.leader} a ${next.city}, livello ${next.level}.`
      : `Hai tutte le ${GYMS.length} medaglie di Kanto: la Via Vittoria verso l'Altopiano Blu è aperta!`,
    color: gym.color,
    badge: true,
  };
}

const nameOf = (id: string) => (id === YOU ? save.clubName : trainerById(id)!.name);

function leagueOutcome(match: Match): MatchBanner {
  const run = save.league!;
  const round = currentRound(run);
  const oppId = opponentOf(run, YOU)!;
  const won = match.winner === 0;
  const pens = match.shootout ? match.shootout.score : null;
  const mine: LeagueResult = {
    round, a: YOU, b: oppId, winner: won ? YOU : oppId,
    score: [match.score[0], match.score[1]], pens: pens ? [pens[0], pens[1]] : null,
  };
  // le altre partite del tabellone si giocano in automatico
  advanceLeague(run, mine, (a, b, r) => {
    const m = simulateMatch(buildLeagueTeam(trainerById(a)!), buildLeagueTeam(trainerById(b)!), true);
    const sc = m.shootout?.score;
    return { round: r, a, b, winner: m.winner === 0 ? a : b, score: [m.score[0], m.score[1]], pens: sc ? [sc[0], sc[1]] : null };
  });
  const color = trainerById(oppId)!.color;
  if (run.champion === YOU) {
    // vinto il torneo: come nei giochi manca l'ultima sfida, il Campione
    run.championMatch = 'pending';
    return {
      title: 'Hai vinto il torneo della Lega!',
      text: `Hai battuto ${nameOf(oppId)} in finale. Ultimo passo: il Campione Blu ti aspetta all'Altopiano Blu.`,
      color: '#e8a317',
    };
  }
  if (!won) {
    return {
      title: `Eliminato: ${ROUND_NAMES[round].toLowerCase()} persa con ${nameOf(oppId)}`,
      text: `Il titolo va a ${nameOf(run.champion!)}. Allenati e iscriviti a una nuova edizione quando vuoi.`,
      color,
    };
  }
  const next = opponentOf(run, YOU)!;
  return { title: `Passi in ${ROUND_NAMES[currentRound(run)].toLowerCase()}!`, text: `Prossimo avversario: ${nameOf(next)}.`, color };
}

/** L'ultima sfida della Lega: battere Blu vuol dire diventare Campione. */
function championOutcome(match: Match): MatchBanner {
  const run = save.league!;
  if (match.winner !== 0) {
    run.championMatch = 'lost';
    return {
      title: 'Blu resta il Campione',
      text: 'Ci sei andato vicino: allenati e iscriviti a una nuova edizione per riprovarci.',
      color: '#6aaecb',
    };
  }
  run.championMatch = 'won';
  save.titles++;
  return {
    title: 'Sei il Campione della Lega Pokémon!',
    text: `Hai battuto Blu. Titoli vinti: ${save.titles}. Il tetto di livello è sparito, si apre la Grotta Ignota e nelle città ti aspettano le rivincite con i capipalestra.`,
    color: '#e8a317',
    badge: true,
  };
}

function rematchOutcome(gym: Gym, match: Match): MatchBanner {
  return match.winner === 0
    ? { title: `Hai vinto la rivincita con ${gym.leader}!`, text: 'Puoi sfidarlo di nuovo quando vuoi: dopo ogni titolo la sua squadra è più forte.', color: gym.color }
    : { title: `${gym.leader} si prende la rivincita`, text: 'Riprova quando vuoi.', color: gym.color };
}

showHub();
