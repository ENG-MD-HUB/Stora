import type { TS } from '../lib/format';
import type { Role } from '../lib/permissions';

export interface Session {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  companyId: string;
  assignedWarehouseIds: string[];
  isActive: boolean;
  pendingApproval: boolean;
}

export interface UserDoc {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  companyId: string;
  assignedWarehouseIds?: string[];
  isActive: boolean;
  pendingApproval?: boolean;
  createdAt?: TS;
  lastLoginAt?: TS;
}

export interface Warehouse {
  id: string;
  companyId: string;
  name: string;
  code: string;
  location: string;
  department: string;
  storageType: string;
  notes?: string;
  status: 'active' | 'archived';
  createdAt?: TS;
}

export interface Item {
  id: string;
  companyId: string;
  warehouseId: string;
  internalId?: string;
  itemCode?: string;
  name: string;
  projectName: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  owner: string;
  notes?: string;
  status: 'active' | 'archived';
  entryDate?: TS;
  expiryDate?: TS;
  createdAt?: TS;
  updatedAt?: TS;
  // ITSM / SAP fields (optional, same names as STORA 2.x)
  employeeNumber?: string;
  modelCategory?: string;
  model?: string;
  serialNumber?: string;
  assetsTag?: string;
  sapCode?: string;
  requestType?: string;
  poNumber?: string;
  dnNumber?: string;
}

export type MovementType = 'add' | 'withdraw' | 'edit' | 'return';

export interface Movement {
  id: string;
  companyId: string;
  itemId: string;
  warehouseId: string;
  type: MovementType;
  quantityBefore: number;
  quantityAfter: number;
  performedBy: string;
  performedByName: string;
  requesterName?: string;
  reason?: string;
  destination?: string;
  notes?: string;
  createdAt?: TS;
}

export interface ReleaseLine {
  itemId: string;
  itemName: string;
  sapCode: string;
  modelNo: string;
  serialNumber: string;
  qtyReleased: number;
  qtyRemaining: number;
  description: string;
}

export interface Release {
  id: string;
  companyId: string;
  releaseNumber: string;
  warehouseId: string;
  warehouseName: string;
  ticketNo: string;
  dnNumber: string;
  poNumber: string;
  installLocation: string;
  reason: string;
  requesterName?: string;
  items: ReleaseLine[];
  releasedBy: string;
  releasedByName: string;
  status: 'active' | 'cancelled';
  createdAt?: TS;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  userDisplayName: string;
  action: string;
  entity: string;
  entityId: string | null;
  newValue?: unknown;
  previousValue?: unknown;
  createdAt?: TS;
}

export interface Signatory { role: string; title: string; name: string }
