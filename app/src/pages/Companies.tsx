import { useState } from 'react';
import { CONTROL } from '../config/app';
import { usePrefs } from '../lib/prefs';
import { fetchCompanies, generateCode, saveCompany, type CompanyRow } from '../services/companies';
import { Icon } from '../ui/Icon';
import { Field, Loading, Sheet, useLoad, useToast } from '../ui/kit';

export default function Companies() {
  const { L } = usePrefs();
  const toast = useToast();
  const list = useLoad(fetchCompanies, []);
  const [form, setForm] = useState<{ id?: string; name: string; joinCode: string; active: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = list.data ?? [];
  const sum = (k: 'users' | 'pending') => rows.reduce((a, r) => a + (r[k] ?? 0), 0);

  async function save() {
    if (!form) return;
    setBusy(true);
    try { await saveCompany(form, rows); toast(form.id ? L('تم التحديث', 'Updated') : L('تم إنشاء الشركة', 'Company created')); setForm(null); list.reload(); }
    catch (e) {
      const m = (e as Error).message;
      toast(m === 'name' ? L('الاسم قصير', 'Name too short') : m === 'code' ? L('الرمز 8 حروف/أرقام', 'Code must be 8 letters/digits') : m === 'codeTaken' ? L('الرمز مستخدم لشركة أخرى', 'Code already used') : L('تعذّر الحفظ — راجع قواعد Firestore', 'Could not save — check Firestore rules'), 'error');
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="head">
        <div><h1 className="h1">{L('الشركات', 'Companies')}</h1><p className="muted" style={{ margin: 0, fontSize: 13 }}>{L('إدارة الشركات ورموز الانضمام', 'Companies and join codes')}</p></div>
        <a className="btn primary" href={CONTROL.dashboard} target="_blank" rel="noreferrer"><Icon name="building" size={18} />{L('إدارة الشركات في مركز التحكم', 'Manage in Control Center')}</a>
      </div>
      <div className="callout"><Icon name="info" /><div>{L('الشركات ورموز الانضمام تُدار الآن من مركز التحكم. هنا ترى عدد مستخدمي كل شركة في STORA.', 'Companies and join codes are now managed in the Control Center. This page shows each company\'s STORA users.')}</div></div>
      <section className="grid g2 g4-d">
        <div className="card stat"><p>{L('الشركات', 'Companies')}</p><b>{rows.length}</b></div>
        <div className="card stat"><p>{L('النشطة', 'Active')}</p><b>{rows.filter((r) => r.active).length}</b></div>
        <div className="card stat"><p>{L('المستخدمون', 'Users')}</p><b>{sum('users')}</b></div>
        <div className="card stat"><p>{L('بانتظار الصلاحيات', 'Awaiting access')}</p><b style={{ color: sum('pending') ? 'var(--low)' : undefined }}>{sum('pending')}</b></div>
      </section>
      {list.loading && !list.data ? <Loading /> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
          {rows.map((c: CompanyRow) => (
            <div key={c.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, opacity: c.active ? 1 : 0.65 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="ico" style={{ background: 'var(--primary)', color: 'var(--on-primary)', fontWeight: 700 }}>{c.name.trim().slice(0, 2).toUpperCase()}</span>
                <div className="grow"><p className="title">{c.name}</p><p className="sub mono" style={{ fontSize: 11 }}>{c.id}</p></div>
                <span className={`chip ${c.active ? 'ok' : 'plain'}`}>{c.active ? L('نشطة', 'Active') : L('معطّلة', 'Disabled')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--raised)', border: '1px dashed var(--line)' }}>
                <div className="grow"><p className="muted" style={{ margin: 0, fontSize: 12 }}>{L('رمز الانضمام', 'Join code')}</p><p className="mono ltr" style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '.18em', textAlign: 'start' }}>{c.joinCode || '—'}</p></div>
                {c.joinCode && <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(c.joinCode); toast(L('تم النسخ', 'Copied')); }}>{L('نسخ', 'Copy')}</button>}
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>{c.users == null ? '—' : L(`${c.users} مستخدم · ${c.managers ?? 0} مدير`, `${c.users} users · ${c.managers ?? 0} managers`)}{c.pending ? L(` · ${c.pending} بانتظار`, ` · ${c.pending} waiting`) : ''}{c.builtIn ? L(' · أساسية', ' · built-in') : ''}</p>
            </div>
          ))}
        </div>
      )}
      {form && (
        <Sheet title={form.id ? L('تعديل الشركة', 'Edit company') : L('شركة جديدة', 'New company')} onClose={() => setForm(null)}
          footer={<><button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : L('حفظ', 'Save')}</button><button className="btn" onClick={() => setForm(null)}>{L('إلغاء', 'Cancel')}</button></>}>
          <Field label={L('اسم الشركة', 'Company name')}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={L('رمز الانضمام', 'Join code')} hint={L('تغييره يعطّل الرمز القديم', 'changing it disables the old one')}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input mono ltr" style={{ letterSpacing: '.15em', textAlign: 'start' }} maxLength={8} value={form.joinCode} onChange={(e) => setForm({ ...form, joinCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
              <button type="button" className="btn" onClick={() => setForm({ ...form, joinCode: generateCode() })}>{L('توليد', 'Generate')}</button>
            </div>
          </Field>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} style={{ width: 20, height: 20 }} />{L('نشطة (يمكن للموظفين الجدد الانضمام)', 'Active (new staff can join)')}</label>
        </Sheet>
      )}
    </>
  );
}
