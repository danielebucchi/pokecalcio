const cache = new Map<number, HTMLImageElement>();

/** Sprite ufficiale della medaglia di una palestra di Kanto (0 = Sasso … 7 = Terra). */
export const badgeUrl = (gym: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/${gym + 1}.png`;

/** La medaglia come immagine; `won` false = ancora da vincere (sbiadita). */
export const medalHtml = (gym: number, big = false, won = true) =>
  `<img class="medal ${big ? 'big' : ''} ${won ? '' : 'locked'}" src="${badgeUrl(gym)}" alt="">`;

export const spriteUrl = (dex: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`;

/** Sprite già caricato, oppure null (nel frattempo il renderer disegna un segnaposto). */
export function spriteFor(dex: number): HTMLImageElement | null {
  let img = cache.get(dex);
  if (!img) {
    img = new Image();
    img.src = spriteUrl(dex);
    cache.set(dex, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

const whiteCache = new Map<number, HTMLCanvasElement>();

/** Sagoma bianca dello sprite (per l'animazione dell'evoluzione), oppure null finché non è caricato. */
export function whiteSprite(dex: number): HTMLCanvasElement | null {
  const cached = whiteCache.get(dex);
  if (cached) return cached;
  const img = spriteFor(dex);
  if (!img) return null;
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const g = cv.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, cv.width, cv.height);
  whiteCache.set(dex, cv);
  return cv;
}
