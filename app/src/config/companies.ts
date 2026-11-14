// Built-in companies (same ids as STORA 2.x so existing data keeps working).
// New companies are created from the Companies page (Firestore: companies + joinCodes).
export interface BuiltInCompany {
  id: string;
  name: string;
  joinCodes: string[];
  aliases: string[];
}

export const BUILT_IN_COMPANIES: BuiltInCompany[] = [
  { id: 'company_002', name: 'مطارات جدة', joinCodes: ['JEDCO001'], aliases: ['company_001'] },
  { id: 'company_1780749182580', name: 'ICAD', joinCodes: ['ICAD0001', 'ICAD0000'], aliases: ['company_003', 'company_1780750610332'] },
];

export function builtInFor(companyId?: string | null): BuiltInCompany | null {
  if (!companyId) return null;
  return BUILT_IN_COMPANIES.find((c) => c.id === companyId || c.aliases.includes(companyId)) ?? null;
}

/** All ids that belong to the same company as `companyId`. */
export function companyGroup(companyId: string): string[] {
  const b = builtInFor(companyId);
  return b ? Array.from(new Set([companyId, b.id, ...b.aliases])) : [companyId];
}
