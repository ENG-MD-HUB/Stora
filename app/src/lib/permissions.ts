export type Role = 'super_admin' | 'manager' | 'data_entry' | 'viewer';

export type Permission =
  | 'warehouse:manage'
  | 'item:create' | 'item:edit' | 'item:withdraw' | 'item:archive' | 'item:delete'
  | 'release:create' | 'release:cancel'
  | 'user:manage' | 'log:view' | 'report:view' | 'excel:export'
  | 'settings:company' | 'company:manage';

const MAP: Record<Role, Permission[]> = {
  super_admin: ['warehouse:manage', 'item:create', 'item:edit', 'item:withdraw', 'item:archive', 'item:delete', 'release:create', 'release:cancel', 'user:manage', 'log:view', 'report:view', 'excel:export', 'settings:company', 'company:manage'],
  manager: ['warehouse:manage', 'item:create', 'item:edit', 'item:withdraw', 'item:archive', 'item:delete', 'release:create', 'release:cancel', 'user:manage', 'log:view', 'report:view', 'excel:export', 'settings:company'],
  data_entry: ['item:create', 'item:edit', 'item:withdraw', 'release:create', 'report:view', 'excel:export'],
  viewer: ['report:view'],
};

export const can = (role: Role | undefined, p: Permission) => !!role && MAP[role].includes(p);
export const isManager = (role?: Role) => role === 'manager' || role === 'super_admin';

export function roleLabel(role: Role | string | undefined, L: (a: string, e: string) => string) {
  switch (role) {
    case 'super_admin': return L('المشرف العام', 'Super Admin');
    case 'manager': return L('مدير', 'Manager');
    case 'data_entry': return L('إدخال بيانات', 'Data Entry');
    default: return L('مشاهد', 'Viewer');
  }
}
