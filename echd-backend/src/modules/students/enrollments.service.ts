import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Actor, AuditService } from '../../common/audit.service';
import { NotificationsService } from '../../common/notifications.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { ageOn, dateOnly, overlaps } from '../../common/utils';
import { FinanceService } from '../finance/finance.service';
import { ProgressService } from '../progress/progress.service';
import { EnrollDto, TransferDto } from './students.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private settings: SettingsService,
    private notifications: NotificationsService,
    private finance: FinanceService,
    private progress: ProgressService,
  ) {}

  /**
   * Inscrit un élève dans une classe.
   * Règle 3 : si la classe est pleine, l'élève passe en liste d'attente (jamais de dépassement).
   */
  async enroll(studentId: string, dto: EnrollDto, actor: Actor, ip?: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Élève introuvable.');
    if (student.status === 'LEFT' || student.archivedAt) {
      throw new BadRequestException("Cet élève est parti ou archivé : réactivez-le avant de l'inscrire.");
    }
    const cls = await this.prisma.schoolClass.findUnique({
      where: { id: dto.classId },
      include: { course: true, slots: true },
    });
    if (!cls || !cls.active) throw new NotFoundException('Classe introuvable ou inactive.');

    const existing = await this.prisma.enrollment.findFirst({
      where: { studentId, classId: dto.classId, status: { in: ['ACTIVE', 'WAITLIST'] } },
    });
    if (existing) throw new ConflictException('Cet élève est déjà inscrit (ou en attente) dans cette classe.');

    const today = await this.settings.today();
    if (!dto.force) {
      if (cls.course.audience !== student.audience) {
        throw new ConflictException({
          code: 'AUDIENCE_MISMATCH',
          message: `Ce cours est destiné aux ${cls.course.audience === 'CHILD' ? 'enfants' : 'adultes'}.`,
        });
      }
      const age = ageOn(student.birthDate, today);
      if (cls.course.minAge != null && age != null && age < cls.course.minAge) {
        throw new ConflictException({
          code: 'MIN_AGE',
          message: `Âge minimum pour ce cours : ${cls.course.minAge} ans (élève : ${age} ans).`,
        });
      }
      await this.assertNoStudentConflict(studentId, cls.slots);
    }

    const activeCount = await this.prisma.enrollment.count({ where: { classId: cls.id, status: 'ACTIVE' } });
    const full = activeCount >= cls.capacity;
    const enrollment = await this.prisma.enrollment.create({
      data: {
        studentId,
        classId: cls.id,
        status: full ? 'WAITLIST' : 'ACTIVE',
        startDate: dto.startDate ? dateOnly(dto.startDate) : today,
      },
      include: { class: { select: { id: true, name: true } } },
    });
    await this.audit.log(actor, full ? 'ENROLL_WAITLIST' : 'ENROLL', 'Enrollment', enrollment.id, undefined, enrollment, ip);

    if (full || activeCount + 1 >= cls.capacity) {
      await this.notifications.notifyStaff({
        type: 'CLASS_FULL',
        title: `Classe pleine : ${cls.name}`,
        body: full ? 'Un élève a été placé en liste d’attente.' : 'La dernière place vient d’être attribuée.',
        entityType: 'Class',
        entityId: cls.id,
        dedupeKey: `full:${cls.id}:${(await this.settings.today()).toISOString().slice(0, 10)}`,
      });
    }

    await this.syncStudentStatus(studentId);
    if (!full) await this.afterActivated(studentId, cls.courseId);
    return { enrollment, waitlisted: full };
  }

  private async afterActivated(studentId: string, courseId: string) {
    await this.finance.generateForStudent(studentId);
    await this.progress.autoAssign(studentId, courseId);
  }

  private async assertNoStudentConflict(studentId: string, newSlots: { weekday: number; startTime: string; endTime: string }[]) {
    if (!newSlots.length) return;
    const mine = await this.prisma.slot.findMany({
      where: { class: { active: true, enrollments: { some: { studentId, status: 'ACTIVE' } } } },
      include: { class: { select: { name: true } } },
    });
    for (const n of newSlots) {
      const hit = mine.find((m) => m.weekday === n.weekday && overlaps(m.startTime, m.endTime, n.startTime, n.endTime));
      if (hit) {
        throw new ConflictException({
          code: 'STUDENT_SCHEDULE_CONFLICT',
          message: `Chevauchement avec « ${hit.class.name} » (${hit.startTime}–${hit.endTime}).`,
        });
      }
    }
  }

  /** Cohérence du statut de l'élève avec ses inscriptions (sans toucher à suspendu / parti). */
  async syncStudentStatus(studentId: string) {
    const s = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!s || !['PREREGISTERED', 'WAITLIST', 'ENROLLED'].includes(s.status)) return;
    const [active, waiting] = await Promise.all([
      this.prisma.enrollment.count({ where: { studentId, status: 'ACTIVE' } }),
      this.prisma.enrollment.count({ where: { studentId, status: 'WAITLIST' } }),
    ]);
    let next = s.status;
    if (active > 0) next = 'ENROLLED';
    else if (waiting > 0) next = 'WAITLIST';
    if (next !== s.status) {
      await this.prisma.student.update({
        where: { id: studentId },
        data: { status: next, enrolledAt: s.enrolledAt ?? (next === 'ENROLLED' ? await this.settings.today() : null) },
      });
    }
  }

  /** Termine une inscription (sortie de classe). Libère une place : l'administration est prévenue s'il y a une liste d'attente. */
  async end(enrollmentId: string, endDate: string | undefined, actor: Actor, ip?: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { class: true } });
    if (!e) throw new NotFoundException('Inscription introuvable.');
    if (e.status === 'ENDED') throw new BadRequestException('Inscription déjà terminée.');
    const today = await this.settings.today();
    const wasActive = e.status === 'ACTIVE';
    const end = endDate ? dateOnly(endDate) : today;
    const updated = await this.prisma.enrollment.update({
      where: { id: e.id },
      data: { status: 'ENDED', endDate: end },
    });
    await this.audit.log(actor, 'ENROLLMENT_END', 'Enrollment', e.id, e, updated, ip);
    if (wasActive) {
      await this.finance.pruneFutureDues(e.studentId, e.class.courseId, end);
      const waiting = await this.prisma.enrollment.count({ where: { classId: e.classId, status: 'WAITLIST' } });
      if (waiting) {
        await this.notifications.notifyStaff({
          type: 'SEAT_FREED',
          title: `Place libérée : ${e.class.name}`,
          body: `${waiting} élève(s) en liste d'attente peuvent être promus.`,
          entityType: 'Class',
          entityId: e.classId,
          dedupeKey: `seat:${e.classId}:${end.toISOString().slice(0, 10)}`,
        });
      }
    }
    await this.syncStudentStatus(e.studentId);
    return updated;
  }

  /** Passe un élève de la liste d'attente à inscrit (s'il y a une place). */
  async promote(enrollmentId: string, actor: Actor, ip?: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { class: true } });
    if (!e) throw new NotFoundException('Inscription introuvable.');
    if (e.status !== 'WAITLIST') throw new BadRequestException("Cet élève n'est pas en liste d'attente.");
    const active = await this.prisma.enrollment.count({ where: { classId: e.classId, status: 'ACTIVE' } });
    if (active >= e.class.capacity) throw new ConflictException({ code: 'CLASS_FULL', message: 'La classe est toujours pleine.' });
    const today = await this.settings.today();
    const updated = await this.prisma.enrollment.update({ where: { id: e.id }, data: { status: 'ACTIVE', startDate: today } });
    await this.audit.log(actor, 'ENROLLMENT_PROMOTE', 'Enrollment', e.id, e, updated, ip);
    await this.syncStudentStatus(e.studentId);
    await this.afterActivated(e.studentId, e.class.courseId);
    return updated;
  }

  /** Transfert d'une classe à une autre en un clic. */
  async transfer(enrollmentId: string, dto: TransferDto, actor: Actor, ip?: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!e || e.status === 'ENDED') throw new NotFoundException('Inscription active introuvable.');
    if (e.classId === dto.toClassId) throw new BadRequestException('La classe de destination est identique.');
    const target = await this.prisma.schoolClass.findUnique({ where: { id: dto.toClassId } });
    if (!target || !target.active) throw new NotFoundException('Classe de destination introuvable ou inactive.');
    const active = await this.prisma.enrollment.count({ where: { classId: target.id, status: 'ACTIVE' } });
    if (active >= target.capacity) {
      throw new ConflictException({ code: 'CLASS_FULL', message: 'La classe de destination est pleine.' });
    }
    await this.end(enrollmentId, undefined, actor, ip);
    let res: Awaited<ReturnType<EnrollmentsService['enroll']>>;
    try {
      res = await this.enroll(e.studentId, { classId: dto.toClassId, force: dto.force }, actor, ip);
    } catch (err) {
      // Échec (ex. chevauchement) : on rétablit l'inscription d'origine, rien n'est perdu.
      await this.prisma.enrollment.update({
        where: { id: e.id },
        data: { status: e.status, endDate: e.endDate },
      });
      await this.syncStudentStatus(e.studentId);
      throw err;
    }
    await this.audit.log(actor, 'TRANSFER', 'Enrollment', res.enrollment.id, { fromEnrollmentId: e.id }, res.enrollment, ip);
    return res;
  }
}
