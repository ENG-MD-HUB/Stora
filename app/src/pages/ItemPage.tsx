import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { can } from '../lib/permissions';
import { changeStock, deleteItem, fetchItem, fetchMovements, setItemStatus, stockLevel } from '../services/inventory';
import type { Item, Movement } from '../services/types';
import { useCart, useData, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { Confirm, Crumbs, Empty, Field, Loading, Sheet, StockChip, Stepper, useLoad, useToast } from '../ui/kit';
import { ItemForm } from './ItemForm';

type Action = 'withdraw' | 'add' | 'return';

function StockSheet({ item, kind, onClose, onDone }: { item: Item; kind: Action; onClose: () => void; onDone: () => void }) {
  const { L } = usePrefs();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [who, setWho] = useState('');
  const [where, setWhere] = useState('');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const titles = { withdraw: L('صرف من المخزون', 'Withdraw'), add: L('إضافة كمية', 'Add stock'), return: L('إرجاع للمخزون', 'Return to stock') };
  const max = kind === 'withdraw' ? item.quantity : 100000;

  async function go() {
    setBusy(true);
    try {
      await changeStock(kind, { itemId: item.id, quantity: qty, requesterName: who, destination: where, reason: why });
      toast(L('تم التسجيل', 'Saved'));
      onDone();
    } catch (e) {
      toast((e as Error).message === 'insufficientStock' ? L('الكمية المتوفرة غير كافية', 'Not enough stock') : L('تعذّر الحفظ', 'Could not save'), 'error');
    } finally { setBusy(false); }
  }

  return (
    <Sheet title={titles[kind]} onClose={onClose} footer={<><button className="btn primary" style={{ flex: 1 }} disabled={busy || qty < 1 || qty > max} onClick={go}>{busy ? <span className="spinner" /> : L('تأكيد', 'Confirm')}</button><button className="btn" onClick={onClose}>{L('إلغاء', 'Cancel')}</button></>}>
      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="grow"><p className="title">{item.name}</p><p className="sub">{L('المتوفر', 'Available')} <span className="mono">{item.quantity}</span> {item.unit}</p></div>
        {kind === 'withdraw' ? <Stepper value={qty} max={Math.max(1, max)} onChange={setQty} /> :
          <input className="input mono" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 110 }} aria-label={L('الكمية', 'Quantity')} />}
      </div>
      {kind !== 'add' && <Field label={kind === 'withdraw' ? L('المستلم', 'Received by') : L('أرجعه', 'Returned by')}><input className="input" value={who} onChange={(e) => setWho(e.target.value)} /></Field>}
      {kind === 'withdraw' && <Field label={L('الوجهة', 'Destination')}><input className="input" value={where} onChange={(e) => setWhere(e.target.value)} /></Field>}
      <Field label={L('السبب / ملاحظة', 'Reason / note')} hint={L('اختياري', 'optional')}><input className="input" value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
    </Sheet>
  );
}

function MovementRow({ m }: { m: Movement }) {
  const { L, lang } = usePrefs();
  const diff = m.quantityAfter - m.quantityBefore;
  const label = { withdraw: L('صرف', 'Withdraw'), add: L('إضافة', 'Add'), edit: L('تعديل الكمية', 'Qty edit'), return: L('إرجاع', 'Return') }[m.type] ?? m.type;
  const extra = [m.requesterName, m.destination, m.reason].filter(Boolean).join(' · ');
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span className={`ico ${diff < 0 ? 'low' : 'ok'}`} style={{ width: 32, height: 32, borderRadius: 10 }}><Icon name={diff < 0 ? 'down' : 'up'} size={15} stroke={2.2} /></span>
      <div className="grow">
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{label} {Math.abs(diff)}</p>
        <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>{[m.performedByName, extra, fmtDateTime(m.createdAt, lang)].filter(Boolean).join(' · ')}</p>
      </div>
      <span className="mono ltr muted" style={{ fontSize: 13 }}>{m.quantityBefore} → {m.quantityAfter}</span>
    </div>
  );
}

export function ItemPage() {
  const { id = '' } = useParams();
  const s = useSession();
  const { L, lang } = usePrefs();
  const { whName, reload, items } = useData();
  const cart = useCart();
  const toast = useToast();
  const nav = useNavigate();
  const cached = items.find((i) => i.id === id) ?? null;
  const item = useLoad(() => fetchItem(id).catch(() => null), [id]);
  const moves = useLoad(() => fetchMovements(id), [id]);
  const [action, setAction] = useState<Action | null>(null);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);

  const it = item.data ?? cached;
  if (item.loading && !it) return <Loading />;
  if (!it) return <Empty title={L('الصنف غير موجود', 'Item not found')} action={<button className="btn" onClick={() => nav('/inventory')}>{L('رجوع للمخزون', 'Back to inventory')}</button>} />;
  const lvl = stockLevel(it);
  const refresh = () => { item.reload(); moves.reload(); reload(); };
  const info = [
    [L('المشروع', 'Project'), it.projectName], [L('مالك الأصول', 'Assets owner'), it.owner], [L('مكان التخزين', 'Storage'), whName(it.warehouseId)],
    [L('رقم المخزون', 'Stock no.'), it.itemCode], ['SAP', it.sapCode], [L('الموديل', 'Model'), it.model], [L('الرقم التسلسلي', 'Serial'), it.serialNumber],
    [L('رقم الأصل', 'Asset tag'), it.assetsTag], [L('أمر الشراء', 'PO'), it.poNumber], [L('سند التسليم', 'DN'), it.dnNumber],
    [L('تاريخ الإدخال', 'Entry date'), fmtDate(it.entryDate ?? it.createdAt, lang)], [L('تاريخ الانتهاء', 'Expiry'), it.expiryDate ? fmtDate(it.expiryDate, lang) : ''],
    [L('المعرّف', 'Internal ID'), it.internalId],
  ].filter(([, v]) => v);

  const canStock = it.status === 'active' && can(s.role, 'item:withdraw');
  const canCart = it.status === 'active' && it.quantity > 0 && can(s.role, 'release:create');
  const inCart = cart.has(it.id);
  const pct = Math.min(100, (it.quantity / Math.max(it.minThreshold * 3, it.quantity, 1)) * 100);

  return (
    <>
      <div className="page-top no-print">
        <button className="btn sm ghost" onClick={() => nav(-1)}><Icon name={lang === 'ar' ? 'back' : 'fwd'} size={16} />{L('رجوع', 'Back')}</button>
        <Crumbs items={[{ label: L('المخزون', 'Inventory'), to: '/inventory' }, { label: whName(it.warehouseId), to: `/inventory?wh=${it.warehouseId}` }, { label: it.name }]} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="h1">{it.name}</h1>
          {it.status === 'archived' ? <span className="chip plain">{L('مؤرشف', 'Archived')}</span> : <StockChip level={lvl} />}
        </div>
        <p className="muted mono" style={{ margin: '4px 0 0', fontSize: 13 }}>{[it.sapCode || it.itemCode, whName(it.warehouseId)].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="toolbar no-print">
        {canStock && <>
          <button className="btn sm primary" disabled={it.quantity <= 0} onClick={() => setAction('withdraw')}><Icon name="down" size={16} />{L('صرف كمية', 'Withdraw')}</button>
          <button className="btn sm" onClick={() => setAction('add')}><Icon name="up" size={16} />{L('إضافة كمية', 'Add stock')}</button>
          <button className="btn sm" onClick={() => setAction('return')}><Icon name="restore" size={16} />{L('إرجاع للمخزون', 'Return')}</button>
        </>}
        {canCart && (
          <button className={`btn sm ${inCart ? 'selected' : ''}`} onClick={() => { const r = inCart ? (cart.remove(it.id), 'removed') : cart.add(it); if (r === 'mixed') toast(L('سند الصرف يقبل مكان تخزين واحد فقط', 'One storage per release'), 'error'); }}>
            <Icon name={inCart ? 'check' : 'bag'} size={16} />{inCart ? L('في سند الصرف', 'In release') : L('إضافة لسند الصرف', 'Add to release')}
          </button>
        )}
        <span className="grow" />
        {can(s.role, 'item:edit') && <button className="btn sm" onClick={() => setEdit(true)}><Icon name="edit" size={16} />{L('تعديل البيانات', 'Edit details')}</button>}
        {can(s.role, 'item:archive') && (it.status === 'active'
          ? <button className="btn sm" onClick={() => setConfirm('archive')}><Icon name="archive" size={16} />{L('أرشفة', 'Archive')}</button>
          : <button className="btn sm" onClick={async () => { await setItemStatus(it.id, 'active'); toast(L('تمت الاستعادة', 'Restored')); refresh(); }}><Icon name="restore" size={16} />{L('استعادة', 'Restore')}</button>)}
        {can(s.role, 'item:delete') && <button className="btn sm danger" onClick={() => setConfirm('delete')}><Icon name="trash" size={16} />{L('حذف', 'Delete')}</button>}
      </div>

      <div className="card qty-strip">
        <div><span className="muted">{L('الكمية الحالية', 'Current quantity')}</span><b className="mono" style={{ color: lvl === 'ok' ? 'var(--text)' : `var(--${lvl})` }}>{it.quantity} <small>{it.unit}</small></b></div>
        <div><span className="muted">{L('الحد الأدنى', 'Minimum')}</span><b className="mono">{it.minThreshold}</b></div>
        <div className="grow" style={{ minWidth: 160 }}><span className="muted">{L('المستوى', 'Level')}</span><div className="bar" style={{ height: 8, marginTop: 10 }}><i style={{ width: `${it.quantity <= 0 ? 0 : Math.max(6, pct)}%`, background: `var(--${lvl})` }} /></div></div>
      </div>

      <div className="split">
        <section className="card card-pad">
          <h2 className="section-title" style={{ marginBottom: 8 }}>{L('بيانات الصنف', 'Item details')}</h2>
          <dl className="dl">
            {info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            {it.notes && <div style={{ gridColumn: '1 / -1' }}><dt>{L('ملاحظات', 'Notes')}</dt><dd>{it.notes}</dd></div>}
          </dl>
        </section>
        <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="section-title">{L('سجل الحركة', 'Movement history')}</h2>
          {(moves.data ?? []).length === 0 ? <p className="muted" style={{ margin: 0 }}>{moves.loading ? L('جارٍ التحميل…', 'Loading…') : L('لا توجد حركات', 'No movements')}</p> : (moves.data ?? []).map((m) => <MovementRow key={m.id} m={m} />)}
        </section>
      </div>

      {action && <StockSheet item={it} kind={action} onClose={() => setAction(null)} onDone={() => { setAction(null); refresh(); }} />}
      {edit && <ItemForm item={it} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); refresh(); }} />}
      {confirm === 'archive' && <Confirm title={L('أرشفة الصنف؟', 'Archive item?')} text={L('سيختفي من المخزون النشط ويمكن استعادته لاحقاً.', 'It will be hidden from active stock and can be restored later.')} confirmLabel={L('أرشفة', 'Archive')} onClose={() => setConfirm(null)} onConfirm={async () => { await setItemStatus(it.id, 'archived'); cart.remove(it.id); toast(L('تمت الأرشفة', 'Archived')); refresh(); }} />}
      {confirm === 'delete' && <Confirm danger title={L('حذف نهائي؟', 'Delete permanently?')} text={L('سيُحذف الصنف نهائياً ولا يمكن التراجع. سجل الحركات يبقى محفوظاً.', 'The item will be deleted for good. Movement history is kept.')} confirmLabel={L('حذف', 'Delete')} onClose={() => setConfirm(null)} onConfirm={async () => { await deleteItem(it.id); cart.remove(it.id); toast(L('تم الحذف', 'Deleted')); reload(); nav('/inventory'); }} />}
    </>
  );
}
