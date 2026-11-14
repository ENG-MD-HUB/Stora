// Optional, privacy-respecting hooks for a future central monitoring platform.
// No names, emails or phone numbers are collected. Failure never affects the app.
import { APP, FEATURES, TELEMETRY_ENDPOINT } from '../config/app';

const KEY = 'stora.installId';

/** Random installation id stored on this device (not a fingerprint; resets if storage is cleared). */
export function installId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
    return id;
  } catch { return 'unknown'; }
}

export function deviceInfo() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Windows/i.test(ua) ? 'windows' : /Mac/i.test(ua) ? 'macos' : /Linux/i.test(ua) ? 'linux' : 'other';
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return { os, standalone, lang: document.documentElement.lang, screen: `${screen.width}x${screen.height}` };
}

export function track(event: string, props: Record<string, string | number | boolean> = {}) {
  if (!FEATURES.telemetry || !TELEMETRY_ENDPOINT) return;
  const body = JSON.stringify({ app: APP.id, version: APP.version, install: installId(), event, props, device: deviceInfo(), at: new Date().toISOString() });
  try { navigator.sendBeacon?.(TELEMETRY_ENDPOINT, body); } catch { /* optional */ }
}

export function initTelemetry() {
  installId();
  track('app_open');
  window.addEventListener('error', (e) => track('error', { message: String(e.message).slice(0, 200) }));
  window.addEventListener('unhandledrejection', (e) => track('error', { message: String(e.reason).slice(0, 200) }));
}
