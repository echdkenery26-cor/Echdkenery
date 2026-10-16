import { BadRequestException, Injectable } from '@nestjs/common';
import { AccessService } from '../../common/access.service';
import { summarize } from '../../common/attendance.util';
import { AuthUser } from '../../common/decorators';
import { FilesService } from '../../common/files.service';
import { NotificationsService } from '../../common/notifications.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { dateOnly, fullName, isoWeekday, ymd } from '../../common/utils';
import { expandOccurrences } from '../academic/timetable.service';
import { SaveSheetDto } from './attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private settings: SettingsService,
    private notifications: NotificationsService,
    private files: FilesService,
  ) {}

  /**
   * Feuille d'appel d'une séance. Les élèves partis ou suspendus n'apparaissent plus (règle 8).
   * Le front peut proposer « Tous présents » par défaut pour les élèves sans statut (status = null).
   */
  async sheet(classId: string, date: string | undefined, user: AuthUser) {
    const cls = await this.access.assertClassAccess(user, classId);
    const today = await this.settings.today();
    const day = date ? dateOnly(date) : today;

    const [full, slots, closures, rows, existing] = await Promise.all([
      this.prisma.schoolClass.findUnique({ where: { id: classId }, include: { course: { select: { titleFr: true, titleAr: true } } } }),
      this.prisma.slot.findMany({ where: { classId }, include: { exceptions: { where: { date: day } } } }),
      this.prisma.closure.findMany({ where: { schoolYearId: cls.schoolYearId, startDate: { lte: day }, endDate: { gte: day } } }),
      this.prisma.enrollment.findMany({
        where: { classId, status: 'ACTIVE', student: { status: 'ENROLLED', archivedAt: null } },
        include: { student: { select: { id: true, firstName: true, lastName: true, arabicName: true, photo: true, audience: true } } },
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      }),
      this.prisma.attendance.findMany({ where: { classId, date: day } }),
    ]);

    const occ = expandOccurrences(
      slots.map((s) => ({ ...s, exceptions: s.exceptions })),
      closures,
      day,
      day,
    );
    const byStudent = new Map(existing.map((a) => [a.studentId, a]));
    return {
      class: { id: cls.id, name: cls.name, course: full?.course },
      date: ymd(day),
      weekday: isoWeekday(day),
      isFuture: day > today,
      session: occ[0] ?? null, // null = pas de séance prévue ce jour-là
      recorded: existing.length > 0,
      students: rows.map((r) => ({
        ...this.files.withPhoto(r.student),
        status: byStudent.get(r.studentId)?.status ?? null,
        remark: byStudent.get(r.studentId)?.remark ?? null,
      })),
    };
  }

  async save(dto: SaveSheetDto, user: AuthUser) {
    const cls = await this.access.assertClassAccess(user, dto.classId);
    const today = await this.settings.today();
    const day = dateOnly(dto.date);
    if (day > today) throw new BadRequestException("Impossible de faire l'appel d'une date future.");

    const roster = await this.prisma.enrollment.findMany({
      where: { classId: dto.classId, status: 'ACTIVE', student: { status: 'ENROLLED' } },
      select: { studentId: true },
    });
    const allowed = new Set(roster.map((r) => r.studentId));
    const ids = new Set<string>();
    for (const r of dto.records) {
      if (!allowed.has(r.studentId)) throw new BadRequestException("Un élève de la liste n'est pas inscrit (ou actif) dans cette classe.");
      if (ids.has(r.studentId)) throw new BadRequestException('Un élève apparaît deux fois dans la liste.');
      ids.add(r.studentId);
    }

    await this.prisma.$transaction(
      dto.records.map((r) =>
        this.prisma.attendance.upsert({
          where: { studentId_classId_date: { studentId: r.studentId, classId: dto.classId, date: day } },
          update: { status: r.status, remark: r.remark ?? null, recordedById: user.id },
          create: { studentId: r.studentId, classId: dto.classId, date: day, status: r.status, remark: r.remark, recordedById: user.id },
        }),
      ),
    );

    // Alerte d'absentéisme immédiate pour les élèves marqués absents
    const absent = dto.records.filter((r) => r.status === 'ABSENT').map((r) => r.studentId);
    const alerts = await this.notifyRepeatedAbsences(absent, dto.classId, cls.name);
    return { saved: dto.records.length, absenceAlerts: alerts };
  }

  /** Nombre d'absences consécutives les plus récentes (les absences excusées sont neutres). */
  consecutiveAbsences(rows: { status: string; date: Date }[]): { count: number; lastDate: Date | null } {
    const sorted = [...rows].sort((a, b) => b.date.getTime() - a.date.getTime());
    let count = 0;
    let lastDate: Date | null = null;
    for (const r of sorted) {
      if (r.status === 'EXCUSED') continue;
      if (r.status === 'ABSENT') {
        count++;
        lastDate ??= r.date;
      } else break;
    }
    return { count, lastDate };
  }

  private async notifyRepeatedAbsences(studentIds: string[], classId: string, className: string) {
    if (!studentIds.length) return [];
    const threshold = await this.settings.get<number>('alerts.absenceThreshold');
    const out: { studentId: string; count: number }[] = [];
    for (const studentId of studentIds) {
      const rows = await this.prisma.attendance.findMany({
        where: { studentId, classId },
        orderBy: { date: 'desc' },
        take: 30,
        select: { status: true, date: true },
      });
      const { count, lastDate } = this.consecutiveAbsences(rows);
      if (count >= threshold && lastDate) {
        const s = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { firstName: true, lastName: true } });
        await this.notifications.notifyStaff({
          type: 'ABSENCES',
          title: `Absences répétées : ${fullName(s)}`,
          body: `${count} absences consécutives en « ${className} ».`,
          entityType: 'Student',
          entityId: studentId,
          dedupeKey: `abs:${studentId}:${classId}:${ymd(lastDate)}`,
        });
        out.push({ studentId, count });
      }
    }
    return out;
  }

  /** Tous les élèves actuellement au-dessus du seuil d'absences consécutives (dashboard + alertes). */
  async repeatedAbsences() {
    const threshold = await this.settings.get<number>('alerts.absenceThreshold');
    const since = new Date(Date.now() - 90 * 86400_000);
    const rows = await this.prisma.attendance.findMany({
      where: {
        date: { gte: since },
        class: { active: true, schoolYear: { isCurrent: true } },
        student: { status: 'ENROLLED', archivedAt: null },
      },
      select: {
        studentId: true,
        classId: true,
        status: true,
        date: true,
        class: { select: { name: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    });
    const groups = new Map<string, typeof rows>();
    for (const r of rows) groups.set(`${r.studentId}|${r.classId}`, [...(groups.get(`${r.studentId}|${r.classId}`) ?? []), r]);
    const out: { studentId: string; name: string; classId: string; className: string; count: number; lastDate: Date }[] = [];
    for (const g of groups.values()) {
      const { count, lastDate } = this.consecutiveAbsences(g);
      if (count >= threshold && lastDate) {
        out.push({ studentId: g[0].studentId, name: fullName(g[0].student), classId: g[0].classId, className: g[0].class.name, count, lastDate });
      }
    }
    return out.sort((a, b) => b.count - a.count);
  }

  /** Historique d'assiduité d'un élève (un enseignant ne voit que ses propres classes). */
  async studentHistory(studentId: string, from: string | undefined, to: string | undefined, user: AuthUser) {
    await this.access.assertStudentAccess(user, studentId);
    const rows = await this.prisma.attendance.findMany({
      where: {
        studentId,
        date: { gte: from ? dateOnly(from) : undefined, lte: to ? dateOnly(to) : undefined },
        class: this.access.isTeacher(user) ? { teacherId: user.teacherId ?? '__none__' } : undefined,
      },
      orderBy: { date: 'desc' },
      include: { class: { select: { id: true, name: true } } },
      take: 500,
    });
    return { summary: summarize(rows), items: rows };
  }

  /** Séances déjà enregistrées pour une classe, avec les totaux. */
  async classHistory(classId: string, user: AuthUser) {
    await this.access.assertClassAccess(user, classId);
    const grouped = await this.prisma.attendance.groupBy({
      by: ['date', 'status'],
      where: { classId },
      _count: true,
      orderBy: { date: 'desc' },
      take: 200,
    });
    const map = new Map<string, Record<string, number>>();
    for (const g of grouped) {
      const k = ymd(g.date);
      map.set(k, { ...(map.get(k) ?? {}), [g.status]: g._count });
    }
    return [...map.entries()].slice(0, 40).map(([date, counts]) => ({ date, counts }));
  }
}
