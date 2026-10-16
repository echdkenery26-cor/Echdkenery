'use client';

import { useApi } from './hooks';

export interface Lookups {
  levels: Array<{ id: string; code?: string; labelFr: string; labelAr: string; order: number; active?: boolean }>;
  rooms: Array<{ id: string; name: string; nameAr?: string | null; capacity?: number | null; active?: boolean }>;
  schoolYears: Array<{ id: string; name: string; startDate: string; endDate: string; isCurrent: boolean }>;
  currentSchoolYear: { id: string; name: string; startDate: string; endDate: string } | null;
  courses: Array<{ id: string; titleFr: string; titleAr: string; audience: string; category?: string; active: boolean; color?: string | null }>;
  classes: Array<{ id: string; name: string; courseId: string; teacherId: string | null; schoolYearId: string; capacity: number; active: boolean; roomId: string | null }>;
  teachers: Array<{ id: string; firstName: string; lastName: string; active: boolean }>;
  settings: Record<string, any>;
}

/** Listes de référence (niveaux, salles, cours, classes…) partagées par les formulaires. */
export function useLookups() {
  const r = useApi<Lookups>('/lookups', undefined, { revalidateOnFocus: false, dedupingInterval: 20_000 });
  return { ...r, lk: r.data };
}
