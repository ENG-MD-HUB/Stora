import { useState } from 'react';
import { fmtDateTime } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { fetchLogs } from '../services/audit';
import { useData, useSession } from '../state/app';
import { Empty, Loading, useLoad } from '../ui/kit';

const LABELS: Record<string, [string, string]> = {
  LOGIN: ['تسجيل دخول', 'Signed in'], LOGOUT: ['تسجيل خروج', 'Signed out'], SESSION_TIMEOUT: ['انتهاء الجلسة', 'Session expired'],
  ITEM_CREATE: ['إضافة صنف', 'Item added'], ITEM_EDIT: ['تعديل صنف', 'Item edited'], ITEM_WITHDRAW: ['صرف صنف', 'Item withdrawn'], ITEM_RETURN: ['إرجاع صنف', 'Item returned'],
  ITEM_ARCHIVE: ['أرشفة صنف', 'Item archived'], ITEM_DELETE: ['حذف صنف', 'Item deleted'], ITEM_RESTORE: ['استعادة صنف', 'Item restored'], QTY_CHANGE: ['تغيير كمية', 'Quantity changed'],
  WAREHOUSE_CREATE: ['إنشاء مكان تخزين', 'Storage created'], WAREHOUSE_EDIT: ['تعديل مكان تخزين', 'Storage edited'], WAREHOUSE_ARCHIVE: ['أرشفة/حذف مكان تخزين', 'Storage archived/deleted'], WAREHOUSE_RESTORE: ['استعادة مكان تخزين', 'Storage restored'],
  USER_CREATE: ['تسجيل مستخدم', 'User registered'], USER_EDIT: ['تعديل مستخدم', 'User updated'], USER_DEACTIVATE: ['تعطيل مستخدم', 'User disabled'],
  RELEASE_CREATE: ['إصدار سند صرف', 'Release issued'], RELEASE_CANCEL: ['إلغاء سند صرف', 'Release cancelled'],
  COMPANY_CREATE: ['إنشاء شركة', 'Company created'], COMPANY_EDIT: ['تعديل شركة', 'Company edited'], EXCEL_IMPORT: ['استيراد Excel', 'Excel import'], EXCEL_EXPORT: ['تصدير Excel', 'Excel export'],
};
const GROUPS: [string, string, string][] = [['', 'الكل', 'All'], ['ITEM_|QTY_', 'الأصناف', 'Items'], ['RELEASE_', 'السندات', 'Releases'], ['WAREHOUSE_', 'الأماكن', 'Storages'], ['USER_|LOGIN|LOGOUT|SESSION', 'المستخدمون', 'Users']];

export default function Logs() {
  const s = useSession();
  const { items } = useData();
  const { L, lang } = usePrefs();
  const logs = useLoad(() => fetchLogs(s.companyId), [s.companyId]);
  const [g, setG] = useState('');
  const rows = (logs.data ?? []).filter((l) => !g || new RegExp(`^(${g})`).test(l.action));

  return (
    <>
      <h1 className="h1">{L('سجل النشاط', 'Activity log')}</h1>
      <div className="filters">{GROUPS.map(([k, a, e]) => <button key={k} className={`fchip ${g === k ? 'on' : ''}`} onClick={() => setG(k)}>{L(a, e)}</button>)}</div>
      {logs.loading && !logs.data ? <Loading /> : rows.length === 0 ? <Empty icon="log" title={L('لا يوجد نشاط', 'No activity')} /> : (
        <div className="list">
          {rows.map((l) => {
            const lab = LABELS[l.action];
            const nv = l.newValue as Record<string, unknown> | null;
            const pv = l.previousValue as Record<string, unknown> | null;
            const name = (nv?.name as string) ?? (l.entity === 'item' ? items.find((i) => i.id === l.entityId)?.name : undefined);
            const qty = pv?.quantity !== undefined && nv?.quantity !== undefined ? `${pv.quantity} → ${nv.quantity}` : nv?.quantity;
            const detail = [name, nv?.releaseNumber, nv?.role, qty].filter((v) => v !== undefined && v !== null && v !== '').join(' · ');
            return (
              <div key={l.id} className="row">
                <div className="grow"><p className="title" style={{ fontSize: 14 }}>{lab ? L(lab[0], lab[1]) : l.action}{detail && <span className="muted" style={{ fontWeight: 400 }}> — {detail}</span>}</p><p className="sub" style={{ fontSize: 12 }}>{l.userDisplayName}</p></div>
                <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(l.createdAt, lang)}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
