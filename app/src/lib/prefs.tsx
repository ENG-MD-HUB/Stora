import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';
export type ThemePref = 'system' | 'light' | 'dark';
export type FontPref = 'inter' | 'jakarta' | 'manrope' | 'dm' | 'plex';

/** Latin font choices. Arabic text always uses IBM Plex Sans Arabic. */
export const FONTS: Record<FontPref, { label: string; family: string; css: string }> = {
  inter: { label: 'Inter', family: "'Inter'", css: 'Inter:wght@400;500;600;700' },
  jakarta: { label: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans'", css: 'Plus+Jakarta+Sans:wght@400;500;600;700' },
  manrope: { label: 'Manrope', family: "'Manrope'", css: 'Manrope:wght@400;500;600;700' },
  dm: { label: 'DM Sans', family: "'DM Sans'", css: 'DM+Sans:wght@400;500;600;700' },
  plex: { label: 'IBM Plex Sans', family: "'IBM Plex Sans'", css: 'IBM+Plex+Sans:wght@400;500;600;700' },
};

function applyFont(f: FontPref) {
  const font = FONTS[f] ?? FONTS.inter;
  document.documentElement.style.setProperty('--font-latin', font.family);
  let link = document.getElementById('latin-font') as HTMLLinkElement | null;
  if (!link) { link = document.createElement('link'); link.id = 'latin-font'; link.rel = 'stylesheet'; document.head.appendChild(link); }
  const href = `https://fonts.googleapis.com/css2?family=${font.css}&display=swap`;
  if (link.href !== href) link.href = href;
}

interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  font: FontPref;
  setFont: (f: FontPref) => void;
  /** Pick the string for the current language: L('عربي', 'English') */
  L: (ar: string, en: string) => string;
}

const Ctx = createContext<Prefs | null>(null);

function read<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
}
function write(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* private mode */ } }

function applyTheme(t: ThemePref) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0A0E17' : '#F4F6FA');
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => read<Lang>('stora.lang', 'en'));
  const [theme, setThemeState] = useState<ThemePref>(() => read<ThemePref>('stora.theme', 'system'));
  const [font, setFontState] = useState<FontPref>(() => read<FontPref>('stora.font', 'inter'));
  useEffect(() => { applyFont(font); }, [font]);
  const setFont = useCallback((f: FontPref) => { write('stora.font', f); setFontState(f); }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [theme]);

  const setLang = useCallback((l: Lang) => { write('stora.lang', l); setLangState(l); }, []);
  const setTheme = useCallback((t: ThemePref) => { write('stora.theme', t); setThemeState(t); }, []);
  const L = useCallback((ar: string, en: string) => (lang === 'ar' ? ar : en), [lang]);

  const value = useMemo(() => ({ lang, setLang, theme, setTheme, font, setFont, L }), [lang, setLang, theme, setTheme, font, setFont, L]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePrefs outside provider');
  return c;
}
