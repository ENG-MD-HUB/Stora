import { APP } from '../config/app';
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

/** Header and footer used on printed documents (release form, reports). */
export function PrintHeader({ title, company, meta }: { title: string; company: string; meta?: React.ReactNode }) {
  return (
    <div dir="ltr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 10, color: '#000' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={`${base}brand/stora-icon.png`} alt="" style={{ width: 38, height: 38, objectFit: 'contain' }} />
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, letterSpacing: '.25em', fontSize: 15 }}>STORA</div>
          <div style={{ fontSize: 10, color: '#444' }}>Warehouse Management · {company}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 700 }}>{title}</div>
      <div style={{ textAlign: 'right', fontSize: 11 }}>{meta}</div>
    </div>
  );
}

export function PrintFooter() {
  return (
    <div dir="ltr" style={{ marginTop: 18, paddingTop: 6, borderTop: '1px solid #999', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#555' }}>
      <span>STORA {APP.version} · {new Date().toLocaleString('en-GB')}</span>
      <PoweredBy height={9} print />
    </div>
  );
}
