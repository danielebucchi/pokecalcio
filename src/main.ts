import './style.css';
import { POKEDEX } from './data/pokedex';
import { GYMS, nextGym, type Gym } from './game/gyms';
import { FLY_BADGES, locationById, neighbors, type RouteTrainer } from './game/kanto';
import {
  ROUND_NAMES, YOU, advanceLeague, currentRound, newLeagueRun, opponentOf, trainerById, type LeagueResult,
} from './game/league';
import { awardMatch } from './game/progression';
import { recruitOffers } from './game/recruit';
import { arriveAt, chooseStarters, loadSave, newSave, storeSave, type SaveData } from './game/save';
import type { Match, TeamSetup } from './match/engine';
import {
  buildGymTeam, buildLeagueTeam, buildLegendaryTeam, buildTrainerTeam, buildWildTeam, clubTeam, simulateMatch,
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
  const gym = loc.gym === save.badges ? (nextGym(save.badges) ?? null) : null;
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
    const team = run && trainer ? cached(`league:${run.edition}:${currentRound(run)}`, () => buildLeagueTeam(trainer)) : null;
    league = { run, opponent: trainer, team };
  }
  return {
    location: loc,
    gym,
    gymTeam: gym ? cached(`gym:${save.badges}`, () => buildGymTeam(gym)) : null,
    trainers,
    wild: cached(`wild:${loc.id}`, () => buildWildTeam(loc)),
    legendary: loc.legendary && !save.legendaries.includes(loc.legendary.key)
      ? cached(`legendary:${loc.id}`, () => buildLegendaryTeam(loc))
      : null,
    league,
  };
}

/** Si può andare in `id` da dove sei: luogo vicino aperto, oppure Volo verso una città già visitata. */
export function canTravel(id: string): boolean {
  const target = locationById(id);
  if (id === save.location || target.badges > save.badges) return false;
  if (target.requiresChampion && !save.titles) return false;
  if (neighbors(save.location).includes(id)) return true;
  return save.badges >= FLY_BADGES && target.kind === 'city' && save.visited.includes(id);
}

function showHub() {
  // carriera nuova: prima si sceglie la squadra
  if (!save.roster.length) {
    renderStarterPick(app, (keys) => {
      chooseStarters(save, keys);
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
    },
    canTravel,
    joinLeague() {
      save.league = newLeagueRun((save.league?.edition ?? 0) + 1);
      storeSave(save);
      hub.tab = 'map';
      showHub();
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

function playMatch(kind: ChallengeKind, trainerId?: string, skip = false) {
  const c = challenges();
  const route = kind === 'trainer' ? c.trainers.find((t) => t.trainer.id === trainerId) : undefined;
  const opponent =
    kind === 'gym' ? c.gymTeam!
    : kind === 'league' ? c.league!.team!
    : kind === 'trainer' ? route!.team
    : kind === 'legendary' ? c.legendary!
    : c.wild;
  (skip ? skipMatch : runMatch)(app, [clubTeam(save), opponent], {
    knockout: kind === 'league',
    onFinish(match) {
      // gli esiti vanno registrati prima di awardMatch, che fa avanzare la giornata
      const banner =
        kind === 'gym' ? gymOutcome(c.gym!, match)
        : kind === 'league' ? leagueOutcome(match)
        : kind === 'trainer' ? trainerOutcome(route!.trainer, match)
        : kind === 'legendary' ? legendaryOutcome(match)
        : undefined;
      // dopo una partitella vinta, qualche selvatico chiede di unirsi (si accetta nel resoconto)
      const offers = kind === 'wild' ? recruitOffers(match, 0) : [];
      const report = awardMatch(save, match, 0);
      storeSave(save);
      return { report, banner, offers };
    },
    recruit(inst) {
      if (save.roster.some((p) => p.uid === inst.uid)) return;
      save.roster.push({ ...inst, exp: 0 });
      storeSave(save);
    },
    onLeave(counted = true) {
      hub.message = null;
      // a fine partita, se hai sessioni da usare, si apre l'allenamento (altrimenti ce se ne dimentica)
      if (counted && (save.sessionsLeft > 0 || save.sparringLeft > 0)) hub.tab = 'training';
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

/** Battuto il leggendario, si unisce a te: niente tasso di cattura. */
function legendaryOutcome(match: Match): MatchBanner {
  const loc = locationById(save.location);
  const key = loc.legendary!.key;
  const name = POKEDEX[key].name;
  if (match.winner !== 0) {
    return { title: `${name} è troppo forte, per ora`, text: 'Allenati e torna a sfidarlo: resterà qui ad aspettarti.', color: '#e8a317' };
  }
  const inst = match.appearances.find((p) => p.team === 1 && p.inst.speciesKey === key)!.inst;
  save.roster.push({ ...inst, exp: 0 });
  save.legendaries.push(key);
  return {
    title: `${name} si unisce alla tua squadra!`,
    text: `Ti ha messo alla prova e l'hai superata. Lo trovi nella rosa al livello ${inst.level}.`,
    color: '#e8a317',
    badge: true,
  };
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
    save.titles++;
    return { title: 'Sei il Campione della Lega Pokémon!', text: `Hai battuto ${nameOf(oppId)} in finale. Titoli vinti: ${save.titles}.`, color: '#e8a317', badge: true };
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

showHub();
