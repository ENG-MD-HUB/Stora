import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { COL, db } from '../config/firebase';
import { requireSession } from '../state/sessionStore';
import { audit } from './audit';

/** Logos printed in the top corners of release forms and reports. Kept as small images inside the
 *  company's settings document (same document as the signatories), so no file storage is needed. */
export interface Branding { logoLeft?: string; logoRight?: string }
export type LogoSide = 'logoLeft' | 'logoRight';

let cache: { companyId: string; data: Branding } | null = null;
const listeners = new Set<() => void>();

export async function fetchBranding(companyId: string): Promise<Branding> {
  if (cache?.companyId === companyId) return cache.data;
  try {
    const d = await getDoc(doc(db, COL.settings, `${companyId}_release`));
    const v = d.exists() ? d.data() : {};
    cache = { companyId, data: { logoLeft: v.logoLeft || undefined, logoRight: v.logoRight || undefined } };
  } catch { cache = { companyId, data: {} }; }
  return cache.data;
}

export async function saveLogo(side: LogoSide, dataUrl: string | null) {
  const s = requireSession();
  await setDoc(doc(db, COL.settings, `${s.companyId}_release`), { [side]: dataUrl ?? '', updatedAt: serverTimestamp() }, { merge: true });
  cache = { companyId: s.companyId, data: { ...(cache?.companyId === s.companyId ? cache.data : {}), [side]: dataUrl || undefined } };
  listeners.forEach((f) => f());
  await audit('SETTINGS_UPDATE', 'company', s.companyId, { newValue: { name: side === 'logoLeft' ? 'Left logo' : 'Right logo', removed: !dataUrl } });
}

export function useBranding(companyId: string) {
  const [data, setData] = useState<Branding | null>(cache?.companyId === companyId ? cache.data : null);
  useEffect(() => {
    let live = true;
    const load = () => fetchBranding(companyId).then((b) => live && setData({ ...b }));
    load();
    listeners.add(load);
    return () => { live = false; listeners.delete(load); };
  }, [companyId]);
  return { branding: data ?? {}, loaded: data !== null };
}

/** Shrinks an uploaded picture so it fits comfortably in a Firestore document (max ~600×240). */
export async function prepareLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) throw new Error('type');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const w0 = img.naturalWidth || 600, h0 = img.naturalHeight || 240;
    const k = Math.min(1, 600 / w0, 240 / h0);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL('image/png');
    if (out.length > 300_000) out = c.toDataURL('image/webp', 0.9);
    if (out.length > 600_000) throw new Error('size');
    return out;
  } finally { URL.revokeObjectURL(url); }
}
