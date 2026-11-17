// Simula carriere complete sulla mappa di Kanto (CPU per entrambe le squadre) per tarare la progressione:
// allenatori dei percorsi in ordine → palestra → se perdi, allenatore di passaggio e riprovi.
// npm run career -- 10
import { GYMS } from '../src/game/gyms';
import { KANTO } from '../src/game/kanto';
import { applyDrill, awardMatch, drillBlock, suggestedDrill } from '../src/game/progression';
import { DEFAULT_STARTERS, autoLineup, chooseStarters, findOwned, newSave, type SaveData } from '../src/game/save';
import { FORMATIONS } from '../src/game/formations';
import { Match, type TeamSetup } from '../src/match/engine';
import { buildGymTeam, buildTrainerTeam, buildWildTeam, clubTeam } from '../src/match/teams';

const CAREERS = Number(process.argv[2] ?? 10);
const MAX_MATCHES = 200;
const stats = GYMS.map(() => ({ level: [] as number[], tries: [] as number[], grind: [] as number[], trainers: [] as number[] }));

const startersAvg = (save: SaveData) =>
  save.lineup.reduce((a, uid) => a + findOwned(save, uid)!.level, 0) / save.lineup.length;

function play(save: SaveData, opponent: TeamSetup): boolean {
  const roles = FORMATIONS[save.formation].slots;
  for (let tries = 0; save.sessionsLeft > 0 && tries < 20; tries++) {
    const i = Math.floor(Math.random() * save.lineup.length);
    const p = findOwned(save, save.lineup[i])!;
    const d = suggestedDrill(roles[i].role);
    if (!drillBlock(save, p, d)) applyDrill(save, p, d);
    else if (!drillBlock(save, p, 'sparring')) applyDrill(save, p, 'sparring');
  }
  save.lineup = autoLineup(save);
  const home = clubTeam(save);
  home.controlled = false;
  const m = new Match([home, opponent]);
  while (!m.finished) m.step(1 / 60);
  awardMatch(save, m, 0);
  return m.winner === 0;
}

for (let c = 0; c < CAREERS; c++) {
  const save = newSave();
  chooseStarters(save, DEFAULT_STARTERS);
  let played = 0;
  for (let g = 0; g < GYMS.length && played < MAX_MATCHES; g++) {
    // tutti gli allenatori dei luoghi aperti con questa medaglia (una vittoria ciascuno, si riprova se si perde)
    let trainers = 0;
    const from = g ? GYMS[g - 1].level : 0;
    for (const loc of KANTO.filter((l) => !l.league && l.level >= from && l.level < GYMS[g].level)) {
      for (const t of loc.trainers) {
        while (played < MAX_MATCHES) {
          played++;
          trainers++;
          if (play(save, buildTrainerTeam(loc, t))) break;
        }
      }
    }
    const city = KANTO.find((l) => l.gym === g)!;
    stats[g].level.push(startersAvg(save));
    stats[g].trainers.push(trainers);
    let tries = 0;
    let grind = 0;
    while (played < MAX_MATCHES) {
      played++;
      tries++;
      if (play(save, buildGymTeam(GYMS[g]))) break;
      // persa: una partitella con i selvatici prima di riprovare
      played++;
      grind++;
      play(save, buildWildTeam(city));
    }
    stats[g].tries.push(tries);
    stats[g].grind.push(grind);
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
console.log(`Carriere sulla mappa: ${CAREERS}`);
GYMS.forEach((g, i) => {
  const s = stats[i];
  console.log(
    `${g.leader.padEnd(9)} Lv ${g.level} · arrivi a Lv ${mean(s.level).toFixed(1)} · partite coi percorsi ${mean(s.trainers).toFixed(1)} · tentativi ${mean(s.tries).toFixed(1)} · grinding ${mean(s.grind).toFixed(1)}`,
  );
});
