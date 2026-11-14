import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { auth, COL, db } from '../config/firebase';
import { requireSession } from '../state/sessionStore';
import { audit } from './audit';
import { fetchUsers } from './users';

export type ResetScope = 'items' | 'movements' | 'releases' | 'logs' | 'warehouses' | 'users' | 'all';

/** Confirms the signed-in manager's own password (Firebase checks it; nothing is stored in the app). */
export async function confirmPassword(password: string) {
  const u = auth.currentUser;
  if (!u?.email) throw new Error('noUser');
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
}

async function wipe(col: string, companyId: string, onProgress: (n: number) => void): Promise<number> {
  const snap = await getDocs(query(collection(db, col), where('companyId', '==', companyId)));
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += 450) {
    const b = writeBatch(db);
    snap.docs.slice(i, i + 450).forEach((d) => b.delete(d.ref));
    await b.commit();
    n += Math.min(450, snap.docs.length - i);
    onProgress(n);
  }
  return n;
}

/** Deletes the chosen company data. Your own account is always kept. */
export async function resetData(scope: ResetScope, onProgress: (label: string, n: number) => void): Promise<number> {
  const s = requireSession();
  const all = scope === 'all';
  let total = 0;
  const run = async (col: string, label: string) => { total += await wipe(col, s.companyId, (n) => onProgress(label, n)); };
  if (all || scope === 'releases') await run(COL.releases, 'releases');
  if (all || scope === 'items' || scope === 'warehouses') await run(COL.items, 'items');
  if (all || scope === 'movements') await run(COL.movements, 'movements');
  if (all || scope === 'warehouses') await run(COL.warehouses, 'warehouses');
  if (all || scope === 'users') {
    const users = (await fetchUsers(s.companyId)).filter((u) => u.uid !== s.uid);
    for (let i = 0; i < users.length; i += 450) {
      const b = writeBatch(db);
      users.slice(i, i + 450).forEach((u) => b.delete(doc(db, COL.users, u.uid)));
      await b.commit();
    }
    total += users.length;
    onProgress('users', users.length);
  }
  if (all || scope === 'logs') await run(COL.auditLogs, 'logs');
  await audit('DATA_RESET', 'company', s.companyId, { metadata: { scope, deleted: total } });
  return total;
}
