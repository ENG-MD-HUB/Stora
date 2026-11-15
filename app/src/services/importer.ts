import { addDoc, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { COL, db } from '../config/firebase';
import { requireSession } from '../state/sessionStore';
import { audit } from './audit';
import type { Item, Warehouse } from './types';

// Column definitions — matched against the template header (English or Arabic part).
const ITEM_FIELDS = [
  ['storageCode', 'storage code', 'رمز مكان التخزين', true],
  ['name', 'item name', 'اسم الصنف', true],
  ['quantity', 'quantity', 'الكمية', true],
  ['unit', 'unit', 'الوحدة', true],
  ['minThreshold', 'min threshold', 'الحد الأدنى', false],
  ['projectName', 'project', 'المشروع', true],
  ['owner', 'assets owner', 'مالك الأصول', true],
  ['itemCode', 'stock number', 'رقم المخزون', false],
  ['shelf', 'shelf', 'الرف', false],
  ['released', 'released quantity', 'الكمية المصروفة', false],
  ['sapCode', 'sap code', 'رمز sap', false],
  ['model', 'model', 'الموديل', false],
  ['modelCategory', 'model category', 'فئة الموديل', false],
  ['serialNumber', 'serial number', 'الرقم التسلسلي', false],
  ['assetsTag', 'asset tag', 'رقم الأصل', false],
  ['employeeNumber', 'company', 'الشركة', false],
  ['poNumber', 'po number', 'رقم أمر الشراء', false],
  ['dnNumber', 'dn number', 'رقم سند التسليم', false],
  ['requestType', 'request type', 'نوع الطلب', false],
  ['expiryDate', 'expiry date', 'تاريخ الانتهاء', false],
  ['notes', 'notes', 'ملاحظات', false],
] as const;
const WH_FIELDS = [['code', 'code', 'الرمز'], ['name', 'name', 'الاسم'], ['location', 'location', 'الموقع'], ['department', 'department', 'القسم'], ['storageType', 'storage type', 'نوع التخزين']] as const;

type Cell = string | number | boolean | Date | null;
export interface ImportRow { line: number; data: Record<string, string>; quantity: number; released: number; minThreshold: number; expiry?: Date; errors: string[]; action?: 'create' | 'update'; matchId?: string }
export interface ImportPlan { rows: ImportRow[]; newStorages: { code: string; name: string; location: string; department: string; storageType: string }[] }

const norm = (v: Cell) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : String(v).trim());

function mapHeader(header: Cell[], fields: readonly (readonly [string, string, string, ...unknown[]])[]) {
  // Longest labels first so "model category" is not taken by "model".
  const sorted = [...fields].sort((a, b) => b[1].length - a[1].length);
  const used = new Set<string>();
  return header.map((h) => {
    const t = norm(h).toLowerCase();
    const f = sorted.find(([k, en, ar]) => !used.has(k) && (t.includes(en) || t.includes(ar.toLowerCase())));
    if (f) used.add(f[0]);
    return f?.[0] ?? null;
  });
}

export async function readWorkbook(file: File): Promise<{ items: Record<string, Cell>[]; storages: Record<string, Cell>[] }> {
  const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
  const names = await readSheetNames(file);
  const itemSheet = names.find((n) => /items|المواد/i.test(n) && !/example|مثال/i.test(n)) ?? names[0];
  const whSheet = names.find((n) => /storages|أماكن/i.test(n));
  const toObjects = (rows: Cell[][], fields: Parameters<typeof mapHeader>[1]) => {
    if (!rows.length) return [];
    const map = mapHeader(rows[0], fields);
    return rows.slice(1).map((r, i) => {
      const o: Record<string, Cell> = { __line: i + 2 };
      map.forEach((k, j) => { if (k) o[k] = r[j] ?? null; });
      return o;
    }).filter((o) => Object.entries(o).some(([k, v]) => k !== '__line' && norm(v)));
  };
  const items = toObjects((await readXlsxFile(file, { sheet: itemSheet })) as Cell[][], ITEM_FIELDS);
  const storages = whSheet ? toObjects((await readXlsxFile(file, { sheet: whSheet })) as Cell[][], WH_FIELDS) : [];
  return { items, storages };
}

export function planImport(raw: { items: Record<string, Cell>[]; storages: Record<string, Cell>[] }, warehouses: Warehouse[], items: Item[], ar: boolean): ImportPlan {
  const L = (a: string, e: string) => (ar ? a : e);
  // A storage is matched by its code or by its name.
  const known = new Map<string, Warehouse>([...warehouses.map((w) => [w.name.trim().toUpperCase(), w] as const), ...warehouses.map((w) => [w.code.trim().toUpperCase(), w] as const)]);
  const newStorages: ImportPlan['newStorages'] = [];
  raw.storages.forEach((s) => {
    const code = norm(s.code).toUpperCase();
    if (!code || known.has(code) || newStorages.some((n) => n.code === code)) return;
    newStorages.push({ code, name: norm(s.name) || code, location: norm(s.location) || '—', department: norm(s.department) || '—', storageType: norm(s.storageType) || '—' });
  });
  const rows: ImportRow[] = raw.items.map((r) => {
    const data: Record<string, string> = {};
    ITEM_FIELDS.forEach(([k]) => { data[k] = norm(r[k]); });
    data.storageCode = data.storageCode.toUpperCase();
    const errors: string[] = [];
    ITEM_FIELDS.forEach(([k, , ar_, req]) => { if (req && !data[k]) errors.push(L(`${ar_} مطلوب`, `${k} is required`)); });
    const quantity = Number(data.quantity);
    if (data.quantity && (!Number.isFinite(quantity) || quantity < 0)) errors.push(L('الكمية غير صحيحة', 'Invalid quantity'));
    const minThreshold = data.minThreshold ? Number(data.minThreshold) : 0;
    const released = data.released ? Number(data.released) : 0;
    if (data.released && (!Number.isFinite(released) || released < 0)) errors.push(L('الكمية المصروفة غير صحيحة', 'Invalid released quantity'));
    if (data.storageCode && !known.has(data.storageCode) && !newStorages.some((n) => n.code === data.storageCode)) {
      newStorages.push({ code: data.storageCode, name: data.storageCode, location: '—', department: '—', storageType: '—' });
    }
    let expiry: Date | undefined;
    if (data.expiryDate) { const d = new Date(data.expiryDate); if (isNaN(d.getTime())) errors.push(L('تاريخ الانتهاء غير صحيح', 'Invalid expiry date')); else expiry = d; }
    const wh = known.get(data.storageCode);
    const match = wh && items.find((i) => i.warehouseId === wh.id && ((data.sapCode && i.sapCode === data.sapCode) || (data.itemCode && i.itemCode === data.itemCode)));
    return { line: Number(r.__line), data, quantity: Math.round((quantity || 0) * 1000) / 1000, released: Math.round((released || 0) * 1000) / 1000, minThreshold: Math.max(0, Math.floor(minThreshold || 0)), expiry, errors, action: match ? 'update' : 'create', matchId: match?.id };
  });
  return { rows, newStorages };
}

const OPTIONAL = ['itemCode', 'shelf', 'sapCode', 'model', 'modelCategory', 'serialNumber', 'assetsTag', 'employeeNumber', 'poNumber', 'dnNumber', 'requestType', 'notes'] as const;

export async function runImport(plan: ImportPlan, warehouses: Warehouse[], items: Item[], onProgress: (done: number, total: number) => void) {
  const s = requireSession();
  const codeToId = new Map<string, string>([...warehouses.map((w) => [w.name.trim().toUpperCase(), w.id] as const), ...warehouses.map((w) => [w.code.trim().toUpperCase(), w.id] as const)]);
  for (const w of plan.newStorages) {
    const ref = await addDoc(collection(db, COL.warehouses), { ...w, notes: 'Created by Excel import', companyId: s.companyId, status: 'active', createdBy: s.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    codeToId.set(w.code, ref.id);
  }
  const good = plan.rows.filter((r) => !r.errors.length);
  let created = 0, updated = 0;
  for (let i = 0; i < good.length; i += 120) {
    const b = writeBatch(db);
    for (const r of good.slice(i, i + 120)) {
      const whId = codeToId.get(r.data.storageCode)!;
      const fields: Record<string, unknown> = { name: r.data.name, unit: r.data.unit, projectName: r.data.projectName, owner: r.data.owner, minThreshold: r.minThreshold, updatedAt: serverTimestamp() };
      OPTIONAL.forEach((k) => { if (r.data[k]) fields[k] = r.data[k]; });
      if (r.expiry) fields.expiryDate = r.expiry;
      const mv = { companyId: s.companyId, warehouseId: whId, performedBy: s.uid, performedByName: s.displayName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      if (r.action === 'update' && r.matchId) {
        const cur = items.find((x) => x.id === r.matchId)!;
        b.update(doc(db, COL.items, r.matchId), { ...fields, quantity: r.quantity });
        if (cur.quantity !== r.quantity) b.set(doc(collection(db, COL.movements)), { ...mv, itemId: r.matchId, type: 'edit', quantityBefore: cur.quantity, quantityAfter: r.quantity, notes: 'Excel import' });
        updated++;
      } else {
        const ref = doc(collection(db, COL.items));
        b.set(ref, { ...fields, companyId: s.companyId, warehouseId: whId, quantity: r.quantity, internalId: `ITM-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`, status: 'active', addedBy: s.uid, entryDate: serverTimestamp(), createdAt: serverTimestamp() });
        // Opening balance: what was received, then what had already been released before STORA.
        const received = r.quantity + r.released;
        b.set(doc(collection(db, COL.movements)), { ...mv, itemId: ref.id, type: 'add', quantityBefore: 0, quantityAfter: received, reason: r.data.dnNumber || r.data.poNumber || '', notes: 'Opening balance — Excel import' });
        if (r.released > 0) b.set(doc(collection(db, COL.movements)), { ...mv, itemId: ref.id, type: 'withdraw', quantityBefore: received, quantityAfter: r.quantity, reason: 'Released before STORA', notes: 'Opening balance — Excel import' });
        created++;
      }
    }
    await b.commit();
    onProgress(Math.min(i + 120, good.length), good.length);
  }
  await audit('EXCEL_IMPORT', 'item', null, { newValue: { created, updated, storages: plan.newStorages.length } });
  return { created, updated, storages: plan.newStorages.length };
}
