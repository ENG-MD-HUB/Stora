import { APP } from '../config/app';
import { roleLabel } from '../lib/permissions';
import { seconds } from '../lib/format';
import { LABELS } from '../pages/Logs';
import { fetchLogs } from './audit';
import { fetchMovementsSince, stockLevel } from './inventory';
import { fetchReleases } from './releases';
import type { Item, Movement, Warehouse } from './types';
import { fetchUsers } from './users';

type Lx = (ar: string, en: string) => string;
type Cell = { value?: unknown; type?: unknown; format?: string; fontWeight?: 'bold'; textColor?: string; backgroundColor?: string; align?: 'left' | 'center' | 'right'; alignVertical?: 'top' | 'center' | 'bottom'; wrap?: boolean; borderColor?: string; borderStyle?: string; height?: number; fontSize?: number } | null;

const HEAD: Partial<NonNullable<Cell>> = { fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: '#1F4F8F', alignVertical: 'center', wrap: true, borderColor: '#16406F', borderStyle: 'thin', height: 30 };
const NUM = '#,##0.###';
const DATE = 'dd/mm/yyyy hh:mm';
const DAY = 'dd/mm/yyyy';

// Excel has no time zones: shift to local wall-clock time so the sheet shows the time people saw.
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000);
const toDate = (ts: unknown): Date | null => { const s = seconds(ts as never); return s ? local(new Date(s * 1000)) : null; };
const txt = (v: unknown): Cell => (v === undefined || v === null || v === '' ? null : { value: String(v), type: String });
const num = (v: number | undefined | null, extra: Partial<NonNullable<Cell>> = {}): Cell => (v === undefined || v === null || !Number.isFinite(v) ? null : { value: v, type: Number, format: NUM, ...extra });
const date = (v: unknown, fmt = DATE): Cell => { const d = toDate(v) ?? (v instanceof Date ? local(v) : null); return d ? { value: d, type: Date, format: fmt } : null; };
const header = (labels: string[]): Cell[] => labels.map((l) => ({ value: l, type: String, ...HEAD }));
const isReversal = (m: Movement) => m.type === 'add' && (!!m.releaseId || /^Reversal of release/.test(m.notes ?? ''));

/** Builds one organised Excel workbook with everything the company has in STORA, and downloads it. */
export async function downloadBackup(o: { companyId: string; company: string; by: string; warehouses: Warehouse[]; items: Item[]; L: Lx; lang: 'ar' | 'en'; onStep?: (s: string) => void }) {
  const { L, warehouses, items } = o;
  o.onStep?.(L('جلب الحركات…', 'Loading movements…'));
  const [moves, rels, logs, users] = await Promise.all([
    fetchMovementsSince(o.companyId, 365 * 50),
    fetchReleases(o.companyId),
    fetchLogs(o.companyId, 100000),
    fetchUsers(o.companyId).catch(() => []),
  ]);
  o.onStep?.(L('تجهيز الملف…', 'Building the file…'));
  const wh = new Map(warehouses.map((w) => [w.id, w]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const whName = (id?: string) => (id && wh.get(id)?.name) || '';

  // Per item: released (net of returns and cancellations), and received = available + released.
  const out = new Map<string, number>();
  for (const m of moves) {
    const d = m.quantityAfter - m.quantityBefore;
    if (m.type === 'withdraw') out.set(m.itemId, (out.get(m.itemId) ?? 0) - d);
    else if (m.type === 'return' || isReversal(m)) out.set(m.itemId, (out.get(m.itemId) ?? 0) - d);
  }
  const released = (i: Item) => Math.max(0, Math.round((out.get(i.id) ?? 0) * 1000) / 1000);

  const sortedItems = [...items].sort((a, b) => whName(a.warehouseId).localeCompare(whName(b.warehouseId)) || (a.shelf ?? '').localeCompare(b.shelf ?? '') || a.name.localeCompare(b.name));
  const levelCell = (i: Item): Cell => {
    if (i.status === 'archived') return { value: L('مؤرشف', 'Archived'), type: String, textColor: '#555555' };
    const lv = stockLevel(i);
    return lv === 'out' ? { value: L('نفد', 'Out of stock'), type: String, backgroundColor: '#F8D7DA', textColor: '#8A1C24', fontWeight: 'bold' }
      : lv === 'low' ? { value: L('منخفض', 'Low'), type: String, backgroundColor: '#FFF0C2', textColor: '#7A5300', fontWeight: 'bold' }
      : { value: L('متوفر', 'In stock'), type: String, textColor: '#1E6B45' };
  };

  // 1. Items
  const itemRows: Cell[][] = [header([L('مكان التخزين', 'Storage'), L('الرف', 'Shelf'), L('الصنف', 'Item'), L('الموديل', 'Model'), L('الفئة', 'Category'), 'SAP', L('رقم المخزون', 'Stock no.'), L('الوحدة', 'Unit'),
    L('المستلم الكلي', 'Total received'), L('المصروف', 'Released'), L('المتبقي', 'Available'), L('الحد الأدنى', 'Minimum'), L('الحالة', 'Status'),
    L('المشروع', 'Project'), L('مالك الأصول', 'Assets owner'), L('الرقم التسلسلي', 'Serial'), L('رقم الأصل', 'Asset tag'), 'PO', 'DN', L('نوع الطلب', 'Request type'), L('تاريخ الانتهاء', 'Expiry'), L('تاريخ الإدخال', 'Entry date'), L('ملاحظات', 'Notes'), L('المعرّف', 'Internal ID')])];
  for (const i of sortedItems) {
    const r = released(i);
    itemRows.push([txt(whName(i.warehouseId)), txt(i.shelf), { value: i.name, type: String, fontWeight: 'bold' }, txt(i.model), txt(i.modelCategory), txt(i.sapCode), txt(i.itemCode), txt(i.unit),
      num(i.quantity + r), num(r), num(i.quantity, { fontWeight: 'bold' }), num(i.minThreshold), levelCell(i),
      txt(i.projectName), txt(i.owner), txt(i.serialNumber), txt(i.assetsTag), txt(i.poNumber), txt(i.dnNumber), txt(i.requestType), date(i.expiryDate, DAY), date(i.entryDate ?? i.createdAt, DAY), txt(i.notes), txt(i.internalId)]);
  }

  // 2. Storages
  const storeRows: Cell[][] = [header([L('الرمز', 'Code'), L('الاسم', 'Name'), L('الموقع', 'Location'), L('القسم', 'Department'), L('النوع', 'Type'), L('الحالة', 'Status'), L('عدد الأصناف', 'Items'), L('القطع المتوفرة', 'Units available'), L('منخفض / نافد', 'Low / out')])];
  for (const w of [...warehouses].sort((a, b) => a.name.localeCompare(b.name))) {
    const its = items.filter((i) => i.warehouseId === w.id);
    storeRows.push([txt(w.code), { value: w.name, type: String, fontWeight: 'bold' }, txt(w.location), txt(w.department), txt(w.storageType), txt(w.status === 'active' ? L('نشط', 'Active') : L('مؤرشف', 'Archived')),
      num(its.length), num(its.reduce((a, i) => a + i.quantity, 0)), txt(`${its.filter((i) => stockLevel(i) === 'low').length} / ${its.filter((i) => stockLevel(i) === 'out').length}`)]);
  }

  // 3. Movements (newest first)
  const typeName = (m: Movement) => m.type === 'withdraw' ? L('صرف', 'Released') : m.type === 'return' ? L('إرجاع', 'Returned') : isReversal(m) ? L('إلغاء سند', 'Release cancelled') : m.type === 'edit' ? L('تعديل كمية', 'Quantity edit') : L('استلام', 'Received');
  const moveRows: Cell[][] = [header([L('التاريخ', 'Date'), L('النوع', 'Type'), L('الصنف', 'Item'), L('مكان التخزين', 'Storage'), L('التغيير', 'Change'), L('قبل', 'Before'), L('بعد', 'After'), L('رقم السند', 'Release no.'), L('المستلم / المُرجع', 'Recipient / returned by'), L('الوجهة', 'Destination'), L('السبب / المرجع', 'Reason / reference'), L('ملاحظات', 'Notes'), L('بواسطة', 'By')])];
  for (const m of [...moves].sort((a, b) => seconds(b.createdAt) - seconds(a.createdAt))) {
    const d = Math.round((m.quantityAfter - m.quantityBefore) * 1000) / 1000;
    moveRows.push([date(m.createdAt), txt(typeName(m)), txt(itemById.get(m.itemId)?.name ?? L('(صنف محذوف)', '(deleted item)')), txt(whName(m.warehouseId)),
      num(d, { format: '+#,##0.###;-#,##0.###;0', textColor: d < 0 ? '#9A5B00' : '#1E6B45', fontWeight: 'bold' }), num(m.quantityBefore), num(m.quantityAfter),
      txt(m.releaseNumber), txt(m.requesterName), txt(m.destination), txt(m.reason), txt(m.notes), txt(m.performedByName)]);
  }

  // 4. Releases — one row per item line
  const relRows: Cell[][] = [header([L('رقم السند', 'Release no.'), L('التاريخ', 'Date'), L('الحالة', 'Status'), L('مكان التخزين', 'Storage'), L('المستلم', 'Recipient'), L('موقع التركيب', 'Install location'), L('رقم التذكرة', 'Ticket no.'), 'D/N', 'P/O', L('السبب', 'Reason'), L('الصنف', 'Item'), 'SAP', L('المصروف', 'Released'), L('المُرجع', 'Returned'), L('الصافي', 'Net out'), L('أصدره', 'Issued by')])];
  for (const r of [...rels].sort((a, b) => seconds(b.createdAt) - seconds(a.createdAt))) {
    const cancelled = r.status === 'cancelled';
    const st: Cell = cancelled ? { value: L('ملغى', 'Cancelled'), type: String, backgroundColor: '#F8D7DA', textColor: '#8A1C24' } : { value: L('صادر', 'Issued'), type: String, textColor: '#1E6B45' };
    for (const l of r.items) {
      const back = l.qtyReturned ?? 0;
      relRows.push([{ value: r.releaseNumber, type: String, fontWeight: 'bold' }, date(r.createdAt), st, txt(r.warehouseName), txt(r.requesterName), txt(r.installLocation), txt(r.ticketNo), txt(r.dnNumber), txt(r.poNumber), txt(r.reason),
        txt(l.itemName), txt(l.sapCode), num(l.qtyReleased), num(back), num(cancelled ? 0 : l.qtyReleased - back, { fontWeight: 'bold' }), txt(r.releasedByName)]);
    }
  }

  // 5. Activity log
  const detail = (v: unknown) => {
    if (!v || typeof v !== 'object') return '';
    const o = v as Record<string, unknown>;
    return ['name', 'releaseNumber', 'role', 'quantity', 'created', 'updated'].map((k) => (o[k] !== undefined && o[k] !== null ? `${k === 'quantity' ? L('الكمية', 'qty') + ' ' : ''}${o[k]}` : '')).filter(Boolean).join(' · ');
  };
  const logRows: Cell[][] = [header([L('التاريخ', 'Date'), L('العملية', 'Action'), L('التفاصيل', 'Details'), L('المستخدم', 'User')])];
  for (const l of logs) {
    const lab = LABELS[l.action];
    logRows.push([date(l.createdAt), txt(lab ? L(lab[0], lab[1]) : l.action), txt(detail(l.newValue)), txt(l.userDisplayName)]);
  }

  // 6. Team
  const teamRows: Cell[][] = [header([L('الاسم', 'Name'), L('الإيميل', 'Email'), L('الدور', 'Role'), L('الحالة', 'Status'), L('أماكن التخزين', 'Storages'), L('آخر دخول', 'Last sign-in')])];
  for (const u of [...users].sort((a, b) => a.displayName.localeCompare(b.displayName))) {
    const status = u.pendingApproval ? L('بانتظار الموافقة', 'Waiting for approval') : u.isActive ? L('نشط', 'Active') : L('موقوف', 'Disabled');
    const stores = u.role === 'manager' || !u.assignedWarehouseIds?.length ? L('كل الأماكن', 'All storages') : u.assignedWarehouseIds.map(whName).filter(Boolean).join(', ');
    teamRows.push([{ value: u.displayName, type: String, fontWeight: 'bold' }, txt(u.email), txt(roleLabel(u.role, L)), txt(status), txt(stores), date(u.lastLoginAt)]);
  }

  // 0. Summary (first sheet)
  const now = new Date();
  const title = (v: string): Cell => ({ value: v, type: String, fontWeight: 'bold', fontSize: 16, textColor: '#1F4F8F', height: 28 });
  const k = (v: string): Cell => ({ value: v, type: String, textColor: '#555555' });
  const units = items.reduce((a, i) => a + i.quantity, 0);
  const relTotal = items.reduce((a, i) => a + released(i), 0);
  const active = rels.filter((r) => r.status === 'active').length;
  const summary: Cell[][] = [
    [title(L('STORA — نسخة احتياطية', 'STORA — Backup')), null],
    [k(L('الجهة', 'Company')), { value: o.company, type: String, fontWeight: 'bold' }],
    [k(L('تاريخ النسخة', 'Created')), { value: local(now), type: Date, format: DATE, align: 'left' }],
    [k(L('بواسطة', 'By')), txt(o.by)],
    [k(L('الإصدار', 'Version')), txt(`STORA ${APP.version}`)],
    [null, null],
    header([L('الورقة', 'Sheet'), L('عدد الصفوف', 'Rows')]),
    [txt(L('الأصناف', 'Items')), num(items.length)],
    [txt(L('أماكن التخزين', 'Storages')), num(warehouses.length)],
    [txt(L('سجل الحركة', 'Movements')), num(moves.length)],
    [txt(L('سندات الصرف (أسطر)', 'Releases (lines)')), num(relRows.length - 1)],
    [txt(L('سجل النشاط', 'Activity log')), num(logs.length)],
    [txt(L('الفريق', 'Team')), num(users.length)],
    [null, null],
    header([L('مؤشر', 'Figure'), L('القيمة', 'Value')]),
    [txt(L('القطع المتوفرة', 'Units available')), num(units, { fontWeight: 'bold' })],
    [txt(L('القطع المصروفة', 'Units released')), num(relTotal)],
    [txt(L('أصناف منخفضة', 'Low items')), num(items.filter((i) => stockLevel(i) === 'low').length)],
    [txt(L('أصناف نافدة', 'Out of stock')), num(items.filter((i) => stockLevel(i) === 'out').length)],
    [txt(L('سندات صادرة / ملغاة', 'Releases issued / cancelled')), txt(`${active} / ${rels.length - active}`)],
  ];

  const rtl = o.lang === 'ar';
  const w = (...n: number[]) => n.map((width) => ({ width }));
  const sheets = [
    { data: summary, sheet: L('ملخص', 'Summary'), columns: w(30, 34), showGridLines: false },
    { data: itemRows, sheet: L('الأصناف', 'Items'), orientation: 'landscape', columns: w(18, 20, 44, 18, 16, 13, 12, 7, 12, 11, 11, 10, 12, 18, 16, 16, 13, 11, 11, 13, 12, 12, 30, 14), stickyRowsCount: 1, stickyColumnsCount: 3 },
    { data: storeRows, sheet: L('أماكن التخزين', 'Storages'), columns: w(16, 24, 18, 16, 14, 10, 10, 14, 11), stickyRowsCount: 1 },
    { data: moveRows, sheet: L('سجل الحركة', 'Movements'), orientation: 'landscape', columns: w(17, 15, 40, 18, 10, 10, 10, 12, 22, 20, 26, 26, 20), stickyRowsCount: 1 },
    { data: relRows, sheet: L('سندات الصرف', 'Releases'), orientation: 'landscape', columns: w(12, 17, 10, 18, 20, 20, 13, 11, 11, 26, 40, 13, 10, 10, 10, 20), stickyRowsCount: 1, stickyColumnsCount: 1 },
    { data: logRows, sheet: L('سجل النشاط', 'Activity log'), columns: w(17, 24, 50, 22), stickyRowsCount: 1 },
    { data: teamRows, sheet: L('الفريق', 'Team'), columns: w(24, 32, 14, 18, 40, 17), stickyRowsCount: 1 },
  ].map((s) => ({ ...s, rightToLeft: rtl }));

  const { default: writeExcelFile } = await import('write-excel-file/universal');
  const blob: Blob = await (writeExcelFile as unknown as (s: unknown, g: unknown) => { toBlob: () => Promise<Blob> })(sheets, { fontFamily: 'Calibri', fontSize: 11 }).toBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `STORA-backup-${now.toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { items: items.length, movements: moves.length, releases: rels.length };
}
