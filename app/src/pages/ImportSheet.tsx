import { useState } from 'react';
import { usePrefs } from '../lib/prefs';
import { planImport, readWorkbook, runImport, type ImportPlan } from '../services/importer';
import { useData } from '../state/app';
import { Icon } from '../ui/Icon';
import { Sheet, useToast } from '../ui/kit';

const TEMPLATE = `${import.meta.env.BASE_URL}templates/STORA-import-template.xlsx`;

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { L, lang } = usePrefs();
  const { warehouses, items, reload } = useData();
  const toast = useToast();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [err, setErr] = useState('');

  async function pick(f: File | undefined) {
    if (!f) return;
    setErr(''); setPlan(null); setFileName(f.name); setBusy(true);
    try {
      const raw = await readWorkbook(f);
      if (!raw.items.length) setErr(L('لم نجد مواد في ورقة "المواد - Items"', 'No rows found in the "Items" sheet'));
      else setPlan(planImport(raw, warehouses, items, lang === 'ar'));
    } catch { setErr(L('تعذّرت قراءة الملف. استخدم القالب بصيغة .xlsx', 'Could not read the file. Use the .xlsx template')); }
    finally { setBusy(false); }
  }

  async function go() {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await runImport(plan, warehouses, items, (d, t) => setProgress([d, t]));
      toast(L(`تم: ${r.created} جديد، ${r.updated} محدّث${r.storages ? `، ${r.storages} أماكن تخزين` : ''}`, `Done: ${r.created} new, ${r.updated} updated${r.storages ? `, ${r.storages} storages` : ''}`));
      await reload();
      onClose();
    } catch { toast(L('توقف الاستيراد — تحقق من الاتصال والصلاحيات', 'Import stopped — check connection and permissions'), 'error'); }
    finally { setBusy(false); }
  }

  const ok = plan?.rows.filter((r) => !r.errors.length) ?? [];
  const bad = plan?.rows.filter((r) => r.errors.length) ?? [];
  const upd = ok.filter((r) => r.action === 'update').length;

  return (
    <Sheet title={L('استيراد المواد من Excel', 'Import materials from Excel')} onClose={onClose}
      footer={plan ? <><button className="btn primary" style={{ flex: 1 }} disabled={busy || !ok.length} onClick={go}>{busy ? (progress ? `${progress[0]} / ${progress[1]}` : <span className="spinner" />) : L(`استيراد ${ok.length} صنف`, `Import ${ok.length} items`)}</button><button className="btn" onClick={onClose}>{L('إلغاء', 'Cancel')}</button></> : undefined}>
      <a className="row card" href={TEMPLATE} download style={{ borderRadius: 14 }}>
        <span className="ico ok"><Icon name="download" size={19} /></span>
        <span className="grow"><p className="title" style={{ fontSize: 14 }}>{L('تحميل القالب', 'Download template')}</p><p className="sub" style={{ fontSize: 12 }}>STORA-import-template.xlsx</p></span>
      </a>
      <label className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center' }}>
        <Icon name="up" size={26} />
        <b>{fileName || L('اختر ملف Excel المعبّأ', 'Choose the filled Excel file')}</b>
        <span className="muted" style={{ fontSize: 12.5 }}>.xlsx</span>
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {busy && !plan && <div className="center" style={{ minHeight: 60 }}><span className="spinner" /></div>}
      {err && <p className="err-text">{err}</p>}
      {plan && (
        <>
          <div className="grid g3">
            <div className="card stat"><p>{L('جديد', 'New')}</p><b style={{ color: 'var(--ok)' }}>{ok.length - upd}</b></div>
            <div className="card stat"><p>{L('تحديث', 'Update')}</p><b>{upd}</b></div>
            <div className="card stat"><p>{L('أخطاء', 'Errors')}</p><b style={{ color: bad.length ? 'var(--out)' : undefined }}>{bad.length}</b></div>
          </div>
          {plan.newStorages.length > 0 && <div className="callout"><Icon name="storage" /><div>{L('سيتم إنشاء أماكن تخزين جديدة:', 'New storages will be created:')} <b>{plan.newStorages.map((s) => s.name).join('، ')}</b></div></div>}
          {bad.length > 0 && (
            <div className="list" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {bad.slice(0, 50).map((r) => <div key={r.line} className="row" style={{ fontSize: 13 }}><span className="chip out mono">{L('سطر', 'Row')} {r.line}</span><span className="grow">{r.data.name || '—'} — {r.errors.join('، ')}</span></div>)}
            </div>
          )}
          {bad.length > 0 && <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{L('الأسطر التي فيها أخطاء لن تُستورد. صحّحها في الملف وأعد رفعه لاحقاً.', 'Rows with errors are skipped. Fix them and upload again.')}</p>}
        </>
      )}
    </Sheet>
  );
}
