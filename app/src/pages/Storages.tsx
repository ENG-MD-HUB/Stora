import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePrefs } from '../lib/prefs';
import { can } from '../lib/permissions';
import { deleteWarehouse, fetchWarehouses, saveWarehouse, setWarehouseStatus, stockLevel } from '../services/inventory';
import type { Warehouse } from '../services/types';
import { useData, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { Confirm, Empty, Field, Sheet, useLoad, useToast } from '../ui/kit';

function StorageForm({ wh, onClose, onSaved }: { wh?: Warehouse; onClose: () => void; onSaved: () => void }) {
  const { L } = usePrefs();
  const toast = useToast();
  const [f, setF] = useState({ name: wh?.name ?? '', code: wh?.code ?? '', location: wh?.location ?? '', department: wh?.department ?? '', storageType: wh?.storageType ?? '', notes: wh?.notes ?? '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'code' ? e.target.value.toUpperCase() : e.target.value });

  async function save() {
    if (!f.name.trim() || !f.code.trim() || !f.location.trim() || !f.department.trim() || !f.storageType.trim()) { setErr(L('أكمل الحقول المطلوبة', 'Fill in the required fields')); return; }
    setBusy(true);
    try { await saveWarehouse(f, wh?.id); toast(wh ? L('تم التحديث', 'Updated') : L('تم إنشاء مكان التخزين', 'Storage created')); onSaved(); }
    catch (e) { setErr((e as Error).message === 'codeExists' ? L('هذا الرمز مستخدم لمكان آخر', 'This code is already used') : L('تعذّر الحفظ', 'Could not save')); }
    finally { setBusy(false); }
  }

  return (
    <Sheet title={wh ? L('تعديل مكان التخزين', 'Edit storage') : L('مكان تخزين جديد', 'New storage')} onClose={onClose}
      footer={<><button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : L('حفظ', 'Save')}</button><button className="btn" onClick={onClose}>{L('إلغاء', 'Cancel')}</button></>}>
      <div className="grid g2">
        <Field label={L('الاسم', 'Name')}><input className="input" value={f.name} onChange={set('name')} placeholder={L('المخزن الرئيسي', 'Main storage')} /></Field>
        <Field label={L('الرمز', 'Code')}><input className="input mono" value={f.code} onChange={set('code')} placeholder="WH-01" /></Field>
        <Field label={L('الموقع', 'Location')}><input className="input" value={f.location} onChange={set('location')} /></Field>
        <Field label={L('القسم', 'Department')}><input className="input" value={f.department} onChange={set('department')} /></Field>
      </div>
      <Field label={L('نوع التخزين', 'Storage type')}><input className="input" value={f.storageType} onChange={set('storageType')} placeholder={L('عام، مبرّد، شبكات…', 'General, cold, network…')} /></Field>
      <Field label={L('ملاحظات', 'Notes')} hint={L('اختياري', 'optional')}><input className="input" value={f.notes} onChange={set('notes')} /></Field>
      {err && <p className="err-text">{err}</p>}
    </Sheet>
  );
}

export default function Storages() {
  const s = useSession();
  const { L } = usePrefs();
  const { warehouses, items, reload } = useData();
  const toast = useToast();
  const [params] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const archived = useLoad(() => (showArchived ? fetchWarehouses(s.companyId, 'archived') : Promise.resolve([])), [showArchived, s.companyId]);
  const [form, setForm] = useState<Warehouse | 'new' | null>(params.get('new') === '1' ? 'new' : null);
  const [confirm, setConfirm] = useState<{ wh: Warehouse; kind: 'archive' | 'delete' } | null>(null);
  const manage = can(s.role, 'warehouse:manage');
  const list = showArchived ? archived.data ?? [] : warehouses;

  return (
    <>
      <div className="head">
        <div><h1 className="h1">{L('أماكن التخزين', 'Storages')}</h1><p className="muted" style={{ margin: 0, fontSize: 13 }}>{L(`${warehouses.length} نشطة`, `${warehouses.length} active`)}</p></div>
        {manage && <button className="btn primary" onClick={() => setForm('new')}><Icon name="plus" size={18} />{L('جديد', 'New')}</button>}
      </div>
      <div className="filters">
        <button className={`fchip ${!showArchived ? 'on' : ''}`} onClick={() => setShowArchived(false)}>{L('النشطة', 'Active')}</button>
        {manage && <button className={`fchip ${showArchived ? 'on' : ''}`} onClick={() => setShowArchived(true)}>{L('المؤرشفة', 'Archived')}</button>}
      </div>

      {list.length === 0 ? (
        <Empty icon="storage" title={showArchived ? L('لا توجد أماكن مؤرشفة', 'No archived storages') : L('لا توجد أماكن تخزين بعد', 'No storages yet')}
          action={!showArchived && manage ? <button className="btn primary" onClick={() => setForm('new')}>{L('أنشئ أول مكان تخزين', 'Create the first storage')}</button> : undefined} />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))' }}>
          {list.map((w) => {
            const its = items.filter((i) => i.warehouseId === w.id);
            const alerts = its.filter((i) => stockLevel(i) !== 'ok').length;
            return (
              <div key={w.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="ico plain"><Icon name="storage" /></span>
                  <div className="grow"><p className="title">{w.name}</p><p className="sub"><span className="mono">{w.code}</span> · {w.location}</p></div>
                  {alerts > 0 && <span className="chip low"><Icon name="warn" size={13} />{alerts}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="chip plain">{w.storageType}</span><span className="chip plain">{w.department}</span>
                  {!showArchived && <span className="chip info">{L(`${its.length} صنف`, `${its.length} items`)}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!showArchived && <Link to={`/inventory?wh=${w.id}`} className="btn sm" style={{ flex: 1 }}>{L('الأصناف', 'Items')}</Link>}
                  {manage && !showArchived && <button className="btn sm" onClick={() => setForm(w)} aria-label={L('تعديل', 'Edit')}><Icon name="edit" size={16} /></button>}
                  {manage && !showArchived && <button className="btn sm" onClick={() => setConfirm({ wh: w, kind: 'archive' })} aria-label={L('أرشفة', 'Archive')}><Icon name="archive" size={16} /></button>}
                  {manage && showArchived && <button className="btn sm" style={{ flex: 1 }} onClick={async () => { await setWarehouseStatus(w.id, 'active'); toast(L('تمت الاستعادة', 'Restored')); archived.reload(); reload(); }}><Icon name="restore" size={16} />{L('استعادة', 'Restore')}</button>}
                  {manage && <button className="btn sm danger" onClick={() => setConfirm({ wh: w, kind: 'delete' })} aria-label={L('حذف', 'Delete')}><Icon name="trash" size={16} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && <StorageForm wh={form === 'new' ? undefined : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
      {confirm?.kind === 'archive' && <Confirm title={L('أرشفة مكان التخزين؟', 'Archive storage?')} text={L('سيختفي من القوائم ويمكن استعادته لاحقاً.', 'It will be hidden and can be restored later.')} confirmLabel={L('أرشفة', 'Archive')} onClose={() => setConfirm(null)} onConfirm={async () => { await setWarehouseStatus(confirm.wh.id, 'archived'); toast(L('تمت الأرشفة', 'Archived')); reload(); }} />}
      {confirm?.kind === 'delete' && <Confirm danger title={L('حذف نهائي؟', 'Delete permanently?')} text={L(`سيُحذف "${confirm.wh.name}" وكل أصنافه نهائياً. لا يمكن التراجع.`, `"${confirm.wh.name}" and all its items will be deleted. This cannot be undone.`)} confirmLabel={L('حذف نهائي', 'Delete')} onClose={() => setConfirm(null)} onConfirm={async () => { await deleteWarehouse(confirm.wh.id); toast(L('تم الحذف', 'Deleted')); archived.reload(); reload(); }} />}
    </>
  );
}
