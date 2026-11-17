const cache = new Map<number, HTMLImageElement>();

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
