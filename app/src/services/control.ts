// Link to the ENG-MD-HUB control center (https://eng-md-hub.github.io/control/).
// The control center owns STORA's companies and join codes. Every call here is
// fail-open: if the control center is slow or down, STORA keeps working.
import { APP, CONTROL } from '../config/app';

const TIMEOUT_MS = 3000;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${CONTROL.url}/rest/v1/rpc/${fn}`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', apikey: CONTROL.publishableKey, Authorization: `Bearer ${CONTROL.publishableKey}` },
      body: JSON.stringify(args),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; } finally { clearTimeout(t); }
}

/** undefined = control center unreachable (caller falls back); null = code not valid. */
export async function controlResolveCode(code: string): Promise<{ companyId: string; name: string } | null | undefined> {
  const r = await rpc<{ ok: boolean; company_id?: string; name?: string }>('stora_resolve_code', { p_code: code });
  if (!r) return undefined;
  return r.ok && r.company_id ? { companyId: r.company_id, name: r.name ?? '' } : null;
}

/** False only when the control center explicitly says the company is disabled. */
export async function controlCompanyActive(companyId: string): Promise<{ active: boolean; name?: string }> {
  const r = await rpc<{ ok: boolean; known: boolean; active: boolean; name?: string }>('stora_company_state', { p_id: companyId });
  if (!r || !r.known) return { active: true };
  return { active: r.active, name: r.name };
}

/** Usage heartbeat (install id, version, platform — no personal data). Needs the app key. */
export function startControlHeartbeat() {
  if (!CONTROL.appKey) return;
  import(/* @vite-ignore */ `${CONTROL.sdkUrl}`)
    .then((m: { startControl?: (o: { key: string; version: string }) => void }) => m.startControl?.({ key: CONTROL.appKey, version: APP.version }))
    .catch(() => { /* optional */ });
}
