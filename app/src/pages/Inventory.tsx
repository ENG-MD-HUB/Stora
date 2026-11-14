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
import { ImportSheet } from './ImportSheet';
import { ItemForm } from './ItemForm';

type Filter = 'all' | 'low' | 'out' | 'archived';

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
  const [showImport, setShowImport] = useState(false);
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

  return (
    <>
      <div className="head">
        <div><h1 className="h1">{L('المخزون', 'Inventory')}</h1><p className="muted" style={{ margin: 0, fontSize: 13 }}>{L(`${items.length} صنف في ${warehouses.length} أماكن تخزين`, `${items.length} items in ${warehouses.length} storages`)}</p></div>
        {can(s.role, 'item:create') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowImport(true)}><Icon name="up" size={18} /><span className="desktop-only">{L('استيراد Excel', 'Import Excel')}</span></button>
            <button className="btn primary sm mobile-only" style={{ width: 48, height: 48, padding: 0 }} onClick={() => setShowNew(true)} aria-label={L('إضافة صنف', 'Add item')}><Icon name="plus" stroke={2.3} /></button>
          </div>
        )}
      </div>

      {wh && (
        <div className="callout" style={{ alignItems: 'center', padding: '10px 14px' }}>
          <Icon name="storage" size={20} />
          <span className="grow">{L('أنت في', 'You are in')} <b>{whName(wh)}</b> · <span className="muted">{L(`${items.filter((i) => i.warehouseId === wh).length} صنف`, `${items.filter((i) => i.warehouseId === wh).length} items`)}</span></span>
          <button className="btn sm ghost" onClick={() => { setWh(''); setParams({}, { replace: true }); }}>{L('كل الأماكن', 'All storages')} ✕</button>
        </div>
      )}
      <label className="search">
        <Icon name="search" size={18} />
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('ابحث بالاسم أو الرمز أو SAP', 'Search name, code or SAP')} aria-label={L('بحث', 'Search')} />
        {hasFeature('barcodeScanner') && <button type="button" onClick={() => go('/scan?mode=search')} style={{ background: 'none', border: 0, color: 'var(--accent-text)', display: 'grid' }} aria-label={L('مسح باركود', 'Scan')}><Icon name="scan" /></button>}
      </label>

      <div className="filters">
        {([['all', L('الكل', 'All')], ['low', `${L('منخفض', 'Low')} · ${counts.low}`], ['out', `${L('نفد', 'Out')} · ${counts.out}`], ['archived', L('مؤرشف', 'Archived')]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} className={`fchip ${filter === k ? 'on' : ''}`} onClick={() => { setFilter(k); setParams({}, { replace: true }); }}>{label}</button>
        ))}
        {warehouses.length > 1 && (
          <select className="fchip" value={wh} onChange={(e) => setWh(e.target.value)} aria-label={L('مكان التخزين', 'Storage')}>
            <option value="">{L('كل الأماكن', 'All storages')}</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </div>

      {loading && !items.length ? (
        <div className="grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 92 }} />)}</div>
      ) : list.length === 0 ? (
        <Empty title={items.length ? L('لا توجد نتائج', 'No results') : L('لا توجد أصناف بعد', 'No items yet')}
          text={!items.length && !warehouses.length ? L('ابدأ بإنشاء مكان تخزين ثم أضف الأصناف.', 'Create a storage first, then add items.') : undefined}
          action={!items.length && can(s.role, 'item:create') ? (warehouses.length ? <button className="btn primary" onClick={() => setShowNew(true)}>{L('أضف أول صنف', 'Add first item')}</button> : <Link className="btn primary" to="/storages?new=1">{L('أنشئ مكان تخزين', 'Create storage')}</Link>) : undefined} />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))' }}>
          {list.slice(0, 300).map((i) => <ItemCard key={i.id} item={i} whName={whName(i.warehouseId)} />)}
        </div>
      )}
      {list.length > 300 && <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>{L('استخدم البحث لعرض باقي الأصناف', 'Use search to see the rest')}</p>}

      {showImport && <ImportSheet onClose={() => setShowImport(false)} />}
      {showNew && <ItemForm defaultWarehouse={wh || undefined} onClose={() => { setShowNew(false); setParams({}, { replace: true }); }} onSaved={(id) => { setShowNew(false); reload(); go(`/item/${id}`); }} />}
    </>
  );
}
