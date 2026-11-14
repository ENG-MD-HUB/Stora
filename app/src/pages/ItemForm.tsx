import { useState } from 'react';
import { usePrefs } from '../lib/prefs';
import { createItem, updateItem, type ItemInput } from '../services/inventory';
import type { Item } from '../services/types';
import { useData } from '../state/app';
import { Field, Sheet, useToast } from '../ui/kit';
import { toDate } from '../lib/format';

const EXTRA = ['employeeNumber', 'modelCategory', 'model', 'serialNumber', 'assetsTag', 'sapCode', 'requestType', 'poNumber', 'dnNumber'] as const;

export function ItemForm({ item, defaultWarehouse, onClose, onSaved }: { item?: Item; defaultWarehouse?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const { L } = usePrefs();
  const { warehouses } = useData();
  const toast = useToast();
  const exp = toDate(item?.expiryDate);
  const [f, setF] = useState<Record<string, string>>(() => ({
    warehouseId: item?.warehouseId ?? defaultWarehouse ?? (warehouses.length === 1 ? warehouses[0].id : ''),
    name: item?.name ?? '', itemCode: item?.itemCode ?? '', projectName: item?.projectName ?? '', owner: item?.owner ?? '',
    quantity: String(item?.quantity ?? ''), unit: item?.unit ?? 'pcs', minThreshold: String(item?.minThreshold ?? 5), notes: item?.notes ?? '',
    expiryDate: exp ? exp.toISOString().slice(0, 10) : '',
    ...Object.fromEntries(EXTRA.map((k) => [k, (item?.[k] as string) ?? ''])),
  }));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(() => EXTRA.some((k) => item?.[k]));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const req = L('مطلوب', 'Required');

  async function save() {
    const e: Record<string, string> = {};
    if (!item && !f.warehouseId) e.warehouseId = req;
    if (f.name.trim().length < 2) e.name = req;
    if (!f.projectName.trim()) e.projectName = req;
    if (!f.owner.trim()) e.owner = req;
    if (!f.unit.trim()) e.unit = req;
    if (f.quantity === '' || Number(f.quantity) < 0) e.quantity = L('رقم صحيح', 'Valid number');
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const input = { ...f, quantity: Number(f.quantity), minThreshold: Number(f.minThreshold) || 0 } as unknown as ItemInput;
      const id = item ? (await updateItem(item.id, input), item.id) : await createItem(input);
      toast(item ? L('تم تحديث الصنف', 'Item updated') : L('تمت إضافة الصنف', 'Item added'));
      onSaved(id);
    } catch (x) {
      const code = (x as { code?: string }).code ?? '';
      toast(code.includes('permission') ? L('ليست لديك صلاحية', 'Permission denied') : L('تعذّر الحفظ', 'Could not save'), 'error');
    } finally { setBusy(false); }
  }

  const inp = (k: string, label: string, opts: { type?: string; hint?: string; ph?: string; mono?: boolean } = {}) => (
    <Field label={label} hint={opts.hint} error={errs[k]}>
      <input className={`input ${errs[k] ? 'err' : ''} ${opts.mono ? 'mono' : ''}`} type={opts.type ?? 'text'} inputMode={opts.type === 'number' ? 'numeric' : undefined} value={f[k]} onChange={set(k)} placeholder={opts.ph} />
    </Field>
  );

  return (
    <Sheet title={item ? L('تعديل الصنف', 'Edit item') : L('صنف جديد', 'New item')} onClose={onClose}
      footer={<><button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : L('حفظ', 'Save')}</button><button className="btn" onClick={onClose}>{L('إلغاء', 'Cancel')}</button></>}>
      {!item && (
        <Field label={L('مكان التخزين', 'Storage')} error={errs.warehouseId}>
          <select className={`input ${errs.warehouseId ? 'err' : ''}`} value={f.warehouseId} onChange={set('warehouseId')}>
            <option value="">{L('اختر…', 'Choose…')}</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
          </select>
        </Field>
      )}
      {inp('name', L('اسم الصنف', 'Item name'), { ph: 'Dell Latitude 5540' })}
      <div className="grid g2">
        {inp('projectName', L('المشروع', 'Project'))}
        {inp('owner', L('مالك الأصول', 'Assets owner'))}
      </div>
      <div className="grid g3">
        {inp('quantity', L('الكمية', 'Quantity'), { type: 'number' })}
        {inp('unit', L('الوحدة', 'Unit'), { ph: L('جهاز', 'pcs') })}
        {inp('minThreshold', L('الحد الأدنى', 'Minimum'), { type: 'number' })}
      </div>
      <div className="grid g2">
        {inp('itemCode', L('رقم المخزون', 'Stock no.'), { mono: true })}
        {inp('expiryDate', L('تاريخ الانتهاء', 'Expiry'), { type: 'date', hint: L('اختياري', 'optional') })}
      </div>
      <Field label={L('ملاحظات', 'Notes')} hint={L('اختياري', 'optional')}><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field>
      {!more ? (
        <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(true)}>+ {L('بيانات ITSM / SAP', 'ITSM / SAP details')}</button>
      ) : (
        <fieldset className="box">
          <legend>ITSM / SAP</legend>
          <div className="grid g2">
            {inp('sapCode', 'SAP Code', { mono: true })}
            {inp('assetsTag', L('رقم الأصل', 'Asset tag'), { mono: true })}
            {inp('model', L('الموديل', 'Model'))}
            {inp('serialNumber', L('الرقم التسلسلي', 'Serial no.'), { mono: true })}
            {inp('modelCategory', L('فئة الموديل', 'Model category'))}
            {inp('employeeNumber', L('الشركة', 'Company'))}
            {inp('poNumber', L('أمر الشراء', 'PO number'), { mono: true })}
            {inp('dnNumber', L('سند التسليم', 'DN number'), { mono: true })}
          </div>
          {inp('requestType', L('نوع الطلب', 'Request type'))}
        </fieldset>
      )}
    </Sheet>
  );
}
