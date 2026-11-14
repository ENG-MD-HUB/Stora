import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { can } from '../lib/permissions';
import { cancelRelease, createRelease, fetchRelease, fetchReleases, fetchSignatories, returnFromRelease, type ReleaseForm } from '../services/releases';
import type { ReleaseLine } from '../services/types';
import { useAuth, useCart, useData, useSession } from '../state/app';
import { PrintFooter, PrintHeader } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { Confirm, Empty, Field, Loading, Sheet, Stepper, useLoad, useToast } from '../ui/kit';

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const { L } = usePrefs();
  const labels = [L('الأصناف', 'Items'), L('التفاصيل', 'Details'), L('الإصدار', 'Issue')];
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6 }}>
      {labels.map((l, i) => (
        <li key={l} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ height: 4, borderRadius: 99, background: i < step ? 'var(--primary)' : 'var(--line)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: i + 1 === step ? 'var(--text)' : i < step ? 'var(--accent-text)' : 'var(--muted)' }}>{i + 1} {l}</span>
        </li>
      ))}
    </ol>
  );
}

export function ReleaseNew() {
  const { L, lang } = usePrefs();
  const cart = useCart();
  const { items, whName, reload } = useData();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState<ReleaseForm>({ requesterName: '', installLocation: '', ticketNo: '', dnNumber: '', poNumber: '', reason: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const lines = cart.entries.map((e) => ({ entry: e, item: items.find((i) => i.id === e.itemId) })).filter((l) => l.item);
  const set = (k: keyof ReleaseForm) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { // drop lines whose item disappeared
    cart.entries.forEach((e) => { if (items.length && !items.find((i) => i.id === e.itemId)) cart.remove(e.itemId); });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  async function issue() {
    const e: Record<string, string> = {};
    if (!f.installLocation.trim()) e.installLocation = L('مطلوب', 'Required');
    if (!f.reason.trim()) e.reason = L('مطلوب', 'Required');
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const id = await createRelease(lines.map((l) => ({ item: l.item!, qty: l.entry.qty })), f, whName(cart.warehouseId ?? ''));
      cart.clear();
      reload();
      toast(L('تم إصدار السند', 'Release issued'));
      nav(`/releases/${id}?print=1`, { replace: true });
    } catch (x) {
      const m = (x as Error).message;
      toast(m.startsWith('insufficient') ? L(`الكمية غير كافية: ${m.split(':')[1]}`, `Not enough stock: ${m.split(':')[1]}`) : L('تعذّر إصدار السند', 'Could not issue release'), 'error');
    } finally { setBusy(false); }
  }

  if (!lines.length) {
    return (
      <>
        <h1 className="h1">{L('السلة', 'Cart')}</h1>
        <Empty icon="bag" title={L('السلة فارغة', 'Your cart is empty')} text={L('اضغط + بجانب أي صنف في المخزون، حدّد الكمية، وسيُضاف هنا.', 'Tap + next to any item in inventory, choose the quantity, and it lands here.')}
          action={<div style={{ display: 'flex', gap: 8 }}><Link className="btn primary" to="/inventory">{L('اختر من المخزون', 'Pick from inventory')}</Link><Link className="btn" to="/scan">{L('مسح', 'Scan')}</Link></div>} />
      </>
    );
  }

  return (
    <>
      <div className="head">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label={L('رجوع', 'Back')}><Icon name={lang === 'ar' ? 'back' : 'fwd'} /></button>
        <div className="grow"><h1 className="h1" style={{ fontSize: 21 }}>{L('السلة', 'Cart')}</h1><p className="muted" style={{ margin: 0, fontSize: 13 }}>{L(`${lines.length} أصناف من ${whName(cart.warehouseId ?? '')} · لا تُخصم من المخزون إلا عند إصدار السند`, `${lines.length} items from ${whName(cart.warehouseId ?? '')} · stock changes only when you issue the release`)}</p></div>
      </div>
      <Steps step={2} />

      <div className="split">
        <div className="list">
          {lines.map(({ entry, item }) => (
            <div key={entry.itemId} className="row" style={{ flexWrap: 'wrap' }}>
              <div className="grow"><p className="title" style={{ fontSize: 14 }}>{item!.name}</p><p className="sub" style={{ fontSize: 12 }}>{L('المتوفر', 'Available')} <span className="mono">{item!.quantity}</span></p></div>
              <Stepper value={entry.qty} max={item!.quantity} onChange={(n) => cart.setQty(entry.itemId, n)} />
              <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={() => cart.remove(entry.itemId)} aria-label={L('إزالة', 'Remove')}><Icon name="x" size={16} /></button>
            </div>
          ))}
          <Link to="/inventory" className="row" style={{ color: 'var(--accent-text)', fontWeight: 600, fontSize: 14 }}><Icon name="plus" size={18} />{L('إضافة أصناف أخرى', 'Add more items')}</Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label={L('المستلم', 'Received by')}><input className="input" value={f.requesterName} onChange={set('requesterName')} /></Field>
          <div className="grid g2">
            <Field label={L('موقع التركيب / الوجهة', 'Install location')} error={errs.installLocation}><input className={`input ${errs.installLocation ? 'err' : ''}`} value={f.installLocation} onChange={set('installLocation')} /></Field>
            <Field label={L('رقم التذكرة', 'Ticket no.')}><input className="input mono" value={f.ticketNo} onChange={set('ticketNo')} /></Field>
            <Field label={L('سند التسليم D/N', 'D/N no.')}><input className="input mono" value={f.dnNumber} onChange={set('dnNumber')} /></Field>
            <Field label={L('أمر الشراء P/O', 'P/O no.')}><input className="input mono" value={f.poNumber} onChange={set('poNumber')} /></Field>
          </div>
          <Field label={L('السبب', 'Reason')} error={errs.reason}><input className={`input ${errs.reason ? 'err' : ''}`} value={f.reason} onChange={set('reason')} placeholder={L('مثال: استبدال جهاز معطل', 'e.g. replace faulty device')} /></Field>
          <button className="btn primary block" style={{ height: 54, marginTop: 6 }} disabled={busy} onClick={issue}>{busy ? <span className="spinner" /> : <><Icon name="print" />{L('إصدار وطباعة السند', 'Issue & print')}</>}</button>
        </div>
      </div>
    </>
  );
}

export function Releases() {
  const s = useSession();
  const { L, lang } = usePrefs();
  const list = useLoad(() => fetchReleases(s.companyId), [s.companyId]);
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((r) => !t || [r.releaseNumber, r.ticketNo, r.requesterName, r.installLocation, r.releasedByName].some((v) => v?.toLowerCase().includes(t)));

  return (
    <>
      <div className="head">
        <h1 className="h1">{L('سندات الصرف', 'Releases')}</h1>
        {can(s.role, 'release:create') && <Link to="/release" className="btn primary"><Icon name="plus" size={18} />{L('سند جديد', 'New')}</Link>}
      </div>
      <label className="search"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('رقم السند أو التذكرة أو المستلم', 'Release, ticket or recipient')} /></label>
      {list.loading && !list.data ? <Loading /> : rows.length === 0 ? <Empty icon="bag" title={L('لا توجد سندات', 'No releases yet')} /> : (
        <div className="list">
          {rows.map((r) => (
            <Link key={r.id} to={`/releases/${r.id}`} className="row">
              <span className="mono" style={{ color: 'var(--accent-text)', fontWeight: 600, fontSize: 14, minWidth: 72 }}>{r.releaseNumber}</span>
              <span className="grow"><p className="title" style={{ fontSize: 14 }}>{r.requesterName || r.installLocation || r.warehouseName}</p><p className="sub" style={{ fontSize: 12 }}>{L(`${r.items?.length ?? 0} أصناف`, `${r.items?.length ?? 0} items`)} · {r.releasedByName}</p></span>
              {r.status === 'cancelled' ? <span className="chip out">{L('ملغى', 'Cancelled')}</span> : <span className="muted" style={{ fontSize: 12 }}>{fmtDate(r.createdAt, lang)}</span>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function ReleaseView() {
  const { id = '' } = useParams();
  const s = useSession();
  const { company } = useAuth();
  const { L, lang } = usePrefs();
  const { reload } = useData();
  const toast = useToast();
  const nav = useNavigate();
  const r = useLoad(() => fetchRelease(id), [id]);
  const sig = useLoad(() => fetchSignatories(s.companyId), [s.companyId]);
  const [cancel, setCancel] = useState(false);
  const [ret, setRet] = useState<ReleaseLine | null>(null);

  if (r.loading && !r.data) return <Loading />;
  const rel = r.data;
  if (!rel) return <Empty title={L('السند غير موجود', 'Release not found')} />;
  const total = rel.items.reduce((a, b) => a + b.qtyReleased, 0);

  return (
    <>
      <style>{'@media print{@page{size:A4 landscape;margin:12mm}.print-form{display:block!important}.screen-only{display:none!important}}'}</style>
      <div className="head no-print">
        <button className="icon-btn" onClick={() => nav('/releases')} aria-label={L('رجوع', 'Back')}><Icon name={lang === 'ar' ? 'back' : 'fwd'} /></button>
        <div style={{ display: 'flex', gap: 8 }}>
          {rel.status === 'active' && can(s.role, 'release:cancel') && <button className="btn sm danger" onClick={() => setCancel(true)}>{L('إلغاء السند', 'Cancel release')}</button>}
          <button className="btn sm primary" onClick={() => window.print()}><Icon name="print" size={17} />{L('طباعة', 'Print')}</button>
        </div>
      </div>

      <div className="screen-only" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          {rel.status === 'cancelled' ? <span className="chip out">{L('ملغى', 'Cancelled')}</span> : <span className="chip ok"><Icon name="check" size={13} stroke={2.4} />{L('صادر', 'Issued')}</span>}
          <h1 className="h1 mono" style={{ marginTop: 8 }}>{rel.releaseNumber}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{rel.warehouseName} · {fmtDateTime(rel.createdAt, lang)} · {rel.releasedByName}</p>
        </div>
        <div className="grid g2">
          {[[L('المستلم', 'Recipient'), rel.requesterName], [L('الموقع', 'Location'), rel.installLocation], [L('التذكرة', 'Ticket'), rel.ticketNo], ['D/N', rel.dnNumber], ['P/O', rel.poNumber], [L('السبب', 'Reason'), rel.reason]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="card" style={{ padding: '12px 14px' }}><p className="muted" style={{ margin: 0, fontSize: 12 }}>{k}</p><p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: 14 }}>{v}</p></div>
          ))}
        </div>
        <div className="list">
          {rel.items.map((l) => {
            const back = l.qtyReturned ?? 0;
            const canReturn = rel.status === 'active' && back < l.qtyReleased && can(s.role, 'item:withdraw');
            return (
              <div key={l.itemId} className="row">
                <Link to={`/item/${l.itemId}`} className="grow" style={{ color: 'inherit' }}><p className="title" style={{ fontSize: 14 }}>{l.itemName}</p><p className="sub mono" style={{ fontSize: 12 }}>{[l.sapCode, l.serialNumber].filter(Boolean).join(' · ')}</p></Link>
                {back > 0 && <span className="chip ok" style={{ fontSize: 12 }}>{L(`أُرجع ${back}`, `${back} returned`)}</span>}
                <b className="mono">× {l.qtyReleased}</b>
                {canReturn && <button className="btn sm" onClick={() => setRet(l)}><Icon name="restore" size={15} />{L('إرجاع', 'Return')}</button>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Printed material release form (English, as used on site) */}
      <div className="print-form" dir="ltr" style={{ display: 'none', color: '#000', fontFamily: 'Arial, sans-serif', fontSize: 11 }}>
        <PrintHeader title="MATERIAL RELEASE FORM" company={company} meta={<><div><b>Release No:</b> {rel.releaseNumber}</div><div><b>Date:</b> {fmtDate(rel.createdAt, 'en')}</div><div><b>Storage:</b> {rel.warehouseName}</div></>} />
        <div style={{ display: 'flex', gap: 18, marginBottom: 8, flexWrap: 'wrap' }}>
          <span><b>TICKET NO.:</b> {rel.ticketNo || '—'}</span><span><b>D/N NO.:</b> {rel.dnNumber || '—'}</span><span><b>P/O NO.:</b> {rel.poNumber || '—'}</span>
          <span><b>INSTALL LOCATION:</b> {rel.installLocation}</span><span><b>RECEIVED BY:</b> {rel.requesterName || '—'}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['SL', 'SAP CODE', 'ITEM NAME / DESCRIPTION', 'MODEL NO.', 'SERIAL NUMBER', 'QTY REL.', 'QTY REM.'].map((h) => <th key={h} style={{ border: '1px solid #000', padding: 4, background: '#eee', textAlign: 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rel.items.map((l, i) => (
              <tr key={l.itemId}>{[i + 1, l.sapCode, `${l.itemName}${l.description ? ` — ${l.description}` : ''}`, l.modelNo, l.serialNumber, l.qtyReleased, l.qtyRemaining].map((v, j) => <td key={j} style={{ border: '1px solid #000', padding: 4 }}>{v}</td>)}</tr>
            ))}
            <tr><td colSpan={5} style={{ border: '1px solid #000', padding: 4, textAlign: 'right' }}><b>TOTAL</b></td><td style={{ border: '1px solid #000', padding: 4 }}><b>{total}</b></td><td style={{ border: '1px solid #000' }} /></tr>
          </tbody>
        </table>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(sig.data ?? []).length || 4}, 1fr)`, gap: 10, marginTop: 22 }}>
          {(sig.data ?? []).map((g, i) => (
            <div key={i} style={{ border: '1px solid #000', padding: 6, minHeight: 90 }}>
              <div style={{ fontWeight: 700 }}>{g.role}</div><div>{g.title}</div>
              <div style={{ marginTop: 6 }}>Name: {g.name || '______________'}</div><div style={{ marginTop: 10 }}>Signature: ______________</div><div style={{ marginTop: 10 }}>Date: ______________</div>
            </div>
          ))}
        </div>
        {rel.status === 'cancelled' && <div style={{ marginTop: 10, fontWeight: 700 }}>*** CANCELLED ***</div>}
        <PrintFooter />
      </div>

      {cancel && <Confirm danger title={L('إلغاء السند؟', 'Cancel release?')} text={L('ستعود الكميات إلى المخزون ويُسجّل الإلغاء.', 'Quantities go back to stock and the cancellation is logged.')} confirmLabel={L('إلغاء السند', 'Cancel release')} onClose={() => setCancel(false)} onConfirm={async () => { await cancelRelease(rel.id); toast(L('تم إلغاء السند', 'Release cancelled')); r.reload(); reload(); }} />}
      {ret && <ReturnSheet releaseId={rel.id} releaseNumber={rel.releaseNumber} line={ret} onClose={() => setRet(null)} onDone={() => { setRet(null); r.reload(); reload(); }} />}
      <AutoPrint ready={!!sig.data} />
    </>
  );
}

function ReturnSheet({ releaseId, releaseNumber, line, onClose, onDone }: { releaseId: string; releaseNumber: string; line: ReleaseLine; onClose: () => void; onDone: () => void }) {
  const { L } = usePrefs();
  const toast = useToast();
  const open = line.qtyReleased - (line.qtyReturned ?? 0);
  const [qty, setQty] = useState(open);
  const [by, setBy] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={L(`إرجاع من ${releaseNumber}`, `Return from ${releaseNumber}`)} onClose={onClose}>
      <div className="qty-pick">
        <p className="muted"><b style={{ color: 'var(--text)' }}>{line.itemName}</b> · {L(`مصروف ${line.qtyReleased}، يمكن إرجاع ${open}`, `released ${line.qtyReleased}, ${open} can come back`)}</p>
        <Stepper value={qty} max={open} onChange={setQty} />
        <Field label={L('أرجعه', 'Returned by')}><input className="input" value={by} onChange={(e) => setBy(e.target.value)} /></Field>
        <Field label={L('السبب / ملاحظة', 'Reason / note')} hint={L('اختياري', 'optional')}><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('مثال: لم يُستخدم', 'e.g. not used')} /></Field>
        <button className="btn primary block" disabled={busy} onClick={async () => {
          setBusy(true);
          try { const n = await returnFromRelease(releaseId, line.itemId, qty, by.trim(), note.trim()); toast(L(`أُرجع ${n} للمخزون`, `${n} returned to stock`)); onDone(); }
          catch { toast(L('تعذّر الإرجاع', 'Could not return'), 'error'); setBusy(false); }
        }}>{busy ? <span className="spinner" /> : L(`إرجاع ${qty} للمخزون`, `Return ${qty} to stock`)}</button>
      </div>
    </Sheet>
  );
}

function AutoPrint({ ready }: { ready: boolean }) {
  useEffect(() => {
    if (ready && location.hash.includes('print=1')) {
      const t = setTimeout(() => window.print(), 400);
      history.replaceState(null, '', location.href.replace('?print=1', ''));
      return () => clearTimeout(t);
    }
  }, [ready]);
  return null;
}
