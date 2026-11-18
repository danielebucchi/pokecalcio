// Squadra "ad hoc" contro ogni palestra: i Pokémon che puoi avere a quella tappa (gruppo iniziale + selvatici
// dei luoghi aperti) scelti per tipo contro il capopalestra, al tetto di livello e con gli EV ottenibili.
// Serve a controllare che nessuna palestra diventi banale con la squadra costruita apposta.
// npm run counter -- 100
import { POKEDEX, descendants } from '../src/data/pokedex';
import { GYMS } from '../src/game/gyms';
import { KANTO } from '../src/game/kanto';
import { CAP, EV_PER_SESSION, levelCap } from '../src/game/progression';
import { SESSIONS_PER_PLACE, STARTER_POOL, autoBench, autoLineup, bestRating, newSave } from '../src/game/save';
import { createInstance } from '../src/game/stats';
import { typeMultiplier } from '../src/game/typechart';
import { buildGymTeam, clubTeam, simulateMatch } from '../src/match/teams';

// prova: capipalestra più alti di GLV livelli con il tetto invariato, ed eventuale allenamento uguale per tutti
if (process.env.GLV) { const b = Number(process.env.GLV); GYMS.forEach((g) => (g.level += b)); CAP.margin -= b; }
if (process.env.GTR) GYMS.forEach((g) => (g.training = Number(process.env.GTR)));
// prova su singole palestre: GSET='{"0":{"training":0.8,"extraLevels":2}}'
if (process.env.GSET) for (const [i, v] of Object.entries(JSON.parse(process.env.GSET))) Object.assign(GYMS[Number(i)], v);
const N = Number(process.argv[2] ?? 100);
const ONLY = process.env.GYM_ONLY ? Number(process.env.GYM_ONLY) : null;
const tot = [0, 0];
for (let g = 0; g < GYMS.length; g++) {
  if (ONLY !== null && g !== ONLY) continue;
  const gym = GYMS[g];
  const save = newSave();
  save.badges = g;
  const lvl = levelCap(save);
  const places = KANTO.filter((l) => l.badges <= g && !l.requiresChampion);
  const evs = Math.min(504, Math.floor((places.length * SESSIONS_PER_PLACE * EV_PER_SESSION) / 5 / 40) * 40);
  const candidates = [...new Set([...STARTER_POOL, ...places.flatMap((l) => l.wild)])];
  // vantaggio di tipo contro il gruppo del capopalestra (anche le forme evolute, che giocano in partita)
  const rivals = [gym.signature, ...gym.pool].map((k) => POKEDEX[k].types);
  const edge = (k: string) => {
    const forms = [k, ...descendants(k).filter((d) => d.level <= lvl).map((d) => d.key)];
    return Math.max(...forms.map((f) => rivals.reduce((a, r) => a + Math.log(typeMultiplier(POKEDEX[f].types, r)) - Math.log(typeMultiplier(r, POKEDEX[f].types)), 0) / rivals.length));
  };
  const insts = candidates.map((k) => {
    const i: any = createInstance(k, lvl);
    i.ivs = { hp: 25, atk: 25, def: 25, spa: 25, spd: 25, spe: 25 };
    const b = POKEDEX[k].base;
    i.evs[b.atk >= b.spa ? 'atk' : 'spa'] = Math.min(252, Math.ceil(evs / 2));
    i.evs[b.def >= b.spd ? 'def' : 'spd'] = Math.min(252, Math.floor(evs / 2));
    i.exp = 0;
    return i;
  });
  // i 9 migliori per voto × vantaggio di tipo
  save.roster = insts.sort((a, b) => bestRating(b) * Math.exp(edge(b.speciesKey)) - bestRating(a) * Math.exp(edge(a.speciesKey))).slice(0, 9);
  save.lineup = autoLineup(save);
  save.bench = autoBench(save);
  let w = 0;
  let d = 0;
  for (let i = 0; i < N; i++) {
    const m = simulateMatch(clubTeam(save), buildGymTeam(gym, clubTeam(save)), true); // ai rigori se pari
    if (m.winner === 0) w++;
    d += m.score[0] - m.score[1];
  }
  tot[0] += w;
  tot[1] += N;
  const names = save.lineup.map((u) => POKEDEX[save.roster.find((p) => p.uid === u)!.speciesKey].name);
  console.log(`${gym.leader.padEnd(9)} Lv ${lvl}: vinci ${String(Math.round((w / N) * 100)).padStart(3)}% scarto ${(d / N >= 0 ? '+' : '') + (d / N).toFixed(1)} · ${names.join(', ')}`);
}
console.log(`media ${Math.round((tot[0] / tot[1]) * 100)}%`);
