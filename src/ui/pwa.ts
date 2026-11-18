/**
 * Gioco installabile (PWA): service worker per giocare offline, richiesta di spazio persistente
 * (il browser non cancella il salvataggio per far posto) e il bottone "Installa".
 */

let deferred: (Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
let onChange: () => void = () => {};

/** Già aperta come app (dalla Home), non nel browser. */
export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** iPhone/iPad con Safari: lì non c'è il bottone di installazione, si fa da Condividi. */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Come si installa qui: con il bottone (Android, Chrome, Edge), a mano (iPhone) o già fatto / non si può. */
export function installMode(): 'prompt' | 'ios' | null {
  if (isInstalled()) return null;
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return null;
}

export async function promptInstall() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  onChange();
}

/** `changed`: da richiamare quando cambia la possibilità di installare (per ridisegnare il bottone). */
export function setupPwa(changed: () => void) {
  onChange = changed;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as typeof deferred;
    onChange();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    onChange();
  });
  // il salvataggio sta in localStorage: chiediamo al browser di non cancellarlo per fare spazio
  void navigator.storage?.persist?.();
  // in sviluppo niente service worker: si metterebbe in mezzo al ricaricamento automatico di Vite
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
    // quello che la pagina ha già scaricato prima che il service worker fosse attivo
    const urls = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => !u.includes('/sw.js'));
    reg.active?.postMessage({ type: 'cache', urls: [location.origin + '/', ...urls] });
  }).catch(() => {});
}
