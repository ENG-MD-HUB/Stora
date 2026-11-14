import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { can } from '../lib/permissions';
import { changeStock, deleteItem, fetchItem, fetchMovements, setItemStatus, stockLevel, updateItem, type ItemInput } from '../services/inventory';
import type { Item, Movement } from '../services/types';
import { useCart, useData, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { Confirm, Crumbs, Empty, Field, Loading, Sheet, StockChip, Stepper, useLoad, useToast } from '../ui/kit';
import { toDate } from '../lib/format';

/** Receiving new stock is the only quantity change made from the item page. */
function ReceiveSheet({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const { L } = usePrefs();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={L('استلام كمية', 'Receive stock')} onClose={onClose}>
      <div className="qty-pick">
        <p className="muted"><b style={{ color: 'var(--text)' }}>{item.name}</b> · {L('الحالي', 'now')} <span className="mono">{item.quantity}</span> {item.unit}</p>
        <Stepper value={qty} max={100000} onChange={setQty} />
        <Field label={L('مرجع الاستلام (D/N أو P/O)', 'Reference (D/N or P/O)')} hint={L('اختياري', 'optional')}><input className="input mono" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label={L('ملاحظة', 'Note')} hint={L('اختياري', 'optional')}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <button className="btn primary block" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await changeStock('add', { itemId: item.id, quantity: qty, reason: ref.trim(), notes: note.trim() }); toast(L(`استُلم ${qty}`, `${qty} received`)); onDone(); }
          catch { toast(L('تعذّر الحفظ', 'Could not save'), 'error'); setBusy(false); }
        }}>{busy ? <span className="spinner" /> : L(`استلام ${qty}`, `Receive ${qty}`)}</button>
      </div>
    </Sheet>
  );
}

const isReversal = (m: Movement) => m.type === 'add' && (!!m.releaseId || /^Reversal of release/.test(m.notes ?? ''));
const releaseRef = (m: Movement) => m.releaseNumber || (m.reason?.match(/R\d{2}-\d+/)?.[0] ?? '');

function MovementRow({ m }: { m: Movement }) {
  const { L, lang } = usePrefs();
  const diff = m.quantityAfter - m.quantityBefore;
  const ref = releaseRef(m);
  const label = m.type === 'withdraw' ? L('صُرف', 'Released')
    : m.type === 'return' ? L('أُرجع من', 'Returned from')
    : isReversal(m) ? L('أُلغي السند', 'Release cancelled')
    : m.type === 'edit' ? L('تعديل الكمية', 'Quantity edit')
    : L('استلام', 'Received');
  const who = [m.requesterName, m.destination, m.type === 'add' && !isReversal(m) ? m.reason || m.performedByName : '', m.type !== 'add' ? m.reason : ''].filter(Boolean).join(' · ') || m.performedByName;
  return (
    <div className="mv">
      <span className={`mv-ico ${diff < 0 ? 'out' : 'in'}`}><Icon name={diff < 0 ? 'down' : 'up'} size={13} stroke={2.4} /></span>
      <div className="grow" style={{ minWidth: 0 }}>
        <p className="mv-t">{label} {ref && (m.releaseId ? <Link to={`/releases/${m.releaseId}`} className="mono">{ref}</Link> : <span className="mono">{ref}</span>)}</p>
        <p className="mv-s">{who}</p>
      </div>
      <b className={`mono mv-q ${diff < 0 ? 'out' : 'in'}`}>{diff > 0 ? '+' : '−'}{Math.abs(diff)}</b>
      <span className="mv-d" title={fmtDateTime(m.createdAt, lang)}>{fmtDate(m.createdAt, lang)}</span>
    </div>
  );
}

/** Totals for the item: received − released = remaining. */
function stats(it: Item, moves: Movement[]) {
  let out = 0, back = 0, returned = 0, n = 0;
  const cancelled = new Set(moves.filter(isReversal).map((m) => m.releaseId || releaseRef(m)));
  for (const m of moves) {
    const d = m.quantityAfter - m.quantityBefore;
    if (m.type === 'withdraw') { out += -d; if (!cancelled.has(m.releaseId || releaseRef(m) || '-')) n++; }
    else if (m.type === 'return') { back += d; returned += d; }
    else if (isReversal(m)) back += d;
  }
  const released = Math.max(0, out - back);
  return { released, returned, releases: n, remaining: it.quantity, received: it.quantity + released };
}

const EXTRA: [keyof Item, string, string, boolean?][] = [
  ['projectName', 'المشروع', 'Project'], ['owner', 'مالك الأصول', 'Assets owner'], ['unit', 'الوحدة', 'Unit'], ['minThreshold', 'الحد الأدنى', 'Minimum'],
  ['itemCode', 'رقم المخزون', 'Stock no.', true], ['sapCode', 'SAP', 'SAP', true], ['model', 'الموديل', 'Model'], ['serialNumber', 'الرقم التسلسلي', 'Serial', true],
  ['assetsTag', 'رقم الأصل', 'Asset tag', true], ['poNumber', 'أمر الشراء', 'PO', true], ['dnNumber', 'سند التسليم', 'DN', true], ['modelCategory', 'فئة الموديل', 'Model category'],
  ['employeeNumber', 'الشركة', 'Company'], ['requestType', 'نوع الطلب', 'Request type'],
];

/** Item details switched into editable fields, in place. Quantities are not edited here. */
function DetailsEdit({ it, onCancel, onSaved }: { it: Item; onCancel: () => void; onSaved: () => void }) {
  const { L } = usePrefs();
  const toast = useToast();
  const exp = toDate(it.expiryDate);
  const [f, setF] = useState<Record<string, string>>(() => ({
    name: it.name, notes: it.notes ?? '', expiryDate: exp ? exp.toISOString().slice(0, 10) : '',
    ...Object.fromEntries(EXTRA.map(([k]) => [k, String(it[k] ?? '')])),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, boolean>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    const e: Record<string, boolean> = { name: f.name.trim().length < 2, projectName: !f.projectName.trim(), owner: !f.owner.trim(), unit: !f.unit.trim() };
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    setBusy(true);
    try {
      await updateItem(it.id, { ...f, minThreshold: Number(f.minThreshold) || 0 } as unknown as Partial<ItemInput>);
      toast(L('تم حفظ التعديلات', 'Changes saved'));
      onSaved();
    } catch { toast(L('تعذّر الحفظ', 'Could not save'), 'error'); setBusy(false); }
  }

  return (
    <section className="card card-pad editing">
      <div className="card-head">
        <h2 className="section-title">{L('تعديل بيانات الصنف', 'Edit item details')}</h2>
        <span className="grow" />
        <button className="btn sm ghost" onClick={onCancel}>{L('إلغاء', 'Cancel')}</button>
        <button className="btn sm primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : <><Icon name="check" size={15} stroke={2.4} />{L('حفظ', 'Save')}</>}</button>
      </div>
      <div className="edit-grid">
        <label className="field span2"><span>{L('اسم الصنف', 'Item name')}</span><input className={`input ${err.name ? 'err' : ''}`} value={f.name} onChange={set('name')} /></label>
        {EXTRA.map(([k, ar, en, mono]) => (
          <label key={k} className="field"><span>{L(ar, en)}</span>
            <input className={`input ${err[k] ? 'err' : ''} ${mono ? 'mono' : ''}`} inputMode={k === 'minThreshold' ? 'numeric' : undefined} value={f[k]} onChange={set(k)} /></label>
        ))}
        <label className="field"><span>{L('تاريخ الانتهاء', 'Expiry')}</span><input className="input" type="date" value={f.expiryDate} onChange={set('expiryDate')} /></label>
        <label className="field span-all"><span>{L('ملاحظات', 'Notes')}</span><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></label>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>{L('الكميات تتغير فقط عبر "استلام كمية" وسندات الصرف.', 'Quantities change only through "Receive stock" and releases.')}</p>
    </section>
  );
}

function MoreMenu({ it, onArchive, onRestore, onDelete }: { it: Item; onArchive: () => void; onRestore: () => void; onDelete: () => void }) {
  const s = useSession();
  const { L } = usePrefs();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  const canArc = can(s.role, 'item:archive'), canDel = can(s.role, 'item:delete');
  if (!canArc && !canDel) return null;
  return (
    <div className="menu-wrap">
      <button className="btn sm icon-only" aria-label={L('المزيد', 'More')} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}><Icon name="more" size={18} stroke={3} /></button>
      {open && (
        <div className="menu" role="menu">
          {canArc && (it.status === 'active'
            ? <button role="menuitem" onClick={onArchive}><Icon name="archive" size={16} />{L('أرشفة', 'Archive')}</button>
            : <button role="menuitem" onClick={onRestore}><Icon name="restore" size={16} />{L('استعادة', 'Restore')}</button>)}
          {canDel && <button role="menuitem" className="danger" onClick={onDelete}><Icon name="trash" size={16} />{L('حذف نهائي', 'Delete')}</button>}
        </div>
      )}
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
  const moves = useLoad(() => fetchMovements(id, s.companyId), [id, s.companyId]);
  const [receive, setReceive] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);

  const it = item.data ?? cached;
  if (item.loading && !it) return <Loading />;
  if (!it) return <Empty title={L('الصنف غير موجود', 'Item not found')} action={<button className="btn" onClick={() => nav('/inventory')}>{L('رجوع للمخزون', 'Back to inventory')}</button>} />;
  const lvl = stockLevel(it);
  const refresh = () => { item.reload(); moves.reload(); reload(); };
  const info = [
    [L('مكان التخزين', 'Storage'), whName(it.warehouseId)], [L('المشروع', 'Project'), it.projectName], [L('مالك الأصول', 'Assets owner'), it.owner],
    [L('رقم المخزون', 'Stock no.'), it.itemCode], ['SAP', it.sapCode], [L('الموديل', 'Model'), it.model], [L('الرقم التسلسلي', 'Serial'), it.serialNumber],
    [L('رقم الأصل', 'Asset tag'), it.assetsTag], [L('أمر الشراء', 'PO'), it.poNumber], [L('سند التسليم', 'DN'), it.dnNumber],
    [L('تاريخ الإدخال', 'Entry date'), fmtDate(it.entryDate ?? it.createdAt, lang)], [L('تاريخ الانتهاء', 'Expiry'), it.expiryDate ? fmtDate(it.expiryDate, lang) : ''],
    [L('المعرّف', 'Internal ID'), it.internalId],
  ].filter(([, v]) => v);

  const st = stats(it, moves.data ?? []);
  const base = Math.max(st.received, it.minThreshold, 1);
  const outPct = (st.released / base) * 100;
  const remPct = (st.remaining / base) * 100;
  const minPct = Math.min(100, (it.minThreshold / base) * 100);
  const gap = st.remaining - it.minThreshold;

  return (
    <>
      <div className="page-top no-print">
        <button className="btn sm ghost" onClick={() => nav(-1)}><Icon name={lang === 'ar' ? 'back' : 'fwd'} size={16} />{L('رجوع', 'Back')}</button>
        <Crumbs items={[{ label: L('المخزون', 'Inventory'), to: '/inventory' }, { label: whName(it.warehouseId), to: `/inventory?wh=${it.warehouseId}` }, { label: it.name }]} />
      </div>

      <div className="item-head">
        <h1 className="h1">{it.name}</h1>
        {it.status === 'archived' ? <span className="chip plain">{L('مؤرشف', 'Archived')}</span> : <StockChip level={lvl} />}
        <span className="grow" />
        {!edit && <div className="item-actions no-print">
          {it.status === 'active' && can(s.role, 'item:edit') && <button className="btn sm" onClick={() => setReceive(true)}><Icon name="up" size={15} />{L('استلام كمية', 'Receive stock')}</button>}
          {can(s.role, 'item:edit') && <button className="btn sm" onClick={() => setEdit(true)}><Icon name="edit" size={15} />{L('تعديل التفاصيل', 'Edit details')}</button>}
          <MoreMenu it={it}
            onArchive={() => setConfirm('archive')}
            onRestore={async () => { await setItemStatus(it.id, 'active', it.name); toast(L('تمت الاستعادة', 'Restored')); refresh(); }}
            onDelete={() => setConfirm('delete')} />
        </div>}
      </div>

      <section className="card stock-panel">
        <div className="stat4">
          <div><span>{L('المستلم الكلي', 'Total received')}</span><b className="mono">{st.received}</b><small>{it.unit}</small></div>
          <div><span>{L('المصروف', 'Released')}</span><b className="mono c-out">{st.released}</b><small>{st.releases ? L(`في ${st.releases} سندات`, `in ${st.releases} releases`) : '—'}{st.returned ? L(` · أُرجع ${st.returned}`, ` · ${st.returned} returned`) : ''}</small></div>
          <div><span>{L('المتبقي', 'Remaining')}</span><b className={`mono ${lvl === 'ok' ? 'c-rem' : `c-${lvl}`}`}>{st.remaining}</b><small>{L('في المخزن', 'on the shelf')}</small></div>
          <div><span>{L('الحد الأدنى', 'Minimum')}</span><b className="mono c-min">{it.minThreshold}</b><small>{L('تنبيه تحته', 'alert below')}</small></div>
        </div>
        <div className="stockbar" role="img" aria-label={L(`مصروف ${st.released}، متبقي ${st.remaining}، الحد الأدنى ${it.minThreshold}`, `Released ${st.released}, remaining ${st.remaining}, minimum ${it.minThreshold}`)}>
          <div className="track">
            <i className={`seg-rem ${lvl}`} style={{ width: `${remPct}%` }} />
            <i className="seg-out" style={{ width: `${outPct}%` }} />
          </div>
          <div className="ticks" aria-hidden="true">{Array.from({ length: 11 }, (_, i) => <i key={i} className={i % 5 === 0 ? 'major' : ''} />)}</div>
          {it.minThreshold > 0 && <span className="min-mark" style={{ insetInlineStart: `${minPct}%` }}><em>{L('الحد', 'Min')} {it.minThreshold}</em></span>}
        </div>
        <div className="stock-legend">
          <span><i className="lg rem" />{L('متبقي', 'Remaining')} {st.remaining}</span>
          <span><i className="lg out" />{L('مصروف', 'Released')} {st.released}</span>
          <span><i className="lg min" />{L('الحد الأدنى', 'Minimum')} {it.minThreshold}</span>
          <span className="grow" />
          <span className={gap > 0 ? 'muted' : `c-${lvl}`}>{gap > 0 ? L(`أعلى من الحد بـ ${gap}`, `${gap} above minimum`) : gap === 0 ? L('عند الحد الأدنى', 'At minimum') : L(`أقل من الحد بـ ${-gap}`, `${-gap} below minimum`)}</span>
        </div>
      </section>

      <div className="split">
        {edit ? <DetailsEdit it={it} onCancel={() => setEdit(false)} onSaved={() => { setEdit(false); refresh(); }} /> : (
          <section className="card card-pad">
            <h2 className="section-title" style={{ marginBottom: 8 }}>{L('بيانات الصنف', 'Item details')}</h2>
            <dl className="dl">
              {info.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              {it.notes && <div style={{ gridColumn: '1 / -1' }}><dt>{L('ملاحظات', 'Notes')}</dt><dd>{it.notes}</dd></div>}
            </dl>
          </section>
        )}
        <section className="card mv-card">
          <h2 className="section-title">{L('سجل الحركة', 'Movement history')}</h2>
          {(moves.data ?? []).length === 0 ? <p className="muted" style={{ margin: 0, padding: '4px 14px 12px', fontSize: 13 }}>{moves.loading ? L('جارٍ التحميل…', 'Loading…') : L('لا توجد حركات', 'No movements')}</p> : (moves.data ?? []).map((m) => <MovementRow key={m.id} m={m} />)}
        </section>
      </div>

      {receive && <ReceiveSheet item={it} onClose={() => setReceive(false)} onDone={() => { setReceive(false); refresh(); }} />}
      {confirm === 'archive' && <Confirm title={L('أرشفة الصنف؟', 'Archive item?')} text={L('سيختفي من المخزون النشط ويمكن استعادته لاحقاً.', 'It will be hidden from active stock and can be restored later.')} confirmLabel={L('أرشفة', 'Archive')} onClose={() => setConfirm(null)} onConfirm={async () => { await setItemStatus(it.id, 'archived', it.name); cart.remove(it.id); toast(L('تمت الأرشفة', 'Archived')); refresh(); }} />}
      {confirm === 'delete' && <Confirm danger title={L('حذف نهائي؟', 'Delete permanently?')} text={L('سيُحذف الصنف نهائياً ولا يمكن التراجع. سجل الحركات يبقى محفوظاً.', 'The item will be deleted for good. Movement history is kept.')} confirmLabel={L('حذف', 'Delete')} onClose={() => setConfirm(null)} onConfirm={async () => { await deleteItem(it.id, it.name); cart.remove(it.id); toast(L('تم الحذف', 'Deleted')); reload(); nav('/inventory'); }} />}
    </>
  );
}
