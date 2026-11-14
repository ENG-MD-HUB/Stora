import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { COL, db } from '../config/firebase';
import { seconds } from '../lib/format';
import { requireSession } from '../state/sessionStore';
import { audit } from './audit';
import { changeStock } from './inventory';
import type { Item, Release, ReleaseLine, Signatory } from './types';

async function nextNumber(companyId: string): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(2);
  const snap = await getDocs(query(collection(db, COL.releases), where('companyId', '==', companyId)));
  const max = snap.docs
    .map((d) => parseInt(String(d.data().releaseNumber ?? '').split('-').pop() ?? '0', 10))
    .filter((n) => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `R${yy}-${String(max + 1).padStart(3, '0')}`;
}

export interface ReleaseForm { ticketNo: string; dnNumber: string; poNumber: string; installLocation: string; reason: string; requesterName: string }
export interface CartLine { item: Item; qty: number }

export async function createRelease(lines: CartLine[], form: ReleaseForm, warehouseName: string): Promise<string> {
  const s = requireSession();
  if (!lines.length) throw new Error('empty');
  const wh = lines[0].item.warehouseId;
  if (lines.some((l) => l.item.warehouseId !== wh)) throw new Error('mixedStorages');
  for (const l of lines) if (l.qty > l.item.quantity) throw new Error(`insufficient:${l.item.name}`);

  const items: ReleaseLine[] = [];
  for (const l of lines) {
    const after = await changeStock('withdraw', {
      itemId: l.item.id, quantity: l.qty, reason: form.reason, destination: form.installLocation, requesterName: form.requesterName,
      notes: `Ticket:${form.ticketNo}|D/N:${form.dnNumber}|P/O:${form.poNumber}`,
    });
    items.push({
      itemId: l.item.id, itemName: l.item.name, sapCode: l.item.sapCode ?? l.item.itemCode ?? '', modelNo: l.item.model ?? '',
      serialNumber: l.item.serialNumber ?? '', qtyReleased: l.qty, qtyRemaining: after, description: form.reason,
    });
  }
  const releaseNumber = await nextNumber(s.companyId);
  const ref = await addDoc(collection(db, COL.releases), {
    companyId: s.companyId, releaseNumber, warehouseId: wh, warehouseName, ...form, items,
    releasedBy: s.uid, releasedByName: s.displayName, status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await audit('RELEASE_CREATE', 'release', ref.id, { newValue: { releaseNumber, items: items.length } });
  return ref.id;
}

export async function fetchReleases(companyId: string): Promise<Release[]> {
  const snap = await getDocs(query(collection(db, COL.releases), where('companyId', '==', companyId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Release).sort((a, b) => seconds(b.createdAt) - seconds(a.createdAt));
}

export async function fetchRelease(id: string): Promise<Release | null> {
  const d = await getDoc(doc(db, COL.releases, id));
  return d.exists() ? ({ id: d.id, ...d.data() } as Release) : null;
}

/** Cancels a release and puts the quantities back. */
export async function cancelRelease(id: string) {
  const s = requireSession();
  const ref = doc(db, COL.releases, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('notFound');
  const r = snap.data() as Release;
  if (r.status === 'cancelled') throw new Error('alreadyCancelled');
  const b = writeBatch(db);
  for (const line of r.items) {
    const iref = doc(db, COL.items, line.itemId);
    const it = await getDoc(iref);
    if (!it.exists()) continue;
    const before = (it.data().quantity as number) ?? 0;
    const after = before + line.qtyReleased;
    b.update(iref, { quantity: after, updatedAt: serverTimestamp() });
    b.set(doc(collection(db, COL.movements)), {
      companyId: s.companyId, itemId: line.itemId, warehouseId: r.warehouseId, type: 'add', quantityBefore: before, quantityAfter: after,
      performedBy: s.uid, performedByName: s.displayName, reason: `Release ${r.releaseNumber} cancelled`, notes: `Reversal of release ${r.releaseNumber}`,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
  b.update(ref, { status: 'cancelled', updatedAt: serverTimestamp() });
  await b.commit();
  await audit('RELEASE_CANCEL', 'release', id, { newValue: { releaseNumber: r.releaseNumber } });
}

export const DEFAULT_SIGNATORIES: Signatory[] = [
  { role: 'Reviewed by: Contractor', title: 'Logistic Manager', name: '' },
  { role: 'Approved by: Contractor', title: 'Data Center Manager', name: '' },
  { role: 'Approved by: Client', title: 'User Support Supervisor', name: '' },
  { role: 'Approved by: Client', title: 'Sr. Manager of Infrastructure & Operations', name: '' },
];

export async function fetchSignatories(companyId: string): Promise<Signatory[]> {
  try {
    const d = await getDoc(doc(db, COL.settings, `${companyId}_release`));
    const list = d.exists() ? (d.data().signatories as Signatory[] | undefined) : undefined;
    return list?.length ? list : DEFAULT_SIGNATORIES;
  } catch { return DEFAULT_SIGNATORIES; }
}

export async function saveSignatories(companyId: string, signatories: Signatory[]) {
  await setDoc(doc(db, COL.settings, `${companyId}_release`), { signatories, updatedAt: serverTimestamp() });
}
