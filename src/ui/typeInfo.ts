import { TYPE_NAMES, type PokeType } from '../data/pokedex';
import { ALL_TYPES, effectiveness } from '../game/typechart';

/**
 * Tabella dei tipi a portata di tocco: ogni elemento con `data-type` apre un fumetto con contro chi
 * quel tipo è forte e da chi è battuto, come nella tabella dei giochi (in partita i ×2 valgono meno:
 * vedi typeMultiplier).
 */
function popHtml(t: PokeType): string {
  const list = (ts: PokeType[]) => (ts.length ? ts.map((x) => TYPE_NAMES[x]).join(', ') : '—');
  const att = (m: number) => ALL_TYPES.filter((d) => effectiveness(t, [d]) === m);
  const def = (m: number) => ALL_TYPES.filter((a) => effectiveness(a, [t]) === m);
  return `<b>Tipo ${TYPE_NAMES[t]}</b>
    <dl>
      <dt>Forte contro</dt><dd>${list(att(2))}</dd>
      <dt>Poco efficace contro</dt><dd>${list([...att(0.5), ...att(0)])}</dd>
      <dt>Debole contro</dt><dd>${list(def(2))}</dd>
      <dt>Resiste a</dt><dd>${list([...def(0.5), ...def(0)])}</dd>
    </dl>
    <small>In partita il vantaggio di tipo pesa nei contrasti, nei tiri e nelle parate.</small>`;
}

let pop: HTMLDivElement | null = null;

const close = () => {
  pop?.remove();
  pop = null;
};

/** Da chiamare una volta all'avvio: un solo ascoltatore per tutta la pagina. */
export function installTypeInfo() {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-type]');
    if (!el) {
      if (pop && !(e.target as HTMLElement).closest('.type-pop')) close();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const same = pop?.dataset.for === el.dataset.type;
    close();
    if (same) return;
    pop = document.createElement('div');
    pop.className = 'type-pop card';
    pop.dataset.for = el.dataset.type;
    pop.innerHTML = popHtml(el.dataset.type as PokeType);
    document.body.append(pop);
    // sotto l'etichetta, dentro lo schermo
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const below = r.bottom + 8 + pop.offsetHeight < window.innerHeight;
    pop.style.left = `${left}px`;
    pop.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - pop.offsetHeight - 8)}px`;
  }, true);
  window.addEventListener('scroll', close, { passive: true });
  window.addEventListener('keydown', (e) => e.key === 'Escape' && close());
}
