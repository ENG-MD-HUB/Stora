import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { BUILT_IN_COMPANIES, builtInFor, companyGroup } from '../config/companies';
import { COL, db } from '../config/firebase';
import { seconds } from '../lib/format';
import type { Role } from '../lib/permissions';
import { requireSession } from '../state/sessionStore';
import { audit } from './audit';
import type { UserDoc } from './types';

/** Users of the company, including people registered under older ids of the same company. */
export async function fetchUsers(companyId: string): Promise<UserDoc[]> {
  const ids = new Set(companyGroup(companyId));
  if (!builtInFor(companyId)) {
    // Legacy company document with a random id: match its join code to a built-in company.
    try {
      const c = await getDoc(doc(db, COL.companies, companyId));
      const code = String(c.data()?.joinCode ?? '').toUpperCase();
      const b = BUILT_IN_COMPANIES.find((x) => x.joinCodes.includes(code));
      if (b) [b.id, ...b.aliases].forEach((i) => ids.add(i));
    } catch { /* ignore */ }
  }
  const map = new Map<string, UserDoc>();
  try {
    const snap = await getDocs(query(collection(db, COL.users), where('companyId', 'in', [...ids].slice(0, 30)), limit(500)));
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as UserDoc));
  } catch {
    const snap = await getDocs(query(collection(db, COL.users), where('companyId', '==', companyId), limit(500)));
    snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as UserDoc));
  }
  return [...map.values()].sort((a, b) => seconds(b.createdAt) - seconds(a.createdAt));
}

/** Waiting for the manager to set permissions. */
export function isPending(u: UserDoc, myCompanyId: string): boolean {
  if (u.pendingApproval === true) return true;
  return u.pendingApproval !== false && u.role === 'viewer' && !(u.assignedWarehouseIds ?? []).length && u.companyId !== myCompanyId;
}

/** Manager saves role/storages; also moves the user into the manager's company id. */
export async function updateUserAccess(uid: string, role: Role, assignedWarehouseIds: string[]) {
  const s = requireSession();
  const data = { role, assignedWarehouseIds: role === 'manager' ? [] : assignedWarehouseIds, pendingApproval: false, updatedAt: serverTimestamp() };
  const ref = doc(db, COL.users, uid);
  if (s.companyId !== 'system') {
    try { await updateDoc(ref, { ...data, companyId: s.companyId }); }
    catch { await updateDoc(ref, data); }
  } else {
    await updateDoc(ref, data);
  }
  await audit('USER_EDIT', 'user', uid, { newValue: { role, storages: assignedWarehouseIds.length } });
}

export async function setUserActive(uid: string, isActive: boolean) {
  await updateDoc(doc(db, COL.users, uid), { isActive, updatedAt: serverTimestamp() });
  await audit(isActive ? 'USER_EDIT' : 'USER_DEACTIVATE', 'user', uid, { newValue: { isActive } });
}
