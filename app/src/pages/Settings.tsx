import { useEffect, useState, type ReactNode } from 'react';
import { APP } from '../config/app';
import { usePrefs, type ThemePref } from '../lib/prefs';
import { can, roleLabel } from '../lib/permissions';
import { deviceInfo, installId } from '../lib/telemetry';
import { updateMyName } from '../services/auth';
import { fetchSignatories, saveSignatories } from '../services/releases';
import type { Signatory } from '../services/types';
import { useAuth, useData, useSession } from '../state/app';
import { PoweredBy } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/kit';
import { ImportSheet } from './ImportSheet';
import { ResetSheet } from './ResetSheet';
import { downloadBackup } from '../services/backup';

/** One settings row: label on one side, value/control on the other. */
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-label"><span>{label}</span>{hint && <small>{hint}</small>}</div>
      <div className="set-ctrl">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string, string?][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([k, label, icon]) => (
        <button key={k} role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {icon && <Icon name={icon} size={16} />}{label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const s = useSession();
  const { company, setSession, signOut } = useAuth();
  const { L, lang, setLang, theme, setTheme } = usePrefs();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.displayName);
  const [sig, setSig] = useState<Signatory[] | null>(null);
  const [savingSig, setSavingSig] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [backing, setBacking] = useState('');
  const { warehouses, items } = useData();
  const canReset = s.role === 'manager' && s.companyId !== 'system';
  const canImport = can(s.role, 'item:create') && s.companyId !== 'system';
  const canSig = can(s.role, 'settings:company') && s.companyId !== 'system';
  const dev = deviceInfo();

  useEffect(() => { if (canSig) fetchSignatories(s.companyId).then(setSig); }, [canSig, s.companyId]);

  const setField = (i: number, k: keyof Signatory, v: string) => setSig((list) => list && list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function saveName() {
    if (name.trim().length < 2) return;
    await updateMyName(s.uid, name);
    setSession({ ...s, displayName: name.trim() });
    setEditing(false);
    toast(L('تم تحديث الاسم', 'Name updated'));
  }

  return (
    <div className="settings">
      <h1 className="h1">{L('الإعدادات', 'Settings')}</h1>

      {/* Profile */}
      <section className="card set-profile">
        <span className="avatar">{s.displayName.trim().charAt(0).toUpperCase()}</span>
        <div className="grow">
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); saveName(); }} style={{ display: 'flex', gap: 8 }}>
              <input className="input" dir="auto" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label={L('الاسم الظاهر', 'Display name')} style={{ height: 42 }} />
              <button className="btn primary sm" style={{ height: 42 }}>{L('حفظ', 'Save')}</button>
              <button type="button" className="btn sm ghost" style={{ height: 42 }} onClick={() => { setEditing(false); setName(s.displayName); }}>{L('إلغاء', 'Cancel')}</button>
            </form>
          ) : (
            <p className="title" style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
              {s.displayName}
              <button className="icon-btn" style={{ width: 30, height: 30, border: 0, background: 'transparent', color: 'var(--muted)' }} onClick={() => setEditing(true)} aria-label={L('تعديل الاسم', 'Edit name')}><Icon name="edit" size={15} /></button>
            </p>
          )}
          <p className="sub ltr" style={{ textAlign: 'start' }}>{s.email}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span className="chip info">{roleLabel(s.role, L)}</span>
            {company && <span className="chip plain"><Icon name="building" size={13} />{company}</span>}
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="card set-list">
        <h2 className="section-title">{L('التفضيلات', 'Preferences')}</h2>
        <Row label={L('المظهر', 'Theme')} hint={L('"تلقائي" يتبع إعداد جهازك', '"Auto" follows your device')}>
          <Segmented<ThemePref> value={theme} onChange={setTheme} options={[['system', L('تلقائي', 'Auto'), 'globe'], ['light', L('فاتح', 'Light'), 'sun'], ['dark', L('داكن', 'Dark'), 'moon']]} />
        </Row>
        <Row label={L('اللغة', 'Language')}>
          <Segmented value={lang} onChange={setLang} options={[['en', 'English'], ['ar', 'العربية']]} />
        </Row>
      </section>

      {/* Release form signatories */}
      {canSig && sig && (
        <section className="card set-list">
          <div className="head">
            <div><h2 className="section-title">{L('معتمدو سند الصرف المطبوع', 'Release form signatories')}</h2><p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>{L('تظهر في خانات التوقيع أسفل السند.', 'Printed in the signature boxes of the release form.')}</p></div>
            <button className="btn primary sm" disabled={savingSig} onClick={async () => { setSavingSig(true); try { await saveSignatories(s.companyId, sig); toast(L('تم الحفظ', 'Saved')); } catch { toast(L('تعذّر الحفظ', 'Could not save'), 'error'); } finally { setSavingSig(false); } }}>{L('حفظ', 'Save')}</button>
          </div>
          <div className="sig-table" role="table">
            <div className="sig-head" role="row"><span>#</span><span>{L('صفة التوقيع', 'Signs as')}</span><span>{L('المسمى الوظيفي', 'Job title')}</span><span>{L('الاسم', 'Name')}</span></div>
            {sig.map((g, i) => (
              <div key={i} className="sig-row" role="row">
                <span className="sig-n mono">{i + 1}</span>
                <label><small>{L('صفة التوقيع', 'Signs as')}</small><input className="input" dir="auto" value={g.role} onChange={(e) => setField(i, 'role', e.target.value)} /></label>
                <label><small>{L('المسمى الوظيفي', 'Job title')}</small><input className="input" dir="auto" value={g.title} onChange={(e) => setField(i, 'title', e.target.value)} /></label>
                <label><small>{L('الاسم', 'Name')}</small><input className="input" dir="auto" value={g.name} onChange={(e) => setField(i, 'name', e.target.value)} placeholder={L('اسم المعتمد', 'Signatory name')} /></label>
              </div>
            ))}
          </div>
        </section>
      )}

      {(canImport || canReset) && (
        <section className="card set-list">
          <h2 className="section-title">{L('البيانات', 'Data')}</h2>
          <Row label={L('استيراد مواد من Excel', 'Import materials from Excel')} hint={L('لنقل مخزون قديم أو إضافة أصناف كثيرة مرة واحدة', 'Move an old stock list or add many items at once')}>
            <button className="btn sm" onClick={() => setImporting(true)}><Icon name="up" size={16} />{L('استيراد', 'Import')}</button>
          </Row>
          <Row label={L('قالب الاستيراد', 'Import template')} hint={L('ملف Excel جاهز بالأعمدة المطلوبة', 'Ready Excel file with the required columns')}>
            <a className="btn sm" href={`${import.meta.env.BASE_URL}templates/STORA-import-template.xlsx`} download><Icon name="download" size={16} />{L('تحميل', 'Download')}</a>
          </Row>
          {canReset && (
            <Row label={L('نسخة احتياطية كاملة', 'Full backup')} hint={L('ملف Excel واحد: الأصناف، الأماكن، الحركات، السندات، السجل، الفريق', 'One Excel file: items, storages, movements, releases, log, team')}>
              <button className="btn sm" disabled={!!backing} onClick={async () => {
                setBacking(L('جارٍ التجهيز…', 'Preparing…'));
                try { await downloadBackup({ companyId: s.companyId, company: company ?? '', by: s.displayName, warehouses, items, L, lang, onStep: setBacking }); toast(L('تم تنزيل النسخة', 'Backup downloaded')); }
                catch { toast(L('تعذّر إنشاء النسخة', 'Could not create the backup'), 'error'); }
                finally { setBacking(''); }
              }}>{backing ? <><span className="spinner" />{backing}</> : <><Icon name="download" size={16} />{L('تنزيل', 'Download')}</>}</button>
            </Row>
          )}
          {canReset && (
            <Row label={L('حذف البيانات', 'Delete data')} hint={L('مسح بيانات التجربة: الحركات، السندات، السجل، الأصناف…', 'Clear test data: movements, releases, log, items…')}>
              <button className="btn sm danger" onClick={() => setResetting(true)}><Icon name="trash" size={16} />{L('حذف…', 'Delete…')}</button>
            </Row>
          )}
        </section>
      )}

      {/* About */}
      <section className="card set-list">
        <h2 className="section-title">{L('حول التطبيق', 'About')}</h2>
        <Row label={L('الإصدار', 'Version')}><span className="mono ltr">{APP.version}</span></Row>
        <Row label={L('المطوّر', 'Developer')}><span>{APP.developer}</span></Row>
        <Row label={L('الجهاز', 'Device')}><span style={{ textTransform: 'capitalize' }}>{dev.os}{dev.standalone ? L(' · مثبّت', ' · installed') : ''}</span></Row>
        <Row label={L('معرّف التثبيت', 'Install ID')} hint={L('رقم عشوائي لهذا الجهاز فقط', 'Random, this device only')}><span className="mono ltr">{installId().slice(0, 8)}</span></Row>
      </section>

      {importing && <ImportSheet onClose={() => setImporting(false)} />}
      {resetting && <ResetSheet onClose={() => setResetting(false)} />}
      <button className="btn danger block" onClick={signOut}><Icon name="logout" size={18} />{L('تسجيل الخروج', 'Sign out')}</button>
      <div style={{ display: 'flex', justifyContent: 'center' }}><PoweredBy height={12} /></div>
    </div>
  );
}
