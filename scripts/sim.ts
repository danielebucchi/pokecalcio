// Simula N partite IA contro IA per bilanciare il motore: npm run sim -- 300
import { Match } from '../src/match/engine';
import { buildDemoTeams } from '../src/match/teams';

const N = Number(process.argv[2] ?? 200);
const swap = process.argv.includes('--swap');
const totals = { goals: 0, shots: 0, saves: 0, kos: 0, evos: 0, tackles: 0, w0: 0, w1: 0, draws: 0 };
const koByForm: Record<string, number> = {};
const sp = { kickins: 0, corners: 0, fouls: 0, freekicks: 0, penalties: 0, headerGoals: 0, freekickGoals: 0, penaltyGoals: 0 };
const byRole: Record<string, { goals: number; shots: number; assists: number }> = {};

for (let i = 0; i < N; i++) {
  const teams = buildDemoTeams();
  teams[0].controlled = false;
  if (swap) teams.reverse();
  const m = new Match(teams);
  while (!m.finished) m.step(1 / 60);
  totals.goals += m.score[0] + m.score[1];
  for (const k of Object.keys(sp) as (keyof typeof sp)[]) sp[k] += m.counts[k];
  if (m.score[0] > m.score[1]) totals.w0++;
  else if (m.score[1] > m.score[0]) totals.w1++;
  else totals.draws++;
  for (const p of m.players) {
    totals.shots += p.tally.shots;
    totals.saves += p.tally.saves;
    totals.kos += p.tally.kos;
    totals.evos += p.tally.evolutions;
    totals.tackles += p.tally.tackles;
    const r = (byRole[p.role] ??= { goals: 0, shots: 0, assists: 0 });
    r.goals += p.tally.goals;
    r.shots += p.tally.shots;
    r.assists += p.tally.assists;
    if (p.tally.kos) koByForm[p.inst.speciesKey] = (koByForm[p.inst.speciesKey] ?? 0) + p.tally.kos;
  }
}

const per = (v: number) => (v / N).toFixed(2);
console.log(`Partite: ${N}`);
console.log(`Gol/partita ${per(totals.goals)} · tiri ${per(totals.shots)} · parate ${per(totals.saves)}`);
console.log(`Contrasti vinti ${per(totals.tackles)} · KO ${per(totals.kos)} · evoluzioni ${per(totals.evos)}`);
console.log(`Vittorie casa ${totals.w0} · trasferta ${totals.w1} · pareggi ${totals.draws}`);
console.log('KO per specie:', Object.fromEntries(Object.entries(koByForm).map(([k, v]) => [k, per(v)])));
const roleGoals = Object.values(byRole).reduce((a, r) => a + r.goals, 0) || 1;
console.log(
  `Rimesse laterali ${per(sp.kickins)} · angoli ${per(sp.corners)} · falli ${per(sp.fouls)} · punizioni pericolose ${per(sp.freekicks)} · rigori ${per(sp.penalties)}`,
);
console.log(
  `Gol di testa ${per(sp.headerGoals)} · su punizione ${per(sp.freekickGoals)} · su rigore ${per(sp.penaltyGoals)} (realizzazione rigori ${Math.round((sp.penaltyGoals / (sp.penalties || 1)) * 100)}%)`,
);
console.log('Per ruolo (somma delle due squadre):');
console.table(
  Object.fromEntries(
    Object.entries(byRole).map(([role, r]) => [
      role,
      { gol: per(r.goals), tiri: per(r.shots), assist: per(r.assists), 'quota gol': `${Math.round((r.goals / roleGoals) * 100)}%` },
    ]),
  ),
);
