import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { COL, db } from '../config/firebase';
import { seconds } from '../lib/format';
import { requireSession } from '../state/sessionStore';
import { audit } from './audit';
import type { Item, Movement, Warehouse } from './types';

const byNewest = <T extends { createdAt?: unknown }>(a: T, b: T) => seconds(b.createdAt as never) - seconds(a.createdAt as never);

// ---------- Storages ----------
export async function fetchWarehouses(companyId: string, status: 'active' | 'archived' | 'all' = 'active'): Promise<Warehouse[]> {
  const base = collection(db, COL.warehouses);
  const q = status === 'all' ? query(base, where('companyId', '==', companyId)) : query(base, where('companyId', '==', companyId), where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Warehouse).sort((a, b) => a.name.localeCompare(b.name));
}

export interface WarehouseInput { name: string; code: string; location: string; department: string; storageType: string; notes?: string }

export async function saveWarehouse(input: WarehouseInput, id?: string): Promise<string> {
  const s = requireSession();
  const code = input.code.trim().toUpperCase();
  const dup = await getDocs(query(collection(db, COL.warehouses), where('companyId', '==', s.companyId), where('code', '==', code)));
  if (dup.docs.some((d) => d.id !== id)) throw new Error('codeExists');
  const data = { name: input.name.trim(), code, location: input.location.trim(), department: input.department.trim(), storageType: input.storageType.trim(), notes: input.notes?.trim() ?? '', updatedAt: serverTimestamp() };
  if (id) {
    await updateDoc(doc(db, COL.warehouses, id), data);
    await audit('WAREHOUSE_EDIT', 'warehouse', id, { newValue: { name: data.name, code } });
    return id;
  }
  const ref = await addDoc(collection(db, COL.warehouses), { ...data, companyId: s.companyId, status: 'active', createdBy: s.uid, createdAt: serverTimestamp() });
  await audit('WAREHOUSE_CREATE', 'warehouse', ref.id, { newValue: { name: data.name, code } });
  return ref.id;
}

export async function setWarehouseStatus(id: string, status: 'active' | 'archived') {
  await updateDoc(doc(db, COL.warehouses, id), { status, updatedAt: serverTimestamp() });
  await audit(status === 'active' ? 'WAREHOUSE_RESTORE' : 'WAREHOUSE_ARCHIVE', 'warehouse', id);
}

/** Permanently deletes a storage and its items (no orphans). */
export async function deleteWarehouse(id: string) {
  const s = requireSession();
  const items = await getDocs(query(collection(db, COL.items), where('companyId', '==', s.companyId), where('warehouseId', '==', id)));
  for (let i = 0; i < items.docs.length; i += 450) {
    const b = writeBatch(db);
    items.docs.slice(i, i + 450).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
  await deleteDoc(doc(db, COL.warehouses, id));
  await audit('WAREHOUSE_ARCHIVE', 'warehouse', id, { metadata: { permanentDelete: true, itemsDeleted: items.size } });
}

// ---------- Items ----------
export async function fetchItems(companyId: string, status: 'active' | 'archived' | 'all' = 'active'): Promise<Item[]> {
  const base = collection(db, COL.items);
  const q = status === 'all' ? query(base, where('companyId', '==', companyId)) : query(base, where('companyId', '==', companyId), where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Item).sort(byNewest);
}

export async function fetchItem(id: string): Promise<Item | null> {
  const d = await getDoc(doc(db, COL.items, id));
  return d.exists() ? ({ id: d.id, ...d.data() } as Item) : null;
}

export async function fetchMovements(itemId: string, companyId: string): Promise<Movement[]> {
  // companyId must be in the query: security rules only allow reading a company's own movements.
  try {
    const snap = await getDocs(query(collection(db, COL.movements), where('companyId', '==', companyId), where('itemId', '==', itemId), orderBy('createdAt', 'desc'), limit(60)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Movement);
  } catch {
    const snap = await getDocs(query(collection(db, COL.movements), where('companyId', '==', companyId), where('itemId', '==', itemId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Movement).sort(byNewest).slice(0, 60);
  }
}

export async function fetchRecentMovements(companyId: string, max = 8): Promise<Movement[]> {
  try {
    const snap = await getDocs(query(collection(db, COL.movements), where('companyId', '==', companyId), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Movement);
  } catch {
    const snap = await getDocs(query(collection(db, COL.movements), where('companyId', '==', companyId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Movement).sort(byNewest).slice(0, max);
  }
}

export type ItemInput = Omit<Item, 'id' | 'companyId' | 'status' | 'internalId' | 'createdAt' | 'updatedAt' | 'entryDate' | 'expiryDate'> & { expiryDate?: string };

const OPTIONAL = ['itemCode', 'notes', 'employeeNumber', 'modelCategory', 'model', 'serialNumber', 'assetsTag', 'sapCode', 'requestType', 'poNumber', 'dnNumber'] as const;

function clean(input: Partial<ItemInput>) {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.name = input.name.trim();
  if (input.projectName !== undefined) out.projectName = input.projectName.trim();
  if (input.owner !== undefined) out.owner = input.owner.trim();
  if (input.unit !== undefined) out.unit = input.unit.trim();
  if (input.minThreshold !== undefined) out.minThreshold = Math.max(0, Number(input.minThreshold) || 0);
  OPTIONAL.forEach((k) => { const v = input[k]; if (v !== undefined) out[k] = String(v).trim(); });
  return out;
}

export async function createItem(input: ItemInput): Promise<string> {
  const s = requireSession();
  const qty = Math.max(0, Number(input.quantity) || 0);
  const ref = await addDoc(collection(db, COL.items), {
    ...clean(input), companyId: s.companyId, warehouseId: input.warehouseId, quantity: qty,
    internalId: `ITM-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    status: 'active', addedBy: s.uid, entryDate: serverTimestamp(),
    ...(input.expiryDate ? { expiryDate: new Date(input.expiryDate) } : {}),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, COL.movements), {
    companyId: s.companyId, itemId: ref.id, warehouseId: input.warehouseId, type: 'add', quantityBefore: 0, quantityAfter: qty,
    performedBy: s.uid, performedByName: s.displayName, notes: 'Initial stock entry', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await audit('ITEM_CREATE', 'item', ref.id, { newValue: { name: input.name, quantity: qty } });
  return ref.id;
}

export async function updateItem(id: string, input: Partial<ItemInput>) {
  const s = requireSession();
  const ref = doc(db, COL.items, id);
  const cur = (await getDoc(ref)).data() as Item | undefined;
  if (!cur) throw new Error('notFound');
  const data: Record<string, unknown> = { ...clean(input), updatedAt: serverTimestamp() };
  if (input.expiryDate !== undefined) data.expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;
  if (input.quantity !== undefined && Number(input.quantity) !== cur.quantity) {
    const q = Math.max(0, Number(input.quantity) || 0);
    data.quantity = q;
    await addDoc(collection(db, COL.movements), {
      companyId: s.companyId, itemId: id, warehouseId: cur.warehouseId, type: 'edit', quantityBefore: cur.quantity, quantityAfter: q,
      performedBy: s.uid, performedByName: s.displayName, notes: 'Manual quantity update', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    await audit('QTY_CHANGE', 'item', id, { previousValue: { quantity: cur.quantity }, newValue: { quantity: q } });
  }
  await updateDoc(ref, data as Record<string, never>);
  await audit('ITEM_EDIT', 'item', id, { newValue: { name: data.name ?? cur.name } });
}

export interface StockChange { itemId: string; quantity: number; requesterName?: string; reason?: string; destination?: string; notes?: string }

/** Withdraw (negative) or add / return (positive) stock with a movement record. */
export async function changeStock(kind: 'withdraw' | 'add' | 'return', c: StockChange) {
  const s = requireSession();
  const ref = doc(db, COL.items, c.itemId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('notFound');
  const it = snap.data() as Item;
  const qty = Math.max(1, Math.floor(c.quantity));
  if (kind === 'withdraw' && it.quantity < qty) throw new Error('insufficientStock');
  const after = kind === 'withdraw' ? it.quantity - qty : it.quantity + qty;
  const b = writeBatch(db);
  b.update(ref, { quantity: after, updatedAt: serverTimestamp() });
  b.set(doc(collection(db, COL.movements)), {
    companyId: s.companyId, itemId: c.itemId, warehouseId: it.warehouseId, type: kind, quantityBefore: it.quantity, quantityAfter: after,
    requesterName: c.requesterName ?? '', reason: c.reason ?? '', destination: c.destination ?? '', approvedBy: '',
    performedBy: s.uid, performedByName: s.displayName, notes: c.notes ?? '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await b.commit();
  await audit(kind === 'withdraw' ? 'ITEM_WITHDRAW' : kind === 'return' ? 'ITEM_RETURN' : 'QTY_CHANGE', 'item', c.itemId, { previousValue: { quantity: it.quantity }, newValue: { name: it.name, quantity: after } });
  if (kind === 'withdraw' && after <= it.minThreshold) notifyLowStock(s.companyId, c.itemId, it.name, after);
  return after;
}

async function notifyLowStock(companyId: string, itemId: string, name: string, qty: number) {
  try {
    const managers = await getDocs(query(collection(db, COL.users), where('companyId', '==', companyId), where('role', '==', 'manager')));
    await Promise.allSettled(managers.docs.map((m) => addDoc(collection(db, COL.notifications), {
      companyId, recipientUid: m.id, type: 'low_stock', titleKey: 'notification.lowStock', body: `${name} — qty: ${qty}`,
      relatedId: itemId, relatedType: 'item', read: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })));
  } catch { /* optional */ }
}

export async function setItemStatus(id: string, status: 'active' | 'archived', name?: string) {
  await updateDoc(doc(db, COL.items, id), { status, updatedAt: serverTimestamp() });
  await audit(status === 'active' ? 'ITEM_RESTORE' : 'ITEM_ARCHIVE', 'item', id, name ? { newValue: { name } } : {});
}

export async function deleteItem(id: string, name?: string) {
  await deleteDoc(doc(db, COL.items, id));
  await audit('ITEM_DELETE', 'item', id, { newValue: name ? { name } : null, metadata: { permanentDelete: true } });
}

export type StockLevel = 'ok' | 'low' | 'out';
export const stockLevel = (it: Pick<Item, 'quantity' | 'minThreshold'>): StockLevel =>
  it.quantity <= 0 ? 'out' : it.quantity <= (it.minThreshold ?? 0) ? 'low' : 'ok';

/** Find an item by a scanned/typed code (SAP, stock no., serial, asset tag or internal id). */
export function findByCode(items: Item[], code: string): Item | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return items.find((i) => [i.sapCode, i.itemCode, i.serialNumber, i.assetsTag, i.internalId].some((v) => v && v.trim().toLowerCase() === c));
}
