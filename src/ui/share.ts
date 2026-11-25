import { POKEDEX } from '../data/pokedex';
import { FORMATIONS } from '../game/formations';
import { GYMS } from '../game/gyms';
import { benchOf, findOwned, type OwnedPokemon, type SaveData } from '../game/save';
import type { Role } from '../game/stats';
import { esc } from './common';
import { spriteUrl } from './sprites';

/**
 * "Condividi la tua squadra": un'immagine quadrata (1080×1080, va bene per WhatsApp, Instagram e social)
 * con il campo e i titolari, la panchina, il record e l'indirizzo del gioco. Si apre un pannello con
 * l'anteprima: da lì il tocco su «Condividi» apre il menu del telefono (Web Share con il file), altrimenti
 * si scarica il PNG e si copia il link.
 */

export const SITE_URL = 'https://play.nerdnostalgia.store';
const SITE_LABEL = 'play.nerdnostalgia.store';
const SIZE = 1080;

// i colori del tema scuro di style.css
const BG = '#1a1326';
const INK = '#f3ecff';
const INK_SOFT = '#c8b9e6';
const INK_MUTE = '#9585b5';
const PINK = '#e879a8';
const LILAC = '#a890d8';
const SURFACE = 'rgba(40, 29, 60, 0.88)';
const ROLE_COLORS: Record<Role, string> = { ATT: '#f8a8c8', DIF: '#a8e6d4', CEN: '#b8e0e8', POR: '#fff4a8' };

const nameOf = (p: OwnedPokemon) => p.nickname || POKEDEX[p.speciesKey].name;

/**
 * Sprite con CORS (raw.githubusercontent.com lo permette), altrimenti il canvas si "sporca" e non si può
 * esportare. Il parametro in più tiene la richiesta separata dalla copia senza CORS che il service worker
 * ha già salvato per le <img>. Se non arriva in tempo, al suo posto c'è un segnaposto.
 */
function loadSprite(dex: number, shiny: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = `${spriteUrl(dex, shiny)}?condividi`;
  });
}

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('600 40px Fredoka'),
      document.fonts.load('700 30px Manrope'),
      document.fonts.load('600 24px Manrope'),
    ]);
  } catch {
    // senza i font del gioco si usa quello di sistema
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Larghezza della pillola con il testo `text`. */
function pillWidth(g: CanvasRenderingContext2D, text: string, font: string, padX: number) {
  g.font = font;
  return g.measureText(text).width + padX * 2;
}

/** Testo in una pillola che parte da `x`, centrata in altezza su `cy`; restituisce la larghezza. */
function pill(g: CanvasRenderingContext2D, text: string, x: number, cy: number, font: string, bg: string, color: string, padX = 16, h = 40) {
  const w = pillWidth(g, text, font, padX);
  roundRect(g, x, cy - h / 2, w, h, h / 2);
  g.fillStyle = bg;
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x + w / 2, cy + 1);
  return w;
}

/** Riduce il carattere finché il testo sta in `max` pixel. */
function fitFont(g: CanvasRenderingContext2D, text: string, max: number, size: number, family: string, weight: number) {
  let s = size;
  for (; s > 24; s -= 2) {
    g.font = `${weight} ${s}px ${family}`;
    if (g.measureText(text).width <= max) break;
  }
  return g.font;
}

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  g.fillStyle = grad;
  g.fillRect(0, 0, SIZE, SIZE);
}

function drawPitch(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.save();
  roundRect(g, x, y, w, h, 32);
  g.clip();
  const stripes = 7;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? '#244a3f' : '#2a5246';
    g.fillRect(x + (w / stripes) * i, y, w / stripes + 1, h);
  }
  g.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  g.lineWidth = 4;
  g.strokeRect(x + 18, y + 18, w - 36, h - 36);
  g.beginPath();
  g.moveTo(x + w / 2, y + 18);
  g.lineTo(x + w / 2, y + h - 18);
  g.stroke();
  g.beginPath();
  g.arc(x + w / 2, y + h / 2, 70, 0, Math.PI * 2);
  g.stroke();
  // aree di rigore del calcio a 5: semicerchi davanti alle porte
  g.beginPath();
  g.arc(x + 18, y + h / 2, 130, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.beginPath();
  g.arc(x + w - 18, y + h / 2, 130, Math.PI / 2, (Math.PI * 3) / 2);
  g.stroke();
  g.restore();
  roundRect(g, x, y, w, h, 32);
  g.strokeStyle = 'rgba(212, 196, 240, 0.35)';
  g.lineWidth = 6;
  g.stroke();
}

/** Sprite (o il segnaposto, se non è arrivato) centrato in (cx, cy), lato `size`. */
function drawSprite(g: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, cy: number, size: number) {
  if (img) {
    g.save();
    g.imageSmoothingEnabled = false;
    g.shadowColor = 'rgba(0, 0, 0, 0.45)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 6;
    g.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    g.restore();
    return;
  }
  g.beginPath();
  g.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
  g.fillStyle = 'rgba(212, 196, 240, 0.25)';
  g.fill();
}

/** Disegna l'immagine; `sprites` false = senza sprite (se il browser rifiuta di esportarli). */
async function drawCard(save: SaveData, sprites: boolean): Promise<HTMLCanvasElement> {
  const cv = document.createElement('canvas');
  cv.width = SIZE;
  cv.height = SIZE;
  const g = cv.getContext('2d')!;
  const formation = FORMATIONS[save.formation];
  const lineup = formation.slots.map((slot, i) => ({ slot, p: findOwned(save, save.lineup[i]) }));
  const bench = benchOf(save);
  const all = [...lineup.map((l) => l.p), ...bench].filter((p): p is OwnedPokemon => !!p);
  const imgs = new Map<string, HTMLImageElement | null>();
  if (sprites) {
    const loaded = await Promise.all(all.map((p) => loadSprite(POKEDEX[p.speciesKey].dex, !!p.shiny)));
    all.forEach((p, i) => imgs.set(p.uid, loaded[i]));
  }

  // sfondo come quello del gioco nel tema scuro
  g.fillStyle = BG;
  g.fillRect(0, 0, SIZE, SIZE);
  glow(g, 160, 120, 520, 'rgba(168, 144, 216, 0.30)');
  glow(g, 980, 200, 460, 'rgba(142, 197, 216, 0.20)');
  glow(g, 540, 1160, 620, 'rgba(125, 209, 184, 0.20)');

  // in alto: il nome del gioco e le medaglie
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = '600 40px Fredoka, system-ui, sans-serif';
  g.fillStyle = INK;
  g.fillText('Poké', 60, 92);
  const pw = g.measureText('Poké').width;
  g.fillStyle = PINK;
  g.fillText('Calcio', 60 + pw, 92);
  g.textAlign = 'right';
  g.font = '700 28px Manrope, system-ui, sans-serif';
  g.fillStyle = INK_SOFT;
  g.fillText(`Medaglie ${save.badges}/${GYMS.length}${save.titles ? ` · Campione ×${save.titles}` : ''}`, SIZE - 60, 90);

  // il club: nome, colore e record
  g.textAlign = 'left';
  g.font = fitFont(g, save.clubName, SIZE - 120, 84, 'Fredoka, system-ui, sans-serif', 600);
  g.fillStyle = INK;
  g.fillText(save.clubName, 60, 196);
  roundRect(g, 60, 216, 140, 10, 5);
  g.fillStyle = save.color;
  g.fill();
  const r = save.record;
  g.font = '600 28px Manrope, system-ui, sans-serif';
  g.fillStyle = INK_SOFT;
  g.fillText(`${r.w} V · ${r.d} P · ${r.l} S  ·  gol ${r.gf}–${r.ga}  ·  ${formation.name}`, 60, 270);

  // il campo con i titolari, nelle posizioni del modulo (come nella Formazione)
  // senza panchina il campo prende anche il suo spazio
  const px = 60, py = 300, pwid = SIZE - 120, ph = bench.length ? 560 : 660;
  drawPitch(g, px, py, pwid, ph);
  for (const { slot, p } of lineup) {
    const cx = px + ((slot.home[0] + 3) / 68) * pwid;
    const cy = py + (slot.home[1] / 60) * ph;
    if (p) drawSprite(g, imgs.get(p.uid) ?? null, cx, cy - 24, 192);
    // sotto lo sprite: ruolo e nome con il livello, in due pillole affiancate
    const roleFont = '800 20px Manrope, system-ui, sans-serif';
    const nameFont = '700 26px Manrope, system-ui, sans-serif';
    const label = p ? `${nameOf(p)}${p.shiny ? ' ✨' : ''}  Lv${p.level}` : 'vuoto';
    const total = pillWidth(g, slot.role, roleFont, 12) + 8 + pillWidth(g, label, nameFont, 16);
    // il portiere sta sul bordo: la scritta non deve uscire dall'immagine
    const left = Math.max(30, Math.min(cx - total / 2, SIZE - 30 - total));
    const rw = pill(g, slot.role, left, cy + 46, roleFont, ROLE_COLORS[slot.role], '#3d2a5c', 12, 34);
    pill(g, label, left + rw + 8, cy + 46, nameFont, SURFACE, INK, 16, 44);
  }

  // la panchina, piccola sotto il campo
  if (bench.length) {
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = '700 24px Manrope, system-ui, sans-serif';
    g.fillStyle = INK_MUTE;
    g.fillText('Panchina', 60, 940);
    let x = 200;
    for (const p of bench) {
      drawSprite(g, imgs.get(p.uid) ?? null, x + 40, 930, 96);
      g.font = '600 20px Manrope, system-ui, sans-serif';
      g.fillStyle = INK_SOFT;
      g.textAlign = 'center';
      g.fillText(nameOf(p).slice(0, 12), x + 40, 985);
      x += 130;
    }
  }

  // in fondo: dove si gioca
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.font = '600 24px Manrope, system-ui, sans-serif';
  g.fillStyle = INK_MUTE;
  g.fillText('Calcio a 5 con i Pokémon · gioca gratis', 60, 1036);
  const urlFont = '800 26px Manrope, system-ui, sans-serif';
  pill(g, SITE_LABEL, SIZE - 60 - pillWidth(g, SITE_LABEL, urlFont, 20), 1036, urlFont, LILAC, BG, 20, 48);
  return cv;
}

const toBlob = (cv: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    try {
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('immagine vuota'))), 'image/png');
    } catch (e) {
      reject(e);
    }
  });

/** L'immagine della squadra in PNG. Se il browser non lascia esportare gli sprite, si rifà senza. */
export async function teamImage(save: SaveData): Promise<Blob> {
  await fontsReady();
  try {
    return await toBlob(await drawCard(save, true));
  } catch {
    return toBlob(await drawCard(save, false));
  }
}

const shareText = (save: SaveData) => `La mia squadra su PokéCalcio: ${save.clubName}. Gioca anche tu: ${SITE_URL}`;
const fileName = (save: SaveData) =>
  `pokecalcio-${save.clubName.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'squadra'}.png`;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pannello "Condividi la tua squadra": prima si prepara l'immagine (ci vuole un attimo per gli sprite), poi
 * il tocco su «Condividi» apre subito il menu del telefono. Il menu va aperto da un tocco: se lo si
 * aprisse dopo l'attesa, Safari lo rifiuterebbe.
 */
export function openShareSheet(save: SaveData) {
  document.querySelector('.share-sheet')?.remove();
  const root = document.createElement('div');
  root.className = 'share-sheet';
  root.innerHTML = `
    <div class="share-backdrop" data-share-close></div>
    <div class="card share-panel" role="dialog" aria-label="Condividi la tua squadra">
      <div class="pick-head">
        <div>
          <h3>Condividi la tua squadra</h3>
          <p class="muted">Un'immagine con i tuoi titolari, da mandare agli amici.</p>
        </div>
        <button class="share-close" data-share-close aria-label="Chiudi">✕</button>
      </div>
      <div class="share-preview"><span class="muted">Preparo l'immagine…</span></div>
      <div class="share-actions" hidden>
        <button class="primary" data-share-go hidden>Condividi</button>
        <button data-share-download>Scarica l'immagine</button>
        <button data-share-link>Copia il link del gioco</button>
      </div>
      <p class="share-status muted" aria-live="polite"></p>
    </div>`;
  document.body.appendChild(root);
  const status = root.querySelector<HTMLElement>('.share-status')!;
  let preview = '';
  const close = () => {
    if (preview) URL.revokeObjectURL(preview);
    root.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  root.querySelectorAll<HTMLElement>('[data-share-close]').forEach((b) => (b.onclick = close));

  root.querySelector<HTMLButtonElement>('[data-share-link]')!.onclick = async () => {
    status.textContent = (await copyText(SITE_URL)) ? 'Link copiato ✓' : SITE_URL;
  };

  teamImage(save).then(
    (blob) => {
      if (!root.isConnected) return;
      preview = URL.createObjectURL(blob);
      root.querySelector('.share-preview')!.innerHTML = `<img src="${preview}" alt="La squadra ${esc(save.clubName)}">`;
      root.querySelector<HTMLElement>('.share-actions')!.hidden = false;
      const file = new File([blob], fileName(save), { type: 'image/png' });
      const canShareFile = !!navigator.canShare?.({ files: [file] });
      const go = root.querySelector<HTMLButtonElement>('[data-share-go]')!;
      go.hidden = !canShareFile;
      go.onclick = async () => {
        try {
          await navigator.share({ files: [file], title: 'PokéCalcio', text: shareText(save) });
          status.textContent = 'Condivisa ✓';
        } catch (e) {
          if ((e as DOMException).name === 'AbortError') return;
          // il telefono non ha voluto: si scarica
          download(blob, file.name);
          status.textContent = (await copyText(shareText(save))) ? 'Immagine scaricata e link copiato ✓' : 'Immagine scaricata ✓';
        }
      };
      root.querySelector<HTMLButtonElement>('[data-share-download]')!.onclick = async () => {
        download(blob, file.name);
        status.textContent = (await copyText(shareText(save)))
          ? 'Immagine scaricata e link copiato: incollalo insieme all\'immagine ✓'
          : 'Immagine scaricata ✓';
      };
    },
    () => {
      if (!root.isConnected) return;
      root.querySelector('.share-preview')!.innerHTML = '<span class="muted">Non sono riuscito a preparare l\'immagine. Puoi comunque mandare il link del gioco.</span>';
      root.querySelector<HTMLElement>('.share-actions')!.hidden = false;
      root.querySelector<HTMLElement>('[data-share-download]')!.hidden = true;
    },
  );
}
