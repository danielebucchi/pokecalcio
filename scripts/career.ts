// Simula carriere complete sulla mappa di Kanto (CPU per entrambe le squadre) per tarare la progressione:
import { writeFileSync } from 'fs';
// allenatori dei percorsi in ordine → palestra → se perdi, allenatore di passaggio e riprovi.
// npm run career -- 10
import { GYMS } from '../src/game/gyms';
import { KANTO } from '../src/game/kanto';
import { CAP, applyDrill, awardMatch, drillBlock, suggestedDrill } from '../src/game/progression';
import { DEFAULT_STARTERS, ROSTER_MAX, addToRoster, arriveAt, autoBench, autoLineup, bestRating, chooseStarters, findOwned, newSave, releasable, type SaveData } from '../src/game/save';
import { recruitOffers } from '../src/game/recruit';
import { FORMATIONS } from '../src/game/formations';
import { Match, type TeamSetup } from '../src/match/engine';
import { TUNING, buildGymTeam, buildLeagueTeam, buildTrainerTeam, buildWildTeam, clubTeam } from '../src/match/teams';
import { LEAGUE } from '../src/game/league';
// override dell'allenamento delle palestre: GYM='[0.3,0.6,…]'
if (process.env.GYM) (JSON.parse(process.env.GYM) as number[]).forEach((t, i) => (GYMS[i].training = t));
if (process.env.CAPM) CAP.margin = Number(process.env.CAPM);
// prova: capipalestra più alti di GLV livelli con il tetto invariato, ed eventuale allenamento uguale per tutti
if (process.env.GLV) { const b = Number(process.env.GLV); GYMS.forEach((g) => (g.level += b)); CAP.margin -= b; }
if (process.env.GTR) GYMS.forEach((g) => (g.training = Number(process.env.GTR)));

// override da riga di comando per tarare: TUNE='{"wildGap":2}'
if (process.env.TUNE) Object.assign(TUNING, JSON.parse(process.env.TUNE));

const CAREERS = Number(process.argv[2] ?? 10);
const MAX_MATCHES = 400;
const stats = GYMS.map(() => ({ level: [] as number[], tries: [] as number[], grind: [] as number[], trainers: [] as number[], roster: [] as number[] }));
/** Esiti per tipo di partita: vittorie e scarto medio (gol fatti - subiti). */
type Kind = 'percorso' | 'palestra' | 'selvatici' | 'lega';
const outcomes: Record<Kind, { n: number; w: number; diff: number }> = {
  percorso: { n: 0, w: 0, diff: 0 }, palestra: { n: 0, w: 0, diff: 0 }, selvatici: { n: 0, w: 0, diff: 0 }, lega: { n: 0, w: 0, diff: 0 },
};

const startersAvg = (save: SaveData) =>
  save.lineup.reduce((a, uid) => a + findOwned(save, uid)!.level, 0) / save.lineup.length;

function play(save: SaveData, opponent: TeamSetup, kind: Kind): boolean {
  const roles = FORMATIONS[save.formation].slots;
  for (let tries = 0; (save.sessionsLeft > 0 || save.sparringLeft > 0) && tries < 20; tries++) {
    const i = Math.floor(Math.random() * save.lineup.length);
    const p = findOwned(save, save.lineup[i])!;
    const d = suggestedDrill(roles[i].role);
    if (!drillBlock(save, p, d)) applyDrill(save, p, d);
    else if (!drillBlock(save, p, 'sparring')) applyDrill(save, p, 'sparring');
  }
  save.lineup = autoLineup(save);
  save.bench = autoBench(save);
  const home = clubTeam(save);
  home.controlled = false;
  const m = new Match([home, opponent], { knockout: kind === 'lega' || kind === 'palestra' });
  while (!m.finished) m.step(1 / 60);
  // come un giocatore: accetta chi chiede di unirsi se c'è posto o se è meglio della riserva più debole
  if (kind === 'selvatici') {
    for (const offer of recruitOffers(m, 0)) {
      if (save.roster.length < ROSTER_MAX) addToRoster(save, offer.inst);
      else {
        const worst = releasable(save).sort((a, b) => bestRating(a) - bestRating(b))[0];
        if (worst && bestRating(offer.inst) > bestRating(worst)) addToRoster(save, offer.inst, worst.uid);
      }
    }
  }
  awardMatch(save, m, 0);
  const o = outcomes[kind];
  o.n++;
  if (m.winner === 0) o.w++;
  o.diff += m.score[0] - m.score[1];
  return m.winner === 0;
}

const league = { level: [] as number[], attempts: [] as number[], won: 0 };
for (let c = 0; c < CAREERS; c++) {
  const save = newSave();
  chooseStarters(save, DEFAULT_STARTERS);
  let played = 0;
  for (let g = 0; g < GYMS.length && played < MAX_MATCHES; g++) {
    // tutti gli allenatori dei luoghi aperti con questa medaglia (una vittoria ciascuno, si riprova se si perde)
    let trainers = 0;
    const from = g ? GYMS[g - 1].level : 0;
    for (const loc of KANTO.filter((l) => !l.league && l.level >= from && l.level < GYMS[g].level)) {
      arriveAt(save, loc.id); // le sessioni di allenamento arrivano luogo per luogo
      for (const t of loc.trainers) {
        while (played < MAX_MATCHES) {
          played++;
          trainers++;
          if (play(save, buildTrainerTeam(loc, t), 'percorso')) break;
          // persa: una partitella con i selvatici del posto prima di riprovare
          played++;
          play(save, buildWildTeam(loc, startersAvg(save)), 'selvatici');
        }
      }
    }
    const city = KANTO.find((l) => l.gym === g)!;
    arriveAt(save, city.id);
    if (process.env.DUMP && c === 0) writeFileSync(`/tmp/save-gym${g}.json`, JSON.stringify(save));
    stats[g].level.push(startersAvg(save));
    stats[g].roster.push(save.roster.length);
    stats[g].trainers.push(trainers);
    let tries = 0;
    let grind = 0;
    while (played < MAX_MATCHES) {
      played++;
      tries++;
      if (play(save, buildGymTeam(GYMS[g], clubTeam(save)), 'palestra')) break;
      // persa: una partitella con i selvatici prima di riprovare
      played++;
      grind++;
      play(save, buildWildTeam(city, startersAvg(save)), 'selvatici');
    }
    save.badges = g + 1; // alza il tetto di livello come nel gioco
    stats[g].tries.push(tries);
    stats[g].grind.push(grind);
  }
  // dopo Giovanni: Via Vittoria, poi la Lega (3 sfide a eliminazione diretta contro allenatori sorteggiati)
  for (const loc of KANTO.filter((l) => !l.league && !l.requiresChampion && l.level >= GYMS[7].level)) {
    arriveAt(save, loc.id);
    for (const t of loc.trainers) {
      while (played < MAX_MATCHES) {
        played++;
        if (play(save, buildTrainerTeam(loc, t), 'percorso')) break;
        played++;
        play(save, buildWildTeam(loc, startersAvg(save)), 'selvatici');
      }
    }
  }
  const plateau = KANTO.find((l) => l.league)!;
  arriveAt(save, plateau.id);
  league.level.push(startersAvg(save));
  let attempts = 0;
  let won = false;
  while (!won && played < MAX_MATCHES) {
    attempts++;
    const field = [...LEAGUE].sort(() => Math.random() - 0.5).slice(0, 3);
    won = field.every((t) => (played++, play(save, buildLeagueTeam(t, clubTeam(save)), 'lega')));
    if (!won) {
      played++;
      play(save, buildWildTeam(plateau, startersAvg(save)), 'selvatici');
    }
  }
  league.attempts.push(won ? attempts : NaN);
  league.won += won ? 1 : 0;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
console.log(`Carriere sulla mappa: ${CAREERS}`);
GYMS.forEach((g, i) => {
  const s = stats[i];
  console.log(
    `${g.leader.padEnd(9)} Lv ${g.level} · arrivi a Lv ${mean(s.level).toFixed(1)} · partite coi percorsi ${mean(s.trainers).toFixed(1)} · tentativi ${mean(s.tries).toFixed(1)} · grinding ${mean(s.grind).toFixed(1)} · rosa ${mean(s.roster).toFixed(1)}`,
  );
});
for (const [k, o] of Object.entries(outcomes)) {
  if (o.n) console.log(`${k.padEnd(10)} vinte ${Math.round((o.w / o.n) * 100)}% · scarto medio ${(o.diff / o.n).toFixed(1)} · partite ${o.n}`);
}
console.log(`Lega: arrivi a Lv ${mean(league.level).toFixed(1)} · vinta in ${league.won}/${CAREERS} carriere · edizioni per vincerla ${mean(league.attempts.filter((x) => !Number.isNaN(x))).toFixed(1)}`);
