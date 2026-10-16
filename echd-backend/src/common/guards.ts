import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { ALLOW_PWD_CHANGE, AuthUser, IS_PUBLIC, ROLES_KEY } from './decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const ok = (await super.canActivate(ctx)) as boolean;
    if (!ok) return false;

    const user = ctx.switchToHttp().getRequest().user as AuthUser;
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PWD_CHANGE, targets);
    if (user.mustChangePassword && !allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'MUST_CHANGE_PASSWORD',
        message: 'Vous devez changer votre mot de passe avant de continuer.',
      });
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets) ?? [Role.ADMIN, Role.MANAGER];
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException("Vous n'avez pas les droits pour cette action.");
    }
    return true;
  }
}
