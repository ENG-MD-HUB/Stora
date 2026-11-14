import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'ar' | 'en';
export type ThemePref = 'system' | 'light' | 'dark';

interface Prefs {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
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
  const [lang, setLangState] = useState<Lang>(() => read<Lang>('stora.lang', 'ar'));
  const [theme, setThemeState] = useState<ThemePref>(() => read<ThemePref>('stora.theme', 'system'));

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

  const value = useMemo(() => ({ lang, setLang, theme, setTheme, L }), [lang, setLang, theme, setTheme, L]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePrefs outside provider');
  return c;
}
