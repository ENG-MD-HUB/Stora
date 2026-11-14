import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hasFeature } from '../config/app';
import { fmtAgo, greeting, seconds, toDate } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { can, isManager, roleLabel } from '../lib/permissions';
import { fetchMovementsSince, stockLevel } from '../services/inventory';
import { fetchReleases } from '../services/releases';
import type { Item } from '../services/types';
import { fetchUsers, isPending } from '../services/users';
import { useAuth, useCart, useData, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { Sheet, useLoad } from '../ui/kit';
import { ItemForm } from './ItemForm';
import { ReceiveSheet } from './ItemPage';

/** Pick an item, then receive stock into it. */
function ReceivePicker({ onClose }: { onClose: () => void }) {
  const { L } = usePrefs();
  const { items, whName, reload } = useData();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Item | null>(null);
  const t = q.trim().toLowerCase();
  const list = items.filter((i) => !t || [i.name, i.sapCode, i.itemCode, i.serialNumber].some((v) => v?.toLowerCase().includes(t))).slice(0, 8);
  if (pick) return <ReceiveSheet item={pick} onClose={onClose} onDone={() => { reload(); onClose(); }} />;
  return (
    <Sheet title={L('استلام كمية — اختر الصنف', 'Receive stock — choose the item')} onClose={onClose}>
      <label className="search sm"><Icon name="search" size={16} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('اسم الصنف أو SAP', 'Item name or SAP')} /></label>
      <div className="list">
        {list.length === 0 && <p className="muted" style={{ margin: 0, padding: 14, fontSize: 13 }}>{L('لا توجد نتائج', 'No results')}</p>}
        {list.map((i) => (
          <button key={i.id} className="row" onClick={() => setPick(i)}>
            <span className="grow"><p className="title" style={{ fontSize: 13.5 }}>{i.name}</p><p className="sub" style={{ fontSize: 12 }}>{whName(i.warehouseId)}</p></span>
            <b className="mono" style={{ fontSize: 13 }}>{i.quantity}</b>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function Home() {
  const s = useSession();
  const { company } = useAuth();
  const { L, lang } = usePrefs();
  const { items, warehouses, loading, reload } = useData();
  const cart = useCart();
  const go = useNavigate();
  const mgr = isManager(s.role);
  const users = useLoad(() => (mgr ? fetchUsers(s.companyId) : Promise.resolve([])), [s.companyId, mgr]);
  const moves = useLoad(() => fetchMovementsSince(s.companyId, 14), [s.companyId]);
  const rels = useLoad(() => fetchReleases(s.companyId), [s.companyId]);
  const [q, setQ] = useState('');
  const [receive, setReceive] = useState(false);
  const [newItem, setNewItem] = useState(false);

  const below = useMemo(() => items.filter((i) => stockLevel(i) !== 'ok').sort((a, b) => (a.quantity / Math.max(1, a.minThreshold)) - (b.quantity / Math.max(1, b.minThreshold))), [items]);
  const outN = below.filter((i) => i.quantity <= 0).length;
  const units = items.reduce((a, i) => a + (i.quantity || 0), 0);
  const pending = (users.data ?? []).filter((u) => isPending(u, s.companyId)).length;
  const soon = Date.now() + 30 * 86400000;
  const expiring = items.filter((i) => { const d = toDate(i.expiryDate as never); return d && d.getTime() <= soon; }).length;

  // Released per day, last 14 days (net of cancellations is not needed here: it is an activity view).
  const days = useMemo(() => {
    const out: { key: string; n: number; label: string }[] = [];
    for (let k = 13; k >= 0; k--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - k);
      out.push({ key: d.toDateString(), n: 0, label: d.toLocaleDateString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' }) });
    }
    for (const m of moves.data ?? []) {
      if (m.type !== 'withdraw') continue;
      const key = new Date(seconds(m.createdAt) * 1000).toDateString();
      const d = out.find((x) => x.key === key);
      if (d) d.n += m.quantityBefore - m.quantityAfter;
    }
    return out;
  }, [moves.data, lang]);
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const total14 = days.reduce((a, d) => a + d.n, 0);
  const weekAgo = Date.now() / 1000 - 7 * 86400;
  const activeRels = (rels.data ?? []).filter((r) => r.status === 'active');
  const relWeek = activeRels.filter((r) => seconds(r.createdAt) >= weekAgo);
  const unitsWeek = relWeek.reduce((a, r) => a + r.items.reduce((x, l) => x + l.qtyReleased - (l.qtyReturned ?? 0), 0), 0);
  const name = s.displayName.split(' ')[0];

  const byStore = warehouses.map((w) => {
    const its = items.filter((i) => i.warehouseId === w.id);
    return { w, n: its.length, low: its.filter((i) => stockLevel(i) !== 'ok').length, units: its.reduce((a, i) => a + i.quantity, 0) };
  });
  const maxUnits = Math.max(1, ...byStore.map((x) => x.units));

  return (
    <>
      <div className="home-head">
        <div className="grow">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{company} · {roleLabel(s.role, L)}</p>
          <h1 className="h1">{greeting(lang)}{lang === 'ar' ? '، ' : ', '}{name}</h1>
        </div>
        <form className="search sm home-search" onSubmit={(e) => { e.preventDefault(); go(`/inventory?q=${encodeURIComponent(q.trim())}`); }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('ابحث عن صنف أو SAP أو رقم تسلسلي…', 'Find an item, SAP or serial…')} aria-label={L('بحث', 'Search')} />
          {hasFeature('barcodeScanner') && <button type="button" className="search-scan" onClick={() => go('/scan?mode=search')} aria-label={L('مسح باركود', 'Scan barcode')}><Icon name="scan" size={17} /></button>}
        </form>
        <Link to="/more" className="icon-btn mobile-only" aria-label={L('الإعدادات', 'Settings')}><Icon name="settings" size={19} /></Link>
      </div>

      {s.pendingApproval && (
        <div className="callout">
          <Icon name="info" size={22} />
          <div><b>{L('حسابك جاهز', 'Your account is ready')}</b><p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>{L('سيحدد مديرك دورك وأماكن التخزين قريباً، وستظهر بياناتك هنا بعد ذلك.', 'Your manager will assign your role and storages shortly.')}</p></div>
        </div>
      )}

      <div className="quick4">
        {hasFeature('barcodeScanner') && <Link to="/scan" className="qa"><span className="qa-ico"><Icon name="scan" size={17} /></span><span><b>{L('مسح', 'Scan')}</b><small>{L('ابحث أو أضف للسلة', 'find or add to cart')}</small></span></Link>}
        {can(s.role, 'item:edit') && <button className="qa" onClick={() => setReceive(true)}><span className="qa-ico ok"><Icon name="up" size={17} /></span><span><b>{L('استلام كمية', 'Receive stock')}</b><small>{L('وصلت بضاعة', 'a delivery arrived')}</small></span></button>}
        {can(s.role, 'item:create') && warehouses.length > 0 && <button className="qa" onClick={() => setNewItem(true)}><span className="qa-ico plain"><Icon name="plus" size={17} /></span><span><b>{L('صنف جديد', 'New item')}</b><small>{L('أضف لمكان تخزين', 'add to a storage')}</small></span></button>}
        {can(s.role, 'release:create') && <Link to="/release" className="qa primary"><span className="qa-ico"><Icon name="cart" size={17} /></span><span><b>{L(`السلة · ${cart.entries.length}`, `Cart · ${cart.entries.length}`)}</b><small>{cart.entries.length ? L('أكمل السند', 'continue the release') : L('فارغة', 'empty')}</small></span></Link>}
      </div>

      <div className="card kpi4">
        <Link to="/inventory"><span>{L('الأصناف', 'Items')}</span><b className="mono">{items.length}</b><small>{L(`في ${warehouses.length} أماكن تخزين`, `in ${warehouses.length} storages`)}</small></Link>
        <Link to="/inventory"><span>{L('القطع في الرفوف', 'Units on shelves')}</span><b className="mono c-rem">{units.toLocaleString('en')}</b><small>{L('كل الأماكن', 'all storages')}</small></Link>
        <Link to="/inventory?f=low"><span>{L('منخفض / نافد', 'Low / out of stock')}</span><b className="mono" style={{ color: below.length ? 'var(--low)' : undefined }}>{below.length - outN} / {outN}</b><small>{L('تحت الحد الأدنى', 'below minimum')}</small></Link>
        <Link to="/releases"><span>{L('مصروف هذا الأسبوع', 'Released this week')}</span><b className="mono">{unitsWeek}</b><small>{L(`في ${relWeek.length} سندات`, `in ${relWeek.length} releases`)}</small></Link>
      </div>

      <div className="home-grid">
        <div className="col">
          <section className="card tight">
            <div className="tight-head"><b>{L('تحت الحد الأدنى', 'Below minimum')}</b><span className="muted">{L('الكمية / الحد', 'quantity / minimum')}</span></div>
            {below.length === 0 ? <p className="tight-empty">{loading ? L('جارٍ التحميل…', 'Loading…') : L('كل الأصناف فوق الحد الأدنى', 'Every item is above its minimum')}</p> : below.slice(0, 6).map((i) => {
              const lvl = stockLevel(i);
              return (
                <Link key={i.id} to={`/item/${i.id}`} className="tight-row">
                  <span className={`dotlvl ${lvl}`} />
                  <span className="grow ell">{i.name} <span className="muted">· {warehouses.find((w) => w.id === i.warehouseId)?.name}</span></span>
                  <span className="mono" style={{ color: `var(--${lvl})`, fontWeight: 600 }}>{i.quantity} <span className="muted" style={{ fontWeight: 500 }}>/ {i.minThreshold}</span></span>
                </Link>
              );
            })}
            {below.length > 0 && <Link to="/inventory?f=low" className="tight-foot">{L('اعرضها في المخزون', 'Show in inventory')}</Link>}
          </section>

          <section className="card card-pad">
            <div className="tight-title"><b>{L('المصروف يومياً · آخر 14 يوم', 'Released per day · last 14 days')}</b><span className="muted">{L(`${total14} قطعة`, `${total14} pieces`)}</span></div>
            <div className="daybars" role="img" aria-label={L(`المصروف في آخر 14 يوماً: ${total14} قطعة`, `Released in the last 14 days: ${total14} pieces`)}>
              {days.map((d, i) => <i key={d.key} title={`${d.label}: ${d.n}`} className={i === days.length - 1 ? 'today' : ''} style={{ height: `${Math.max(3, (d.n / maxDay) * 100)}%` }} />)}
            </div>
            <div className="daybars-x"><span>{days[0].label}</span><span>{L('اليوم', 'Today')}</span></div>
          </section>
        </div>

        <div className="col">
          {(pending > 0 || expiring > 0) && (
            <section className="card tight">
              <div className="tight-head"><b>{L('يحتاجك', 'Needs you')}</b></div>
              {pending > 0 && <Link to="/team" className="tight-row"><b className="mono c-rem" style={{ width: 22 }}>{pending}</b><span className="grow">{L('موظفون جدد بانتظار الصلاحيات', 'new employees waiting for access')}</span></Link>}
              {expiring > 0 && <Link to="/inventory" className="tight-row"><b className="mono c-low" style={{ width: 22 }}>{expiring}</b><span className="grow">{L('أصناف تنتهي صلاحيتها خلال 30 يوم', 'items expire within 30 days')}</span></Link>}
            </section>
          )}

          <section className="card tight">
            <div className="tight-head"><b>{L('آخر السندات', 'Latest releases')}</b><Link to="/releases" style={{ fontSize: 12 }}>{L('الكل', 'All')}</Link></div>
            {(rels.data ?? []).length === 0 ? <p className="tight-empty">{rels.loading ? L('جارٍ التحميل…', 'Loading…') : L('لا توجد سندات بعد', 'No releases yet')}</p> : (rels.data ?? []).slice(0, 5).map((r) => (
              <Link key={r.id} to={`/releases/${r.id}`} className="tight-row">
                <span className="mono c-rem" style={{ fontWeight: 600, width: 64 }}>{r.releaseNumber}</span>
                <span className="grow ell">{[r.requesterName, r.installLocation].filter(Boolean).join(' · ') || r.warehouseName}</span>
                {r.status === 'cancelled' ? <span className="chip out" style={{ fontSize: 11 }}>{L('ملغى', 'Cancelled')}</span> : <span className="muted" style={{ fontSize: 12 }}>{fmtAgo(r.createdAt, lang)}</span>}
              </Link>
            ))}
          </section>

          <section className="card card-pad stores-mini">
            <b>{L('أماكن التخزين', 'Storages')}</b>
            {byStore.map(({ w, n, low, units: u }) => (
              <Link key={w.id} to={`/inventory?wh=${w.id}`}>
                <span className="sm-row"><span className="grow ell">{w.name}</span><span className="muted">{L(`${n} صنف`, `${n} ${n === 1 ? 'item' : 'items'}`)} · <span style={{ color: low ? 'var(--low)' : 'var(--ok)' }}>{L(`${low} منخفض`, `${low} low`)}</span></span></span>
                <span className="sm-bar"><i style={{ width: `${(u / maxUnits) * 100}%` }} /></span>
              </Link>
            ))}
          </section>
        </div>
      </div>

      {receive && <ReceivePicker onClose={() => setReceive(false)} />}
      {newItem && <ItemForm onClose={() => setNewItem(false)} onSaved={(id) => { setNewItem(false); reload(); go(`/item/${id}`); }} />}
    </>
  );
}
