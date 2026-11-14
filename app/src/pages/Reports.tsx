import { collection, getDocs, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { COL, db } from '../config/firebase';
import { fmtDate, seconds, toDate } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { can } from '../lib/permissions';
import { stockLevel } from '../services/inventory';
import type { Movement } from '../services/types';
import { useAuth, useData, useSession } from '../state/app';
import { PrintFooter, PrintHeader } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { useLoad } from '../ui/kit';

function downloadCsv(name: string, rows: (string | number | undefined)[][]) {
  const esc = (v: string | number | undefined) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function Reports() {
  const s = useSession();
  const { L, lang } = usePrefs();
  const { items, warehouses, whName } = useData();
  const { company } = useAuth();
  const moves = useLoad(async () => {
    const snap = await getDocs(query(collection(db, COL.movements), where('companyId', '==', s.companyId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Movement).sort((a, b) => seconds(b.createdAt) - seconds(a.createdAt));
  }, [s.companyId]);

  const since = Date.now() / 1000 - 30 * 86400;
  // Net units out in 30 days: withdrawals minus the stock put back by cancelled releases.
  const isReversal = (m: Movement) => m.type === 'add' && /^Reversal of release/.test(m.notes ?? '');
  const out30 = (moves.data ?? []).filter((m) => (m.type === 'withdraw' || isReversal(m)) && seconds(m.createdAt) >= since);
  const units30 = Math.max(0, out30.reduce((a, m) => a + (m.quantityBefore - m.quantityAfter), 0));
  const top = useMemo(() => {
    const map = new Map<string, number>();
    out30.forEach((m) => map.set(m.itemId, (map.get(m.itemId) ?? 0) + (m.quantityBefore - m.quantityAfter)));
    map.forEach((n, k) => { if (n <= 0) map.delete(k); });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ name: items.find((i) => i.id === id)?.name ?? '—', n }));
  }, [out30, items]);
  const byWh = warehouses.map((w) => ({ w, n: items.filter((i) => i.warehouseId === w.id).length, units: items.filter((i) => i.warehouseId === w.id).reduce((a, i) => a + i.quantity, 0) }));
  const maxN = Math.max(1, ...byWh.map((x) => x.units));
  const low = items.filter((i) => stockLevel(i) !== 'ok');
  const exp = can(s.role, 'excel:export');

  const header = ['Name', 'Storage', 'Quantity', 'Unit', 'Min', 'Status', 'Project', 'Owner', 'Stock no.', 'SAP', 'Model', 'Serial', 'Asset tag', 'PO', 'DN', 'Entry date'];
  const row = (i: typeof items[number]) => [i.name, whName(i.warehouseId), i.quantity, i.unit, i.minThreshold, stockLevel(i), i.projectName, i.owner, i.itemCode, i.sapCode, i.model, i.serialNumber, i.assetsTag, i.poNumber, i.dnNumber, fmtDate(i.entryDate ?? i.createdAt, 'en')];

  return (
    <>
      <div className="print-only"><PrintHeader title={L('تقرير المخزون', 'Inventory report')} company={company} meta={<div>{fmtDate(new Date(), 'en')}</div>} /></div>
      <div className="head no-print">
        <div><h1 className="h1">{L('التقارير', 'Reports')}</h1><p className="muted" style={{ margin: 0, fontSize: 13 }}>{L('ملخص المخزون وحركة آخر 30 يوماً', 'Stock summary and the last 30 days')}</p></div>
        <button className="btn" onClick={() => window.print()}><Icon name="print" size={18} />{L('طباعة التقرير', 'Print report')}</button>
      </div>

      <section className="grid g2 g4-d">
        <div className="card stat"><p>{L('الأصناف', 'Items')}</p><b>{items.length}</b></div>
        <div className="card stat"><p>{L('إجمالي الوحدات', 'Total units')}</p><b>{items.reduce((a, i) => a + i.quantity, 0)}</b></div>
        <div className="card stat"><p>{L('تحتاج توريد', 'Need restock')}</p><b style={{ color: low.length ? 'var(--low)' : undefined }}>{low.length}</b></div>
        <div className="card stat"><p>{L('مصروف (30 يوم)', 'Out (30 days)')}</p><b>{units30}</b></div>
      </section>

      <div className="split">
        <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="section-title">{L('الوحدات حسب مكان التخزين', 'Units by storage')}</h2>
          {byWh.map(({ w, n, units }) => (
            <div key={w.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>{w.name} <span className="muted">· {L(`${n} صنف`, `${n} items`)}</span></span><b className="mono">{units}</b></div>
              <div className="bar" style={{ height: 8 }}><i style={{ width: `${(units / maxN) * 100}%`, background: 'var(--primary)' }} /></div>
            </div>
          ))}
          {!byWh.length && <p className="muted" style={{ margin: 0 }}>{L('لا توجد بيانات', 'No data')}</p>}
        </section>
        <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="section-title">{L('الأكثر صرفاً (30 يوم)', 'Most released (30 days)')}</h2>
          {top.length ? top.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}><span className="mono muted" style={{ width: 18 }}>{i + 1}</span><span className="grow">{t.name}</span><b className="mono">{t.n}</b></div>
          )) : <p className="muted" style={{ margin: 0 }}>{moves.loading ? L('جارٍ التحميل…', 'Loading…') : L('لا توجد عمليات صرف', 'No releases')}</p>}
        </section>
      </div>

      <section className="print-only" style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 14, margin: '0 0 6px' }}>{L('أصناف تحتاج توريد', 'Items to restock')} ({low.length})</h2>
        <table className="tbl" style={{ border: '1px solid #ccc' }}>
          <thead><tr><th>{L('الصنف', 'Item')}</th><th>{L('المكان', 'Storage')}</th><th>{L('الكمية', 'Qty')}</th><th>{L('الحد', 'Min')}</th><th>SAP</th></tr></thead>
          <tbody>{low.map((i) => <tr key={i.id}><td>{i.name}</td><td>{whName(i.warehouseId)}</td><td>{i.quantity}</td><td>{i.minThreshold}</td><td>{i.sapCode || i.itemCode}</td></tr>)}</tbody>
        </table>
        <PrintFooter />
      </section>

      {exp && (
        <section className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="section-title">{L('تصدير إلى Excel', 'Export to Excel')}</h2>
          <div className="list">
            <button className="row" onClick={() => downloadCsv('stora-inventory', [header, ...items.map(row)])}><span className="ico plain"><Icon name="download" size={18} /></span><span className="grow"><p className="title">{L('المخزون الكامل', 'Full inventory')}</p><p className="sub">{L(`${items.length} صنف`, `${items.length} items`)}</p></span></button>
            <button className="row" onClick={() => downloadCsv('stora-restock', [header, ...low.map(row)])}><span className="ico low"><Icon name="download" size={18} /></span><span className="grow"><p className="title">{L('أصناف تحتاج توريد', 'Items to restock')}</p><p className="sub">{L(`${low.length} صنف`, `${low.length} items`)}</p></span></button>
            <button className="row" disabled={!moves.data} onClick={() => downloadCsv('stora-movements', [['Date', 'Item', 'Storage', 'Type', 'Before', 'After', 'By', 'Recipient', 'Destination', 'Reason'], ...(moves.data ?? []).map((m) => [toDate(m.createdAt)?.toISOString().slice(0, 16).replace('T', ' ') ?? '', items.find((i) => i.id === m.itemId)?.name ?? m.itemId, whName(m.warehouseId), m.type, m.quantityBefore, m.quantityAfter, m.performedByName, m.requesterName, m.destination, m.reason])])}><span className="ico plain"><Icon name="download" size={18} /></span><span className="grow"><p className="title">{L('سجل الحركات', 'Movements')}</p><p className="sub">{moves.data ? L(`${moves.data.length} حركة`, `${moves.data.length} movements`) : L('جارٍ التحميل…', 'Loading…')}</p></span></button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{L(`الملفات بصيغة CSV وتفتح مباشرة في Excel. التاريخ: ${fmtDate(new Date(), lang)}`, 'Files are CSV and open directly in Excel.')}</p>
        </section>
      )}
    </>
  );
}
