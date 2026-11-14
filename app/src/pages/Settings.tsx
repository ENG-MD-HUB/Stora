import { useEffect, useState } from 'react';
import { APP } from '../config/app';
import { usePrefs, type ThemePref } from '../lib/prefs';
import { can, roleLabel } from '../lib/permissions';
import { installId, deviceInfo } from '../lib/telemetry';
import { updateMyName } from '../services/auth';
import { fetchSignatories, saveSignatories } from '../services/releases';
import type { Signatory } from '../services/types';
import { useAuth, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { Field, useToast } from '../ui/kit';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><h2 className="section-title">{title}</h2>{children}</section>;
}

export default function Settings() {
  const s = useSession();
  const { company, setSession, signOut } = useAuth();
  const { L, lang, setLang, theme, setTheme } = usePrefs();
  const toast = useToast();
  const [name, setName] = useState(s.displayName);
  const [sig, setSig] = useState<Signatory[] | null>(null);
  const canSig = can(s.role, 'settings:company') && s.companyId !== 'system';

  useEffect(() => { if (canSig) fetchSignatories(s.companyId).then(setSig); }, [canSig, s.companyId]);

  const themes: [ThemePref, string, string][] = [['system', 'globe', L('تلقائي', 'Auto')], ['light', 'sun', L('فاتح', 'Light')], ['dark', 'moon', L('داكن', 'Dark')]];
  const dev = deviceInfo();

  return (
    <>
      <h1 className="h1">{L('الإعدادات', 'Settings')}</h1>
      <div className="split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section title={L('الملف الشخصي', 'Profile')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ico plain" style={{ width: 48, height: 48, fontSize: 18, fontWeight: 700 }}>{s.displayName.trim().charAt(0)}</span>
              <div className="grow"><p className="title">{s.displayName}</p><p className="sub"><span className="ltr">{s.email}</span></p></div>
              <span className="chip info">{roleLabel(s.role, L)}</span>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>{company}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
              <Field label={L('الاسم الظاهر', 'Display name')}><input className="input" dir="auto" value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <button className="btn" disabled={name.trim().length < 2 || name === s.displayName} onClick={async () => { await updateMyName(s.uid, name); setSession({ ...s, displayName: name.trim() }); toast(L('تم تحديث الاسم', 'Name updated')); }}>{L('حفظ', 'Save')}</button>
            </div>
          </Section>

          <Section title={L('المظهر واللغة', 'Appearance & language')}>
            <div className="grid g3">
              {themes.map(([k, icon, label]) => <button key={k} className={`btn ${theme === k ? 'primary' : ''}`} onClick={() => setTheme(k)}><Icon name={icon} size={18} />{label}</button>)}
            </div>
            <div className="grid g2">
              <button className={`btn ${lang === 'ar' ? 'primary' : ''}`} onClick={() => setLang('ar')}>العربية</button>
              <button className={`btn ${lang === 'en' ? 'primary' : ''}`} onClick={() => setLang('en')}>English</button>
            </div>
          </Section>

          <button className="btn danger block" onClick={signOut}><Icon name="logout" size={18} />{L('تسجيل الخروج', 'Sign out')}</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section title={L('حول التطبيق', 'About')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 14 }}>
              <span className="muted">{L('الإصدار', 'Version')}</span><span className="mono ltr" style={{ textAlign: 'start' }}>{APP.version}</span>
              <span className="muted">{L('المطوّر', 'Developer')}</span><span>{APP.developer}</span>
              <span className="muted">{L('الجهاز', 'Device')}</span><span>{dev.os}{dev.standalone ? L(' · مثبّت كتطبيق', ' · installed') : ''}</span>
              <span className="muted">{L('معرّف التثبيت', 'Install ID')}</span><span className="mono ltr" style={{ fontSize: 12, textAlign: 'start', overflowWrap: 'anywhere' }}>{installId().slice(0, 8)}</span>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{L('لا يجمع التطبيق أي بيانات تعريفية عن جهازك خارج حسابك.', 'The app collects no identifying data about your device outside your account.')}</p>
          </Section>
        </div>
      </div>
      {canSig && sig && (
        <Section title={L('معتمدو نموذج الصرف المطبوع', 'Release form signatories')}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{L('تظهر هذه البيانات في خانات التوقيع أسفل سند الصرف المطبوع.', 'Shown in the signature boxes of the printed release form.')}</p>
          <div className="grid g2-d" style={{ gap: 12 }}>
            {sig.map((g, i) => (
              <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--raised)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="chip info mono">{i + 1}</span>
                  <input className="input" dir="auto" style={{ height: 40, fontWeight: 700, fontSize: 14 }} value={g.role} onChange={(e) => setSig(sig.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} aria-label={L('صفة التوقيع', 'Signature role')} />
                </div>
                <Field label={L('المسمى الوظيفي', 'Job title')}><input className="input" dir="auto" value={g.title} onChange={(e) => setSig(sig.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /></Field>
                <Field label={L('الاسم', 'Name')}><input className="input" dir="auto" value={g.name} onChange={(e) => setSig(sig.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></Field>
              </div>
            ))}
          </div>
          <button className="btn primary" style={{ alignSelf: 'flex-start', minWidth: 200 }} onClick={async () => { try { await saveSignatories(s.companyId, sig); toast(L('تم الحفظ', 'Saved')); } catch { toast(L('تعذّر الحفظ', 'Could not save'), 'error'); } }}>{L('حفظ المعتمدين', 'Save signatories')}</button>
        </Section>
      )}
    </>
  );
}
