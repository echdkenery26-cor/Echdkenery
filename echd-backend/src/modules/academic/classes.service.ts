import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { Actor, AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/decorators';
import { FilesService } from '../../common/files.service';
import { NotificationsService } from '../../common/notifications.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { dateOnly, isoWeekday, normalizePhone, overlaps, timeToMin, ymd } from '../../common/utils';
import {
  ClassQuery,
  CreateClassDto,
  SlotDto,
  SlotExceptionDto,
  UpdateClassDto,
  UpdateSlotDto,
} from './academic.dto';

const WEEKDAYS_FR = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

@Injectable()
export class ClassesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private access: AccessService,
    private settings: SettingsService,
    private files: FilesService,
    private notifications: NotificationsService,
  ) {}

  /* ───────────── Consultation ───────────── */

  private include = {
    course: { select: { id: true, titleFr: true, titleAr: true, audience: true, color: true, icon: true } },
    teacher: { select: { id: true, firstName: true, lastName: true } },
    room: true,
    schoolYear: { select: { id: true, name: true, isCurrent: true } },
    slots: { include: { room: true }, orderBy: [{ weekday: 'asc' as const }, { startTime: 'asc' as const }] },
  };

  async list(q: ClassQuery, user: AuthUser) {
    const where: Prisma.SchoolClassWhereInput = {};
    if (q.schoolYearId) where.schoolYearId = q.schoolYearId;
    else where.schoolYear = { isCurrent: true };
    if (q.courseId) where.courseId = q.courseId;
    if (q.teacherId) where.teacherId = q.teacherId;
    if (q.active !== undefined) where.active = q.active === 'true';
    if (this.access.isTeacher(user)) where.teacherId = user.teacherId ?? '__none__';

    const classes = await this.prisma.schoolClass.findMany({
      where,
      include: this.include,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    const counts = await this.prisma.enrollment.groupBy({
      by: ['classId', 'status'],
      where: { classId: { in: classes.map((c) => c.id) }, status: { in: ['ACTIVE', 'WAITLIST'] } },
      _count: true,
    });
    return classes.map((c) => {
      const active = counts.find((x) => x.classId === c.id && x.status === 'ACTIVE')?._count ?? 0;
      const waitlist = counts.find((x) => x.classId === c.id && x.status === 'WAITLIST')?._count ?? 0;
      return { ...c, studentsCount: active, waitlistCount: waitlist, seatsLeft: Math.max(c.capacity - active, 0), full: active >= c.capacity };
    });
  }

  async get(id: string, user: AuthUser) {
    await this.access.assertClassAccess(user, id);
    const c = await this.prisma.schoolClass.findUnique({ where: { id }, include: this.include });
    if (!c) throw new NotFoundException('Classe introuvable.');
    const [active, waitlist] = await Promise.all([this.activeCount(id), this.prisma.enrollment.count({ where: { classId: id, status: 'WAITLIST' } })]);
    return { ...c, studentsCount: active, waitlistCount: waitlist, seatsLeft: Math.max(c.capacity - active, 0), full: active >= c.capacity };
  }

  async activeCount(classId: string) {
    return this.prisma.enrollment.count({ where: { classId, status: 'ACTIVE' } });
  }

  /** Élèves d'une classe (appel, progression). Les élèves partis/suspendus sont signalés mais restent visibles. */
  async students(classId: string, user: AuthUser) {
    await this.access.assertClassAccess(user, classId);
    const rows = await this.prisma.enrollment.findMany({
      where: { classId, status: { in: ['ACTIVE', 'WAITLIST'] } },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            arabicName: true,
            photo: true,
            status: true,
            audience: true,
            birthDate: true,
            currentLevel: { select: { id: true, labelFr: true, labelAr: true } },
          },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
    const map = (e: (typeof rows)[number]) => ({
      ...this.files.withPhoto(e.student),
      enrollmentId: e.id,
      enrollmentStatus: e.status,
      startDate: e.startDate,
    });
    return {
      active: rows.filter((e) => e.status === 'ACTIVE').map(map),
      waitlist: rows.filter((e) => e.status === 'WAITLIST').map(map),
    };
  }

  /* ───────────── Création / modification ───────────── */

  async create(dto: CreateClassDto, actor: Actor, ip?: string) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Cours introuvable.');
    const year = dto.schoolYearId
      ? await this.prisma.schoolYear.findUnique({ where: { id: dto.schoolYearId } })
      : await this.prisma.schoolYear.findFirst({ where: { isCurrent: true } });
    if (!year) throw new BadRequestException("Aucune année scolaire courante : créez-en une dans les paramètres.");
    if (dto.teacherId) await this.assertTeacher(dto.teacherId);
    if (dto.roomId) await this.assertRoom(dto.roomId);

    // Valider tous les créneaux avant d'écrire quoi que ce soit
    const slots = dto.slots ?? [];
    for (let i = 0; i < slots.length; i++) {
      this.assertTimes(slots[i].startTime, slots[i].endTime);
      await this.assertNoConflict({
        weekday: slots[i].weekday,
        startTime: slots[i].startTime,
        endTime: slots[i].endTime,
        roomId: slots[i].roomId ?? dto.roomId ?? null,
        teacherId: dto.teacherId ?? null,
        schoolYearId: year.id,
        classId: null,
        extra: slots.slice(0, i),
      });
    }

    const cls = await this.prisma.schoolClass.create({
      data: {
        name: dto.name,
        courseId: dto.courseId,
        teacherId: dto.teacherId,
        schoolYearId: year.id,
        capacity: dto.capacity,
        roomId: dto.roomId,
        active: dto.active ?? true,
        slots: {
          create: slots.map((s) => ({
            weekday: s.weekday,
            startTime: s.startTime,
            endTime: s.endTime,
            roomId: s.roomId ?? dto.roomId ?? null,
          })),
        },
      },
      include: this.include,
    });
    await this.audit.log(actor, 'CREATE', 'Class', cls.id, undefined, cls, ip);
    return cls;
  }

  async update(id: string, dto: UpdateClassDto, actor: Actor, ip?: string) {
    const before = await this.prisma.schoolClass.findUnique({ where: { id }, include: { slots: true } });
    if (!before) throw new NotFoundException('Classe introuvable.');
    if (dto.courseId) {
      const c = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
      if (!c) throw new NotFoundException('Cours introuvable.');
    }
    if (dto.capacity !== undefined) {
      const active = await this.activeCount(id);
      if (dto.capacity < active) {
        throw new BadRequestException(`La capacité ne peut pas être inférieure au nombre d'élèves inscrits (${active}).`);
      }
    }
    const newTeacher = dto.teacherId === undefined ? before.teacherId : dto.teacherId;
    if (dto.teacherId) await this.assertTeacher(dto.teacherId);
    if (dto.roomId) await this.assertRoom(dto.roomId);

    // Changer d'enseignant doit rester compatible avec tous les créneaux de la classe
    if (newTeacher !== before.teacherId && newTeacher) {
      for (const s of before.slots) {
        await this.assertNoConflict({
          weekday: s.weekday,
          startTime: s.startTime,
          endTime: s.endTime,
          roomId: null,
          teacherId: newTeacher,
          schoolYearId: before.schoolYearId,
          classId: id,
          excludeSlotId: s.id,
        });
      }
    }

    const cls = await this.prisma.schoolClass.update({ where: { id }, data: dto, include: this.include });
    await this.audit.log(actor, 'UPDATE', 'Class', id, before, cls, ip);
    return cls;
  }

  async remove(id: string, actor: Actor, ip?: string) {
    const c = await this.prisma.schoolClass.findUnique({
      where: { id },
      include: { _count: { select: { enrollments: true, attendances: true } } },
    });
    if (!c) throw new NotFoundException('Classe introuvable.');
    if (c._count.enrollments || c._count.attendances) {
      throw new ConflictException('Cette classe a des élèves ou un historique de présences : désactivez-la plutôt.');
    }
    await this.prisma.schoolClass.delete({ where: { id } });
    await this.audit.log(actor, 'DELETE', 'Class', id, c, undefined, ip);
    return { ok: true };
  }

  /* ───────────── Créneaux ───────────── */

  async addSlot(classId: string, dto: SlotDto, actor: Actor, ip?: string) {
    const cls = await this.prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Classe introuvable.');
    this.assertTimes(dto.startTime, dto.endTime);
    const roomId = dto.roomId ?? cls.roomId ?? null;
    if (dto.roomId) await this.assertRoom(dto.roomId);
    await this.assertNoConflict({
      weekday: dto.weekday,
      startTime: dto.startTime,
      endTime: dto.endTime,
      roomId,
      teacherId: cls.teacherId,
      schoolYearId: cls.schoolYearId,
      classId,
    });
    const slot = await this.prisma.slot.create({
      data: { classId, weekday: dto.weekday, startTime: dto.startTime, endTime: dto.endTime, roomId },
      include: { room: true },
    });
    await this.audit.log(actor, 'CREATE', 'Slot', slot.id, undefined, slot, ip);
    return slot;
  }

  async updateSlot(id: string, dto: UpdateSlotDto, actor: Actor, ip?: string) {
    const before = await this.prisma.slot.findUnique({ where: { id }, include: { class: true } });
    if (!before) throw new NotFoundException('Créneau introuvable.');
    const next = {
      weekday: dto.weekday ?? before.weekday,
      startTime: dto.startTime ?? before.startTime,
      endTime: dto.endTime ?? before.endTime,
      roomId: dto.roomId ?? before.roomId,
    };
    this.assertTimes(next.startTime, next.endTime);
    if (dto.roomId) await this.assertRoom(dto.roomId);
    await this.assertNoConflict({
      ...next,
      teacherId: before.class.teacherId,
      schoolYearId: before.class.schoolYearId,
      classId: before.classId,
      excludeSlotId: id,
    });
    const slot = await this.prisma.slot.update({ where: { id }, data: next, include: { room: true } });
    await this.audit.log(actor, 'UPDATE', 'Slot', id, before, slot, ip);
    return slot;
  }

  async removeSlot(id: string, actor: Actor, ip?: string) {
    const before = await this.prisma.slot.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Créneau introuvable.');
    await this.prisma.slot.delete({ where: { id } });
    await this.audit.log(actor, 'DELETE', 'Slot', id, before, undefined, ip);
    return { ok: true };
  }

  /**
   * Règle 4 : un enseignant ou une salle ne peut pas être sur deux créneaux simultanés.
   * Une classe ne peut pas non plus avoir deux créneaux qui se chevauchent.
   */
  private async assertNoConflict(c: {
    weekday: number;
    startTime: string;
    endTime: string;
    roomId: string | null;
    teacherId: string | null;
    schoolYearId: string;
    classId: string | null;
    excludeSlotId?: string;
    extra?: SlotDto[];
  }) {
    for (const e of c.extra ?? []) {
      if (e.weekday === c.weekday && overlaps(c.startTime, c.endTime, e.startTime, e.endTime)) {
        throw new ConflictException({
          code: 'SLOT_CONFLICT',
          message: 'Deux créneaux de cette classe se chevauchent.',
        });
      }
    }
    const or: Prisma.SlotWhereInput[] = [];
    if (c.teacherId) or.push({ class: { teacherId: c.teacherId } });
    if (c.roomId) or.push({ roomId: c.roomId });
    if (c.classId) or.push({ classId: c.classId });
    if (!or.length) return;
    const candidates = await this.prisma.slot.findMany({
      where: {
        weekday: c.weekday,
        ...(c.excludeSlotId ? { id: { not: c.excludeSlotId } } : {}),
        class: { active: true, schoolYearId: c.schoolYearId },
        OR: or,
      },
      include: { class: { include: { teacher: true } }, room: true },
    });
    const hit = candidates.find((s) => overlaps(c.startTime, c.endTime, s.startTime, s.endTime));
    if (!hit) return;
    const sameTeacher = !!c.teacherId && hit.class.teacherId === c.teacherId;
    const sameRoom = !!c.roomId && hit.roomId === c.roomId;
    const who = sameTeacher
      ? `L'enseignant ${hit.class.teacher?.firstName ?? ''} est déjà affecté`
      : sameRoom
        ? `La salle ${hit.room?.name ?? ''} est déjà occupée`
        : 'Cette classe a déjà un créneau';
    throw new ConflictException({
      code: 'SLOT_CONFLICT',
      message: `${who} le même jour de ${hit.startTime} à ${hit.endTime} (${hit.class.name}).`,
      conflictWith: { classId: hit.classId, className: hit.class.name, startTime: hit.startTime, endTime: hit.endTime },
    });
  }

  private assertTimes(start: string, end: string) {
    if (timeToMin(end) <= timeToMin(start)) throw new BadRequestException("L'heure de fin doit être après l'heure de début.");
  }

  private async assertTeacher(id: string) {
    const t = await this.prisma.teacher.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Enseignant introuvable.');
    if (!t.active) throw new BadRequestException('Cet enseignant est désactivé.');
  }

  private async assertRoom(id: string) {
    if (!(await this.prisma.room.findUnique({ where: { id } }))) throw new NotFoundException('Salle introuvable.');
  }

  /* ───────────── Exceptions (annulation / déplacement d'une séance) ───────────── */

  async addException(slotId: string, dto: SlotExceptionDto, actor: Actor, ip?: string) {
    const slot = await this.prisma.slot.findUnique({
      where: { id: slotId },
      include: { class: { include: { course: true } } },
    });
    if (!slot) throw new NotFoundException('Créneau introuvable.');
    const date = dateOnly(dto.date);
    if (isoWeekday(date) !== slot.weekday) {
      throw new BadRequestException(`Cette date n'est pas un ${WEEKDAYS_FR[slot.weekday]} (jour de ce créneau).`);
    }
    if (dto.type === 'MOVED') {
      if (!dto.newStartTime || !dto.newEndTime) throw new BadRequestException('Indiquez les nouveaux horaires du déplacement.');
      this.assertTimes(dto.newStartTime, dto.newEndTime);
    }
    const data = {
      type: dto.type,
      newStartTime: dto.type === 'MOVED' ? dto.newStartTime : null,
      newEndTime: dto.type === 'MOVED' ? dto.newEndTime : null,
      newRoomId: dto.type === 'MOVED' ? (dto.newRoomId ?? null) : null,
      reason: dto.reason ?? '',
    };
    const exception = await this.prisma.slotException.upsert({
      where: { slotId_date: { slotId, date } },
      update: data,
      create: { slotId, date, ...data },
    });
    await this.audit.log(actor, 'CREATE', 'SlotException', exception.id, undefined, exception, ip);

    // Message préparé + liste des élèves concernés (envoi manuel par WhatsApp / e-mail)
    const students = await this.prisma.student.findMany({
      where: { enrollments: { some: { classId: slot.classId, status: 'ACTIVE' } }, status: 'ENROLLED' },
      select: { id: true, firstName: true, lastName: true, phone: true, guardians: { select: { phone: true }, take: 1 } },
    });
    const cc = await this.settings.get<string>('institute.defaultCountryCode');
    const recipients = students.map((s) => {
      const phone = s.phone || s.guardians[0]?.phone || null;
      return { studentId: s.id, name: `${s.firstName} ${s.lastName}`.trim(), phone, whatsappNumber: normalizePhone(phone, cc) };
    });
    return { exception, recipients, message: await this.changeMessage(slot.class.course, slot, date, dto) };
  }

  private async changeMessage(
    course: { titleFr: string; titleAr: string },
    slot: { startTime: string; endTime: string },
    date: Date,
    dto: SlotExceptionDto,
  ) {
    const school = await this.settings.get<{ fr: string; ar: string }>('institute.name');
    const tpl = await this.settings.get<{ fr: string; ar: string }>('templates.slotChange');
    const dFr = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
    const dAr = new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
    const reasonFr = dto.reason ? ` (${dto.reason})` : '';
    const fr =
      dto.type === 'CANCELLED'
        ? `le cours « ${course.titleFr} » du ${dFr} est annulé${reasonFr}.`
        : `le cours « ${course.titleFr} » du ${dFr} est déplacé : ${dto.newStartTime}–${dto.newEndTime} au lieu de ${slot.startTime}–${slot.endTime}${reasonFr}.`;
    const ar =
      dto.type === 'CANCELLED'
        ? `تم إلغاء درس «${course.titleAr || course.titleFr}» ليوم ${dAr}${dto.reason ? ` (${dto.reason})` : ''}.`
        : `تم تغيير موعد درس «${course.titleAr || course.titleFr}» ليوم ${dAr}: ${dto.newStartTime}–${dto.newEndTime} بدل ${slot.startTime}–${slot.endTime}.`;
    return {
      fr: tpl.fr.replace('{school}', school.fr).replace('{message}', fr),
      ar: tpl.ar.replace('{school}', school.ar || school.fr).replace('{message}', ar),
    };
  }

  async removeException(id: string, actor: Actor, ip?: string) {
    const ex = await this.prisma.slotException.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Exception introuvable.');
    await this.prisma.slotException.delete({ where: { id } });
    await this.audit.log(actor, 'DELETE', 'SlotException', id, ex, undefined, ip);
    return { ok: true, date: ymd(ex.date) };
  }
}
