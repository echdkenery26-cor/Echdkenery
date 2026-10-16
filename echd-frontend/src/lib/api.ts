// Client HTTP : jeton en mémoire, rafraîchissement automatique (cookie httpOnly), erreurs normalisées.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: string[],
    /** Corps complet de la réponse d'erreur (ex. liste des doublons) */
    public data?: any,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;
export const setOnAuthLost = (fn: (() => void) | null) => {
  onAuthLost = fn;
};

const BASE = '/api';

export type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(q?: Query) {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function parse(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toError(status: number, data: any): ApiError {
  const msg = typeof data === 'string' ? data : data?.message;
  return new ApiError(status, Array.isArray(msg) ? msg.join(' ') : msg || 'Une erreur est survenue.', data?.code, data?.details, typeof data === 'object' ? data : undefined);
}

let inflight: Promise<{ accessToken: string; [k: string]: any } | null> | null = null;

/**
 * Tente d'obtenir un nouveau jeton grâce au cookie de rafraîchissement.
 * Un seul appel à la fois : le cookie tourne à chaque usage, deux appels simultanés
 * (double montage React, plusieurs requêtes qui échouent en même temps…) se partagent donc la même réponse.
 */
export function refreshSession(): Promise<{ accessToken: string; [k: string]: any } | null> {
  if (!inflight) {
    inflight = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => (r.ok ? await parse(r) : null))
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function silentRefresh(): Promise<boolean> {
  const d = await refreshSession();
  if (d?.accessToken) {
    accessToken = d.accessToken;
    return true;
  }
  return false;
}

interface Opts {
  method?: string;
  body?: unknown;
  query?: Query;
  /** Pour les routes publiques : n'envoie pas le jeton */
  anonymous?: boolean;
}

export async function api<T = any>(path: string, opts: Opts = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (accessToken && !opts.anonymous) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}${qs(opts.query)}`, {
    method: opts.method || 'GET',
    headers,
    body,
    credentials: 'include',
  });

  if (res.status === 401 && retry && !opts.anonymous && !path.startsWith('/auth/login')) {
    if (await silentRefresh()) return api<T>(path, opts, false);
    accessToken = null;
    onAuthLost?.();
  }
  const data = await parse(res);
  if (!res.ok) throw toError(res.status, data);
  return data as T;
}

export const get = <T = any>(path: string, query?: Query) => api<T>(path, { query });
export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const put = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: body ?? {} });
export const patch = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body: body ?? {} });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

/** Télécharge un fichier protégé (export Excel, sauvegarde…) avec le jeton, puis le propose à l'enregistrement. */
export async function download(path: string, query?: Query, fallbackName = 'export') {
  const doFetch = () =>
    fetch(`${BASE}${path}${qs(query)}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, credentials: 'include' });
  let res = await doFetch();
  if (res.status === 401 && (await silentRefresh())) res = await doFetch();
  if (!res.ok) throw toError(res.status, await parse(res));
  const cd = res.headers.get('content-disposition') || '';
  const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Ouvre un document imprimable (reçu, fiche, emploi du temps, bulletin) dans un nouvel onglet. */
export async function openDocument(type: string, id: string, lang: 'fr' | 'ar', term?: number) {
  // La fenêtre est ouverte tout de suite (clic de l'utilisateur) pour ne pas être bloquée par le navigateur.
  const w = window.open('', '_blank');
  try {
    const doFetch = () =>
      fetch(`${BASE}/documents/${type}/${id}${qs({ lang, term })}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: 'include',
      });
    let res = await doFetch();
    if (res.status === 401 && (await silentRefresh())) res = await doFetch();
    if (!res.ok) throw toError(res.status, await parse(res));
    let html = await res.text();
    // Les polices du document sont en chemins relatifs : on les rattache à ce site.
    html = html.replace(/<head>/i, `<head><base href="${window.location.origin}/">`);
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    if (w) w.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch (e) {
    w?.close();
    throw e;
  }
}

/** Lien temporaire (72 h) à envoyer à un parent par WhatsApp ou e-mail. */
export async function shareDocument(type: string, id: string, lang: 'fr' | 'ar', term?: number) {
  return post<{ url: string; expiresAt: string }>('/documents/share', { type, id, lang, term });
}
