import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from '../config/firebase';
import { isManager } from '../lib/permissions';
import { loadSession, logout, needsEmailVerification } from '../services/auth';
import { companyName } from '../services/companies';
import { fetchItems, fetchWarehouses } from '../services/inventory';
import type { Item, Session, Warehouse } from '../services/types';
import { registering, setSession as setGlobal } from './sessionStore';

// ---------- Auth ----------
interface AuthState {
  session: Session | null;
  ready: boolean;
  /** Signed in but the email address is not confirmed yet. */
  unverified: boolean;
  recheck: () => void;
  company: string;
  setSession: (s: Session | null) => void;
  signOut: () => Promise<void>;
}
const AuthCtx = createContext<AuthState | null>(null);
const IDLE_MS = 20 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setS] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [company, setCompany] = useState('');
  const [unverified, setUnverified] = useState(false);
  const recheck = useCallback(() => setUnverified(needsEmailVerification(auth.currentUser)), []);

  const setSession = useCallback((s: Session | null) => { setGlobal(s); setS(s); setUnverified(needsEmailVerification(auth.currentUser)); }, []);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { setSession(null); setReady(true); return; }
    if (registering.on) { setReady(true); return; }
    try { setSession(await loadSession(u.uid)); }
    catch (e) {
      // During registration the profile may not exist yet; the register flow sets the session itself.
      if (['accountDisabled', 'companyDisabled'].includes((e as Error).message)) await logout();
      else setSession(null);
    } finally { setReady(true); }
  }), [setSession]);

  useEffect(() => {
    if (!session) { setCompany(''); return; }
    if (session.companyId === 'system') { setCompany('STORA Admin'); return; }
    companyName(session.companyId).then(setCompany);
  }, [session]);

  // Sign out after 20 minutes without activity (same as STORA 2).
  useEffect(() => {
    if (!session) return;
    let t = window.setTimeout(() => logout(), IDLE_MS);
    const reset = () => { clearTimeout(t); t = window.setTimeout(() => logout(), IDLE_MS); };
    const ev = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    ev.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => { clearTimeout(t); ev.forEach((e) => window.removeEventListener(e, reset)); };
  }, [session]);

  const signOut = useCallback(async () => { await logout(); setSession(null); }, [setSession]);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__setSession = (x: Session) => { setSession(x); setReady(true); };
  const value = useMemo(() => ({ session, ready, unverified, recheck, company, setSession, signOut }), [session, ready, unverified, recheck, company, setSession, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
export function useSession(): Session {
  const s = useAuth().session;
  if (!s) throw new Error('no session');
  return s;
}

// ---------- Company data (storages + items), shared across pages ----------
interface DataState {
  warehouses: Warehouse[];
  items: Item[];
  loading: boolean;
  reload: () => Promise<void>;
  whName: (id: string) => string;
}
const DataCtx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [warehouses, setW] = useState<Warehouse[]>([]);
  const [items, setI] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!session || session.companyId === 'system') { setW([]); setI([]); return; }
    setLoading(true);
    try {
      const [w, i] = await Promise.all([fetchWarehouses(session.companyId), fetchItems(session.companyId)]);
      const allowed = session.assignedWarehouseIds;
      const limited = !isManager(session.role) && allowed.length > 0;
      setW(limited ? w.filter((x) => allowed.includes(x.id)) : w);
      setI(limited ? i.filter((x) => allowed.includes(x.warehouseId)) : i);
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { reload(); }, [reload]);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__setData = (w: Warehouse[], i: Item[]) => { setW(w); setI(i); setLoading(false); };
  const whName = useCallback((id: string) => warehouses.find((w) => w.id === id)?.name ?? '—', [warehouses]);
  const value = useMemo(() => ({ warehouses, items, loading, reload, whName }), [warehouses, items, loading, reload, whName]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error('useData outside provider');
  return c;
}

// ---------- Release cart (one storage per release, kept on this device) ----------
export interface CartEntry { itemId: string; qty: number }
interface CartState {
  entries: CartEntry[];
  warehouseId: string | null;
  add: (item: Item, qty?: number) => 'added' | 'mixed' | 'exists';
  remove: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  clear: () => void;
  has: (itemId: string) => boolean;
}
const CartCtx = createContext<CartState | null>(null);
const CART_KEY = 'stora.cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ entries: CartEntry[]; warehouseId: string | null }>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '') ?? { entries: [], warehouseId: null }; } catch { return { entries: [], warehouseId: null }; }
  });
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);

  const value = useMemo<CartState>(() => ({
    ...state,
    has: (id) => state.entries.some((e) => e.itemId === id),
    add: (item, qty = 1) => {
      if (state.entries.some((e) => e.itemId === item.id)) return 'exists';
      if (state.entries.length && state.warehouseId && state.warehouseId !== item.warehouseId) return 'mixed';
      setState((s) => ({ entries: [...s.entries, { itemId: item.id, qty: Math.min(qty, Math.max(1, item.quantity)) }], warehouseId: item.warehouseId }));
      return 'added';
    },
    remove: (id) => setState((s) => { const entries = s.entries.filter((e) => e.itemId !== id); return { entries, warehouseId: entries.length ? s.warehouseId : null }; }),
    setQty: (id, qty) => setState((s) => ({ ...s, entries: s.entries.map((e) => (e.itemId === id ? { ...e, qty } : e)) })),
    clear: () => setState({ entries: [], warehouseId: null }),
  }), [state]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart outside provider');
  return c;
}
