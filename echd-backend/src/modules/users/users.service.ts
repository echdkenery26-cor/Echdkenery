import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Actor, AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { generatePassword, slugify } from '../../common/utils';
import { CreateUserDto, UpdateUserDto } from './users.dto';

const SAFE = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  language: true,
  active: true,
  mustChangePassword: true,
  lastLoginAt: true,
  teacherId: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      select: { ...SAFE, teacher: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  async get(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: SAFE });
    if (!u) throw new NotFoundException('Compte introuvable.');
    return u;
  }

  private async uniqueUsername(base: string) {
    const root = slugify(base) || 'user';
    let candidate = root;
    for (let i = 2; await this.prisma.user.findUnique({ where: { username: candidate } }); i++) {
      candidate = `${root}${i}`;
    }
    return candidate;
  }

  /** Crée un compte. Retourne le mot de passe provisoire UNE seule fois (à transmettre à la personne). */
  async create(dto: CreateUserDto, actor: Actor, ip?: string) {
    if (dto.role === Role.TEACHER) {
      if (!dto.teacherId) throw new BadRequestException('Un compte enseignant doit être relié à une fiche enseignant.');
      const t = await this.prisma.teacher.findUnique({ where: { id: dto.teacherId }, include: { user: true } });
      if (!t) throw new NotFoundException('Fiche enseignant introuvable.');
      if (t.user) throw new ConflictException('Cet enseignant a déjà un compte.');
    } else if (dto.teacherId) {
      throw new BadRequestException('Seul un compte enseignant peut être relié à une fiche enseignant.');
    }
    const email = dto.email?.toLowerCase();
    if (email && (await this.prisma.user.findUnique({ where: { email } }))) {
      throw new ConflictException('Cette adresse e-mail est déjà utilisée par un compte.');
    }
    let username = dto.username?.toLowerCase();
    if (username) {
      if (await this.prisma.user.findUnique({ where: { username } })) {
        throw new ConflictException('Cet identifiant est déjà pris.');
      }
    } else {
      username = await this.uniqueUsername(`${dto.firstName}.${dto.lastName ?? ''}`);
    }
    const temporaryPassword = dto.password ?? generatePassword();
    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        firstName: dto.firstName,
        lastName: dto.lastName ?? '',
        role: dto.role,
        language: dto.language ?? 'fr',
        teacherId: dto.teacherId,
        passwordHash: await bcrypt.hash(temporaryPassword, 11),
        mustChangePassword: true,
      },
      select: SAFE,
    });
    await this.audit.log(actor, 'CREATE', 'User', user.id, undefined, user, ip);
    return { user, credentials: { username: user.username, temporaryPassword } };
  }

  async update(id: string, dto: UpdateUserDto, actor: Actor, ip?: string) {
    const before = await this.get(id);
    if (actor && actor.id === id && (dto.active === false || (dto.role && dto.role !== before.role))) {
      throw new BadRequestException('Vous ne pouvez pas désactiver ou rétrograder votre propre compte.');
    }
    if (dto.role && dto.role !== before.role) {
      if (before.role === Role.TEACHER || dto.role === Role.TEACHER) {
        throw new BadRequestException("Le rôle enseignant est lié à une fiche : créez plutôt un nouveau compte.");
      }
    }
    await this.assertAnotherAdmin(before, dto);
    if (dto.email) {
      const dup = await this.prisma.user.findFirst({ where: { email: dto.email.toLowerCase(), NOT: { id } } });
      if (dup) throw new ConflictException('Cette adresse e-mail est déjà utilisée.');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...dto, email: dto.email?.toLowerCase() },
      select: SAFE,
    });
    if (dto.active === false) {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log(actor, 'UPDATE', 'User', id, before, user, ip);
    return user;
  }

  /** Empêche de se retrouver sans administrateur actif. */
  private async assertAnotherAdmin(before: { id: string; role: Role; active: boolean }, dto: UpdateUserDto) {
    const losesAdmin =
      before.role === Role.ADMIN && before.active && ((dto.role && dto.role !== Role.ADMIN) || dto.active === false);
    if (!losesAdmin) return;
    const others = await this.prisma.user.count({
      where: { role: Role.ADMIN, active: true, NOT: { id: before.id } },
    });
    if (!others) throw new BadRequestException("Il doit rester au moins un administrateur actif.");
  }

  async resetPassword(id: string, password: string | undefined, actor: Actor, ip?: string) {
    const user = await this.get(id);
    const temporaryPassword = password ?? generatePassword();
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, 11),
        mustChangePassword: true,
        failedLogins: 0,
        lockedUntil: null,
      },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log(actor, 'PASSWORD_RESET_BY_ADMIN', 'User', id, undefined, undefined, ip);
    return { credentials: { username: user.username, temporaryPassword } };
  }
}
