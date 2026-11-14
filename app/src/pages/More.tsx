import { Link } from 'react-router-dom';
import { usePrefs } from '../lib/prefs';
import { roleLabel } from '../lib/permissions';
import { useAuth, useSession } from '../state/app';
import { Icon } from '../ui/Icon';
import { useNav } from '../ui/Layout';

/** Mobile "More" menu: everything that is not in the bottom bar. */
export default function More() {
  const s = useSession();
  const { company, signOut } = useAuth();
  const { L, lang } = usePrefs();
  const nav = useNav().filter((n) => !['/', '/inventory', '/releases'].includes(n.to));
  return (
    <>
      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="ico plain" style={{ width: 48, height: 48, fontSize: 18, fontWeight: 700 }}>{s.displayName.trim().charAt(0)}</span>
        <div className="grow"><p className="title">{s.displayName}</p><p className="sub">{roleLabel(s.role, L)} · {company}</p></div>
      </div>
      <div className="list">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className="row">
            <span className="ico plain"><Icon name={n.icon} size={19} /></span>
            <span className="grow title">{n.label}</span>
            <Icon name={lang === 'ar' ? 'fwd' : 'back'} size={18} />
          </Link>
        ))}
      </div>
      <button className="btn danger block" onClick={signOut}><Icon name="logout" size={18} />{L('تسجيل الخروج', 'Sign out')}</button>
    </>
  );
}
