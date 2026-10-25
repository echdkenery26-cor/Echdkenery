//echd-backend/src/modules/prereg/prereg.service.ts
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Actor, AuditService } from '../../common/audit.service';
import { FilesService } from '../../common/files.service';
import { MailService } from '../../common/mail.service';
import { NotificationsService } from '../../common/notifications.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { dateOnly, diffDays, fullName, normalizePhone, pageArgs, pageResult } from '../../common/utils';
import { StudentsService } from '../students/students.service';
import { ConvertPreRegDto, CreatePreRegDto, PreRegQuery, UpdatePreRegDto } from './prereg.dto';

@Injectable()
export class PreRegService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private files: FilesService,
    private mail: MailService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private students: StudentsService,
  ) {}

  /* ═══════════════ Côté public ═══════════════ */

  async uploadPhoto(buffer: Buffer) {
    const key = await this.files.saveImage(buffer, 'private', 'tmp', 'portrait');
    return { key };
  }

  /** Frais d'inscription annoncés sur le formulaire (barème paramétré par l'administrateur). */
  async registrationFee(courseId?: string) {
    const fees = await this.prisma.feeSchedule.findMany({ where: { kind: 'REGISTRATION', active: true }, orderBy: { createdAt: 'asc' } });
    const fee = fees.find((f) => courseId && f.courseId === courseId) ?? fees.find((f) => !f.courseId) ?? null;
    const currency = await this.settings.get<string>('institute.currency');
    return fee ? { amountCents: fee.amountCents, currency, titleFr: fee.titleFr, titleAr: fee.titleAr } : null;
  }

  async create(dto: CreatePreRegDto) {
    // Pot de miel : un robot remplit le champ caché → on répond « OK » sans rien enregistrer.
    if (dto.website && dto.website.trim()) return { ok: true, reference: 'PRE-0000-00000' };

    if (!(await this.settings.get<boolean>('site.registrationOpen'))) {
      throw new ForbiddenException({ code: 'REGISTRATION_CLOSED', message: 'Les préinscriptions sont fermées pour le moment.' });
    }
    if (dto.audience === 'ADULT' && dto.persons.length !== 1) {
      throw new BadRequestException('Une préinscription adulte concerne une seule personne.');
    }
    if (dto.audience === 'CHILD' && !dto.contactName?.trim()) {
      throw new BadRequestException("Indiquez le nom du responsable légal de l'enfant.");
    }
    if (dto.courseId) {
      const c = await this.prisma.course.findFirst({ where: { id: dto.courseId, active: true, visible: true } });
      if (!c) throw new BadRequestException('Cours inconnu.');
    }
    // Les photos doivent exister (envoyées juste avant)
    for (const p of dto.persons) {
      if (p.photoKey && !(await this.files.exists(p.photoKey))) {
        throw new BadRequestException('Une photo envoyée a expiré : veuillez la renvoyer.');
      }
    }

    const year = (await this.settings.today()).getUTCFullYear();
    const counter = await this.prisma.counter.upsert({
      where: { key: `prereg-${year}` },
      update: { value: { increment: 1 } },
      create: { key: `prereg-${year}`, value: 1 },
    });
    const reference = `PRE-${year}-${String(counter.value).padStart(5, '0')}`;

    const persons: Array<{ firstName: string; lastName: string; arabicName?: string; birthDate: Date | null; gender?: any; photo: string | null; levelId?: string; imageRights: boolean }> = [];
    for (const p of dto.persons) {
      persons.push({
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        arabicName: p.arabicName,
        birthDate: p.birthDate ? dateOnly(p.birthDate) : null,
        gender: p.gender,
        photo: p.photoKey ? await this.files.move(p.photoKey, 'private', 'prereg') : null,
        levelId: p.levelId,
        imageRights: !!p.imageRights,
      });
    }
    const pr = await this.prisma.preRegistration.create({
      data: {
        reference,
        audience: dto.audience,
        courseId: dto.courseId,
        contactName: dto.contactName?.trim(),
        relationship: dto.relationship,
        phone: dto.phone.trim(),
        email: dto.email?.toLowerCase(),
        address: dto.address,
        postalCode: dto.postalCode,
        city: dto.city,
        message: dto.message,
        consentAt: new Date(),
        persons: { create: persons },
      },
      include: { persons: true, course: { select: { titleFr: true } } },
    });

    await this.notifyAdmins(pr);
    const lang = 'fr';
    const school = await this.settings.get<{ fr: string; ar: string }>('institute.name');
    const tpl = await this.settings.get<{ fr: string; ar: string }>('templates.preregAck');
    if (pr.email) {
      await this.mail.send({
        to: pr.email,
        subject: `${school.fr} — Préinscription ${reference}`,
        text: `${tpl.fr.replace('{reference}', reference).replace('{school}', school.fr)}\n\n${tpl.ar.replace('{reference}', reference).replace('{school}', school.ar || school.fr)}`,
      });
    }
    const wa = await this.settings.get<string>('institute.whatsapp');
    const waNumber = normalizePhone(wa, await this.settings.get<string>('institute.defaultCountryCode'));
    return {
      ok: true,
      reference,
      count: pr.persons.length,
      registrationFee: await this.registrationFee(dto.courseId),
      whatsappUrl: waNumber
        ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`${lang === 'fr' ? 'Bonjour, ma préinscription' : ''} ${reference}`.trim())}`
        : null,
    };
  }

  private async notifyAdmins(pr: { id: string; reference: string; phone: string; persons: { firstName: string; lastName: string }[]; course?: { titleFr: string } | null }) {
    const names = pr.persons.map((p) => fullName(p)).join(', ');
    await this.notifications.notifyStaff({
      type: 'PREREG_NEW',
      title: `Nouvelle préinscription : ${names}`,
      body: `${pr.reference}${pr.course ? ` · ${pr.course.titleFr}` : ''} · ${pr.phone}`,
      entityType: 'PreRegistration',
      entityId: pr.id,
      dedupeKey: `prereg:${pr.id}`,
    });
    const [users, instEmail] = await Promise.all([
      this.prisma.user.findMany({ where: { active: true, role: { in: [Role.ADMIN, Role.MANAGER] }, email: { not: null } }, select: { email: true } }),
      this.settings.get<string>('institute.email'),
    ]);
    const to = [...new Set([...users.map((u) => u.email!), instEmail].filter(Boolean))];
    if (to.length) {
      await this.mail.send({
        to,
        subject: `Nouvelle préinscription ${pr.reference}`,
        text: `Une nouvelle demande de préinscription a été reçue.\n\nPersonne(s) : ${names}\nTéléphone : ${pr.phone}\nRéférence : ${pr.reference}\n\nConnectez-vous à la plateforme pour la traiter.`,
      });
    }
  }

  /* ═══════════════ Côté administration ═══════════════ */

  private include = {
    persons: true,
    course: { select: { id: true, titleFr: true, titleAr: true } },
  };

  private present<T extends { persons: { photo: string | null }[]; createdAt: Date; status: string }>(pr: T, today: Date) {
    return {
      ...pr,
      persons: pr.persons.map((p) => this.files.withPhoto(p)),
      waitingDays: ['NEW', 'CONTACTED'].includes(pr.status) ? diffDays(today, dateOnly(pr.createdAt)) : 0,
    };
  }

  async list(q: PreRegQuery) {
    const t = q.q?.trim();
    const where = {
      status: q.status,
      ...(t
        ? {
            OR: [
              { reference: { contains: t, mode: 'insensitive' as const } },
              { phone: { contains: t } },
              { contactName: { contains: t, mode: 'insensitive' as const } },
              { persons: { some: { OR: [{ firstName: { contains: t, mode: 'insensitive' as const } }, { lastName: { contains: t, mode: 'insensitive' as const } }] } } },
            ],
          }
        : {}),
    };
    const today = await this.settings.today();
    const [total, rows] = await Promise.all([
      this.prisma.preRegistration.count({ where }),
      this.prisma.preRegistration.findMany({ where, ...pageArgs(q), orderBy: { createdAt: 'desc' }, include: this.include }),
    ]);
    return pageResult(rows.map((r) => this.present(r, today)), total, q);
  }

  async counts() {
    const days = await this.settings.get<number>('alerts.preRegPendingDays');
    const today = await this.settings.today();
    const limit = new Date(today.getTime() - days * 86400_000);
    const [newCount, stale] = await Promise.all([
      this.prisma.preRegistration.count({ where: { status: 'NEW' } }),
      this.prisma.preRegistration.count({ where: { status: { in: ['NEW', 'CONTACTED'] }, createdAt: { lt: limit } } }),
    ]);
    return { new: newCount, stale };
  }

  async get(id: string) {
    const pr = await this.prisma.preRegistration.findUnique({ where: { id }, include: this.include });
    if (!pr) throw new NotFoundException('Préinscription introuvable.');
    return this.present(pr, await this.settings.today());
  }

  async update(id: string, dto: UpdatePreRegDto, actor: Actor & { id: string }, ip?: string) {
    const before = await this.prisma.preRegistration.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Préinscription introuvable.');
    const after = await this.prisma.preRegistration.update({
      where: { id },
      data: { ...dto, processedById: dto.status ? actor.id : undefined, processedAt: dto.status ? new Date() : undefined },
    });
    await this.audit.log(actor, 'UPDATE', 'PreRegistration', id, before, after, ip);
    return this.get(id);
  }

  /** « Valider et créer l'élève » : la demande devient une ou plusieurs fiches élève, sans ressaisie. */
  async convert(id: string, dto: ConvertPreRegDto, actor: Actor & { id: string }, ip?: string) {
    const pr = await this.prisma.preRegistration.findUnique({ where: { id }, include: { persons: true } });
    if (!pr) throw new NotFoundException('Préinscription introuvable.');
    if (pr.status === 'REFUSED') throw new BadRequestException('Cette demande a été refusée : changez son statut avant de la convertir.');
    const todo = pr.persons.filter((p) => !p.studentId);
    if (!todo.length) throw new ConflictException('Toutes les personnes de cette demande ont déjà une fiche élève.');

    const base = (p: (typeof todo)[number]) => {
      const adult = pr.audience === 'ADULT';
      return {
        firstName: p.firstName,
        lastName: p.lastName,
        arabicName: p.arabicName ?? undefined,
        birthDate: p.birthDate ? p.birthDate.toISOString() : undefined,
        gender: p.gender ?? undefined,
        audience: pr.audience,
        phone: adult ? pr.phone : undefined,
        email: adult ? (pr.email ?? undefined) : undefined,
        address: pr.address ?? undefined,
        postalCode: pr.postalCode ?? undefined,
        city: pr.city ?? undefined,
        startLevelId: p.levelId ?? undefined,
        imageRightsConsent: p.imageRights,
        status: dto.classId ? ('ENROLLED' as const) : ('PREREGISTERED' as const),
        guardians: adult
          ? []
          : [{ name: pr.contactName || 'Responsable légal', relationship: pr.relationship ?? '', phone: pr.phone, email: pr.email ?? undefined }],
        classIds: dto.classId ? [dto.classId] : [],
        force: !!dto.force,
      };
    };

    // Contrôle des doublons AVANT toute création (rien n'est créé à moitié)
    if (!dto.force) {
      const all: any[] = [];
      for (const p of todo) {
        const d = base(p);
        const dups = await this.students.findDuplicates(d);
        if (dups.length) all.push({ person: `${p.firstName} ${p.lastName}`, duplicates: dups });
      }
      if (all.length) {
        throw new ConflictException({ code: 'DUPLICATE_STUDENT', message: 'Un élève très proche existe déjà.', duplicates: all });
      }
    }

    const family = todo.length > 1 || pr.persons.length > 1 ? await this.findOrCreateFamily(pr.persons) : null;
    const created: { student: any; warnings: string[] }[] = [];
    for (const p of todo) {
      let photo: string | null = null;
      let studentCreated = false;
      try {
        photo = p.photo ? await this.files.copy(p.photo, 'private', 'students') : null;
        const res = await this.students.create(base(p) as any, actor, ip, { photo, familyId: family, gdprConsentAt: pr.consentAt });
        studentCreated = true;
        // Le lien est posé tout de suite : une personne déjà convertie n'est jamais recréée si l'on relance
        await this.prisma.preRegPerson.update({ where: { id: p.id }, data: { studentId: res.student.id } });
        created.push(res);
      } catch (e) {
        // La copie de photo n'est supprimée que si la fiche élève n'a pas été créée (sinon elle s'en sert)
        if (photo && !studentCreated) await this.files.remove(photo).catch(() => undefined);
        if (!created.length) throw e;
        // Échec en cours de route : les fiches déjà créées sont conservées et reliées, on le dit clairement
        const msg = (e as { message?: string }).message ?? 'erreur inconnue';
        await this.audit.log(actor, 'CONVERT_PARTIAL', 'PreRegistration', id, { status: pr.status }, { students: created.map((c) => c.student.id), error: msg }, ip);
        throw new ConflictException(
          `${created.length} fiche(s) sur ${todo.length} créée(s) avant l’échec (« ${p.firstName} ${p.lastName} » : ${msg}). Relancez la conversion pour terminer : les fiches déjà créées ne seront pas dupliquées.`,
        );
      }
    }
    const after = await this.prisma.preRegistration.update({
      where: { id },
      data: { status: 'ACCEPTED', processedById: actor.id, processedAt: new Date() },
    });
    await this.audit.log(actor, 'CONVERT', 'PreRegistration', id, { status: pr.status }, { status: after.status, students: created.map((c) => c.student.id) }, ip);
    return { students: created.map((c) => c.student), warnings: created.flatMap((c) => c.warnings), preRegistration: await this.get(id) };
  }

  private async findOrCreateFamily(persons: { studentId: string | null }[]) {
    const existing = persons.find((p) => p.studentId);
    if (existing) {
      const s = await this.prisma.student.findUnique({ where: { id: existing.studentId! } });
      if (s?.familyId) return s.familyId;
      const f = await this.prisma.family.create({ data: {} });
      if (s) await this.prisma.student.update({ where: { id: s.id }, data: { familyId: f.id } });
      return f.id;
    }
    return (await this.prisma.family.create({ data: {} })).id;
  }

  async remove(id: string, actor: Actor, ip?: string) {
    const pr = await this.prisma.preRegistration.findUnique({ where: { id }, include: { persons: true } });
    if (!pr) throw new NotFoundException('Préinscription introuvable.');
    await this.prisma.preRegistration.delete({ where: { id } });
    for (const p of pr.persons) await this.files.remove(p.photo);
    await this.audit.log(actor, 'DELETE', 'PreRegistration', id, { reference: pr.reference, status: pr.status }, undefined, ip);
    return { ok: true };
  }
}
