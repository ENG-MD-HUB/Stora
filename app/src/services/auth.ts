import {
  createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { APP } from '../config/app';
import { builtInFor, BUILT_IN_COMPANIES } from '../config/companies';
import { auth, COL, db } from '../config/firebase';
import { registering } from '../state/sessionStore';
import type { Session } from './types';

export function isSuperEmail(email?: string | null) {
  return !!email && email.toLowerCase() === APP.superAdminEmail.toLowerCase();
}

/** Resolve a join code → company. Registry (joinCodes/{CODE}) first, then built-in list. */
export async function resolveJoinCode(raw: string): Promise<{ companyId: string; name: string } | null> {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return null;
  try {
    const d = await getDoc(doc(db, COL.joinCodes, code));
    if (d.exists()) {
      const x = d.data();
      if (x.active === false || !x.companyId) return null;
      const b = builtInFor(x.companyId);
      return { companyId: b ? b.id : x.companyId, name: x.name ?? b?.name ?? '' };
    }
  } catch { /* offline or rules: fall back */ }
  const b = BUILT_IN_COMPANIES.find((c) => c.joinCodes.includes(code));
  return b ? { companyId: b.id, name: b.name } : null;
}

export async function loadSession(uid: string): Promise<Session> {
  const snap = await getDoc(doc(db, COL.users, uid));
  if (!snap.exists()) throw new Error('notFound');
  const u = snap.data();
  if (!u.isActive) throw new Error('accountDisabled');
  const sup = isSuperEmail(u.email);
  return {
    uid, email: u.email, displayName: u.displayName ?? '', role: sup ? 'super_admin' : u.role,
    companyId: u.companyId, assignedWarehouseIds: u.assignedWarehouseIds ?? [], isActive: true,
    pendingApproval: u.pendingApproval === true,
  };
}

export async function login(email: string, password: string): Promise<Session> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const ref = doc(db, COL.users, cred.user.uid);
  if (!(await getDoc(ref)).exists() && isSuperEmail(email)) {
    await setDoc(ref, { uid: cred.user.uid, displayName: 'Super Admin', email, companyId: 'system', role: 'super_admin', assignedWarehouseIds: [], isActive: true, lastLoginAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  const s = await loadSession(cred.user.uid);
  updateDoc(ref, { lastLoginAt: serverTimestamp() }).catch(() => {});
  return s;
}

export async function register(input: { displayName: string; email: string; password: string; joinCode: string }): Promise<Session> {
  const company = await resolveJoinCode(input.joinCode);
  if (!company) throw new Error('invalidJoinCode');
  registering.on = true;
  try { return await doRegister(input, company); } finally { registering.on = false; }
}

async function doRegister(input: { displayName: string; email: string; password: string }, company: { companyId: string }): Promise<Session> {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  } catch (e) {
    // Recover an account whose sign-in exists but whose profile was never written.
    if ((e as { code?: string }).code !== 'auth/email-already-in-use') throw e;
    cred = await signInWithEmailAndPassword(auth, input.email.trim(), input.password);
    if ((await getDoc(doc(db, COL.users, cred.user.uid))).exists()) throw e;
  }
  await updateProfile(cred.user, { displayName: input.displayName.trim() }).catch(() => {});
  await setDoc(doc(db, COL.users, cred.user.uid), {
    uid: cred.user.uid, displayName: input.displayName.trim(), email: input.email.trim(),
    companyId: company.companyId, role: 'viewer', assignedWarehouseIds: [], isActive: true, pendingApproval: true,
    lastLoginAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return loadSession(cred.user.uid);
}

export const logout = () => signOut(auth);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim());

export async function updateMyName(uid: string, name: string) {
  await updateDoc(doc(db, COL.users, uid), { displayName: name.trim(), updatedAt: serverTimestamp() });
  if (auth.currentUser?.uid === uid) await updateProfile(auth.currentUser, { displayName: name.trim() }).catch(() => {});
}

export function authError(e: unknown, L: (a: string, b: string) => string): string {
  const code = (e as { code?: string; message?: string })?.code ?? (e as Error)?.message ?? '';
  if (code.includes('invalidJoinCode')) return L('رمز الشركة غير صحيح. راجع مديرك.', 'Invalid company code. Check with your manager.');
  if (code.includes('accountDisabled')) return L('تم تعطيل حسابك. تواصل مع مديرك.', 'Your account is disabled. Contact your manager.');
  if (code.includes('notFound')) return L('الحساب غير مكتمل. سجّل من جديد بنفس البريد ورمز الشركة.', 'Account incomplete. Register again with the same email and company code.');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return L('البريد أو كلمة المرور غير صحيحة.', 'Wrong email or password.');
  if (code.includes('email-already-in-use')) return L('هذا البريد مسجّل مسبقاً. سجّل الدخول.', 'This email is already registered. Sign in.');
  if (code.includes('weak-password')) return L('كلمة المرور ضعيفة (8 أحرف على الأقل).', 'Password too weak (min 8 characters).');
  if (code.includes('invalid-email')) return L('البريد الإلكتروني غير صالح.', 'Invalid email.');
  if (code.includes('too-many-requests')) return L('محاولات كثيرة. حاول بعد قليل.', 'Too many attempts. Try later.');
  if (code.includes('network')) return L('لا يوجد اتصال بالإنترنت.', 'No internet connection.');
  if (code.includes('permission')) return L('ليست لديك صلاحية لهذا الإجراء.', 'You do not have permission.');
  return L('حدث خطأ. حاول مرة أخرى.', 'Something went wrong. Try again.');
}
