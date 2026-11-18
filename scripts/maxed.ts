// Difficoltà vista da una squadra "al massimo": al tetto di livello (palestra + 2) e con tutti gli EV
// ottenibili a quella tappa (3 sessioni da 40 EV per ogni luogo aperto, divise sui 5 titolari).
// Per ogni palestra: partitella con i selvatici della città, allenatori dei percorsi prima, palestra.
// npm run maxed -- 60      (TUNE='{"wildGap":0}' e GYM='{"first":0.6}' per provare valori diversi)
import { POKEDEX } from '../src/data/pokedex';
import { GYMS } from '../src/game/gyms';
import { KANTO, TRAINER_LEVEL } from '../src/game/kanto';
import { levelCap } from '../src/game/progression';
import { DEFAULT_STARTERS, SESSIONS_PER_PLACE, autoLineup, chooseStarters, newSave } from '../src/game/save';
import { EV_PER_SESSION } from '../src/game/progression';
import { TUNING, buildGymTeam, buildTrainerTeam, buildWildTeam, clubTeam, simulateMatch } from '../src/match/teams';
import type { TeamSetup } from '../src/match/engine';

if (process.env.TUNE) Object.assign(TUNING, JSON.parse(process.env.TUNE));
if (process.env.TLV) TRAINER_LEVEL.bonus = Number(process.env.TLV);
// override dell'allenamento delle palestre: GYM='[0.3,0.6,…]'
if (process.env.GYM) (JSON.parse(process.env.GYM) as number[]).forEach((t, i) => (GYMS[i].training = t));
const N = Number(process.argv[2] ?? 60);

const tot = { wild: [0, 0, 0], trainer: [0, 0, 0], gym: [0, 0, 0] } as Record<string, number[]>;
const pct = (w: number, n: number) => `${Math.round((w / n) * 100)}%`.padStart(4);
for (let g = 0; g < GYMS.length; g++) {
  const save = newSave();
  chooseStarters(save, DEFAULT_STARTERS);
  save.badges = g;
  const lvl = levelCap(save);
  const places = KANTO.filter((l) => l.badges <= g && !l.requiresChampion).length;
  const evs = Math.min(504, Math.floor((places * SESSIONS_PER_PLACE * EV_PER_SESSION) / 5 / 40) * 40);
  for (const p of save.roster) {
    p.level = lvl;
    const b = POKEDEX[p.speciesKey].base;
    p.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    p.evs[b.atk >= b.spa ? 'atk' : 'spa'] = Math.min(252, Math.ceil(evs / 2));
    p.evs[b.def >= b.spd ? 'def' : 'spd'] = Math.min(252, Math.floor(evs / 2));
  }
  save.lineup = autoLineup(save);
  const city = KANTO.find((l) => l.gym === g)!;
  const from = g ? GYMS[g - 1].level : 0;
  const routes = KANTO.filter((l) => !l.league && l.level >= from && l.level < GYMS[g].level).flatMap((l) => l.trainers.map((t) => [l, t] as const));
  const run = (kind: string, make: () => TeamSetup | null) => {
    let w = 0, d = 0, n = 0;
    for (let i = 0; i < N; i++) {
      const opp = make();
      if (!opp) break;
      const m = simulateMatch(clubTeam(save), opp, false);
      n++;
      if (m.winner === 0) w++;
      d += m.score[0] - m.score[1];
    }
    tot[kind][0] += w; tot[kind][1] += n; tot[kind][2] += d;
    return n ? `${pct(w, n)} (${d / n >= 0 ? '+' : ''}${(d / n).toFixed(1)})` : '  —  ';
  };
  const wild = run('wild', () => buildWildTeam(city, lvl));
  const tr = run('trainer', () => (routes.length ? buildTrainerTeam(...routes[Math.floor(Math.random() * routes.length)]) : null));
  const gym = run('gym', () => buildGymTeam(GYMS[g]));
  console.log(`${GYMS[g].leader.padEnd(9)} tu Lv ${lvl}, ${String(evs).padStart(3)} EV · selvatici ${wild} · allenatori ${tr} · palestra ${gym}`);
}
for (const [k, [w, n, d]] of Object.entries(tot)) console.log(`TOTALE ${k.padEnd(8)} ${pct(w, n)} scarto ${(d / n).toFixed(1)}`);
