import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { COL, db } from '../config/firebase';
import { getSession } from '../state/sessionStore';
import { seconds } from '../lib/format';
import type { AuditLog } from './types';

/** Writes an audit entry. Never throws: logging must not break the user's action. */
export async function audit(action: string, entity: string, entityId: string | null, extra: { newValue?: unknown; previousValue?: unknown; metadata?: unknown } = {}) {
  const s = getSession();
  if (!s) return;
  try {
    await addDoc(collection(db, COL.auditLogs), {
      companyId: s.companyId, userId: s.uid, userDisplayName: s.displayName,
      action, entity, entityId,
      newValue: extra.newValue ?? null, previousValue: extra.previousValue ?? null, metadata: extra.metadata ?? null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  } catch { /* ignore */ }
}

export async function fetchLogs(companyId: string, max = 150): Promise<AuditLog[]> {
  try {
    const snap = await getDocs(query(collection(db, COL.auditLogs), where('companyId', '==', companyId), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog);
  } catch {
    // Missing composite index: fall back to client-side sort.
    const snap = await getDocs(query(collection(db, COL.auditLogs), where('companyId', '==', companyId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog).sort((a, b) => seconds(b.createdAt) - seconds(a.createdAt)).slice(0, max);
  }
}
