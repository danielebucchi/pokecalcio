/**
 * Impostazioni del gioco salvate nel browser (non nella carriera): velocità di partenza delle partite,
 * evoluzione automatica, fumetti guida. Suoni, musica e vibrazione stanno in sound.ts, il tema in theme.ts.
 */
export const AUTO_EVO_KEY = 'pokecalcio-autoevo';
/** Velocità della partita: l'ultima scelta resta per le partite successive. */
export const SPEED_KEY = 'pokecalcio-speed';
export const SPEEDS = [1, 2, 4, 8];
export const savedSpeed = () => {
  const v = Number(localStorage.getItem(SPEED_KEY));
  return SPEEDS.includes(v) ? v : 1;
};
export const COACH_KEY = 'pokecalcio-coach-match';
export const REPLAY_TIP_KEY = 'pokecalcio-coach-replay';

/** Fa rivedere i fumetti guida alla prossima partita. */
export function resetCoach() {
  localStorage.removeItem(COACH_KEY);
  localStorage.removeItem(REPLAY_TIP_KEY);
}

/** Colori del club proposti (la palette del gioco più qualche colore pieno). */
export const CLUB_COLORS: [string, string][] = [
  ['#e879a8', 'Rosa'], ['#a890d8', 'Lilla'], ['#8ec5d8', 'Azzurro'], ['#7dd1b8', 'Menta'], ['#e8a317', 'Oro'],
  ['#f08a5d', 'Arancio'], ['#e5484d', 'Rosso'], ['#4f7cff', 'Blu'], ['#3fa889', 'Verde'], ['#6b5b8a', 'Prugna'],
];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Due colori troppo simili si confondono in campo. */
export function tooClose(a: string, b: string): boolean {
  const [x, y] = [rgb(a), rgb(b)];
  if (x.some(Number.isNaN) || y.some(Number.isNaN)) return false;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90;
}

/** Colore per l'avversario se il suo è troppo simile al tuo: il primo della palette ben distinto. */
export function distinctFrom(mine: string, theirs: string): string {
  if (!tooClose(mine, theirs)) return theirs;
  return CLUB_COLORS.map(([c]) => c).find((c) => !tooClose(c, mine)) ?? theirs;
}
