import { Link } from 'react-router-dom';
import { hasFeature } from '../config/app';
import { fmtAgo, greeting } from '../lib/format';
import { usePrefs } from '../lib/prefs';
import { can, isManager, roleLabel } from '../lib/permissions';
import { fetchRecentMovements, stockLevel } from '../services/inventory';
import { fetchUsers, isPending } from '../services/users';
import { useAuth, useData, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { useLoad } from '../ui/kit';

export function Home() {
  const s = useSession();
  const { company } = useAuth();
  const { L, lang } = usePrefs();
  const { items, warehouses, loading } = useData();
  const mgr = isManager(s.role);
  const users = useLoad(() => (mgr ? fetchUsers(s.companyId) : Promise.resolve([])), [s.companyId, mgr]);
  const moves = useLoad(() => fetchRecentMovements(s.companyId, 6), [s.companyId]);

  const low = items.filter((i) => stockLevel(i) === 'low').length;
  const out = items.filter((i) => stockLevel(i) === 'out').length;
  const pending = (users.data ?? []).filter((u) => isPending(u, s.companyId)).length;
  const today = (moves.data ?? []).filter((m) => m.type === 'withdraw').length;
  const name = s.displayName.split(' ')[0];

  const attention = [
    pending > 0 && { to: '/team', cls: 'primary', icon: 'userPlus', title: L(`${pending} موظفين جدد`, `${pending} new employees`), sub: L('بانتظار تحديد الصلاحيات', 'Waiting for permissions') },
    low > 0 && { to: '/inventory?f=low', cls: 'low', icon: 'warn', title: L(`${low} أصناف منخفضة`, `${low} low items`), sub: L('أقل من الحد الأدنى', 'Below minimum') },
    out > 0 && { to: '/inventory?f=out', cls: 'out', icon: 'x', title: L(`${out} أصناف نفدت`, `${out} out of stock`), sub: L('الكمية صفر', 'Quantity is zero') },
  ].filter(Boolean) as { to: string; cls: string; icon: string; title: string; sub: string }[];

  return (
    <>
      <div className="head">
        <div className="grow">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{company} · {roleLabel(s.role, L)}</p>
          <h1 className="h1">{greeting(lang)}{lang === 'ar' ? '، ' : ', '}{name}</h1>
        </div>
        <Link to="/more" className="icon-btn mobile-only" aria-label={L('الإعدادات', 'Settings')}><Icon name="settings" size={19} /></Link>
      </div>

      {s.pendingApproval && (
        <div className="callout">
          <Icon name="info" size={22} />
          <div><b>{L('حسابك جاهز', 'Your account is ready')}</b><p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>{L('سيحدد مديرك دورك وأماكن التخزين قريباً، وستظهر بياناتك هنا بعد ذلك.', 'Your manager will assign your role and storages shortly.')}</p></div>
        </div>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="section-title">{L('يحتاج انتباهك', 'Needs attention')}</h2>
        {attention.length ? (
          <div className="list">
            {attention.map((a) => (
              <Link key={a.to} to={a.to} className="row">
                <span className={`ico ${a.cls}`}><Icon name={a.icon} size={19} /></span>
                <span className="grow"><p className="title">{a.title}</p><p className="sub">{a.sub}</p></span>
                <Icon name={lang === 'ar' ? 'fwd' : 'back'} size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="ico ok"><Icon name="check" size={19} stroke={2.4} /></span>
            <span className="grow"><p className="title">{loading ? L('جارٍ التحميل…', 'Loading…') : L('كل شيء على ما يرام', 'All good')}</p><p className="sub">{L('لا توجد تنبيهات حالياً', 'No alerts right now')}</p></span>
          </div>
        )}
      </section>

      <section className="grid g3">
        {can(s.role, 'release:create') && <Link to="/release" className="quick primary"><Icon name="bag" size={22} stroke={2} />{L('صرف مواد', 'Release')}</Link>}
        {can(s.role, 'item:create') && <Link to="/inventory?new=1" className="quick"><Icon name="plus" size={22} stroke={2} />{L('إضافة صنف', 'Add item')}</Link>}
        {hasFeature('barcodeScanner') && <Link to="/scan" className="quick"><Icon name="scan" size={22} stroke={2} />{L('مسح باركود', 'Scan')}</Link>}
        {!can(s.role, 'item:create') && <Link to="/inventory" className="quick"><Icon name="box" size={22} stroke={2} />{L('المخزون', 'Inventory')}</Link>}
      </section>

      <div className="split">
        <section className="grid g3" style={{ alignContent: 'start' }}>
          <Link to="/storages" className="card stat"><p>{L('أماكن التخزين', 'Storages')}</p><b>{warehouses.length}</b></Link>
          <Link to="/inventory" className="card stat"><p>{L('الأصناف', 'Items')}</p><b>{items.length}</b></Link>
          <Link to="/releases" className="card stat"><p>{L('صرف حديث', 'Recent out')}</p><b>{today}</b></Link>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="section-title">{L('آخر الحركات', 'Latest movements')}</h2>
          <div className="list">
            {(moves.data ?? []).length === 0 && <p className="muted" style={{ margin: 0, padding: 16, fontSize: 14 }}>{moves.loading ? L('جارٍ التحميل…', 'Loading…') : L('لا توجد حركات بعد', 'No movements yet')}</p>}
            {(moves.data ?? []).map((m) => {
              const it = items.find((i) => i.id === m.itemId);
              const diff = m.quantityAfter - m.quantityBefore;
              const cls = m.type === 'withdraw' ? 'low' : diff >= 0 ? 'ok' : 'low';
              return (
                <Link key={m.id} to={`/item/${m.itemId}`} className="row">
                  <span className={`ico ${cls}`} style={{ width: 32, height: 32 }}><Icon name={diff < 0 ? 'down' : 'up'} size={15} stroke={2.2} /></span>
                  <span className="grow"><p className="title" style={{ fontSize: 14 }}>{it?.name ?? L('صنف', 'Item')}</p><p className="sub" style={{ fontSize: 12 }}>{m.performedByName}</p></span>
                  <span className="mono ltr" style={{ fontSize: 13, color: diff < 0 ? 'var(--low)' : 'var(--ok)' }}>{diff > 0 ? '+' : ''}{diff}</span>
                  <span className="muted" style={{ fontSize: 12, minWidth: 40, textAlign: 'end' }}>{fmtAgo(m.createdAt, lang)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
