import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Role } from '@prisma/client';
import { FilesService } from '../../common/files.service';
import { MailService } from '../../common/mail.service';
import { NotificationsService } from '../../common/notifications.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { addDays, diffDays, fullName, isoWeekday, ymd } from '../../common/utils';
import { AttendanceService } from '../attendance/attendance.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger('Alerts');

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private finance: FinanceService,
    private attendance: AttendanceService,
    private notifications: NotificationsService,
    private mail: MailService,
    private files: FilesService,
  ) {}

  /**
   * « À traiter » : tout ce qui demande une action de l'administration
   * (carte du tableau de bord, calculé en direct).
   */
  async todo() {
    await this.finance.refreshStatuses();
    const today = await this.settings.today();
    const staleDays = await this.settings.get<number>('alerts.preRegPendingDays');
    const staleLimit = addDays(today, -staleDays);

    const [preregs, lateDues, absences, classes, noClass, year, retention] = await Promise.all([
      this.prisma.preRegistration.findMany({
        where: { status: { in: ['NEW', 'CONTACTED'] } },
        orderBy: { createdAt: 'asc' },
        include: { persons: { select: { firstName: true, lastName: true } } },
      }),
      this.finance.duesByStudent({ state: 'late', pageSize: 50 }),
      this.attendance.repeatedAbsences(),
      this.prisma.schoolClass.findMany({
        where: { active: true, schoolYear: { isCurrent: true } },
        select: {
          id: true,
          name: true,
          capacity: true,
          enrollments: { where: { status: { in: ['ACTIVE', 'WAITLIST'] } }, select: { status: true } },
        },
      }),
      this.prisma.student.findMany({
        where: { status: 'ENROLLED', archivedAt: null, enrollments: { none: { status: 'ACTIVE' } } },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.schoolYear.findFirst({ where: { isCurrent: true } }),
      this.prisma.student.count({
        where: { status: 'LEFT', leftAt: { lt: addDays(today, -365 * (await this.settings.get<number>('retention.years'))) } },
      }),
    ]);

    const full = classes
      .map((c) => {
        const active = c.enrollments.filter((e) => e.status === 'ACTIVE').length;
        return { id: c.id, name: c.name, capacity: c.capacity, active, waitlist: c.enrollments.filter((e) => e.status === 'WAITLIST').length };
      })
      .filter((c) => c.active >= c.capacity);

    const daysLeft = year ? diffDays(year.endDate, today) : null;
    const result = {
      preRegistrations: {
        count: preregs.length,
        stale: preregs.filter((p) => p.createdAt < staleLimit).length,
        items: preregs.slice(0, 5).map((p) => ({
          id: p.id,
          reference: p.reference,
          names: p.persons.map((x) => fullName(x)).join(', '),
          waitingDays: diffDays(today, new Date(Date.UTC(p.createdAt.getUTCFullYear(), p.createdAt.getUTCMonth(), p.createdAt.getUTCDate()))),
        })),
      },
      lateDues: {
        students: lateDues.total,
        remainingCents: lateDues.items.reduce((a, i) => a + i.remainingCents, 0),
        items: lateDues.items.slice(0, 5),
      },
      absences: { count: absences.length, items: absences.slice(0, 5) },
      fullClasses: { count: full.length, items: full },
      studentsWithoutClass: { count: noClass.length, items: noClass.slice(0, 5) },
      yearEnd: year && daysLeft !== null && daysLeft <= 30 && daysLeft >= 0 ? { name: year.name, endDate: year.endDate, daysLeft } : null,
      retentionExpired: retention,
    };
    const total =
      result.preRegistrations.count +
      result.lateDues.students +
      result.absences.count +
      result.studentsWithoutClass.count +
      (result.yearEnd ? 1 : 0) +
      (retention ? 1 : 0);
    return { total, ...result };
  }

  /* ═══════════════ Tâches planifiées ═══════════════ */

  @Cron('0 7 * * *', { timeZone: process.env.CRON_TZ || 'Europe/Paris' })
  async dailyJob() {
    try {
      await this.runDaily();
    } catch (e) {
      this.logger.error(`Tâche quotidienne en échec : ${(e as Error).message}`);
    }
  }

  /** Recalcule les retards, crée les notifications (sans doublon) et envoie le résumé e-mail. */
  async runDaily() {
    const today = await this.settings.today();
    await this.finance.refreshStatuses(true);

    // 1) Retards de cotisation : une notification par élève et par palier (retard / critique)
    const late = await this.prisma.due.findMany({
      where: { status: { in: ['LATE', 'CRITICAL'] } },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { dueDate: 'asc' },
    });
    const perStudent = new Map<string, typeof late>();
    for (const d of late) perStudent.set(d.studentId, [...(perStudent.get(d.studentId) ?? []), d]);
    let created = 0;
    for (const [studentId, dues] of perStudent) {
      const critical = dues.some((d) => d.status === 'CRITICAL');
      const remaining = dues.reduce((a, d) => a + d.amountCents - d.paidCents, 0);
      created += await this.notifications.notifyStaff({
        type: critical ? 'DUE_CRITICAL' : 'DUE_LATE',
        title: `${critical ? 'Retard critique' : 'Cotisation en retard'} : ${fullName(dues[0].student)}`,
        body: `${dues.length} échéance(s) — reste ${(remaining / 100).toFixed(2)} ${await this.settings.get<string>('institute.currency')}`,
        entityType: 'Student',
        entityId: studentId,
        dedupeKey: `late:${studentId}:${critical ? 'C' : 'L'}:${dues[0].id}`,
      });
    }

    // 2) Hebdomadaire : préinscriptions non traitées, élèves sans classe
    const monday = ymd(addDays(today, -(isoWeekday(today) - 1)));
    const days = await this.settings.get<number>('alerts.preRegPendingDays');
    const stale = await this.prisma.preRegistration.count({
      where: { status: { in: ['NEW', 'CONTACTED'] }, createdAt: { lt: addDays(today, -days) } },
    });
    if (stale) {
      created += await this.notifications.notifyStaff({
        type: 'PREREG_PENDING',
        title: `${stale} préinscription(s) non traitée(s) depuis plus de ${days} jours`,
        entityType: 'PreRegistration',
        dedupeKey: `prereg-stale:${monday}`,
      });
    }
    const noClass = await this.prisma.student.count({
      where: { status: 'ENROLLED', archivedAt: null, enrollments: { none: { status: 'ACTIVE' } } },
    });
    if (noClass) {
      created += await this.notifications.notifyStaff({
        type: 'NO_CLASS',
        title: `${noClass} élève(s) inscrit(s) sans classe affectée`,
        entityType: 'Student',
        dedupeKey: `noclass:${monday}`,
      });
    }

    // 3) Fin d'année scolaire
    const year = await this.prisma.schoolYear.findFirst({ where: { isCurrent: true } });
    if (year) {
      const left = diffDays(year.endDate, today);
      if (left >= 0 && left <= 30) {
        created += await this.notifications.notifyStaff({
          type: 'YEAR_END',
          title: `L'année ${year.name} se termine dans ${left} jour(s)`,
          body: 'Pensez à préparer la rentrée : duplication de l’année, bulletins, réinscriptions.',
          dedupeKey: `yearend:${year.id}`,
        });
      }
    }

    // 4) Résumé par e-mail (quotidien ou hebdomadaire le lundi)
    const mode = await this.settings.get<string>('alerts.digest');
    let digestSent = false;
    if (mode === 'daily' || (mode === 'weekly' && isoWeekday(today) === 1)) digestSent = await this.sendDigest();

    // 5) Nettoyage
    await this.files.cleanTmp(24);
    const now = new Date();
    await this.prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: addDays(now, -7) } }] } });
    await this.prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: addDays(now, -1) } } });
    await this.prisma.notification.deleteMany({ where: { read: true, createdAt: { lt: addDays(now, -90) } } });

    this.logger.log(`Tâche quotidienne terminée : ${created} notification(s) créée(s), résumé e-mail ${digestSent ? 'envoyé' : 'non envoyé'}.`);
    return { notifications: created, digestSent };
  }

  async sendDigest(): Promise<boolean> {
    const [todo, name, users] = await Promise.all([
      this.todo(),
      this.settings.get<{ fr: string }>('institute.name'),
      this.prisma.user.findMany({ where: { active: true, role: { in: [Role.ADMIN, Role.MANAGER] }, email: { not: null } }, select: { email: true } }),
    ]);
    const to = users.map((u) => u.email!);
    if (!to.length || todo.total === 0) return false;
    const cur = await this.settings.get<string>('institute.currency');
    const lines = [
      `Résumé — ${name.fr}`,
      '',
      todo.preRegistrations.count ? `• Préinscriptions à traiter : ${todo.preRegistrations.count} (dont ${todo.preRegistrations.stale} en attente depuis trop longtemps)` : '',
      todo.lateDues.students ? `• Élèves en retard de cotisation : ${todo.lateDues.students} (reste dû : ${(todo.lateDues.remainingCents / 100).toFixed(2)} ${cur})` : '',
      todo.absences.count ? `• Absences répétées : ${todo.absences.count} élève(s)` : '',
      todo.fullClasses.count ? `• Classes pleines : ${todo.fullClasses.items.map((c) => c.name).join(', ')}` : '',
      todo.studentsWithoutClass.count ? `• Élèves sans classe : ${todo.studentsWithoutClass.count}` : '',
      todo.yearEnd ? `• Fin d'année scolaire dans ${todo.yearEnd.daysLeft} jour(s)` : '',
      '',
      `ملخص: ${todo.total} مهمة تنتظر المعالجة.`,
    ].filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i !== a.length - 1));
    return this.mail.send({ to, subject: `${name.fr} — ${todo.total} élément(s) à traiter`, text: lines.join('\n') });
  }
}
