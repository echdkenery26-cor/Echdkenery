import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';
export const ALLOW_PWD_CHANGE = 'allowPwdChange';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: Role;
  language: string;
  teacherId: string | null;
  mustChangePassword: boolean;
}

/** Route accessible sans connexion. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Rôles autorisés. Sans décorateur, une route est réservée à ADMIN + MANAGER
 * (un enseignant n'a donc jamais accès par défaut : sécurité par défaut).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const AdminOnly = () => Roles(Role.ADMIN);
export const StaffOnly = () => Roles(Role.ADMIN, Role.MANAGER);
export const AnyRole = () => Roles(Role.ADMIN, Role.MANAGER, Role.TEACHER);

/** Autorise la route même si l'utilisateur doit encore changer son mot de passe. */
export const AllowPasswordChange = () => SetMetadata(ALLOW_PWD_CHANGE, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return req.ip || req.socket?.remoteAddress || '';
});

export const userLabel = (u: Pick<AuthUser, 'firstName' | 'lastName' | 'username'>) =>
  `${u.firstName} ${u.lastName}`.trim() || u.username;
