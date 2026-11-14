import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PrefsProvider } from './lib/prefs';
import { can, type Permission } from './lib/permissions';
import { AuthProvider, CartProvider, DataProvider, useAuth } from './state/app';
import { Layout } from './ui/Layout';
import { Loading, ToastProvider } from './ui/kit';
import { Login, Register } from './pages/Auth';
import { Home } from './pages/Home';
import { Inventory } from './pages/Inventory';
import { ItemPage } from './pages/ItemPage';

const Storages = lazy(() => import('./pages/Storages'));
const ReleaseNew = lazy(() => import('./pages/Release').then((m) => ({ default: m.ReleaseNew })));
const Releases = lazy(() => import('./pages/Release').then((m) => ({ default: m.Releases })));
const ReleaseView = lazy(() => import('./pages/Release').then((m) => ({ default: m.ReleaseView })));
const Team = lazy(() => import('./pages/Team'));
const Reports = lazy(() => import('./pages/Reports'));
const Logs = lazy(() => import('./pages/Logs'));
const Settings = lazy(() => import('./pages/Settings'));
const Companies = lazy(() => import('./pages/Companies'));
const Scan = lazy(() => import('./pages/Scan'));
const More = lazy(() => import('./pages/More'));

function Guard({ children, perm, superOnly }: { children: ReactNode; perm?: Permission; superOnly?: boolean }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (superOnly && session.role !== 'super_admin') return <Navigate to="/" replace />;
  if (perm && !can(session.role, perm)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Gate() {
  const { session, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!session) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  const sup = session.role === 'super_admin';
  return (
    <DataProvider>
      <CartProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={sup ? <Navigate to="/companies" replace /> : <Home />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="item/:id" element={<ItemPage />} />
              <Route path="storages" element={<Storages />} />
              <Route path="release" element={<Guard perm="release:create"><ReleaseNew /></Guard>} />
              <Route path="releases" element={<Releases />} />
              <Route path="releases/:id" element={<ReleaseView />} />
              <Route path="team" element={<Guard perm="user:manage"><Team /></Guard>} />
              <Route path="reports" element={<Guard perm="report:view"><Reports /></Guard>} />
              <Route path="logs" element={<Guard perm="log:view"><Logs /></Guard>} />
              <Route path="settings" element={<Settings />} />
              <Route path="companies" element={<Guard superOnly><Companies /></Guard>} />
              <Route path="scan" element={<Scan />} />
              <Route path="more" element={<More />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </CartProvider>
    </DataProvider>
  );
}

export function App() {
  return (
    <PrefsProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Gate />
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </PrefsProvider>
  );
}
