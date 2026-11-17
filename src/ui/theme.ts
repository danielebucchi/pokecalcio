export type Theme = 'light' | 'dark';

const KEY = 'pokecalcio-theme';

/** Tema salvato, altrimenti quello del sistema. index.html lo applica già prima del primo disegno. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}

export function toggleTheme(): Theme {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Bottone per la barra in alto: "Tema scuro" / "Tema chiaro". */
export function themeToggleHtml(): string {
  return `<button class="theme-toggle" data-theme-toggle>${currentTheme() === 'dark' ? 'Tema chiaro' : 'Tema scuro'}</button>`;
}

export function bindThemeToggle(root: ParentNode) {
  root.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) => {
    b.onclick = () => {
      b.textContent = toggleTheme() === 'dark' ? 'Tema chiaro' : 'Tema scuro';
    };
  });
}
