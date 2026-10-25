//echd-backend/src/modules/auth/auth.service.ts
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/decorators';
import { MailService } from '../../common/mail.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { ChangePasswordDto, UpdateMeDto } from './auth.dto';

export const REFRESH_COOKIE = 'echd_rt';
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const ROTATION_GRACE_MS = 10_000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  // hash factice pour égaliser le temps de réponse quand l'utilisateur n'existe pas
  private readonly dummyHash = bcrypt.hashSync('not-a-real-password', 10);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private settings: SettingsService,
    private audit: AuditService,
    private mail: MailService,
  ) {}

  /* ───────── Cookie de rafraîchissement ───────── */

  private cookieOptions() {
    const days = Number(process.env.REFRESH_DAYS || 30);
    const sameSite = (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none';
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production' || sameSite === 'none',
      sameSite,
      path: '/api/auth',
      maxAge: days * 86400_000,
    };
  }

  private async issueTokens(userId: string, res: Response, userAgent?: string) {
    const refresh = randomBytes(48).toString('base64url');
    const days = Number(process.env.REFRESH_DAYS || 30);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refresh),
        expiresAt: new Date(Date.now() + days * 86400_000),
        userAgent: userAgent?.slice(0, 250),
      },
    });
    res.cookie(REFRESH_COOKIE, refresh, this.cookieOptions());
    const accessToken = await this.jwt.signAsync({ sub: userId });
    return accessToken;
  }

  clearCookie(res: Response) {
    const { maxAge, ...opts } = this.cookieOptions();
    res.clearCookie(REFRESH_COOKIE, opts);
  }

  /* ───────── Connexion ───────── */

  async login(identifier: string, password: string, res: Response, ip?: string, userAgent?: string) {
    const id = identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: id }, { email: id }] },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        'Compte temporairement verrouillé après trop de tentatives. Réessayez dans quelques minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ok = await bcrypt.compare(password, user?.passwordHash ?? this.dummyHash);
    if (!user || !user.active || !ok) {
      if (user && !ok) {
        const failed = user.failedLogins + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLogins: failed >= MAX_FAILED ? 0 : failed,
            lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
          },
        });
        await this.audit.log(null, 'LOGIN_FAILED', 'User', user.id, undefined, { username: user.username }, ip);
      }
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const accessToken = await this.issueTokens(user.id, res, userAgent);
    await this.audit.log(user, 'LOGIN', 'User', user.id, undefined, undefined, ip);
    return {
      accessToken,
      user: this.publicUser(user),
      mustChangePassword: user.mustChangePassword,
      inactivityMinutes: await this.settings.get<number>('security.inactivityMinutes'),
    };
  }

  /* ───────── Rafraîchissement (rotation + inactivité) ───────── */

  async refresh(token: string | undefined, res: Response, userAgent?: string) {
    if (!token) throw new UnauthorizedException('Session expirée.');
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!row) {
      this.clearCookie(res);
      throw new UnauthorizedException('Session expirée.');
    }
    if (row.revokedAt) {
      // Jeton roulé il y a quelques secondes (deux onglets ou deux requêtes qui se croisent) : ce n'est pas un vol.
      // Une rotation marque revokedAt == lastUsedAt ; une déconnexion ou un changement de mot de passe ne le fait pas.
      const rotated = row.revokedAt.getTime() === row.lastUsedAt.getTime();
      if (rotated && Date.now() - row.revokedAt.getTime() < ROTATION_GRACE_MS && row.user.active) {
        const accessToken = await this.issueTokens(row.userId, res, userAgent);
        return {
          accessToken,
          user: this.publicUser(row.user),
          mustChangePassword: row.user.mustChangePassword,
          inactivityMinutes: await this.settings.get<number>('security.inactivityMinutes'),
        };
      }
      // Réutilisation tardive d'un jeton déjà roulé : vol possible → on coupe toutes les sessions de l'utilisateur
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.clearCookie(res);
      throw new UnauthorizedException('Session expirée.');
    }
    const idleMin = await this.settings.get<number>('security.inactivityMinutes');
    const idle = Date.now() - row.lastUsedAt.getTime() > idleMin * 60_000;
    if (row.expiresAt < new Date() || idle || !row.user.active) {
      await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
      this.clearCookie(res);
      throw new UnauthorizedException(idle ? 'Déconnecté après une période d’inactivité.' : 'Session expirée.');
    }
    const now = new Date();
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: now, lastUsedAt: now } });
    const accessToken = await this.issueTokens(row.userId, res, userAgent);
    return {
      accessToken,
      user: this.publicUser(row.user),
      mustChangePassword: row.user.mustChangePassword,
      inactivityMinutes: idleMin,
    };
  }

  async logout(token: string | undefined, res: Response) {
    if (token) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.clearCookie(res);
    return { ok: true };
  }

  /* ───────── Mot de passe ───────── */

  /**
   * Répond immédiatement et identiquement, que l'adresse existe ou non : le travail (base + e-mail) se fait en
   * arrière-plan, pour qu'on ne puisse pas deviner les comptes existants en mesurant le temps de réponse.
   */
  async forgotPassword(email: string) {
    void this.sendResetLink(email).catch((e) => this.logger.error(`Mot de passe oublié : ${(e as Error).message}`));
    return { ok: true };
  }

  private async sendResetLink(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user?.active || !user.email) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) },
    });
    const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${base}/fr/reset-password?token=${token}`;
    const school = (await this.settings.get<{ fr: string }>('institute.name')).fr;
    await this.mail.send({
      to: user.email,
      subject: `${school} — Réinitialisation du mot de passe`,
      text:
        `Bonjour ${user.firstName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\n` +
        `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.\n\n` +
        `السلام عليكم، لتعيين كلمة مرور جديدة افتح الرابط أعلاه (صالح لمدة ساعة).`,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const row = await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Lien invalide ou expiré. Refaites une demande.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 11);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null },
      }),
      this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log(null, 'PASSWORD_RESET', 'User', row.userId);
    return { ok: true };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto, res: Response, currentToken?: string) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(dto.currentPassword, row.passwordHash))) {
      throw new BadRequestException('Mot de passe actuel incorrect.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien.");
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 11), mustChangePassword: false },
    });
    // Déconnecte les autres appareils, garde la session courante
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(currentToken ? { NOT: { tokenHash: sha256(currentToken) } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    await this.audit.log(user, 'PASSWORD_CHANGE', 'User', user.id);
    return { ok: true };
  }

  /* ───────── Profil ───────── */

  async me(user: AuthUser) {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
    });
    return {
      ...this.publicUser(row),
      teacher: row.teacher,
      inactivityMinutes: await this.settings.get<number>('security.inactivityMinutes'),
    };
  }

  async updateMe(user: AuthUser, dto: UpdateMeDto) {
    const { currentPassword, ...fields } = dto;
    const data: any = { ...fields };
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (dto.email) {
      data.email = dto.email.trim().toLowerCase();
      // Changer l'e-mail = changer le destinataire du « mot de passe oublié » : on redemande le mot de passe
      if (data.email !== (current.email ?? '').toLowerCase()) {
        if (!currentPassword || !(await bcrypt.compare(currentPassword, current.passwordHash))) {
          throw new BadRequestException('Pour changer votre e-mail, saisissez votre mot de passe actuel.');
        }
        const taken = await this.prisma.user.findFirst({ where: { email: data.email, NOT: { id: user.id } }, select: { id: true } });
        if (taken) throw new BadRequestException('Cette adresse e-mail est déjà utilisée.');
      } else {
        delete data.email;
      }
    }
    const row = await this.prisma.user.update({ where: { id: user.id }, data });
    if (data.email) await this.audit.log(user, 'EMAIL_CHANGE', 'User', user.id);
    return this.publicUser(row);
  }

  publicUser(u: {
    id: string;
    username: string;
    email: string | null;
    firstName: string;
    lastName: string;
    role: string;
    language: string;
    teacherId: string | null;
    mustChangePassword: boolean;
  }) {
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      language: u.language,
      teacherId: u.teacherId,
      mustChangePassword: u.mustChangePassword,
    };
  }
}