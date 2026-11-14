import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { hasFeature } from '../config/app';
import { usePrefs } from '../lib/prefs';
import { can } from '../lib/permissions';
import { fetchItems, stockLevel } from '../services/inventory';
import type { Item } from '../services/types';
import { useCart, useData, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { Empty, StockBar, StockChip, useToast } from '../ui/kit';
import { ItemForm } from './ItemForm';

type Filter = 'all' | 'low' | 'out' | 'archived';
type View = 'cards' | 'list' | 'table' | 'grouped';
type Sort = 'new' | 'name' | 'qtyAsc' | 'qtyDesc';
const VIEWS: [View, string, [string, string]][] = [['cards', 'grid', ['بطاقات', 'Cards']], ['list', 'rows', ['قائمة', 'List']], ['table', 'table', ['جدول', 'Table']], ['grouped', 'storage', ['حسب المكان', 'By storage']]];

function ItemRow({ item, whName }: { item: Item; whName: string }) {
  const s = useSession();
  const lvl = stockLevel(item);
  return (
    <Link to={`/item/${item.id}`} className="row">
      <span className={`dotlvl ${lvl}`} aria-hidden="true" />
      <span className="grow"><p className="title" style={{ fontSize: 14.5 }}>{item.name}</p><p className="sub mono" style={{ fontSize: 12 }}>{[item.sapCode || item.itemCode, whName].filter(Boolean).join(' · ')}</p></span>
      <b className="mono" style={{ color: lvl === 'ok' ? 'var(--text)' : `var(--${lvl})` }}>{item.quantity}</b>
      <span className="muted" style={{ fontSize: 12, minWidth: 34 }}>{item.unit}</span>
      {can(s.role, 'release:create') && item.status === 'active' && <AddToCart item={item} />}
    </Link>
  );
}

function ItemsTable({ items, whName }: { items: Item[]; whName: (id: string) => string }) {
  const { L } = usePrefs();
  const nav = useNavigate();
  return (
    <div className="list scroll-x">
      <table className="tbl tbl-hover">
        <thead><tr><th>{L('الصنف', 'Item')}</th><th>{L('المكان', 'Storage')}</th><th>SAP</th><th>{L('المشروع', 'Project')}</th><th style={{ textAlign: 'end' }}>{L('الكمية', 'Qty')}</th><th style={{ textAlign: 'end' }}>{L('الحد', 'Min')}</th><th>{L('الحالة', 'Status')}</th></tr></thead>
        <tbody>
          {items.map((i) => {
            const lvl = stockLevel(i);
            return (
              <tr key={i.id} onClick={() => nav(`/item/${i.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`/item/${i.id}`)}>
                <td style={{ fontWeight: 600 }}>{i.name}</td><td className="muted">{whName(i.warehouseId)}</td><td className="mono">{i.sapCode || i.itemCode || '—'}</td><td className="muted">{i.projectName}</td>
                <td className="mono" style={{ textAlign: 'end', fontWeight: 600, color: lvl === 'ok' ? undefined : `var(--${lvl})` }}>{i.quantity} <span className="muted" style={{ fontWeight: 400 }}>{i.unit}</span></td>
                <td className="mono muted" style={{ textAlign: 'end' }}>{i.minThreshold}</td>
                <td>{i.status === 'archived' ? <span className="chip plain">{L('مؤرشف', 'Archived')}</span> : <StockChip level={lvl} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ItemsView({ view, items, whName, groups }: { view: View; items: Item[]; whName: (id: string) => string; groups: { id: string; name: string }[] }) {
  if (view === 'table') return <ItemsTable items={items} whName={whName} />;
  if (view === 'list') return <div className="list">{items.map((i) => <ItemRow key={i.id} item={i} whName={whName(i.warehouseId)} />)}</div>;
  if (view === 'grouped') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((g) => {
          const its = items.filter((i) => i.warehouseId === g.id);
          return (
            <section key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="storage" size={18} /><b>{g.name}</b><span className="chip plain">{its.length}</span></div>
              <div className="list">{its.map((i) => <ItemRow key={i.id} item={i} whName="" />)}</div>
            </section>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))' }}>
      {items.map((i) => <ItemCard key={i.id} item={i} whName={whName(i.warehouseId)} />)}
    </div>
  );
}

export function AddToCart({ item }: { item: Item }) {
  const { L } = usePrefs();
  const cart = useCart();
  const toast = useToast();
  const inCart = cart.has(item.id);
  if (item.quantity <= 0 || item.status !== 'active') return null;
  return (
    <button type="button" className="icon-btn" aria-label={inCart ? L('إزالة من السند', 'Remove from release') : L('إضافة لسند الصرف', 'Add to release')}
      style={inCart ? { background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'var(--primary)' } : { color: 'var(--accent-text)', background: 'var(--raised)' }}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation();
        if (inCart) { cart.remove(item.id); return; }
        const r = cart.add(item);
        if (r === 'mixed') toast(L('سند الصرف يقبل أصنافاً من مكان تخزين واحد فقط', 'A release can hold items from one storage only'), 'error');
      }}>
      <Icon name={inCart ? 'check' : 'plus'} size={18} stroke={2.3} />
    </button>
  );
}

export function ItemCard({ item, whName }: { item: Item; whName: string }) {
  const { L } = usePrefs();
  const s = useSession();
  const lvl = stockLevel(item);
  return (
    <Link to={`/item/${item.id}`} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--text)', borderColor: lvl === 'ok' ? undefined : `color-mix(in srgb, var(--${lvl}) 45%, transparent)` }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="grow">
          <p className="title">{item.name}</p>
          <p className="sub mono" style={{ fontSize: 12 }}>{[item.sapCode || item.itemCode, whName].filter(Boolean).join(' · ')}</p>
        </div>
        {item.status === 'archived' ? <span className="chip plain">{L('مؤرشف', 'Archived')}</span> : lvl === 'out' ? <StockChip level="out" /> : can(s.role, 'release:create') && <AddToCart item={item} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <StockBar qty={item.quantity} min={item.minThreshold} />
        <b className="mono" style={{ fontSize: 15, color: lvl === 'ok' ? 'var(--text)' : `var(--${lvl})` }}>{item.quantity}</b>
        <span className="muted" style={{ fontSize: 12 }}>{lvl === 'low' ? L(`منخفض · الحد ${item.minThreshold}`, `low · min ${item.minThreshold}`) : item.unit}</span>
      </div>
    </Link>
  );
}

export function Inventory() {
  const s = useSession();
  const { L } = usePrefs();
  const { items, warehouses, whName, loading, reload } = useData();
  const [params, setParams] = useSearchParams();
  const go = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>((params.get('f') as Filter) || 'all');
  const [wh, setWh] = useState(params.get('wh') ?? '');
  const [archived, setArchived] = useState<Item[] | null>(null);
  const [showNew, setShowNew] = useState(params.get('new') === '1');
  const [view, setViewState] = useState<View>(() => { try { return (localStorage.getItem('stora.view') as View) || 'cards'; } catch { return 'cards'; } });
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem('stora.view', v); } catch { /* ignore */ } };
  const [sort, setSort] = useState<Sort>('new');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (params.get('focus') === '1') searchRef.current?.focus(); }, [params]);
  useEffect(() => { if (params.get('new') === '1') setShowNew(true); setWh(params.get('wh') ?? ''); }, [params]);
  useEffect(() => {
    if (filter !== 'archived' || archived) return;
    fetchItems(s.companyId, 'archived').then((a) => setArchived(s.assignedWarehouseIds.length && s.role !== 'manager' ? a.filter((i) => s.assignedWarehouseIds.includes(i.warehouseId)) : a)).catch(() => setArchived([]));
  }, [filter, archived, s]);

  const counts = useMemo(() => ({ low: items.filter((i) => stockLevel(i) === 'low').length, out: items.filter((i) => stockLevel(i) === 'out').length }), [items]);
  const list = useMemo(() => {
    const src = filter === 'archived' ? archived ?? [] : items;
    const t = q.trim().toLowerCase();
    return src.filter((i) =>
      (filter === 'all' || filter === 'archived' || stockLevel(i) === filter) &&
      (!wh || i.warehouseId === wh) &&
      (!t || [i.name, i.itemCode, i.sapCode, i.serialNumber, i.assetsTag, i.projectName, i.model, i.internalId].some((v) => v?.toLowerCase().includes(t))));
  }, [items, archived, filter, wh, q]);

  const sorted = useMemo(() => {
    const a = [...list];
    if (sort === 'name') a.sort((x, y) => x.name.localeCompare(y.name));
    if (sort === 'qtyAsc') a.sort((x, y) => x.quantity - y.quantity);
    if (sort === 'qtyDesc') a.sort((x, y) => y.quantity - x.quantity);
    return a;
  }, [list, sort]);

  return (
    <>
      <div className="head">
        <div><h1 className="h1">{L('المخزون', 'Inventory')}</h1><p className="muted" style={{ margin: 0, fontSize: 13 }}>{wh ? <>{L('أنت في', 'You are in')} <b style={{ color: 'var(--text)' }}>{whName(wh)}</b> · </> : null}{L(`${list.length} من ${items.length} صنف`, `${list.length} of ${items.length} items`)}</p></div>
      </div>

      <div className="inv-tools">
        <label className="search sm">
          <Icon name="search" size={17} />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('ابحث بالاسم أو الرمز أو SAP', 'Search name, code or SAP')} aria-label={L('بحث', 'Search')} />
          {hasFeature('barcodeScanner') && <button type="button" onClick={() => go('/scan?mode=search')} className="search-scan" title={L('مسح باركود', 'Scan barcode')} aria-label={L('مسح باركود', 'Scan barcode')}><Icon name="scan" size={18} /></button>}
        </label>
        {warehouses.length > 1 && (
          <select className="ctl" value={wh} onChange={(e) => { setWh(e.target.value); setParams(e.target.value ? { wh: e.target.value } : {}, { replace: true }); }} aria-label={L('مكان التخزين', 'Storage')}>
            <option value="">{L('كل أماكن التخزين', 'All storages')}</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <select className="ctl" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={L('الترتيب', 'Sort')}>
          <option value="new">{L('ترتيب: الأحدث', 'Sort: Newest')}</option>
          <option value="name">{L('ترتيب: الاسم', 'Sort: Name')}</option>
          <option value="qtyAsc">{L('ترتيب: الأقل كمية', 'Sort: Lowest qty')}</option>
          <option value="qtyDesc">{L('ترتيب: الأعلى كمية', 'Sort: Highest qty')}</option>
        </select>
        <div className="seg" role="radiogroup" aria-label={L('طريقة العرض', 'View')}>
          {VIEWS.map(([k, icon, label]) => (
            <button key={k} role="radio" aria-checked={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)} title={L(label[0], label[1])} aria-label={L(label[0], label[1])}><Icon name={icon} size={16} /></button>
          ))}
        </div>
      </div>

      <div className="filters">
        {([['all', L('الكل', 'All'), null], ['low', L('منخفض', 'Low'), counts.low], ['out', L('نفد', 'Out of stock'), counts.out], ['archived', L('مؤرشف', 'Archived'), null]] as [Filter, string, number | null][]).map(([k, label, n]) => (
          <button key={k} className={`fchip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{label}{n !== null && <span className="fchip-n">{n}</span>}</button>
        ))}
      </div>

      {loading && !items.length ? (
        <div className="grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 92 }} />)}</div>
      ) : list.length === 0 ? (
        <Empty title={items.length ? L('لا توجد نتائج', 'No results') : L('لا توجد أصناف بعد', 'No items yet')}
          text={!items.length && !warehouses.length ? L('ابدأ بإنشاء مكان تخزين ثم أضف الأصناف.', 'Create a storage first, then add items.') : undefined}
          action={!items.length && can(s.role, 'item:create') ? (warehouses.length ? <button className="btn primary" onClick={() => setShowNew(true)}>{L('أضف أول صنف', 'Add first item')}</button> : <Link className="btn primary" to="/storages?new=1">{L('أنشئ مكان تخزين', 'Create storage')}</Link>) : undefined} />
      ) : (
        <ItemsView view={view} items={sorted.slice(0, 300)} whName={whName} groups={view === 'grouped' ? warehouses.filter((w) => sorted.some((i) => i.warehouseId === w.id)) : []} />
      )}
      {list.length > 300 && <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>{L('استخدم البحث لعرض باقي الأصناف', 'Use search to see the rest')}</p>}

      {showNew && <ItemForm defaultWarehouse={wh || undefined} onClose={() => { setShowNew(false); setParams({}, { replace: true }); }} onSaved={(id) => { setShowNew(false); reload(); go(`/item/${id}`); }} />}
    </>
  );
}
