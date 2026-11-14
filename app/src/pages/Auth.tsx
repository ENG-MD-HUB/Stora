import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { APP } from '../config/app';
import { usePrefs } from '../lib/prefs';
import { audit } from '../services/audit';
import { authError, login, register, resetPassword } from '../services/auth';
import { useAuth } from '../state/app';
import { Icon, Logo } from '../ui/Icon';
import { Field, useToast } from '../ui/kit';

function Frame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const { L, lang, setLang } = usePrefs();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px 20px', position: 'relative', overflow: 'hidden' }}>
      <span aria-hidden="true" style={{ position: 'absolute', top: -160, insetInlineStart: -140, width: 380, height: 380, borderRadius: '50%', border: '1px solid var(--line)' }} />
      <span aria-hidden="true" style={{ position: 'absolute', top: -90, insetInlineStart: -70, width: 240, height: 240, borderRadius: '50%', border: '1px solid var(--line)' }} />
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 28, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Logo size={52} />
          <div>
            <p className="mono muted" style={{ margin: 0, letterSpacing: '.3em', fontSize: 14 }}>STORA</p>
            <h1 className="h1" style={{ fontSize: 28, marginTop: 4 }}>{title}</h1>
            <p className="muted" style={{ margin: '4px 0 0' }}>{sub}</p>
          </div>
        </div>
        {children}
        <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, margin: 0 }}>
          STORA {APP.version} · <button className="btn ghost sm" style={{ height: 'auto', padding: 0, border: 0, color: 'var(--accent-text)' }} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{L('English', 'العربية')}</button>
        </p>
      </div>
    </div>
  );
}

export function Login() {
  const { L } = usePrefs();
  const { setSession } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const ss = await login(email, pw); setSession(ss); audit('LOGIN', 'user', ss.uid); } catch (x) { setErr(authError(x, L)); } finally { setBusy(false); }
  }
  async function forgot() {
    if (!email.includes('@')) { setErr(L('اكتب بريدك أولاً ثم اضغط "نسيتها؟"', 'Type your email first, then tap "Forgot?"')); return; }
    try { await resetPassword(email); toast(L('أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك', 'Password reset link sent to your email')); }
    catch (x) { setErr(authError(x, L)); }
  }

  return (
    <Frame title={L('أهلاً بعودتك', 'Welcome back')} sub={L('سجّل الدخول لمتابعة مستودعك', 'Sign in to your warehouse')}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label={L('البريد الإلكتروني', 'Email')}>
          <input className="input ltr" style={{ textAlign: 'start' }} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </Field>
        <label className="field">
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>{L('كلمة المرور', 'Password')}<button type="button" onClick={forgot} style={{ background: 'none', border: 0, color: 'var(--accent-text)', fontWeight: 500, padding: 0 }}>{L('نسيتها؟', 'Forgot?')}</button></span>
          <input className="input" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <p className="err-text" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy} style={{ height: 54 }}>{busy ? <span className="spinner" /> : L('دخول', 'Sign in')}</button>
      </form>
      <Link to="/register" className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text)' }}>
        <span className="ico plain"><Icon name="userPlus" /></span>
        <span className="grow"><b style={{ display: 'block', fontSize: 14 }}>{L('موظف جديد؟', 'New employee?')}</b><span className="muted" style={{ fontSize: 13 }}>{L('أنشئ حسابك برمز الشركة', 'Create your account with the company code')}</span></span>
        <span style={{ color: 'var(--accent-text)', fontWeight: 600, fontSize: 14 }}>{L('إنشاء حساب', 'Register')}</span>
      </Link>
    </Frame>
  );
}

export function Register() {
  const { L } = usePrefs();
  const { setSession } = useAuth();
  const [f, setF] = useState({ displayName: '', email: '', password: '', confirm: '', joinCode: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'joinCode' ? e.target.value.toUpperCase() : e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (f.displayName.trim().length < 2) return setErr(L('اكتب اسمك الكامل', 'Enter your full name'));
    if (f.password.length < 8) return setErr(L('كلمة المرور 8 أحرف على الأقل', 'Password must be at least 8 characters'));
    if (f.password !== f.confirm) return setErr(L('كلمتا المرور غير متطابقتين', 'Passwords do not match'));
    setBusy(true);
    try { const ss = await register(f); setSession(ss); audit('USER_CREATE', 'user', ss.uid, { newValue: { role: 'viewer' } }); } catch (x) { setErr(authError(x, L)); } finally { setBusy(false); }
  }

  return (
    <Frame title={L('إنشاء حساب', 'Create account')} sub={L('سجّل برمز الانضمام الذي أعطاك إياه مديرك', 'Use the join code from your manager')}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={L('الاسم الكامل', 'Full name')}><input className="input" autoComplete="name" required value={f.displayName} onChange={set('displayName')} /></Field>
        <Field label={L('البريد الإلكتروني', 'Email')}><input className="input ltr" style={{ textAlign: 'start' }} type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></Field>
        <div className="grid g2">
          <Field label={L('كلمة المرور', 'Password')}><input className="input" type="password" autoComplete="new-password" required value={f.password} onChange={set('password')} /></Field>
          <Field label={L('تأكيدها', 'Confirm')}><input className="input" type="password" autoComplete="new-password" required value={f.confirm} onChange={set('confirm')} /></Field>
        </div>
        <Field label={L('رمز الشركة', 'Company code')} hint={L('8 حروف وأرقام', '8 characters')}>
          <input className="input mono ltr" style={{ letterSpacing: '.18em', textAlign: 'start' }} required maxLength={16} value={f.joinCode} onChange={set('joinCode')} placeholder="JEDCO001" />
        </Field>
        {err && <p className="err-text" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy} style={{ height: 54 }}>{busy ? <span className="spinner" /> : L('إنشاء الحساب', 'Create account')}</button>
        <Link to="/login" style={{ textAlign: 'center', fontSize: 14 }}>{L('لديك حساب؟ سجّل الدخول', 'Have an account? Sign in')}</Link>
      </form>
    </Frame>
  );
}
