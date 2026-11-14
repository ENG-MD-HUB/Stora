import { useState } from 'react';
import { usePrefs } from '../lib/prefs';
import { confirmPassword, resetData, type ResetScope } from '../services/reset';
import { useData } from '../state/app';
import { Field, Sheet, useToast } from '../ui/kit';

/** Manager tool to clear test data. Confirmed with the manager's own account password. */
export function ResetSheet({ onClose }: { onClose: () => void }) {
  const { L } = usePrefs();
  const toast = useToast();
  const { reload } = useData();
  const [scope, setScope] = useState<ResetScope | null>(null);
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const OPTS: [ResetScope, string, string, boolean][] = [
    ['movements', L('سجل الحركة', 'Movement history'), L('كل حركات الصرف والإرجاع والاستلام', 'All withdraw, return and receive records'), false],
    ['releases', L('سندات الصرف', 'Release records'), L('كل السندات (لا تتغير الكميات)', 'All releases (quantities stay as they are)'), false],
    ['logs', L('سجل النشاط', 'Activity log'), L('كل سجلات النشاط', 'All activity log entries'), false],
    ['items', L('الأصناف', 'Items'), L('كل الأصناف في كل الأماكن', 'All items in every storage'), true],
    ['warehouses', L('أماكن التخزين', 'Storages'), L('كل الأماكن وأصنافها', 'All storages and their items'), true],
    ['users', L('المستخدمون', 'Users'), L('كل المستخدمين ما عدا حسابك', 'Every user except your account'), true],
    ['all', L('مسح كل شيء', 'Reset everything'), L('كل البيانات والمستخدمين — حسابك يبقى', 'All data and users — your account stays'), true],
  ];
  const pick = OPTS.find((o) => o[0] === scope);

  async function go() {
    if (!scope || !pw) return;
    setBusy(true); setErr('');
    try { await confirmPassword(pw); } catch { setErr(L('كلمة المرور غير صحيحة', 'Incorrect password')); setBusy(false); return; }
    try {
      const n = await resetData(scope, (label, k) => setProgress(`${label}: ${k}`));
      reload();
      toast(L(`تم حذف ${n} سجل`, `${n} records deleted`));
      onClose();
    } catch { toast(L('تعذّر الحذف — قد تنقصك الصلاحية', 'Could not delete — permission may be missing'), 'error'); setBusy(false); }
  }

  return (
    <Sheet title={L('حذف البيانات', 'Delete data')} onClose={() => !busy && onClose()}>
      {step === 'pick' ? (
        <>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{L('اختر ما تريد حذفه. لا يمكن التراجع.', 'Choose what to delete. This cannot be undone.')}</p>
          <div className="reset-list" role="radiogroup">
            {OPTS.map(([k, t, d, hard]) => (
              <button key={k} role="radio" aria-checked={scope === k} className={`reset-opt ${scope === k ? 'on' : ''} ${hard ? 'hard' : ''}`} onClick={() => setScope(k)}>
                <span className="reset-dot" /><span className="grow"><b>{t}</b><small>{d}</small></span>
              </button>
            ))}
          </div>
          <button className="btn danger block" disabled={!scope} onClick={() => setStep('confirm')}>{L('متابعة', 'Continue')}</button>
        </>
      ) : (
        <>
          <div className="callout danger-box"><b>{L('سيُحذف نهائياً:', 'Will be deleted for good:')} {pick?.[1]}</b><p style={{ margin: '2px 0 0', fontSize: 13 }}>{pick?.[2]}</p></div>
          <Field label={L('كلمة مرور حسابك للتأكيد', 'Your account password to confirm')} error={err}>
            <input className={`input ${err ? 'err' : ''}`} type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && go()} />
          </Field>
          {busy && progress && <p className="muted mono" style={{ margin: 0, fontSize: 12, textAlign: 'center' }}>{progress}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" disabled={busy} onClick={() => { setStep('pick'); setPw(''); setErr(''); }}>{L('رجوع', 'Back')}</button>
            <button className="btn danger" style={{ flex: 1 }} disabled={busy || !pw} onClick={go}>{busy ? <span className="spinner" /> : L('احذف الآن', 'Delete now')}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
