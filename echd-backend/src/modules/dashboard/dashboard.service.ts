import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { addDays, ymd } from '../../common/utils';
import { expandOccurrences } from '../academic/timetable.service';
import { AlertsService } from '../alerts/alerts.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private alerts: AlertsService,
    private finance: FinanceService,
    private announcements: AnnouncementsService,
  ) {}

  /** Une seule page : chiffres clés, à traiter, prochains cours, annonces. Contenu adapté au rôle. */
  async get(user: AuthUser) {
    return user.role === Role.TEACHER ? this.teacher(user) : this.staff();
  }

  private async sessions(where: object, days: number, limit: number) {
    const today = await this.settings.today();
    const to = addDays(today, days);
    const [slots, closures] = await Promise.all([
      this.prisma.slot.findMany({
        where: { class: { active: true, schoolYear: { isCurrent: true }, ...where } },
        include: {
          exceptions: { where: { date: { gte: today, lte: to } } },
          class: {
            select: {
              id: true,
              name: true,
              course: { select: { id: true, titleFr: true, titleAr: true, color: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
              room: { select: { id: true, name: true, nameAr: true } },
            },
          },
          room: { select: { id: true, name: true, nameAr: true } },
        },
      }),
      this.prisma.closure.findMany({ where: { schoolYear: { isCurrent: true }, endDate: { gte: today } } }),
    ]);
    const meta = new Map(slots.map((s) => [s.id, s]));
    return expandOccurrences(slots.map((s) => ({ ...s, exceptions: s.exceptions })), closures, today, to)
      .slice(0, limit)
      .map((o) => {
        const s = meta.get(o.slotId)!;
        return { ...o, class: s.class, room: s.room ?? s.class.room };
      });
  }

  private async staff() {
    const today = await this.settings.today();
    const [students, classes, counts, fin, todo, next, recent, prereg] = await Promise.all([
      this.prisma.student.groupBy({ by: ['audience'], where: { status: 'ENROLLED', archivedAt: null }, _count: true }),
      this.prisma.schoolClass.findMany({
        where: { active: true, schoolYear: { isCurrent: true } },
        select: { capacity: true, _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } },
      }),
      this.prisma.preRegistration.count({ where: { status: 'NEW' } }),
      this.finance.summary(),
      this.alerts.todo(),
      this.sessions({}, 14, 8),
      this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, titleFr: true, titleAr: true, status: true, pinned: true, category: true, createdAt: true } }),
      this.prisma.preRegistration.count({ where: { status: { in: ['NEW', 'CONTACTED'] } } }),
    ]);
    const children = students.find((s) => s.audience === 'CHILD')?._count ?? 0;
    const adults = students.find((s) => s.audience === 'ADULT')?._count ?? 0;
    return {
      role: 'STAFF',
      today: ymd(today),
      kpis: {
        students: { total: children + adults, children, adults },
        seatsLeft: classes.reduce((a, c) => a + Math.max(c.capacity - c._count.enrollments, 0), 0),
        seatsTotal: classes.reduce((a, c) => a + c.capacity, 0),
        newPreRegistrations: counts,
        openPreRegistrations: prereg,
        collectedThisMonthCents: fin.collectedCents,
        expectedThisMonthCents: fin.expectedCents,
        lateStudents: todo.lateDues.students,
      },
      todo,
      nextSessions: next,
      recentAnnouncements: recent,
    };
  }

  private async teacher(user: AuthUser) {
    const today = await this.settings.today();
    const mine = { teacherId: user.teacherId ?? '__none__' };
    const [classes, next, announcements] = await Promise.all([
      this.prisma.schoolClass.findMany({
        where: { ...mine, active: true, schoolYear: { isCurrent: true } },
        include: {
          course: { select: { titleFr: true, titleAr: true, color: true } },
          _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { name: 'asc' },
      }),
      this.sessions(mine, 14, 12),
      this.announcements.publicList({ limit: 3 }),
    ]);
    const todaySessions = next.filter((s) => s.date === ymd(today));
    const done = await this.prisma.attendance.groupBy({
      by: ['classId'],
      where: { date: today, classId: { in: classes.map((c) => c.id) } },
      _count: true,
    });
    return {
      role: 'TEACHER',
      today: ymd(today),
      myClasses: classes.map((c) => ({
        id: c.id,
        name: c.name,
        course: c.course,
        studentsCount: c._count.enrollments,
        attendanceDoneToday: done.some((d) => d.classId === c.id),
      })),
      myStudentsCount: classes.reduce((a, c) => a + c._count.enrollments, 0),
      todaySessions: todaySessions.map((s) => ({ ...s, attendanceDone: done.some((d) => d.classId === s.classId) })),
      nextSessions: next,
      announcements: announcements.items,
    };
  }
}
