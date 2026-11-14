import { doc, getDoc } from 'firebase/firestore';
import { useState } from 'react';
import { builtInFor } from '../config/companies';
import { COL, db } from '../config/firebase';
import { fmtAgo } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { roleLabel, type Role } from '../lib/permissions';
import type { UserDoc } from '../services/types';
import { fetchUsers, isPending, setUserActive, updateUserAccess } from '../services/users';
import { useAuth, useData, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { Empty, Loading, Sheet, useLoad, useToast } from '../ui/kit';

const ROLES: Role[] = ['data_entry', 'viewer', 'manager'];

function AccessSheet({ user, onClose, onSaved }: { user: UserDoc; onClose: () => void; onSaved: () => void }) {
  const { L } = usePrefs();
  const { warehouses } = useData();
  const toast = useToast();
  const [role, setRole] = useState<Role>(user.role === 'super_admin' ? 'manager' : user.role);
  const [whs, setWhs] = useState<string[]>(user.assignedWarehouseIds ?? []);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setWhs((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));

  async function save() {
    setBusy(true);
    try { await updateUserAccess(user.id, role, whs); toast(L('تم حفظ الصلاحيات', 'Access saved')); onSaved(); }
    catch { toast(L('تعذّر الحفظ', 'Could not save'), 'error'); } finally { setBusy(false); }
  }

  return (
    <Sheet title={user.displayName} onClose={onClose} footer={<><button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : L('حفظ', 'Save')}</button><button className="btn" onClick={onClose}>{L('إلغاء', 'Cancel')}</button></>}>
      <p className="muted ltr" style={{ margin: 0, textAlign: 'start' }}>{user.email}</p>
      <div className="field"><span>{L('الدور', 'Role')}</span>
        <div className="grid g3">{ROLES.map((r) => <button key={r} type="button" className={`btn sm ${role === r ? 'primary' : ''}`} onClick={() => setRole(r)}>{roleLabel(r, L)}</button>)}</div>
        <small className="muted" style={{ fontSize: 12.5 }}>{role === 'manager' ? L('المدير يرى كل شيء ويدير الفريق.', 'Managers see everything and manage the team.') : role === 'data_entry' ? L('يضيف ويصرف ويُصدر السندات.', 'Adds, withdraws and issues releases.') : L('يشاهد المخزون فقط.', 'Read-only access.')}</small>
      </div>
      {role !== 'manager' && warehouses.length > 0 && (
        <div className="field"><span>{L('أماكن التخزين', 'Storages')} <small>{L('بدون اختيار = كل الأماكن', 'none selected = all')}</small></span>
          <div className="filters" style={{ flexWrap: 'wrap' }}>{warehouses.map((w) => <button key={w.id} type="button" className={`fchip ${whs.includes(w.id) ? 'on' : ''}`} onClick={() => toggle(w.id)}>{w.name}</button>)}</div>
        </div>
      )}
    </Sheet>
  );
}

export default function Team() {
  const s = useSession();
  const { company } = useAuth();
  const { L, lang } = usePrefs();
  const toast = useToast();
  const users = useLoad(() => fetchUsers(s.companyId), [s.companyId]);
  const code = useLoad(async () => {
    const b = builtInFor(s.companyId);
    if (b) return b.joinCodes[0];
    try { return String((await getDoc(doc(db, COL.companies, s.companyId))).data()?.joinCode ?? ''); } catch { return ''; }
  }, [s.companyId]);
  const [edit, setEdit] = useState<UserDoc | null>(null);
  const [busyId, setBusyId] = useState('');

  const all = users.data ?? [];
  const pending = all.filter((u) => u.id !== s.uid && isPending(u, s.companyId) && u.isActive);
  const members = all.filter((u) => !pending.includes(u));

  async function quickApprove(u: UserDoc, role: Role) {
    setBusyId(u.id);
    try { await updateUserAccess(u.id, role, []); toast(L(`تم اعتماد ${u.displayName}`, `${u.displayName} approved`)); users.reload(); }
    catch { toast(L('تعذّر الحفظ', 'Could not save'), 'error'); } finally { setBusyId(''); }
  }
  async function share() {
    const text = L(`رمز الانضمام إلى ${company} في STORA: ${code.data}`, `Join ${company} on STORA with code: ${code.data}`);
    try { if (navigator.share) await navigator.share({ text, url: location.origin + location.pathname }); else { await navigator.clipboard.writeText(code.data ?? ''); toast(L('تم النسخ', 'Copied')); } } catch { /* cancelled */ }
  }

  return (
    <>
      <div><h1 className="h1">{L('الفريق', 'Team')}</h1><p className="muted" style={{ margin: 0, fontSize: 13 }}>{company} · {L(`${all.length} عضو`, `${all.length} members`)}</p></div>

      {code.data && (
        <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderStyle: 'dashed' }}>
          <div className="grow"><p className="muted" style={{ margin: 0, fontSize: 12 }}>{L('رمز الانضمام للموظفين الجدد', 'Join code for new employees')}</p><p className="mono ltr" style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 600, letterSpacing: '.18em', textAlign: 'start' }}>{code.data}</p></div>
          <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(code.data ?? ''); toast(L('تم النسخ', 'Copied')); }}><Icon name="copy" size={16} />{L('نسخ', 'Copy')}</button>
          <button className="icon-btn" onClick={share} aria-label={L('مشاركة', 'Share')}><Icon name="share" size={18} /></button>
        </div>
      )}

      {users.loading && !users.data ? <Loading /> : (
        <>
          {pending.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 className="section-title" style={{ color: 'var(--low)' }}>{L(`بانتظار الصلاحيات · ${pending.length}`, `Waiting for access · ${pending.length}`)}</h2>
              {pending.map((u) => (
                <div key={u.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'color-mix(in srgb, var(--low) 45%, transparent)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="ico low" style={{ fontWeight: 700 }}>{u.displayName.trim().charAt(0)}</span>
                    <div className="grow"><p className="title">{u.displayName}</p><p className="sub">{L('سجّل', 'Joined')} {fmtAgo(u.createdAt, lang)} · <span className="ltr">{u.email}</span></p></div>
                  </div>
                  <div className="grid g3">
                    {ROLES.map((r) => <button key={r} className={`btn sm ${r === 'data_entry' ? 'primary' : ''}`} disabled={busyId === u.id} onClick={() => quickApprove(u, r)}>{roleLabel(r, L)}</button>)}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn sm ghost" style={{ flex: 1 }} onClick={() => setEdit(u)}>{L('تحديد أماكن التخزين…', 'Choose storages…')}</button>
                    <button className="btn sm danger" disabled={busyId === u.id} onClick={async () => { await setUserActive(u.id, false); toast(L('تم الرفض', 'Rejected')); users.reload(); }}>{L('رفض', 'Reject')}</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="section-title">{L('الأعضاء', 'Members')}</h2>
            {members.length === 0 ? <Empty icon="users" title={L('لا يوجد أعضاء بعد', 'No members yet')} text={L('شارك رمز الانضمام مع موظفيك.', 'Share the join code with your staff.')} /> : (
              <div className="list">
                {members.map((u) => (
                  <div key={u.id} className="row">
                    <span className="ico plain" style={{ fontWeight: 700, opacity: u.isActive ? 1 : 0.5 }}>{u.displayName.trim().charAt(0)}</span>
                    <div className="grow" style={{ opacity: u.isActive ? 1 : 0.6 }}>
                      <p className="title">{u.displayName} {u.id === s.uid && <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>({L('أنت', 'you')})</span>}</p>
                      <p className="sub">{!u.isActive ? L('معطّل', 'Disabled') : u.assignedWarehouseIds?.length ? L(`${u.assignedWarehouseIds.length} أماكن تخزين`, `${u.assignedWarehouseIds.length} storages`) : L('كل الأماكن', 'All storages')}</p>
                    </div>
                    <span className={`chip ${u.role === 'manager' ? 'info' : 'plain'}`}>{roleLabel(u.role, L)}</span>
                    {u.id !== s.uid && u.role !== 'super_admin' && (
                      <>
                        <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => setEdit(u)} aria-label={L('تعديل', 'Edit')}><Icon name="edit" size={16} /></button>
                        <button className="icon-btn" style={{ width: 38, height: 38, color: u.isActive ? 'var(--out)' : 'var(--ok)' }} onClick={async () => { await setUserActive(u.id, !u.isActive); toast(u.isActive ? L('تم التعطيل', 'Disabled') : L('تم التفعيل', 'Enabled')); users.reload(); }} aria-label={u.isActive ? L('تعطيل', 'Disable') : L('تفعيل', 'Enable')}><Icon name={u.isActive ? 'x' : 'check'} size={16} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {edit && <AccessSheet user={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); users.reload(); }} />}
    </>
  );
}
