import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { APP } from '../config/app';
import { usePrefs } from '../lib/prefs';
import { audit } from '../services/audit';
import { authError, checkVerified, login, register, resetPassword, sendVerification } from '../services/auth';
import { useAuth } from '../state/app';
import { PoweredBy } from '../ui/Brand';
import { Icon } from '../ui/Icon';
import { Field, useToast } from '../ui/kit';

const base = import.meta.env.BASE_URL;

/** Centered intro screen: logo, wordmark, card, small "Powered by" at the bottom. */
function Frame({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  const { L, lang, setLang } = usePrefs();
  return (
    <div className="auth">
      <div className="auth-bg" aria-hidden="true"><i /><i /><i /></div>
      <button className="auth-lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" size={16} />{L('English', 'العربية')}</button>
      <main className="auth-main">
        <div className="auth-brand">
          <span className="auth-logo"><img src={`${base}brand/stora-icon.png`} alt="" /></span>
          <h1 className="auth-word">STORA</h1>
          <p className="auth-tag">Warehouse Management</p>
        </div>
        <div className="auth-card">
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 21 }}>{title}</h2>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>{sub}</p>
          </div>
          {children}
        </div>
      </main>
      <footer className="auth-foot"><PoweredBy height={13} /><span className="mono ltr" style={{ fontSize: 10.5, opacity: .7 }}>v{APP.version}</span></footer>
    </div>
  );
}

/** 8 boxes for the company code: letters, digits and symbols; paste fills all boxes. */
function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: 8 }, (_, i) => value[i] ?? '');
  const setAt = (i: number, ch: string) => {
    const arr = [...chars];
    arr[i] = ch;
    onChange(arr.join('').replace(/\s/g, ''));
  };
  return (
    <div className="code-boxes" dir="ltr" onPaste={(e) => {
      const t = e.clipboardData.getData('text').replace(/\s/g, '').toUpperCase().slice(0, 8);
      if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(t.length, 7)]?.focus(); }
    }}>
      {chars.map((c, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} value={c} maxLength={1} autoCapitalize="characters" autoComplete="off" spellCheck={false}
          aria-label={`${i + 1}`}
          onChange={(e) => { const ch = e.target.value.slice(-1).toUpperCase(); if (!ch.trim()) return; setAt(i, ch); refs.current[i + 1]?.focus(); }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') { e.preventDefault(); if (c) setAt(i, ''); else if (i > 0) { setAt(i - 1, ''); refs.current[i - 1]?.focus(); } }
            if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()} />
      ))}
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
    <Frame title={L('أهلاً بعودتك', 'Welcome back')} sub={L('سجّل الدخول إلى مساحة عملك', 'Sign in to your workspace')}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label={L('البريد الإلكتروني', 'Email')}>
          <input className="input ltr" style={{ textAlign: 'start' }} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </Field>
        <label className="field">
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>{L('كلمة المرور', 'Password')}<button type="button" onClick={forgot} style={{ background: 'none', border: 0, color: 'var(--accent-text)', fontWeight: 500, padding: 0 }}>{L('نسيتها؟', 'Forgot?')}</button></span>
          <input className="input" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <p className="err-text" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy} style={{ height: 52 }}>{busy ? <span className="spinner" /> : L('دخول', 'Sign in')}</button>
      </form>
      <p style={{ margin: 0, textAlign: 'center', fontSize: 14 }} className="muted">{L('موظف جديد؟', 'New employee?')} <Link to="/register" style={{ fontWeight: 600 }}>{L('أنشئ حسابك برمز الشركة', 'Create an account')}</Link></p>
    </Frame>
  );
}

export function Register() {
  const { L } = usePrefs();
  const { setSession } = useAuth();
  const [f, setF] = useState({ displayName: '', email: '', password: '', confirm: '', joinCode: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (f.displayName.trim().length < 2) return setErr(L('اكتب اسمك الكامل', 'Enter your full name'));
    if (f.password.length < 8) return setErr(L('كلمة المرور 8 أحرف على الأقل', 'Password must be at least 8 characters'));
    if (f.password !== f.confirm) return setErr(L('كلمتا المرور غير متطابقتين', 'Passwords do not match'));
    if (f.joinCode.length !== 8) return setErr(L('رمز الشركة 8 خانات', 'The company code has 8 characters'));
    setBusy(true);
    try { const ss = await register(f); setSession(ss); audit('USER_CREATE', 'user', ss.uid, { newValue: { role: 'viewer' } }); } catch (x) { setErr(authError(x, L)); } finally { setBusy(false); }
  }

  return (
    <Frame title={L('إنشاء حساب', 'Create account')} sub={L('استخدم رمز الشركة الذي أعطاك إياه مديرك', 'Use the company code from your manager')}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={L('الاسم الكامل', 'Full name')}><input className="input" autoComplete="name" required value={f.displayName} onChange={set('displayName')} /></Field>
        <Field label={L('البريد الإلكتروني', 'Email')}><input className="input ltr" style={{ textAlign: 'start' }} type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></Field>
        <div className="grid g2">
          <Field label={L('كلمة المرور', 'Password')}><input className="input" type="password" autoComplete="new-password" required value={f.password} onChange={set('password')} /></Field>
          <Field label={L('تأكيدها', 'Confirm')}><input className="input" type="password" autoComplete="new-password" required value={f.confirm} onChange={set('confirm')} /></Field>
        </div>
        <div className="field">
          <span>{L('رمز الشركة', 'Company code')}</span>
          <CodeInput value={f.joinCode} onChange={(v) => setF({ ...f, joinCode: v })} />
        </div>
        {err && <p className="err-text" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy} style={{ height: 52 }}>{busy ? <span className="spinner" /> : L('إنشاء الحساب', 'Create account')}</button>
        <p style={{ margin: 0, textAlign: 'center', fontSize: 14 }} className="muted">{L('لديك حساب؟', 'Have an account?')} <Link to="/login" style={{ fontWeight: 600 }}>{L('سجّل الدخول', 'Sign in')}</Link></p>
      </form>
    </Frame>
  );
}

/** Shown after sign-up until the user opens the confirmation link sent to their email. */
export function VerifyEmail() {
  const { L } = usePrefs();
  const { session, recheck, signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <Frame title={L('أكّد بريدك الإلكتروني', 'Confirm your email')} sub={L('خطوة أخيرة لحماية حسابك', 'One last step to protect your account')}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <span className="ico primary" style={{ width: 56, height: 56, borderRadius: 16 }}><Icon name="info" size={26} /></span>
        <p style={{ margin: 0 }}>{L('أرسلنا رابط تأكيد إلى', 'We sent a confirmation link to')}</p>
        <b className="ltr">{session?.email}</b>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{L('افتح الرسالة واضغط الرابط، ثم ارجع هنا واضغط "تم التأكيد". إذا لم تجدها تحقق من البريد المزعج (Spam).', 'Open the email and tap the link, then come back and press "I confirmed". Check Spam if you can’t find it.')}</p>
      </div>
      <button className="btn primary block" disabled={busy} style={{ height: 52 }} onClick={async () => {
        setBusy(true);
        try { if (await checkVerified()) { recheck(); toast(L('تم تأكيد بريدك', 'Email confirmed')); } else toast(L('لم يتم التأكيد بعد — افتح الرابط في رسالتك', 'Not confirmed yet — open the link in your email'), 'error'); }
        finally { setBusy(false); }
      }}>{busy ? <span className="spinner" /> : L('تم التأكيد', 'I confirmed')}</button>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" style={{ flex: 1 }} disabled={sent} onClick={async () => { try { await sendVerification(); setSent(true); toast(L('أعدنا إرسال الرابط', 'Link sent again')); } catch { toast(L('انتظر قليلاً ثم حاول', 'Please wait and try again'), 'error'); } }}>{L('إعادة الإرسال', 'Resend link')}</button>
        <button className="btn ghost" onClick={signOut}>{L('خروج', 'Sign out')}</button>
      </div>
    </Frame>
  );
}
