import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Actor, AuditService } from '../../common/audit.service';
import { FilesService } from '../../common/files.service';
import { PrismaService } from '../../common/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateTeacherDto, TeacherAccountDto, UpdateTeacherDto } from './teachers.dto';

@Injectable()
export class TeachersService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private files: FilesService,
    private audit: AuditService,
  ) {}

  /** Liste avec la « charge » : nombre de classes et d'élèves (année en cours). */
  async list() {
    const [teachers, classes] = await Promise.all([
      this.prisma.teacher.findMany({
        orderBy: [{ active: 'desc' }, { firstName: 'asc' }],
        include: { user: { select: { id: true, username: true, email: true, active: true, lastLoginAt: true } } },
      }),
      this.prisma.schoolClass.findMany({
        where: { active: true, schoolYear: { isCurrent: true }, teacherId: { not: null } },
        select: { teacherId: true, _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } },
      }),
    ]);
    const load = new Map<string, { classes: number; students: number }>();
    for (const c of classes) {
      const l = load.get(c.teacherId!) ?? { classes: 0, students: 0 };
      l.classes++;
      l.students += c._count.enrollments;
      load.set(c.teacherId!, l);
    }
    return teachers.map((t) => ({
      ...this.files.withPhoto(t),
      classesCount: load.get(t.id)?.classes ?? 0,
      studentsCount: load.get(t.id)?.students ?? 0,
    }));
  }

  async get(id: string) {
    const t = await this.prisma.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, email: true, active: true, lastLoginAt: true } },
        classes: {
          where: { active: true },
          include: { course: { select: { id: true, titleFr: true, titleAr: true } }, slots: true },
        },
      },
    });
    if (!t) throw new NotFoundException('Enseignant introuvable.');
    return this.files.withPhoto(t);
  }

  async create(dto: CreateTeacherDto, actor: Actor, ip?: string) {
    const { account, ...data } = dto;
    // On vérifie le compte AVANT de créer la fiche pour ne rien laisser à moitié créé.
    const teacher = await this.prisma.teacher.create({
      data: { ...data, email: data.email?.toLowerCase(), audiences: data.audiences ?? [] },
    });
    await this.audit.log(actor, 'CREATE', 'Teacher', teacher.id, undefined, teacher, ip);
    let credentials: { username: string; temporaryPassword: string } | undefined;
    if (account) {
      try {
        credentials = (await this.createAccount(teacher.id, account, actor, ip)).credentials;
      } catch (e) {
        await this.prisma.teacher.delete({ where: { id: teacher.id } });
        throw e;
      }
    }
    return { teacher: this.files.withPhoto(teacher), credentials };
  }

  /** Crée le compte de connexion de l'enseignant depuis sa fiche. */
  async createAccount(teacherId: string, acc: TeacherAccountDto, actor: Actor, ip?: string) {
    const t = await this.prisma.teacher.findUnique({ where: { id: teacherId }, include: { user: true } });
    if (!t) throw new NotFoundException('Enseignant introuvable.');
    if (t.user) throw new ConflictException('Cet enseignant a déjà un compte.');
    return this.users.create(
      {
        firstName: t.firstName,
        lastName: t.lastName,
        role: Role.TEACHER,
        teacherId,
        username: acc.username,
        email: acc.email ?? t.email ?? undefined,
        password: acc.password,
      },
      actor,
      ip,
    );
  }

  async update(id: string, dto: UpdateTeacherDto, actor: Actor, ip?: string) {
    const before = await this.prisma.teacher.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Enseignant introuvable.');
    const teacher = await this.prisma.teacher.update({
      where: { id },
      data: { ...dto, email: dto.email?.toLowerCase() },
    });
    if (dto.active !== undefined) {
      const user = await this.prisma.user.findUnique({ where: { teacherId: id } });
      if (user) {
        await this.prisma.user.update({ where: { id: user.id }, data: { active: dto.active } });
        if (!dto.active) {
          await this.prisma.refreshToken.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }
    }
    await this.audit.log(actor, 'UPDATE', 'Teacher', id, before, teacher, ip);
    return this.files.withPhoto(teacher);
  }

  async setPhoto(id: string, buffer: Buffer) {
    const t = await this.prisma.teacher.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Enseignant introuvable.');
    const photo = await this.files.saveImage(buffer, 'public', 'teachers', 'portrait');
    await this.prisma.teacher.update({ where: { id }, data: { photo } });
    await this.files.remove(t.photo);
    return { photoUrl: this.files.url(photo) };
  }

  async remove(id: string, actor: Actor, ip?: string) {
    const t = await this.prisma.teacher.findUnique({ where: { id }, include: { _count: { select: { classes: true } } } });
    if (!t) throw new NotFoundException('Enseignant introuvable.');
    if (t._count.classes) {
      throw new ConflictException(
        "Cet enseignant a encore des classes : désactivez-le plutôt (ou réaffectez ses classes).",
      );
    }
    await this.prisma.$transaction([
      this.prisma.user.deleteMany({ where: { teacherId: id } }),
      this.prisma.teacher.delete({ where: { id } }),
    ]);
    await this.files.remove(t.photo);
    await this.audit.log(actor, 'DELETE', 'Teacher', id, t, undefined, ip);
    return { ok: true };
  }
}
