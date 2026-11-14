import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { BUILT_IN_COMPANIES, builtInFor } from '../config/companies';
import { COL, db } from '../config/firebase';
import { audit } from './audit';

export interface CompanyRow {
  id: string;
  name: string;
  joinCode: string;
  codes: string[];
  active: boolean;
  builtIn: boolean;
  aliases: string[];
  users?: number | null;
  managers?: number;
  pending?: number;
}

export async function companyName(companyId: string): Promise<string> {
  const b = builtInFor(companyId);
  if (b) return b.name;
  try { const d = await getDoc(doc(db, COL.companies, companyId)); return d.data()?.name ?? ''; } catch { return ''; }
}

export async function fetchCompanies(): Promise<CompanyRow[]> {
  const map = new Map<string, CompanyRow>();
  BUILT_IN_COMPANIES.forEach((b) => map.set(b.id, { id: b.id, name: b.name, joinCode: b.joinCodes[0], codes: [...b.joinCodes], active: true, builtIn: true, aliases: [...b.aliases] }));
  try {
    const snap = await getDocs(collection(db, COL.companies));
    snap.docs.forEach((d) => {
      const x = d.data();
      const code = String(x.joinCode ?? '').toUpperCase();
      const b = builtInFor(d.id) ?? BUILT_IN_COMPANIES.find((c) => c.joinCodes.includes(code));
      if (b) {
        const row = map.get(b.id)!;
        if (d.id === b.id) {
          if (x.name) row.name = x.name;
          if (code) { row.joinCode = code; if (!row.codes.includes(code)) row.codes.push(code); }
          if (x.active === false) row.active = false;
        } else if (!row.aliases.includes(d.id)) row.aliases.push(d.id);
        return;
      }
      map.set(d.id, { id: d.id, name: x.name ?? d.id, joinCode: code, codes: code ? [code] : [], active: x.active !== false, builtIn: false, aliases: [] });
    });
  } catch { /* rules may block listing for non super admins */ }
  const rows = [...map.values()];
  await Promise.all(rows.map(async (r) => {
    try {
      const u = await getDocs(query(collection(db, COL.users), where('companyId', 'in', [r.id, ...r.aliases].slice(0, 30))));
      r.users = u.size;
      r.managers = u.docs.filter((d) => d.data().role === 'manager').length;
      r.pending = u.docs.filter((d) => d.data().pendingApproval === true).length;
    } catch { r.users = null; }
  }));
  return rows;
}

export function generateCode(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => a[Math.floor(Math.random() * a.length)]).join('');
}

export async function saveCompany(input: { id?: string; name: string; joinCode: string; active: boolean }, existing: CompanyRow[]) {
  const name = input.name.trim();
  const code = input.joinCode.trim().toUpperCase();
  if (name.length < 2) throw new Error('name');
  if (!/^[A-Z0-9]{8}$/.test(code)) throw new Error('code');
  if (existing.some((c) => c.id !== input.id && c.codes.includes(code))) throw new Error('codeTaken');
  const id = input.id ?? `company_${Date.now()}`;
  const prev = existing.find((c) => c.id === id);
  try {
    const ex = await getDoc(doc(db, COL.joinCodes, code));
    if (ex.exists() && ex.data().companyId !== id && ex.data().active !== false) throw new Error('codeTaken');
  } catch (e) { if ((e as Error).message === 'codeTaken') throw e; }
  const b = writeBatch(db);
  b.set(doc(db, COL.companies, id), { name, joinCode: code, active: input.active, updatedAt: serverTimestamp(), ...(prev ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
  b.set(doc(db, COL.joinCodes, code), { companyId: id, name, active: input.active, updatedAt: serverTimestamp() });
  (prev?.codes ?? []).filter((k) => k !== code).forEach((k) => b.set(doc(db, COL.joinCodes, k), { companyId: id, name, active: false, updatedAt: serverTimestamp() }));
  await b.commit();
  await audit(prev ? 'COMPANY_EDIT' : 'COMPANY_CREATE', 'company', id, { newValue: { name, joinCode: code, active: input.active } });
}

export async function setCompanyActive(c: CompanyRow, active: boolean) {
  const b = writeBatch(db);
  b.set(doc(db, COL.companies, c.id), { name: c.name, joinCode: c.joinCode, active, updatedAt: serverTimestamp() }, { merge: true });
  (active ? [c.joinCode] : c.codes).forEach((k) => b.set(doc(db, COL.joinCodes, k), { companyId: c.id, name: c.name, active, updatedAt: serverTimestamp() }));
  await b.commit();
  await audit('COMPANY_EDIT', 'company', c.id, { newValue: { active } });
}

