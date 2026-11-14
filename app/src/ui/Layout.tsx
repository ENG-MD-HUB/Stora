import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { hasFeature } from '../config/app';
import { usePrefs } from '../lib/prefs';
import { can, roleLabel } from '../lib/permissions';
import { onScan, useHardwareScanner } from '../lib/hwScanner';
import { findByCode } from '../services/inventory';
import { useAuth, useCart, useData, useSession } from '../state/app';
import { PoweredBy } from './Brand';
import { useToast } from './kit';
import { Icon } from './Icon';

export function useNav() {
  const s = useSession();
  const { L } = usePrefs();
  const sup = s.role === 'super_admin';
  const items = [
    { to: '/', icon: 'home', label: L('الرئيسية', 'Home'), show: !sup, end: true },
    { to: '/companies', icon: 'building', label: L('الشركات', 'Companies'), show: sup && hasFeature('companiesAdmin') },
    { to: '/inventory', icon: 'box', label: L('المخزون', 'Inventory'), show: !sup },
    { to: '/storages', icon: 'storage', label: L('أماكن التخزين', 'Storages'), show: !sup },
    { to: '/releases', icon: 'bag', label: L('سندات الصرف', 'Releases'), show: !sup },
    { to: '/reports', icon: 'chart', label: L('التقارير', 'Reports'), show: !sup && can(s.role, 'report:view') },
    { to: '/team', icon: 'users', label: L('الفريق', 'Team'), show: !sup && can(s.role, 'user:manage') },
    { to: '/logs', icon: 'log', label: L('سجل النشاط', 'Activity'), show: can(s.role, 'log:view') },
    { to: '/settings', icon: 'settings', label: L('الإعدادات', 'Settings'), show: true },
  ];
  return items.filter((i) => i.show);
}

function Offline() {
  const { L } = usePrefs();
  const [off, setOff] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOff(false), of = () => setOff(true);
    window.addEventListener('online', on); window.addEventListener('offline', of);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', of); };
  }, []);
  return off ? <div className="offline" role="status">{L('غير متصل — تعمل الآن من البيانات المحفوظة على جهازك', 'Offline — working from data saved on this device')}</div> : null;
}

export function Layout() {
  const s = useSession();
  const { company, signOut } = useAuth();
  const { L } = usePrefs();
  const nav = useNav();
  const cart = useCart();
  const loc = useLocation();
  const go = useNavigate();
  const sup = s.role === 'super_admin';

  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  // USB / Bluetooth barcode scanners work on every page.
  useHardwareScanner();
  const { items } = useData();
  const toast = useToast();
  const ctx = useRef({ items, path: loc.pathname, cart });
  ctx.current = { items, path: loc.pathname, cart };
  useEffect(() => onScan((code) => {
    const { items: list, path, cart: c } = ctx.current;
    if (path.startsWith('/scan')) return; // the scan page handles it
    const it = findByCode(list, code);
    if (!it) { toast(L(`لا يوجد صنف بالرمز ${code}`, `No item with code ${code}`), 'error'); return; }
    if (path.startsWith('/release') && can(s.role, 'release:create')) {
      const r = c.add(it);
      toast(r === 'mixed' ? L('سند الصرف يقبل مكان تخزين واحد فقط', 'One storage per release') : r === 'exists' ? L('موجود في السند', 'Already in release') : L(`أضيف: ${it.name}`, `Added: ${it.name}`), r === 'mixed' ? 'error' : 'ok');
      return;
    }
    go(`/item/${it.id}`);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const tab = (to: string, icon: string, label: string) => {
    const on = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to);
    return <NavLink to={to} className={`tab ${on ? 'on' : ''}`}><Icon name={icon} size={22} />{label}</NavLink>;
  };
  const showCartBar = cart.entries.length > 0 && !loc.pathname.startsWith('/release');

  return (
    <div className="shell">
      <Offline />
      <aside className="sidebar">
        <div className="brand"><img src={`${import.meta.env.BASE_URL}brand/stora-icon.png`} alt="" className="brand-icon" /><span className="brand-word">STORA</span></div>
        <nav className="nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              <Icon name={n.icon} size={19} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="card" style={{ marginTop: 'auto', padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ico plain" style={{ width: 38, height: 38, fontWeight: 700 }}>{(s.displayName || '?').trim().charAt(0)}</span>
          <div className="grow"><p className="title" style={{ fontSize: 14, whiteSpace: 'normal', lineHeight: 1.3 }}>{s.displayName}</p><p className="sub" style={{ fontSize: 12 }}>{roleLabel(s.role, L)} · {company}</p></div>
          <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={signOut} aria-label={L('تسجيل الخروج', 'Sign out')}><Icon name="logout" size={17} /></button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: -8 }}><PoweredBy height={12} /></div>
      </aside>

      <div className="content">

        <main className="page"><Outlet /></main>
      </div>

      {showCartBar && (
        <NavLink to="/release" className="cartbar no-print">
          <span className="n">{cart.entries.length}</span>
          <span className="grow">{L('أصناف في سند الصرف', 'items in release')}</span>
          <span>{L('متابعة', 'Continue')} <Icon name={document.dir === 'rtl' ? 'fwd' : 'back'} size={16} /></span>
        </NavLink>
      )}

      {!sup && !loc.pathname.startsWith('/release') && !loc.pathname.startsWith('/scan') && <Fab raised={showCartBar} />}
      {!sup && (
        <nav className="tabbar no-print" aria-label={L('التنقل', 'Navigation')}>
          {tab('/', 'home', L('الرئيسية', 'Home'))}
          {tab('/inventory', 'box', L('المخزون', 'Inventory'))}
          {hasFeature('barcodeScanner')
            ? <NavLink to="/scan" className="tab tab-scan" aria-label={L('مسح', 'Scan')}><span className="fab"><Icon name="scan" size={26} stroke={2.1} /></span>{L('مسح', 'Scan')}</NavLink>
            : tab('/storages', 'storage', L('المخازن', 'Storages'))}
          {tab('/releases', 'bag', L('الصرف', 'Releases'))}
          {tab('/more', 'more', L('المزيد', 'More'))}
        </nav>
      )}
      {sup && (
        <nav className="tabbar no-print">
          {tab('/companies', 'building', L('الشركات', 'Companies'))}
          {tab('/logs', 'log', L('السجل', 'Activity'))}
          {tab('/settings', 'settings', L('الإعدادات', 'Settings'))}
        </nav>
      )}
    </div>
  );
}

/** Floating "+" button: the one place to start new work (release, item, scan, import). */
function Fab({ raised }: { raised: boolean }) {
  const s = useSession();
  const { L } = usePrefs();
  const go = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  const actions = [
    can(s.role, 'release:create') && { icon: 'bag', label: L('سند صرف جديد', 'New release'), to: '/release' },
    can(s.role, 'item:create') && { icon: 'box', label: L('إضافة صنف', 'Add item'), to: '/inventory?new=1' },
    hasFeature('barcodeScanner') && { icon: 'scan', label: L('مسح باركود', 'Scan barcode'), to: '/scan' },
  ].filter(Boolean) as { icon: string; label: string; to: string }[];
  if (!actions.length) return null;
  return (
    <div className={`fab-wrap no-print ${raised ? 'raised' : ''} ${open ? 'open' : ''}`}>
      {open && <div className="fab-scrim" onClick={() => setOpen(false)} />}
      {open && (
        <div className="fab-menu" role="menu">
          {actions.map((a) => (
            <button key={a.to} role="menuitem" className="fab-item" onClick={() => { setOpen(false); go(a.to); }}>
              <span>{a.label}</span><span className="fab-ico"><Icon name={a.icon} size={19} /></span>
            </button>
          ))}
        </div>
      )}
      <button className="fab-btn" aria-expanded={open} aria-label={L('إجراء جديد', 'New')} onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" size={26} stroke={2.3} />
      </button>
    </div>
  );
}
