//echd-backend/src/modules/alerts/alerts.service.ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
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
export class AlertsService implements OnApplicationBootstrap {
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
    await this.runDailyOnce();
  }

  /**
   * Rattrapage au démarrage : sur un hébergement qui s'endort (Render gratuit), le serveur peut dormir à 7 h.
   * Au réveil, si la tâche du jour n'a pas tourné et qu'il est 7 h passées, on la lance (une seule fois par jour).
   */
  onApplicationBootstrap() {
    if (process.env.DAILY_CATCHUP === 'false') return;
    setTimeout(() => {
      const tz = process.env.CRON_TZ || 'Europe/Paris';
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
      if (hour >= 7) void this.runDailyOnce();
    }, 30_000).unref();
  }

  /** Une seule exécution par jour, même si le cron et le rattrapage se croisent ou si deux instances tournent. */
  private async runDailyOnce() {
    let key = '';
    try {
      key = `daily-${ymd(await this.settings.today())}`;
      try {
        await this.prisma.counter.create({ data: { key, value: 1 } });
      } catch {
        return; // déjà exécutée aujourd'hui
      }
      await this.runDaily();
    } catch (e) {
      this.logger.error(`Tâche quotidienne en échec : ${(e as Error).message}`);
      // on libère le jour pour permettre un nouvel essai (rattrapage au prochain démarrage)
      if (key) await this.prisma.counter.delete({ where: { key } }).catch(() => undefined);
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

    // 1 bis) Relances de paiement automatiques par e-mail (si activées dans les réglages)
    const remindersSent = await this.sendAutoReminders();

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

    this.logger.log(`Tâche quotidienne terminée : ${created} notification(s) créée(s), résumé e-mail ${digestSent ? 'envoyé' : 'non envoyé'}, ${remindersSent} relance(s) envoyée(s).`);
    return { notifications: created, digestSent, remindersSent };
  }

  /**
   * Relance chaque famille en retard de paiement par e-mail, au plus une fois tous les « reminders.everyDays » jours.
   * Message = modèle « Relance de paiement » des réglages (FR + AR). Chaque envoi est tracé dans l'historique des relances.
   */
  async sendAutoReminders(): Promise<number> {
    const cfg = await this.settings.getMany(['reminders.auto', 'reminders.everyDays', 'institute.name']);
    if (!cfg['reminders.auto']) return 0;
    if (!this.mail.enabled) {
      this.logger.warn('Relances automatiques activées mais aucun service e-mail n’est configuré (BREVO_API_KEY ou SMTP_HOST).');
      return 0;
    }
    const since = addDays(new Date(), -Number(cfg['reminders.everyDays']));
    const late = await this.prisma.due.findMany({
      where: { status: { in: ['LATE', 'CRITICAL'] }, student: { archivedAt: null, status: { in: ['ENROLLED', 'SUSPENDED'] } } },
      select: { studentId: true },
      distinct: ['studentId'],
      take: 300,
    });
    const school = cfg['institute.name'].fr as string;
    let sent = 0;
    for (const { studentId } of late) {
      if (sent >= 150) break; // garde-fou : quota d'envoi quotidien des services e-mail gratuits
      const recent = await this.prisma.reminder.findFirst({ where: { studentId, channel: 'EMAIL', createdAt: { gte: since } }, select: { id: true } });
      if (recent) continue;
      const student = await this.prisma.student.findUnique({ where: { id: studentId }, include: { guardians: true } });
      if (!student) continue;
      const to = this.finance.recipientsOf(student);
      if (!to.length) continue;
      try {
        const fr = await this.finance.prepareReminder({ studentId, lang: 'fr' });
        if (fr.amountCents <= 0) continue;
        const ar = await this.finance.prepareReminder({ studentId, lang: 'ar' });
        const message = `${fr.message}\n\n—\n\n${ar.message}`;
        const ok = await this.mail.send({ to, subject: `${school} — Rappel de cotisation`, text: message });
        if (!ok) continue;
        await this.prisma.reminder.create({ data: { studentId, channel: 'EMAIL', message: fr.message, createdByLabel: 'Automatique' } });
        sent++;
      } catch (e) {
        this.logger.warn(`Relance automatique impossible (${studentId}) : ${(e as Error).message}`);
      }
    }
    return sent;
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
