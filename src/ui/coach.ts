import { esc } from './common';

/**
 * Fumetti guida: indicano un elemento della pagina alla volta, con Avanti / Salta. Servono la prima
 * volta che si vede una cosa (la prima partita, il primo replay); poi non tornano più.
 */
export interface CoachStep {
  /** Selettore dell'elemento indicato (se non c'è, il fumetto sta al centro). */
  target: string;
  title: string;
  text: string;
}

let current: { el: HTMLDivElement; place: () => void } | null = null;

/** Mostra i fumetti in fila; `done` parte alla fine (o con Salta). */
export function coach(steps: CoachStep[], done: () => void) {
  closeCoach();
  let i = 0;
  const el = document.createElement('div');
  el.className = 'coach card';
  document.body.append(el);
  const finish = () => {
    closeCoach();
    done();
  };
  current = { el, place };

  function place() {
    const step = steps[i];
    const target = document.querySelector<HTMLElement>(step.target);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!target) {
      el.style.left = `${(window.innerWidth - w) / 2}px`;
      el.style.top = `${(window.innerHeight - h) / 2}px`;
      return;
    }
    const r = target.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    // sotto l'elemento se c'è spazio, altrimenti sopra; se è più alto dello schermo, dentro
    let top = r.bottom + 12;
    if (top + h > window.innerHeight - 8) top = r.top - h - 12;
    if (top < 8) top = Math.min(window.innerHeight - h - 8, Math.max(8, r.top + 12));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  const show = () => {
    const step = steps[i];
    document.querySelectorAll('.coach-target').forEach((t) => t.classList.remove('coach-target'));
    const target = document.querySelector<HTMLElement>(step.target);
    target?.classList.add('coach-target');
    target?.scrollIntoView({ block: 'nearest' });
    const last = i === steps.length - 1;
    el.innerHTML = `<small class="muted">${steps.length > 1 ? `${i + 1}/${steps.length}` : 'Suggerimento'}</small>
      <b>${esc(step.title)}</b>
      <p>${esc(step.text)}</p>
      <div class="coach-actions">
        ${last ? '' : '<button class="link" data-coach-skip>Salta</button>'}
        <button class="primary" data-coach-next>${last ? 'Ho capito' : 'Avanti'}</button>
      </div>`;
    el.querySelector<HTMLButtonElement>('[data-coach-next]')!.onclick = () => {
      if (last) finish();
      else {
        i++;
        show();
      }
    };
    el.querySelector<HTMLButtonElement>('[data-coach-skip]')?.addEventListener('click', finish);
    requestAnimationFrame(place);
  };
  window.addEventListener('resize', place);
  show();
}

/** Chiude il fumetto aperto (es. uscendo dalla partita), senza richiamare `done`. */
export function closeCoach() {
  if (current) window.removeEventListener('resize', current.place);
  current?.el.remove();
  document.querySelectorAll('.coach-target').forEach((t) => t.classList.remove('coach-target'));
  current = null;
}
