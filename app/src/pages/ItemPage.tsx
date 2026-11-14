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

  return (
    <>
      <div className="head no-print">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label={L('رجوع', 'Back')}><Icon name={lang === 'ar' ? 'back' : 'fwd'} /></button>
        {can(s.role, 'item:edit') && <button className="icon-btn" onClick={() => setEdit(true)} aria-label={L('تعديل', 'Edit')}><Icon name="edit" size={19} /></button>}
      </div>

      <Crumbs items={[{ label: L('المخزون', 'Inventory'), to: '/inventory' }, { label: whName(it.warehouseId), to: `/inventory?wh=${it.warehouseId}` }, { label: it.name }]} />
      <div>
        {it.status === 'archived' ? <span className="chip plain">{L('مؤرشف', 'Archived')}</span> : <StockChip level={lvl} />}
        <h1 className="h1" style={{ marginTop: 8 }}>{it.name}</h1>
        <p className="muted mono" style={{ margin: '4px 0 0', fontSize: 13 }}>{[it.sapCode || it.itemCode, whName(it.warehouseId)].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div><p className="muted" style={{ margin: 0, fontSize: 13 }}>{L('الكمية الحالية', 'Current quantity')}</p><b className="mono" style={{ fontSize: 44, lineHeight: 1.1, color: lvl === 'ok' ? 'var(--text)' : `var(--${lvl})` }}>{it.quantity}</b> <span className="muted">{it.unit}</span></div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{L('الحد الأدنى', 'Minimum')} <b className="mono" style={{ color: 'var(--text)' }}>{it.minThreshold}</b></p>
        </div>
        {it.status === 'active' && can(s.role, 'item:withdraw') && (
          <div className="grid g3">
            <button className="btn primary" disabled={it.quantity <= 0} onClick={() => setAction('withdraw')}>{L('صرف', 'Withdraw')}</button>
            <button className="btn" onClick={() => setAction('add')}>{L('إضافة', 'Add')}</button>
            <button className="btn" onClick={() => setAction('return')}>{L('إرجاع', 'Return')}</button>
          </div>
        )}
        {it.status === 'active' && it.quantity > 0 && can(s.role, 'release:create') && (
          <button className="btn ghost sm" onClick={() => { const r = cart.has(it.id) ? (cart.remove(it.id), 'removed') : cart.add(it); if (r === 'mixed') toast(L('سند الصرف يقبل مكان تخزين واحد فقط', 'One storage per release'), 'error'); }}>
            <Icon name="bag" size={17} />{cart.has(it.id) ? L('إزالة من سند الصرف', 'Remove from release') : L('إضافة لسند الصرف', 'Add to release')}
          </button>
        )}
      </div>

      <div className="split">
        <div className="grid g2" style={{ alignContent: 'start' }}>
          {info.map(([k, v]) => (
            <div key={k} className="card" style={{ padding: '12px 14px' }}>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>{k}</p>
              <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 14, overflowWrap: 'anywhere' }}>{v}</p>
            </div>
          ))}
          {it.notes && <div className="card" style={{ padding: '12px 14px', gridColumn: '1 / -1' }}><p className="muted" style={{ margin: 0, fontSize: 12 }}>{L('ملاحظات', 'Notes')}</p><p style={{ margin: '2px 0 0', fontSize: 14 }}>{it.notes}</p></div>}
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="section-title">{L('سجل الحركة', 'Movement history')}</h2>
          {(moves.data ?? []).length === 0 ? <p className="muted" style={{ margin: 0 }}>{moves.loading ? L('جارٍ التحميل…', 'Loading…') : L('لا توجد حركات', 'No movements')}</p> : (moves.data ?? []).map((m) => <MovementRow key={m.id} m={m} />)}
        </section>
      </div>

      {(can(s.role, 'item:archive') || can(s.role, 'item:delete')) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }} className="no-print">
          {can(s.role, 'item:archive') && (it.status === 'active'
            ? <button className="btn sm" onClick={() => setConfirm('archive')}><Icon name="archive" size={16} />{L('أرشفة', 'Archive')}</button>
            : <button className="btn sm" onClick={async () => { await setItemStatus(it.id, 'active'); toast(L('تمت الاستعادة', 'Restored')); refresh(); }}><Icon name="restore" size={16} />{L('استعادة', 'Restore')}</button>)}
          {can(s.role, 'item:delete') && <button className="btn sm danger" onClick={() => setConfirm('delete')}><Icon name="trash" size={16} />{L('حذف نهائي', 'Delete')}</button>}
        </div>
      )}

      {action && <StockSheet item={it} kind={action} onClose={() => setAction(null)} onDone={() => { setAction(null); refresh(); }} />}
      {edit && <ItemForm item={it} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); refresh(); }} />}
      {confirm === 'archive' && <Confirm title={L('أرشفة الصنف؟', 'Archive item?')} text={L('سيختفي من المخزون النشط ويمكن استعادته لاحقاً.', 'It will be hidden from active stock and can be restored later.')} confirmLabel={L('أرشفة', 'Archive')} onClose={() => setConfirm(null)} onConfirm={async () => { await setItemStatus(it.id, 'archived'); cart.remove(it.id); toast(L('تمت الأرشفة', 'Archived')); refresh(); }} />}
      {confirm === 'delete' && <Confirm danger title={L('حذف نهائي؟', 'Delete permanently?')} text={L('سيُحذف الصنف نهائياً ولا يمكن التراجع. سجل الحركات يبقى محفوظاً.', 'The item will be deleted for good. Movement history is kept.')} confirmLabel={L('حذف', 'Delete')} onClose={() => setConfirm(null)} onConfirm={async () => { await deleteItem(it.id); cart.remove(it.id); toast(L('تم الحذف', 'Deleted')); reload(); nav('/inventory'); }} />}
    </>
  );
}
