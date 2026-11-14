// Support for USB / Bluetooth barcode scanners.
// These scanners behave like a keyboard: they "type" the code very fast and press Enter.
// We detect that burst and emit a `stora:scan` event with the code.
import { useEffect } from 'react';

const MAX_GAP_MS = 45;   // scanners type a character every few ms; humans are much slower
const MIN_LEN = 4;

export function useHardwareScanner() {
  useEffect(() => {
    let buf = '';
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const now = performance.now();
      if (now - last > MAX_GAP_MS) buf = '';
      last = now;
      if (e.key === 'Enter') {
        if (buf.length >= MIN_LEN) {
          const code = buf;
          buf = '';
          // In a text field the scanner simply fills it (e.g. the search box); elsewhere we take over.
          if (!typing) { e.preventDefault(); window.dispatchEvent(new CustomEvent('stora:scan', { detail: code })); }
        }
        buf = '';
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) buf += e.key;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

export function onScan(fn: (code: string) => void) {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener('stora:scan', h);
  return () => window.removeEventListener('stora:scan', h);
}
