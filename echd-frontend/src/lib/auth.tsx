'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, post, refreshSession, setAccessToken, setOnAuthLost } from './api';

export type Role = 'ADMIN' | 'MANAGER' | 'TEACHER';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  language: string;
  teacherId: string | null;
  mustChangePassword?: boolean;
}

type Status = 'loading' | 'anon' | 'authed';

interface AuthCtx {
  status: Status;
  user: AuthUser | null;
  mustChangePassword: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** À appeler après un changement de mot de passe réussi */
  passwordChanged: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const DEFAULT_IDLE_MIN = 30;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [must, setMust] = useState(false);
  const idleMin = useRef(DEFAULT_IDLE_MIN);
  const lastActivity = useRef(Date.now());

  const apply = useCallback((d: any) => {
    setAccessToken(d.accessToken);
    setUser(d.user);
    setMust(!!d.mustChangePassword);
    if (d.inactivityMinutes) idleMin.current = d.inactivityMinutes;
    setStatus('authed');
  }, []);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setMust(false);
    setStatus('anon');
  }, []);

  // Au chargement : on tente de reprendre la session grâce au cookie.
  useEffect(() => {
    let alive = true;
    refreshSession().then((d) => {
      if (!alive) return;
      if (d?.accessToken) apply(d);
      else clear();
    });
    setOnAuthLost(clear);
    return () => {
      alive = false;
      setOnAuthLost(null);
    };
  }, [apply, clear]);

  // Déconnexion après inactivité (le serveur applique aussi la même règle).
  useEffect(() => {
    if (status !== 'authed') return;
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(async () => {
      if (Date.now() - lastActivity.current > idleMin.current * 60_000) {
        await post('/auth/logout').catch(() => {});
        clear();
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [status, clear]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const d = await api('/auth/login', { method: 'POST', body: { identifier, password }, anonymous: true });
      apply(d);
      return d.user as AuthUser;
    },
    [apply],
  );

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => {});
    clear();
  }, [clear]);

  const reload = useCallback(async () => {
    const d = await refreshSession();
    if (d?.accessToken) apply(d);
  }, [apply]);

  const value = useMemo<AuthCtx>(
    () => ({
      status,
      user,
      mustChangePassword: must,
      isStaff: user?.role === 'ADMIN' || user?.role === 'MANAGER',
      isAdmin: user?.role === 'ADMIN',
      isTeacher: user?.role === 'TEACHER',
      login,
      logout,
      passwordChanged: reload,
      reload,
    }),
    [status, user, must, login, logout, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return c;
}
