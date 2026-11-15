import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePrefs } from '../lib/prefs';
import type { StockLevel } from '../services/inventory';
import { Icon } from './Icon';

// ---------- Toasts ----------
type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`} role="status">
            <Icon name={t.kind === 'error' ? 'warn' : 'check'} size={18} />{t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Sheet (bottom sheet on phone, dialog on desktop) ----------
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="grip" />
        <div className="head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="close"><Icon name="x" size={18} /></button></div>
        {children}
        {footer && <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, text, danger, confirmLabel, onConfirm, onClose }: { title: string; text: string; danger?: boolean; confirmLabel: string; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const { L } = usePrefs();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={title} onClose={onClose} footer={<>
      <button className={`btn ${danger ? 'danger' : 'primary'}`} style={{ flex: 1 }} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>{busy ? <span className="spinner" /> : confirmLabel}</button>
      <button className="btn" onClick={onClose}>{L('إلغاء', 'Cancel')}</button>
    </>}>
      <p style={{ margin: 0, color: 'var(--text-2)' }}>{text}</p>
    </Sheet>
  );
}

// ---------- Small pieces ----------
export function StockChip({ level }: { level: StockLevel }) {
  const { L } = usePrefs();
  const map = { ok: ['check', L('متوفر', 'In stock')], low: ['warn', L('منخفض', 'Low')], out: ['x', L('نفد', 'Out')] } as const;
  return <span className={`chip ${level}`}><Icon name={map[level][0]} size={13} stroke={2.4} />{map[level][1]}</span>;
}

export function StockBar({ qty, min }: { qty: number; min: number }) {
  const level = qty <= 0 ? 'out' : qty <= min ? 'low' : 'ok';
  const ref = Math.max(min * 3, qty, 1);
  const pct = qty <= 0 ? 0 : Math.max(6, Math.min(100, (qty / ref) * 100));
  return <div className="bar" style={{ flex: 1 }}><i style={{ width: `${pct}%`, background: `var(--${level})` }} /></div>;
}

export function Empty({ icon = 'box', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={34} stroke={1.5} />
      <b style={{ color: 'var(--text)', fontSize: 16 }}>{title}</b>
      {text && <span style={{ maxWidth: 340 }}>{text}</span>}
      {action}
    </div>
  );
}

export function Loading() { return <div className="center"><span className="spinner" /></div>; }

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label} {hint && <small>{hint}</small>}</span>
      {children}
      {error && <p className="err-text">{error}</p>}
    </label>
  );
}

/** Quantity input with − / + buttons. Typed values may have decimals (lengths in ft or m). */
export function Stepper({ value, min = 1, max, onChange }: { value: number; min?: number; max: number; onChange: (n: number) => void }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { setTxt(String(value)); }, [value]);
  const clamp = (n: number) => Math.min(max, Math.max(0.001, Math.round(n * 1000) / 1000));
  return (
    <div className="stepper">
      <button type="button" aria-label="-" onClick={() => onChange(Math.max(min, Math.round((value - 1) * 1000) / 1000))} disabled={value - 1 < min}>−</button>
      <input className="mono" inputMode="decimal" aria-label="qty" value={txt} onFocus={(e) => e.target.select()}
        onChange={(e) => { const raw = e.target.value.replace(/[^\d.]/g, ''); setTxt(raw); const n = parseFloat(raw); if (Number.isFinite(n) && n > 0) onChange(clamp(n)); }}
        onBlur={() => setTxt(String(value))} />
      <button type="button" aria-label="+" onClick={() => onChange(Math.min(max, Math.round((value + 1) * 1000) / 1000))} disabled={value + 1 > max}>+</button>
    </div>
  );
}

/** Small hook: load async data with loading/error state and a reload function. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, loading, error, reload: () => setN((x) => x + 1), setData };
}

/** Where am I? — small path shown at the top of detail pages. */
export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="breadcrumb" className="crumbs">
      {items.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span className="muted" aria-hidden="true">›</span>}
          {c.to ? <Link to={c.to} style={{ fontWeight: 600 }}>{c.label}</Link> : <span className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}
