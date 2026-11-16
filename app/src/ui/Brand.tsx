import { APP } from '../config/app';
import { useBranding } from '../services/branding';
import { useSession } from '../state/app';
import { Logo } from './Icon';

const base = import.meta.env.BASE_URL;

/** "Powered by MD Systems" — picks the logo that fits the current theme. */
export function PoweredBy({ height = 14, print = false }: { height?: number; print?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: print ? '#555' : 'var(--muted)', letterSpacing: '.04em' }} dir="ltr">
      Powered by
      {print ? (
        <img src={`${base}brand/mdsystems-dark.png`} alt="MD Systems" style={{ height }} />
      ) : (
        <>
          <img className="on-light" src={`${base}brand/mdsystems-dark.png`} alt="MD Systems" style={{ height }} />
          <img className="on-dark" src={`${base}brand/mdsystems-light.png`} alt="MD Systems" style={{ height }} />
        </>
      )}
    </span>
  );
}

/** Site footer shown under every page. */
export function SiteFooter() {
  return (
    <footer className="site-footer no-print">
      <span dir="ltr" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Logo size={18} /><b className="mono" style={{ letterSpacing: '.24em', fontSize: 12 }}>STORA</b><span className="mono muted ltr" style={{ fontSize: 11 }}>{APP.version}</span></span>
      <PoweredBy />
    </footer>
  );
}

/** Small box mark drawn inline, sized to sit beside text. */
function BoxMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7zM3.5 7 12 11.5 20.5 7M12 11.5v10" />
    </svg>
  );
}

/** Header used on printed documents: company logos in the two top corners, title in the middle. */
export function PrintHeader({ title, company, meta }: { title: string; company: string; meta?: React.ReactNode }) {
  const s = useSession();
  const { branding } = useBranding(s.companyId);
  const slot = (src?: string, align: 'left' | 'right' = 'left') => (
    <div style={{ width: '28%', height: 58, display: 'flex', alignItems: 'center', justifyContent: align === 'left' ? 'flex-start' : 'flex-end' }}>
      {src && <img src={src} alt="" style={{ maxHeight: 58, maxWidth: '100%', objectFit: 'contain' }} />}
    </div>
  );
  return (
    <div dir="ltr" style={{ borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 10, color: '#000' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        {slot(branding.logoLeft, 'left')}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '.02em' }}>{title}</div>
          <div style={{ fontSize: 10.5, color: '#444', marginTop: 2 }}>{company}</div>
        </div>
        {slot(branding.logoRight, 'right')}
      </div>
      {meta && <div className="print-meta" style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', fontSize: 10.5, marginTop: 6 }}>{meta}</div>}
    </div>
  );
}

export function PrintFooter() {
  return (
    <div dir="ltr" style={{ marginTop: 18, paddingTop: 6, borderTop: '1px solid #999', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#555' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><BoxMark size={10} /><b style={{ letterSpacing: '.12em' }}>STORA</b> {APP.version} · {new Date().toLocaleString('en-GB')}</span>
      <PoweredBy height={7} print />
    </div>
  );
}
