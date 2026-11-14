import { Timestamp } from 'firebase/firestore';
import type { Lang } from './prefs';

export type TS = Timestamp | { seconds: number } | Date | null | undefined;

export function toDate(v: TS): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof (v as { seconds?: number }).seconds === 'number') return new Date((v as { seconds: number }).seconds * 1000);
  return null;
}

const loc = (lang: Lang) => (lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-GB');

export function fmtDate(v: TS, lang: Lang): string {
  const d = toDate(v);
  return d ? d.toLocaleDateString(loc(lang), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function fmtDateTime(v: TS, lang: Lang): string {
  const d = toDate(v);
  return d ? d.toLocaleString(loc(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function fmtAgo(v: TS, lang: Lang): string {
  const d = toDate(v);
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  const ar = lang === 'ar';
  if (s < 60) return ar ? 'الآن' : 'now';
  if (s < 3600) return ar ? `${Math.floor(s / 60)} د` : `${Math.floor(s / 60)}m`;
  if (s < 86400) return ar ? `${Math.floor(s / 3600)} س` : `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return ar ? `${Math.floor(s / 86400)} يوم` : `${Math.floor(s / 86400)}d`;
  return fmtDate(d, lang);
}

export function seconds(v: TS): number {
  const d = toDate(v);
  return d ? d.getTime() / 1000 : 0;
}

export function greeting(lang: Lang): string {
  const h = new Date().getHours();
  if (lang === 'ar') return h < 12 ? 'صباح الخير' : 'مساء الخير';
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
