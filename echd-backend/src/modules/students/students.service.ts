import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StudentStatus } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { Actor, AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/decorators';
import { FilesService } from '../../common/files.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { ageOn, dateOnly, pageArgs, pageResult } from '../../common/utils';
import { FinanceService } from '../finance/finance.service';
import { BatchStudentsDto, CreateStudentDto, StudentQuery, UpdateStudentDto } from './students.dto';
import { EnrollmentsService } from './enrollments.service';

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');

/** Données facultatives fournies par le système (conversion d'une préinscription). */
export interface CreateExtras {
  photo?: string | null;
  familyId?: string | null;
  gdprConsentAt?: Date | null;
}

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private files: FilesService,
    private settings: SettingsService,
    private access: AccessService,
    private finance: FinanceService,
    private enrollments: EnrollmentsService,
  ) {}

  /* ───────────── Liste ───────────── */

  /** Filtres communs à la liste et aux exports. */
  async buildWhere(q: StudentQuery, user: AuthUser): Promise<Prisma.StudentWhereInput> {
    const where: Prisma.StudentWhereInput = {};
    const and: Prisma.StudentWhereInput[] = [];

    if (this.access.isTeacher(user)) {
      where.id = { in: await this.access.teacherStudentIds(user) };
    } else {
      await this.finance.refreshStatuses();
    }
    where.archivedAt = q.archived === 'true' ? { not: null } : null;
    if (q.audience) where.audience = q.audience;
    if (q.status) where.status = q.status;
    if (q.levelId) where.currentLevelId = q.levelId;
    if (q.classId || q.courseId) {
      and.push({
        enrollments: {
          some: { status: 'ACTIVE', classId: q.classId, class: q.courseId ? { courseId: q.courseId } : undefined },
        },
      });
    }
    if (q.paymentState && !this.access.isTeacher(user)) {
      const late = { dues: { some: { status: { in: ['LATE', 'CRITICAL'] } } } } as Prisma.StudentWhereInput;
      and.push(q.paymentState === 'late' ? late : { NOT: late });
    }
    if (q.q?.trim()) {
      const t = q.q.trim();
      const d = digits(t);
      const or: Prisma.StudentWhereInput[] = [
        { firstName: { contains: t, mode: 'insensitive' } },
        { lastName: { contains: t, mode: 'insensitive' } },
        { arabicName: { contains: t } },
      ];
      if (d.length >= 3) {
        or.push({ phone: { contains: d } }, { guardians: { some: { phone: { contains: d } } } });
      }
      // « prénom nom » saisi en entier
      const parts = t.split(/\s+/);
      if (parts.length >= 2) {
        or.push({
          AND: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            { lastName: { contains: parts.slice(1).join(' '), mode: 'insensitive' } },
          ],
        });
      }
      and.push({ OR: or });
    }
    if (and.length) where.AND = and;
    return where;
  }

  async list(q: StudentQuery, user: AuthUser) {
    const where = await this.buildWhere(q, user);
    const [total, rows] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        ...pageArgs(q),
        orderBy: q.sort === 'recent' ? { createdAt: 'desc' } : [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          currentLevel: true,
          enrollments: {
            where: { status: { in: ['ACTIVE', 'WAITLIST'] } },
            include: { class: { select: { id: true, name: true, course: { select: { id: true, titleFr: true, titleAr: true } } } } },
          },
          guardians: { select: { name: true, phone: true }, take: 1 },
        },
      }),
    ]);

    let money = new Map<string, { balanceCents: number; lateCount: number }>();
    if (!this.access.isTeacher(user) && rows.length) {
      const ids = rows.map((r) => r.id);
      const [sums, lates] = await Promise.all([
        this.prisma.due.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, status: { not: 'EXEMPT' } }, _sum: { amountCents: true, paidCents: true } }),
        this.prisma.due.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, status: { in: ['LATE', 'CRITICAL'] } }, _count: true }),
      ]);
      money = new Map(
        ids.map((id) => {
          const s = sums.find((x) => x.studentId === id)?._sum;
          return [id, { balanceCents: (s?.amountCents ?? 0) - (s?.paidCents ?? 0), lateCount: lates.find((x) => x.studentId === id)?._count ?? 0 }];
        }),
      );
    }
    const today = await this.settings.today();
    const items = rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      arabicName: r.arabicName,
      photoUrl: this.files.url(r.photo),
      audience: r.audience,
      gender: r.gender,
      age: ageOn(r.birthDate, today),
      status: r.status,
      phone: this.access.isTeacher(user) ? null : r.phone || r.guardians[0]?.phone || null,
      currentLevel: r.currentLevel,
      classes: r.enrollments.map((e) => ({ enrollmentId: e.id, status: e.status, id: e.class.id, name: e.class.name, course: e.class.course })),
      ...(money.get(r.id) ?? {}),
    }));
    return pageResult(items, total, q);
  }

  /** Toutes les lignes de la liste filtrée (export Excel / CSV). */
  async exportRows(q: StudentQuery, user: AuthUser) {
    const where = await this.buildWhere(q, user);
    const today = await this.settings.today();
    const rows = await this.prisma.student.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 5000,
      include: {
        currentLevel: true,
        guardians: { select: { name: true, phone: true }, take: 2 },
        enrollments: { where: { status: 'ACTIVE' }, include: { class: { select: { name: true } } } },
        dues: { where: { status: { not: 'EXEMPT' } }, select: { amountCents: true, paidCents: true, status: true } },
      },
    });
    return rows.map((r) => ({
      lastName: r.lastName,
      firstName: r.firstName,
      arabicName: r.arabicName ?? '',
      audience: r.audience,
      age: ageOn(r.birthDate, today),
      birthDate: r.birthDate,
      gender: r.gender,
      phone: r.phone ?? '',
      email: r.email ?? '',
      address: [r.address, r.postalCode, r.city].filter(Boolean).join(', '),
      guardians: r.guardians.map((g) => `${g.name}${g.phone ? ` (${g.phone})` : ''}`).join(' / '),
      status: r.status,
      level: r.currentLevel?.labelFr ?? '',
      classes: r.enrollments.map((e) => e.class.name).join(' / '),
      enrolledAt: r.enrolledAt,
      balanceCents: r.dues.reduce((a, d) => a + d.amountCents - d.paidCents, 0),
      lateDues: r.dues.filter((d) => d.status === 'LATE' || d.status === 'CRITICAL').length,
    }));
  }

  /* ───────────── Détail ───────────── */

  async get(id: string, user: AuthUser) {
    await this.access.assertStudentAccess(user, id);
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: {
        guardians: true,
        startLevel: true,
        currentLevel: true,
        family: { include: { students: { where: { NOT: { id } }, select: { id: true, firstName: true, lastName: true, photo: true, audience: true, status: true } } } },
        enrollments: {
          orderBy: { startDate: 'desc' },
          include: {
            class: {
              include: {
                course: { select: { id: true, titleFr: true, titleAr: true, color: true } },
                teacher: { select: { id: true, firstName: true, lastName: true } },
                slots: true,
              },
            },
          },
        },
      },
    });
    if (!s) throw new NotFoundException('Élève introuvable.');
    const today = await this.settings.today();
    const teacher = this.access.isTeacher(user);

    const enrollments = teacher ? s.enrollments.filter((e) => e.class.teacherId === user.teacherId) : s.enrollments;
    const base = {
      ...s,
      photoUrl: this.files.url(s.photo),
      age: ageOn(s.birthDate, today),
      enrollments,
      siblings: (s.family?.students ?? []).map((x) => ({ ...x, photoUrl: this.files.url(x.photo), photo: undefined })),
      family: undefined,
      photo: undefined,
    };
    if (!teacher) return base;
    // Enseignant : pas de notes internes, d'adresse, d'e-mail ni de consentements
    return {
      ...base,
      notes: undefined,
      address: undefined,
      postalCode: undefined,
      city: undefined,
      email: undefined,
      phone: undefined,
      gdprConsentAt: undefined,
      imageRightsConsent: undefined,
      siblings: [],
      guardians: s.guardians.map((g) => ({ id: g.id, name: g.name, relationship: g.relationship, phone: g.phone })),
    };
  }

  /* ───────────── Création ───────────── */

  private validateRules(dto: Pick<CreateStudentDto, 'audience' | 'phone' | 'guardians'>) {
    if (dto.audience === 'ADULT' && !dto.phone?.trim()) {
      throw new BadRequestException('Le téléphone est obligatoire pour un adulte.');
    }
    // Règle 2 : un enfant doit avoir au moins un responsable légal avec téléphone
    if (dto.audience === 'CHILD' && !(dto.guardians ?? []).some((g) => g.phone?.trim())) {
      throw new BadRequestException('Un enfant doit avoir au moins un responsable légal avec un numéro de téléphone.');
    }
  }

  /** Règle 1 : doublon présumé = même nom/prénom et même téléphone ou même date de naissance. */
  async findDuplicates(dto: Pick<CreateStudentDto, 'firstName' | 'lastName' | 'phone' | 'birthDate' | 'guardians'>) {
    const candidates = await this.prisma.student.findMany({
      where: {
        firstName: { equals: dto.firstName.trim(), mode: 'insensitive' },
        lastName: { equals: dto.lastName.trim(), mode: 'insensitive' },
      },
      include: { guardians: { select: { phone: true } } },
    });
    const phones = new Set([digits(dto.phone), ...(dto.guardians ?? []).map((g) => digits(g.phone))].filter(Boolean));
    return candidates
      .filter((c) => {
        const cPhones = [digits(c.phone), ...c.guardians.map((g) => digits(g.phone))].filter(Boolean);
        const samePhone = cPhones.some((p) => phones.has(p));
        const sameBirth = !!dto.birthDate && !!c.birthDate && c.birthDate.toISOString().slice(0, 10) === dto.birthDate.slice(0, 10);
        return samePhone || sameBirth;
      })
      .map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, birthDate: c.birthDate, status: c.status }));
  }

  async create(dto: CreateStudentDto, actor: Actor, ip?: string, extras: CreateExtras = {}) {
    this.validateRules(dto);
    if (!dto.force) {
      const dups = await this.findDuplicates(dto);
      if (dups.length) {
        throw new ConflictException({
          code: 'DUPLICATE_STUDENT',
          message: 'Un élève très proche existe déjà (même nom et même téléphone ou date de naissance).',
          duplicates: dups,
        });
      }
    }
    const today = await this.settings.today();
    const year = await this.prisma.schoolYear.findFirst({ where: { isCurrent: true } });

    let familyId = extras.familyId ?? null;
    if (!familyId && dto.siblingOfStudentId) familyId = await this.familyOf(dto.siblingOfStudentId);

    const student = await this.prisma.student.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        arabicName: dto.arabicName,
        birthDate: dto.birthDate ? dateOnly(dto.birthDate) : null,
        gender: dto.gender,
        audience: dto.audience,
        phone: dto.phone?.trim(),
        email: dto.email?.toLowerCase(),
        address: dto.address,
        postalCode: dto.postalCode,
        city: dto.city,
        photo: extras.photo ?? null,
        startLevelId: dto.startLevelId,
        currentLevelId: dto.startLevelId,
        status: dto.status ?? 'ENROLLED',
        enrolledAt: dto.enrolledAt ? dateOnly(dto.enrolledAt) : today,
        notes: dto.notes,
        gdprConsentAt: extras.gdprConsentAt ?? (dto.gdprConsent ? new Date() : null),
        imageRightsConsent: !!dto.imageRightsConsent,
        familyId,
        guardians: {
          create: (dto.guardians ?? []).map((g) => ({
            name: g.name,
            relationship: g.relationship ?? '',
            phone: g.phone?.trim(),
            email: g.email?.toLowerCase(),
          })),
        },
      },
    });
    await this.audit.log(actor, 'CREATE', 'Student', student.id, undefined, { ...student, yearId: year?.id }, ip);

    const warnings: string[] = [];
    for (const classId of dto.classIds ?? []) {
      try {
        await this.enrollments.enroll(student.id, { classId, force: dto.force }, actor, ip);
      } catch (e: any) {
        warnings.push(e?.response?.message ?? e?.message ?? 'Inscription en classe impossible.');
      }
    }
    // Frais d'inscription dû même sans classe (une seule fois par année, règle 5)
    if (!(dto.classIds ?? []).length) await this.finance.generateForStudent(student.id).catch(() => undefined);

    return { student: await this.get(student.id, actor as AuthUser), warnings };
  }

  /** Crée plusieurs personnes d'un coup (fratrie ou groupe) ; une seule famille si demandé. */
  async createBatch(dto: BatchStudentsDto, actor: Actor, ip?: string) {
    // Contrôle préalable de toutes les fiches pour ne rien créer à moitié
    for (const s of dto.students) this.validateRules(s);
    const family = dto.sameFamily !== false && dto.students.length > 1 ? await this.prisma.family.create({ data: {} }) : null;
    const results: Awaited<ReturnType<StudentsService['create']>>[] = [];
    for (const s of dto.students) {
      results.push(await this.create(s, actor, ip, { familyId: family?.id }));
    }
    return { students: results.map((r) => r.student), warnings: results.flatMap((r) => r.warnings) };
  }

  /* ───────────── Modification ───────────── */

  async update(id: string, dto: UpdateStudentDto, actor: Actor, ip?: string) {
    const before = await this.prisma.student.findUnique({ where: { id }, include: { guardians: true } });
    if (!before) throw new NotFoundException('Élève introuvable.');
    const merged = {
      audience: dto.audience ?? before.audience,
      phone: dto.phone ?? before.phone ?? undefined,
      guardians: dto.guardians ?? before.guardians,
    };
    this.validateRules(merged as any);
    const { guardians, birthDate, email, enrolledAt, ...rest } = dto;
    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          ...rest,
          email: email?.toLowerCase(),
          birthDate: birthDate ? dateOnly(birthDate) : undefined,
          enrolledAt: enrolledAt ? dateOnly(enrolledAt) : undefined,
        },
      });
      if (guardians) {
        await tx.guardian.deleteMany({ where: { studentId: id } });
        await tx.guardian.createMany({
          data: guardians.map((g) => ({ studentId: id, name: g.name, relationship: g.relationship ?? '', phone: g.phone?.trim(), email: g.email?.toLowerCase() })),
        });
      }
    });
    const after = await this.prisma.student.findUniqueOrThrow({ where: { id }, include: { guardians: true } });
    await this.audit.log(actor, 'UPDATE', 'Student', id, before, after, ip);
    return this.get(id, actor as AuthUser);
  }

  async setPhoto(id: string, buffer: Buffer, actor: Actor, ip?: string) {
    const s = await this.prisma.student.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    const photo = await this.files.saveImage(buffer, 'private', 'students', 'portrait');
    await this.prisma.student.update({ where: { id }, data: { photo } });
    await this.files.remove(s.photo);
    await this.audit.log(actor, 'UPDATE_PHOTO', 'Student', id, undefined, undefined, ip);
    return { photoUrl: this.files.url(photo) };
  }

  async removePhoto(id: string) {
    const s = await this.prisma.student.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    await this.prisma.student.update({ where: { id }, data: { photo: null } });
    await this.files.remove(s.photo);
    return { ok: true };
  }

  /* ───────────── Statut, archivage, suppression ───────────── */

  async setStatus(id: string, status: StudentStatus, reason: string | undefined, actor: Actor, ip?: string) {
    const s = await this.prisma.student.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    if (s.status === status) return this.get(id, actor as AuthUser);
    const today = await this.settings.today();
    const data: Prisma.StudentUpdateInput = { status };
    if (status === 'LEFT') data.leftAt = today;
    if (s.status === 'LEFT' && status !== 'LEFT') {
      data.leftAt = null;
      data.archivedAt = null;
    }
    await this.prisma.student.update({ where: { id }, data });

    // Un élève parti n'occupe plus de place : on clôture ses inscriptions (l'historique reste).
    if (status === 'LEFT') {
      const open = await this.prisma.enrollment.findMany({ where: { studentId: id, status: { in: ['ACTIVE', 'WAITLIST'] } } });
      for (const e of open) await this.enrollments.end(e.id, undefined, actor, ip);
    }
    await this.audit.log(actor, 'STATUS', 'Student', id, { status: s.status }, { status, reason }, ip);
    return this.get(id, actor as AuthUser);
  }

  async archive(id: string, actor: Actor, ip?: string) {
    const s = await this.prisma.student.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    if (s.status !== 'LEFT') await this.setStatus(id, 'LEFT', 'Archivage', actor, ip);
    await this.prisma.student.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log(actor, 'ARCHIVE', 'Student', id, undefined, undefined, ip);
    return { ok: true };
  }

  async unarchive(id: string, actor: Actor, ip?: string) {
    await this.prisma.student.update({ where: { id }, data: { archivedAt: null } });
    await this.audit.log(actor, 'UNARCHIVE', 'Student', id, undefined, undefined, ip);
    return { ok: true };
  }

  /** Suppression définitive (droit à l'effacement) — réservée à l'administrateur. */
  async remove(id: string, actor: Actor, ip?: string) {
    const s = await this.prisma.student.findUnique({ where: { id }, include: { guardians: true } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    await this.prisma.student.delete({ where: { id } });
    await this.files.remove(s.photo);
    await this.audit.log(actor, 'DELETE', 'Student', id, { firstName: s.firstName, lastName: s.lastName, status: s.status }, undefined, ip);
    return { ok: true };
  }

  /** Élèves partis dont la durée de conservation est dépassée (à supprimer ou anonymiser). */
  async retentionExpired() {
    const years = await this.settings.get<number>('retention.years');
    const today = await this.settings.today();
    const limit = new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate()));
    const rows = await this.prisma.student.findMany({
      where: { status: 'LEFT', leftAt: { lt: limit } },
      select: { id: true, firstName: true, lastName: true, leftAt: true },
      orderBy: { leftAt: 'asc' },
    });
    return { retentionYears: years, limitDate: limit, items: rows };
  }

  /* ───────────── Fratrie ───────────── */

  private async familyOf(studentId: string): Promise<string> {
    const s = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    if (s.familyId) return s.familyId;
    const f = await this.prisma.family.create({ data: {} });
    await this.prisma.student.update({ where: { id: studentId }, data: { familyId: f.id } });
    return f.id;
  }

  async linkSibling(id: string, siblingId: string, actor: Actor, ip?: string) {
    if (id === siblingId) throw new BadRequestException('Un élève ne peut pas être son propre frère/sa propre sœur.');
    const familyId = await this.familyOf(id);
    const sib = await this.prisma.student.findUnique({ where: { id: siblingId } });
    if (!sib) throw new NotFoundException('Élève introuvable.');
    await this.prisma.student.updateMany({
      where: sib.familyId ? { familyId: sib.familyId } : { id: siblingId },
      data: { familyId },
    });
    await this.audit.log(actor, 'LINK_SIBLING', 'Student', id, undefined, { siblingId }, ip);
    return { ok: true };
  }

  async unlinkSibling(id: string, actor: Actor, ip?: string) {
    await this.prisma.student.update({ where: { id }, data: { familyId: null } });
    await this.audit.log(actor, 'UNLINK_SIBLING', 'Student', id, undefined, undefined, ip);
    return { ok: true };
  }

  /* ───────────── Historique ───────────── */

  history(id: string) {
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'Student', entityId: id },
          { entity: { in: ['Enrollment', 'Payment', 'Due'] }, after: { path: ['studentId'], equals: id } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
