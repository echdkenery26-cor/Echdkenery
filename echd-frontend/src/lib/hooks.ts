'use client';

import useSWR, { SWRConfiguration, mutate as globalMutate } from 'swr';
import { ApiError, Query, get, qs } from './api';
import { useAuth } from './auth';

/**
 * Lecture de données de l'API (avec cache et rechargement).
 * Passer `null` comme chemin met la requête en pause (ex. en attendant un identifiant).
 */
export function useApi<T = any>(path: string | null, query?: Query, config?: SWRConfiguration<T, ApiError>) {
  const { status } = useAuth();
  const key = path && status === 'authed' ? `${path}${qs(query)}` : null;
  const r = useSWR<T, ApiError>(key, () => get<T>(path!, query), {
    revalidateOnFocus: false,
    keepPreviousData: true,
    shouldRetryOnError: false,
    ...config,
  });
  return { data: r.data, error: r.error, loading: !r.data && !r.error && !!key, validating: r.isValidating, reload: () => r.mutate() };
}

/** Données publiques (sans connexion) */
export function usePublic<T = any>(path: string | null, query?: Query) {
  const key = path ? `pub:${path}${qs(query)}` : null;
  const r = useSWR<T, ApiError>(key, () => get<T>(path!, query), { revalidateOnFocus: false, shouldRetryOnError: false });
  return { data: r.data, error: r.error, loading: !r.data && !r.error && !!key };
}

/** Recharge toutes les requêtes dont l'adresse commence par l'un des préfixes donnés. */
export function invalidate(...prefixes: string[]) {
  return globalMutate((key) => typeof key === 'string' && prefixes.some((p) => key.startsWith(p)), undefined, { revalidate: true });
}

export const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Une erreur est survenue.');
