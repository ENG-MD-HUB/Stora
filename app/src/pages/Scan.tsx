import type { IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePrefs } from '../lib/prefs';
import { can } from '../lib/permissions';
import { findByCode } from '../services/inventory';
import type { Item } from '../services/types';
import { onScan } from '../lib/hwScanner';
import { useCart, useData, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/kit';

type Mode = 'release' | 'search';


export default function Scan() {
  const s = useSession();
  const { L } = usePrefs();
  const { items } = useData();
  const cart = useCart();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'search' || !can(s.role, 'release:create') ? 'search' : 'release');
  const [found, setFound] = useState<Item | null>(null);
  const [miss, setMiss] = useState('');
  const [err, setErr] = useState('');
  const [manual, setManual] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const last = useRef({ code: '', at: 0 });
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handle = (code: string) => {
    const now = Date.now();
    if (code === last.current.code && now - last.current.at < 2500) return;
    last.current = { code, at: now };
    navigator.vibrate?.(40);
    const it = findByCode(itemsRef.current, code);
    setFound(it ?? null);
    setMiss(it ? '' : code);
  };

  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState<string>(() => { try { return localStorage.getItem('stora.camera') ?? ''; } catch { return ''; } });

  // USB / Bluetooth scanner input on this page
  useEffect(() => onScan((code) => handle(code)), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (stop || !video.current) return;
        const reader = new BrowserMultiFormatReader();
        controls.current?.stop();
        const constraints: MediaStreamConstraints = { video: camId ? { deviceId: { exact: camId } } : { facingMode: 'environment' } };
        controls.current = await reader.decodeFromConstraints(constraints, video.current, (res) => { if (res) handle(res.getText()); });
        setErr('');
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!stop) setCams(list);
      } catch (e) {
        const name = (e as Error).name;
        if (camId && name === 'OverconstrainedError') { setCamId(''); return; }
        setErr(name === 'NotAllowedError' ? L('اسمح للتطبيق باستخدام الكاميرا من إعدادات المتصفح', 'Allow camera access in your browser settings') : L('لا تتوفر كاميرا — اكتب الرمز أو استخدم قارئ باركود', 'No camera — type the code or use a barcode scanner'));
      }
    })();
    return () => { stop = true; controls.current?.stop(); };
  }, [camId]); // eslint-disable-line react-hooks/exhaustive-deps

  function addFound() {
    if (!found) return;
    const r = cart.add(found);
    if (r === 'mixed') toast(L('سند الصرف يقبل مكان تخزين واحد فقط', 'One storage per release'), 'error');
    else if (r === 'exists') toast(L('الصنف موجود في السند', 'Already in release'));
    else toast(L(`أضيف: ${found.name}`, `Added: ${found.name}`));
    setFound(null);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#05070C', color: '#EEF1F7', display: 'flex', flexDirection: 'column' }}>
      <video ref={video} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
      <header style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(14px + env(safe-area-inset-top)) 14px 14px' }}>
        <button className="icon-btn" style={{ background: 'rgba(0,0,0,.45)', border: 0, color: '#fff' }} onClick={() => nav(-1)} aria-label={L('إغلاق', 'Close')}><Icon name="x" /></button>
        <div style={{ display: 'flex', padding: 4, borderRadius: 99, background: 'rgba(0,0,0,.45)' }}>
          {can(s.role, 'release:create') && <button className="fchip" style={{ border: 0, background: mode === 'release' ? '#EEF1F7' : 'transparent', color: mode === 'release' ? '#0A0E17' : '#C9D0DD' }} onClick={() => setMode('release')}>{L('صرف', 'Release')}</button>}
          <button className="fchip" style={{ border: 0, background: mode === 'search' ? '#EEF1F7' : 'transparent', color: mode === 'search' ? '#0A0E17' : '#C9D0DD' }} onClick={() => setMode('search')}>{L('بحث', 'Find')}</button>
        </div>
        {cart.entries.length > 0 ? <Link to="/release" className="icon-btn" style={{ background: 'var(--primary)', border: 0, color: 'var(--on-primary)' }} aria-label={L('سند الصرف', 'Release')}><b className="mono">{cart.entries.length}</b></Link> : <span style={{ width: 44 }} />}
      </header>

      <div style={{ position: 'relative', flex: 1, display: 'grid', placeItems: 'center', paddingBottom: 200 }}>
        <div style={{ width: 260, height: 180, position: 'relative' }} aria-hidden="true">
          {[['top', 'right'], ['top', 'left'], ['bottom', 'right'], ['bottom', 'left']].map(([v, h]) => (
            <span key={v + h} style={{ position: 'absolute', [v]: 0, [h]: 0, width: 44, height: 44, borderColor: 'var(--primary)', borderStyle: 'solid', borderWidth: 0, [`border${v[0].toUpperCase() + v.slice(1)}Width`]: 4, [`border${h[0].toUpperCase() + h.slice(1)}Width`]: 4, [`border${v[0].toUpperCase() + v.slice(1)}${h[0].toUpperCase() + h.slice(1)}Radius`]: 16 } as React.CSSProperties} />
          ))}
          <span style={{ position: 'absolute', insetInline: 22, top: 88, height: 2, background: 'var(--primary)', boxShadow: '0 0 16px var(--primary)' }} />
        </div>
      </div>

      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, padding: '12px 18px calc(22px + env(safe-area-inset-bottom))', borderRadius: '24px 24px 0 0', background: 'var(--surface)', color: 'var(--text)', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 99, background: 'var(--line)' }} />
        {found ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ico ok"><Icon name="check" stroke={2.4} /></span>
              <div className="grow"><p className="title" style={{ fontSize: 16 }}>{found.name}</p><p className="sub mono" style={{ fontSize: 12 }}>{found.sapCode || found.itemCode} · {L('المتوفر', 'Available')} {found.quantity}</p></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {mode === 'release' && found.quantity > 0 && <button className="btn primary" style={{ flex: 1 }} onClick={addFound}>{L('إضافة لسند الصرف', 'Add to release')}</button>}
              <Link to={`/item/${found.id}`} className="btn" style={mode === 'search' ? { flex: 1 } : undefined}>{L('فتح الصنف', 'Open item')}</Link>
            </div>
          </>
        ) : miss ? (
          <p style={{ margin: 0, textAlign: 'center' }}>{L('لا يوجد صنف بهذا الرمز:', 'No item with code:')} <b className="mono ltr">{miss}</b></p>
        ) : (
          <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 14 }}>{err || L('وجّه الكاميرا نحو الباركود أو رمز QR', 'Point the camera at a barcode or QR code')}</p>
        )}
        {cams.length > 1 && (
          <select className="input" value={camId} onChange={(e) => { setCamId(e.target.value); try { localStorage.setItem('stora.camera', e.target.value); } catch { /* ignore */ } }} aria-label={L('الكاميرا', 'Camera')}>
            <option value="">{L('الكاميرا الافتراضية', 'Default camera')}</option>
            {cams.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `${L('كاميرا', 'Camera')} ${i + 1}`}</option>)}
          </select>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 12, textAlign: 'center' }}>{L('يعمل أيضاً مع قارئ الباركود USB أو بلوتوث — امسح مباشرة', 'USB / Bluetooth barcode scanners work too — just scan')}</p>
        <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { last.current = { code: '', at: 0 }; handle(manual.trim()); setManual(''); } }} style={{ display: 'flex', gap: 8 }}>
          <input className="input mono" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={L('أو اكتب الرمز / SAP / الرقم التسلسلي', 'or type code / SAP / serial')} aria-label={L('رمز يدوي', 'Manual code')} />
          <button className="btn">{L('بحث', 'Find')}</button>
        </form>
      </div>
    </div>
  );
}
