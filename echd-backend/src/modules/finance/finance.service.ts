import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Due, DueStatus, FeePeriod, FeeSchedule, Prisma } from '@prisma/client';
import { Actor, AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { addMonths, dateOnly, diffDays, normalizePhone, pageArgs, pageResult, ymd } from '../../common/utils';
import {
  CancelPaymentDto,
  CreateDueDto,
  CreatePaymentDto,
  CreateReminderDto,
  DueQuery,
  PaymentQuery,
  PrepareReminderDto,
  UpdateDueDto,
} from './finance.dto';

export interface DueThresholds {
  grace: number;
  critical: number;
}

/** Statut d'une échéance (fonction pure, testable). */
export function computeDueStatus(
  due: { amountCents: number; paidCents: number; dueDate: Date; status: DueStatus },
  t: DueThresholds,
  today: Date,
): DueStatus {
  if (due.status === 'EXEMPT') return 'EXEMPT';
  if (due.paidCents >= due.amountCents) return 'PAID';
  const late = diffDays(today, due.dueDate);
  if (late > t.critical) return 'CRITICAL';
  if (late > t.grace) return 'LATE';
  return due.paidCents > 0 ? 'PARTIAL' : 'UPCOMING';
}

const MONTH_FMT = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

@Injectable()
export class FinanceService {
  private readonly logger = new Logger('Finance');
  private lastRefresh = 0;

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private audit: AuditService,
  ) {}

  async thresholds(): Promise<DueThresholds> {
    const s = await this.settings.getMany(['alerts.dueGraceDays', 'alerts.dueCriticalDays']);
    return { grace: s['alerts.dueGraceDays'], critical: Math.max(s['alerts.dueCriticalDays'], s['alerts.dueGraceDays']) };
  }

  /** Met à jour les statuts (À venir / Partiel / En retard / Critique / À jour) selon la date du jour. */
  async refreshStatuses(force = false): Promise<number> {
    if (!force && Date.now() - this.lastRefresh < 20_000) return 0;
    this.lastRefresh = Date.now();
    const [t, today] = await Promise.all([this.thresholds(), this.settings.today()]);
    const dues = await this.prisma.due.findMany({
      where: { status: { in: ['UPCOMING', 'PARTIAL', 'LATE', 'CRITICAL'] } },
      select: { id: true, amountCents: true, paidCents: true, dueDate: true, status: true },
    });
    const byStatus = new Map<DueStatus, string[]>();
    for (const d of dues) {
      const next = computeDueStatus(d, t, today);
      if (next !== d.status) byStatus.set(next, [...(byStatus.get(next) ?? []), d.id]);
    }
    let changed = 0;
    for (const [status, ids] of byStatus) {
      await this.prisma.due.updateMany({ where: { id: { in: ids } }, data: { status } });
      changed += ids.length;
    }
    return changed;
  }

  private async applyStatus(dueId: string) {
    const [d, t, today] = await Promise.all([this.prisma.due.findUniqueOrThrow({ where: { id: dueId } }), this.thresholds(), this.settings.today()]);
    const status = computeDueStatus(d, t, today);
    if (status !== d.status) return this.prisma.due.update({ where: { id: dueId }, data: { status } });
    return d;
  }

  /* ═══════════════ Génération de l'échéancier ═══════════════ */

  /**
   * Génère (sans doublon) les échéances d'un élève : frais d'inscription une fois par année (règle 5)
   * et cotisations selon le barème du cours (mensuel / trimestriel / annuel).
   */
  async generateForStudent(studentId: string): Promise<number> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.status === 'LEFT') return 0;
    const [enrollments, currentYear, schedules, today, discountPct] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { studentId, status: 'ACTIVE' },
        include: { class: { include: { course: true, schoolYear: true } } },
      }),
      this.prisma.schoolYear.findFirst({ where: { isCurrent: true } }),
      this.prisma.feeSchedule.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
      this.settings.today(),
      this.settings.get<number>('fees.siblingDiscountPercent'),
    ]);
    if (!schedules.length) return 0;

    // Remise fratrie : à partir du 2e enfant de la famille (par ordre de création)
    let discount = 0;
    if (discountPct > 0 && student.familyId) {
      const earlier = await this.prisma.student.count({
        where: { familyId: student.familyId, id: { not: student.id }, status: { not: 'LEFT' }, createdAt: { lt: student.createdAt } },
      });
      if (earlier > 0) discount = discountPct;
    }

    const pick = (kind: 'REGISTRATION' | 'TUITION', courseId?: string): FeeSchedule | undefined =>
      schedules.find((s) => s.kind === kind && s.courseId === courseId && courseId) ??
      schedules.find((s) => s.kind === kind && !s.courseId);

    let created = 0;
    const years = new Map<string, { year: { id: string; name: string; startDate: Date; endDate: Date }; courseIds: string[]; entry: Date }>();
    for (const e of enrollments) {
      const y = years.get(e.class.schoolYearId) ?? { year: e.class.schoolYear, courseIds: [], entry: e.startDate };
      y.courseIds.push(e.class.courseId);
      if (e.startDate < y.entry) y.entry = e.startDate;
      years.set(e.class.schoolYearId, y);
    }
    if (!years.size && currentYear) years.set(currentYear.id, { year: currentYear, courseIds: [], entry: today });

    for (const { year, courseIds, entry } of years.values()) {
      // Frais d'inscription : un seul par élève et par année
      const reg = courseIds.map((c) => pick('REGISTRATION', c)).find(Boolean) ?? pick('REGISTRATION');
      if (reg) {
        const exists = await this.prisma.due.findFirst({ where: { studentId, schoolYearId: year.id, kind: 'REGISTRATION' } });
        if (!exists) {
          await this.prisma.due.create({
            data: {
              studentId,
              feeScheduleId: reg.id,
              schoolYearId: year.id,
              kind: 'REGISTRATION',
              label: `${reg.titleFr} ${year.name}`,
              periodKey: `REG-${year.name}`,
              amountCents: reg.amountCents,
              dueDate: entry,
              status: reg.amountCents === 0 ? 'PAID' : 'UPCOMING',
            },
          });
          created++;
        }
      }
    }

    for (const e of enrollments) {
      const course = e.class.course;
      const year = e.class.schoolYear;
      const fee = pick('TUITION', course.id);
      if (!fee || fee.amountCents === 0) continue;
      const start = e.startDate > year.startDate ? e.startDate : year.startDate;
      const amount = discount ? Math.round((fee.amountCents * (100 - discount)) / 100) : fee.amountCents;
      for (const p of this.periods(fee.period, start, year.endDate, year.name)) {
        const exists = await this.prisma.due.findUnique({
          where: { studentId_feeScheduleId_periodKey: { studentId, feeScheduleId: fee.id, periodKey: p.key } },
        });
        if (exists) continue;
        await this.prisma.due.create({
          data: {
            studentId,
            feeScheduleId: fee.id,
            courseId: course.id,
            schoolYearId: year.id,
            kind: 'TUITION',
            label: `${fee.titleFr} — ${p.label}${discount ? ` (remise fratrie ${discount} %)` : ''}`,
            periodKey: p.key,
            amountCents: amount,
            dueDate: p.dueDate,
          },
        });
        created++;
      }
    }
    if (created) await this.refreshStatuses(true);
    return created;
  }

  /** Découpe l'année en périodes de facturation à partir de la date d'entrée. */
  private periods(period: FeePeriod, start: Date, end: Date, yearName: string) {
    const out: { key: string; label: string; dueDate: Date }[] = [];
    if (period === 'ONCE' || period === 'YEARLY') {
      out.push({ key: period === 'ONCE' ? 'ONCE' : `Y-${yearName}`, label: period === 'ONCE' ? 'paiement unique' : `année ${yearName}`, dueDate: start });
      return out;
    }
    const step = period === 'MONTHLY' ? 1 : 3;
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      const key = `${period === 'MONTHLY' ? '' : 'Q-'}${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
      const label =
        period === 'MONTHLY'
          ? MONTH_FMT.format(cursor)
          : `${MONTH_FMT.format(cursor)} → ${MONTH_FMT.format(addMonths(cursor, 2))}`;
      out.push({ key, label, dueDate: cursor < start ? start : cursor });
      cursor = addMonths(cursor, step);
    }
    return out;
  }

  /** Supprime les échéances futures, non payées, d'un cours quitté. */
  async pruneFutureDues(studentId: string, courseId: string, after: Date) {
    await this.prisma.due.deleteMany({
      where: { studentId, courseId, kind: 'TUITION', paidCents: 0, status: 'UPCOMING', dueDate: { gt: after }, payments: { none: {} } },
    });
  }

  async generateAll() {
    const students = await this.prisma.student.findMany({ where: { status: 'ENROLLED', archivedAt: null }, select: { id: true } });
    let created = 0;
    for (const s of students) created += await this.generateForStudent(s.id);
    return { students: students.length, created };
  }

  /* ═══════════════ Échéances ═══════════════ */

  private dueWhere(q: DueQuery): Prisma.DueWhereInput {
    const where: Prisma.DueWhereInput = {};
    if (q.studentId) where.studentId = q.studentId;
    if (q.status) where.status = q.status;
    if (q.kind) where.kind = q.kind;
    if (q.state === 'late') where.status = { in: ['LATE', 'CRITICAL'] };
    if (q.state === 'open') where.status = { in: ['UPCOMING', 'PARTIAL', 'LATE', 'CRITICAL'] };
    if (q.month) {
      const [y, m] = q.month.split('-').map(Number);
      where.dueDate = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
    }
    if (q.q?.trim()) {
      const t = q.q.trim();
      where.student = { OR: [{ firstName: { contains: t, mode: 'insensitive' } }, { lastName: { contains: t, mode: 'insensitive' } }] };
    }
    return where;
  }

  async listDues(q: DueQuery) {
    await this.refreshStatuses();
    const where = this.dueWhere(q);
    const [total, rows, sums, lateCount] = await Promise.all([
      this.prisma.due.count({ where }),
      this.prisma.due.findMany({
        where,
        ...pageArgs(q),
        orderBy: [{ dueDate: 'asc' }, { student: { lastName: 'asc' } }],
        include: { student: { select: { id: true, firstName: true, lastName: true, phone: true, guardians: { select: { phone: true }, take: 1 } } } },
      }),
      this.prisma.due.aggregate({ where: { ...where, status: { not: 'EXEMPT' } }, _sum: { amountCents: true, paidCents: true } }),
      this.prisma.due.count({ where: { ...where, status: { in: ['LATE', 'CRITICAL'] } } }),
    ]);
    const expected = sums._sum.amountCents ?? 0;
    const collected = sums._sum.paidCents ?? 0;
    return {
      ...pageResult(rows.map((d) => ({ ...d, remainingCents: Math.max(d.amountCents - d.paidCents, 0) })), total, q),
      summary: { expectedCents: expected, collectedCents: collected, remainingCents: expected - collected, lateCount },
    };
  }

  /** « Vue Cotisations » : un résumé par élève (reste à payer, retards). */
  async duesByStudent(q: { month?: string; state?: 'late' | 'open'; q?: string; page?: number; pageSize?: number }) {
    await this.refreshStatuses();
    const today = await this.settings.today();
    const dq = Object.assign(new DueQuery(), q);
    const where = this.dueWhere(dq);
    const dues = await this.prisma.due.findMany({
      where: { ...where, status: { not: 'EXEMPT' } },
      select: { studentId: true, amountCents: true, paidCents: true, status: true, dueDate: true },
    });
    const map = new Map<string, { total: number; paid: number; late: number; oldestLate: Date | null }>();
    for (const d of dues) {
      const m = map.get(d.studentId) ?? { total: 0, paid: 0, late: 0, oldestLate: null };
      m.total += d.amountCents;
      m.paid += d.paidCents;
      if (d.status === 'LATE' || d.status === 'CRITICAL') {
        m.late++;
        if (!m.oldestLate || d.dueDate < m.oldestLate) m.oldestLate = d.dueDate;
      }
      map.set(d.studentId, m);
    }
    const students = await this.prisma.student.findMany({
      where: { id: { in: [...map.keys()] } },
      select: { id: true, firstName: true, lastName: true, phone: true, audience: true, status: true, guardians: { select: { phone: true }, take: 1 } },
    });
    let items = students.map((s) => {
      const m = map.get(s.id)!;
      return {
        student: { id: s.id, firstName: s.firstName, lastName: s.lastName, phone: s.phone || s.guardians[0]?.phone || null, audience: s.audience, status: s.status },
        totalCents: m.total,
        paidCents: m.paid,
        remainingCents: m.total - m.paid,
        lateCount: m.late,
        daysLate: m.oldestLate ? diffDays(today, m.oldestLate) : 0,
      };
    });
    if (q.state === 'late') items = items.filter((i) => i.lateCount > 0);
    else items = items.filter((i) => i.remainingCents > 0 || !q.state);
    items.sort((a, b) => b.daysLate - a.daysLate || b.remainingCents - a.remainingCents);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
      summary: {
        expectedCents: items.reduce((a, i) => a + i.totalCents, 0),
        collectedCents: items.reduce((a, i) => a + i.paidCents, 0),
        remainingCents: items.reduce((a, i) => a + i.remainingCents, 0),
        lateStudents: items.filter((i) => i.lateCount > 0).length,
      },
    };
  }

  async studentFinance(studentId: string) {
    await this.refreshStatuses();
    const s = await this.prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    const [dues, payments, reminders] = await Promise.all([
      this.prisma.due.findMany({ where: { studentId }, orderBy: { dueDate: 'asc' } }),
      this.prisma.payment.findMany({ where: { studentId }, orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }], include: { due: { select: { label: true } } } }),
      this.prisma.reminder.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const billable = dues.filter((d) => d.status !== 'EXEMPT');
    const total = billable.reduce((a, d) => a + d.amountCents, 0);
    const paid = billable.reduce((a, d) => a + d.paidCents, 0);
    return {
      dues: dues.map((d) => ({ ...d, remainingCents: Math.max(d.amountCents - d.paidCents, 0) })),
      payments,
      reminders,
      totals: { totalCents: total, paidCents: paid, remainingCents: total - paid },
    };
  }

  async createDue(dto: CreateDueDto, actor: Actor, ip?: string) {
    const student = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Élève introuvable.');
    const year = await this.prisma.schoolYear.findFirst({ where: { isCurrent: true } });
    if (!year) throw new BadRequestException('Aucune année scolaire courante.');
    const due = await this.prisma.due.create({
      data: {
        studentId: dto.studentId,
        schoolYearId: year.id,
        kind: dto.kind ?? 'TUITION',
        label: dto.label,
        periodKey: `MANUAL-${Date.now()}`,
        amountCents: dto.amountCents,
        dueDate: dateOnly(dto.dueDate),
        courseId: dto.courseId,
      },
    });
    await this.audit.log(actor, 'CREATE', 'Due', due.id, undefined, due, ip);
    return this.applyStatus(due.id);
  }

  async updateDue(id: string, dto: UpdateDueDto, actor: Actor, ip?: string) {
    const before = await this.prisma.due.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Échéance introuvable.');
    if (dto.amountCents !== undefined && dto.amountCents < before.paidCents) {
      throw new BadRequestException('Le montant ne peut pas être inférieur à ce qui a déjà été payé.');
    }
    await this.prisma.due.update({
      where: { id },
      data: { label: dto.label, amountCents: dto.amountCents, dueDate: dto.dueDate ? dateOnly(dto.dueDate) : undefined },
    });
    const after = await this.applyStatus(id);
    await this.audit.log(actor, 'UPDATE', 'Due', id, before, after, ip);
    return after;
  }

  async exempt(id: string, reason: string, actor: Actor, ip?: string) {
    const before = await this.prisma.due.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Échéance introuvable.');
    const after = await this.prisma.due.update({ where: { id }, data: { status: 'EXEMPT', exemptReason: reason } });
    await this.audit.log(actor, 'EXEMPT', 'Due', id, before, after, ip);
    return after;
  }

  async unexempt(id: string, actor: Actor, ip?: string) {
    const before = await this.prisma.due.findUnique({ where: { id } });
    if (!before || before.status !== 'EXEMPT') throw new BadRequestException("Cette échéance n'est pas exonérée.");
    await this.prisma.due.update({ where: { id }, data: { status: 'UPCOMING', exemptReason: null } });
    const after = await this.applyStatus(id);
    await this.audit.log(actor, 'UNEXEMPT', 'Due', id, before, after, ip);
    return after;
  }

  async removeDue(id: string, actor: Actor, ip?: string) {
    const d = await this.prisma.due.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } });
    if (!d) throw new NotFoundException('Échéance introuvable.');
    if (d._count.payments) throw new ConflictException('Cette échéance a des paiements enregistrés : exonérez-la ou annulez les paiements.');
    await this.prisma.due.delete({ where: { id } });
    await this.audit.log(actor, 'DELETE', 'Due', id, d, undefined, ip);
    return { ok: true };
  }

  /* ═══════════════ Paiements ═══════════════ */

  private async nextReceiptNumber(): Promise<string> {
    const year = (await this.settings.today()).getUTCFullYear();
    const c = await this.prisma.counter.upsert({
      where: { key: `receipt-${year}` },
      update: { value: { increment: 1 } },
      create: { key: `receipt-${year}`, value: 1 },
    });
    return `R-${year}-${String(c.value).padStart(5, '0')}`;
  }

  async createPayment(dto: CreatePaymentDto, actor: (Actor & { id: string }) | null, ip?: string) {
    const due = await this.prisma.due.findUnique({ where: { id: dto.dueId } });
    if (!due) throw new NotFoundException('Échéance introuvable.');
    if (due.status === 'EXEMPT') throw new BadRequestException('Cette échéance est exonérée.');
    const remaining = due.amountCents - due.paidCents;
    if (remaining <= 0) throw new BadRequestException('Cette échéance est déjà soldée.');
    if (dto.amountCents > remaining) {
      throw new BadRequestException(`Le montant dépasse le reste à payer (${(remaining / 100).toFixed(2)}).`);
    }
    const today = await this.settings.today();
    const paidAt = dto.paidAt ? dateOnly(dto.paidAt) : today;
    if (paidAt > today) throw new BadRequestException('La date de paiement ne peut pas être dans le futur.');

    const receiptNumber = await this.nextReceiptNumber();
    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          studentId: due.studentId,
          dueId: due.id,
          amountCents: dto.amountCents,
          paidAt,
          method: dto.method,
          periodCovered: dto.periodCovered ?? due.label,
          reference: dto.reference,
          comment: dto.comment,
          receiptNumber,
          createdById: actor?.id,
          createdByLabel: actor ? `${actor.firstName} ${actor.lastName}`.trim() : '',
        },
      });
      await tx.due.update({ where: { id: due.id }, data: { paidCents: { increment: dto.amountCents } } });
      return p;
    });
    await this.applyStatus(due.id);
    await this.audit.log(actor, 'PAYMENT', 'Payment', payment.id, undefined, payment, ip);
    return this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { due: true, student: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  /** Règle 6 : un paiement ne se supprime jamais, il s'annule avec un motif (tracé dans le journal). */
  async cancelPayment(id: string, dto: CancelPaymentDto, actor: Actor & { id: string }, ip?: string) {
    const p = await this.prisma.payment.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Paiement introuvable.');
    if (p.cancelledAt) throw new BadRequestException('Ce paiement est déjà annulé.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.payment.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelReason: dto.reason, cancelledById: actor.id },
      });
      await tx.due.update({ where: { id: p.dueId }, data: { paidCents: { decrement: p.amountCents } } });
      return u;
    });
    // l'échéance redevient « à venir / en retard / partiel » selon la date
    const due = await this.prisma.due.findUniqueOrThrow({ where: { id: p.dueId } });
    if (due.status === 'PAID') await this.prisma.due.update({ where: { id: due.id }, data: { status: 'UPCOMING' } });
    await this.applyStatus(p.dueId);
    await this.audit.log(actor, 'CANCEL_PAYMENT', 'Payment', id, p, updated, ip);
    return updated;
  }

  async listPayments(q: PaymentQuery) {
    const where: Prisma.PaymentWhereInput = {};
    if (q.studentId) where.studentId = q.studentId;
    if (q.method) where.method = q.method;
    if (q.includeCancelled !== 'true') where.cancelledAt = null;
    if (q.from || q.to) where.paidAt = { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined };
    const [total, rows, sum] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        ...pageArgs(q),
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        include: { student: { select: { id: true, firstName: true, lastName: true } }, due: { select: { label: true } } },
      }),
      this.prisma.payment.aggregate({ where: { ...where, cancelledAt: null }, _sum: { amountCents: true } }),
    ]);
    return { ...pageResult(rows, total, q), summary: { collectedCents: sum._sum.amountCents ?? 0 } };
  }

  /** Total encaissé et total attendu d'un mois (par défaut le mois courant). */
  async summary(month?: string) {
    await this.refreshStatuses();
    const today = await this.settings.today();
    const m = month ?? ymd(today).slice(0, 7);
    const [y, mo] = m.split('-').map(Number);
    const from = new Date(Date.UTC(y, mo - 1, 1));
    const to = new Date(Date.UTC(y, mo, 1));
    const [collected, byMethod, expected] = await Promise.all([
      this.prisma.payment.aggregate({ where: { cancelledAt: null, paidAt: { gte: from, lt: to } }, _sum: { amountCents: true }, _count: true }),
      this.prisma.payment.groupBy({ by: ['method'], where: { cancelledAt: null, paidAt: { gte: from, lt: to } }, _sum: { amountCents: true } }),
      this.prisma.due.aggregate({ where: { dueDate: { gte: from, lt: to }, status: { not: 'EXEMPT' } }, _sum: { amountCents: true, paidCents: true } }),
    ]);
    return {
      month: m,
      collectedCents: collected._sum.amountCents ?? 0,
      paymentsCount: collected._count,
      byMethod: byMethod.map((x) => ({ method: x.method, cents: x._sum.amountCents ?? 0 })),
      expectedCents: expected._sum.amountCents ?? 0,
      expectedPaidCents: expected._sum.paidCents ?? 0,
    };
  }

  /* ═══════════════ Relances ═══════════════ */

  /** Prépare un message de relance personnalisé et les liens WhatsApp / e-mail prêts à ouvrir. */
  async prepareReminder(dto: PrepareReminderDto) {
    if (!dto.dueId && !dto.studentId) throw new BadRequestException('Indiquez une échéance ou un élève.');
    const lang = dto.lang ?? 'fr';
    const due = dto.dueId ? await this.prisma.due.findUnique({ where: { id: dto.dueId } }) : null;
    if (dto.dueId && !due) throw new NotFoundException('Échéance introuvable.');
    const studentId = due?.studentId ?? dto.studentId!;
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, include: { guardians: true } });
    if (!student) throw new NotFoundException('Élève introuvable.');

    let amountCents: number;
    let period: string;
    if (due) {
      amountCents = due.amountCents - due.paidCents;
      period = due.label;
    } else {
      const open = await this.prisma.due.findMany({ where: { studentId, status: { in: ['LATE', 'CRITICAL', 'PARTIAL', 'UPCOMING'] } } });
      amountCents = open.reduce((a, d) => a + d.amountCents - d.paidCents, 0);
      period = lang === 'ar' ? 'الاشتراكات المستحقة' : 'cotisations en cours';
    }
    const cfg = await this.settings.getMany(['templates.reminder', 'institute.name', 'institute.currency', 'institute.defaultCountryCode']);
    const tpl: string = cfg['templates.reminder'][lang] || cfg['templates.reminder'].fr;
    const school = cfg['institute.name'][lang] || cfg['institute.name'].fr;
    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cfg['institute.currency'] }).format(amountCents / 100);
    const message = tpl
      .replace(/\{student\}/g, `${student.firstName} ${student.lastName}`.trim())
      .replace(/\{amount\}/g, amount)
      .replace(/\{period\}/g, period)
      .replace(/\{school\}/g, school)
      .trim();

    const phone = student.phone || student.guardians.find((g) => g.phone)?.phone || null;
    const email = student.email || student.guardians.find((g) => g.email)?.email || null;
    const wa = normalizePhone(phone, cfg['institute.defaultCountryCode']);
    return {
      studentId,
      dueId: due?.id ?? null,
      lang,
      message,
      amountCents,
      phone,
      email,
      whatsappUrl: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : null,
      mailtoUrl: email ? `mailto:${email}?subject=${encodeURIComponent(school)}&body=${encodeURIComponent(message)}` : null,
    };
  }

  /** Enregistre qu'une relance a été envoyée (historique conservé). */
  async logReminder(dto: CreateReminderDto, actor: Actor) {
    const s = await this.prisma.student.findUnique({ where: { id: dto.studentId } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    const r = await this.prisma.reminder.create({
      data: {
        studentId: dto.studentId,
        dueId: dto.dueId,
        channel: dto.channel,
        message: dto.message,
        createdById: actor?.id,
        createdByLabel: actor ? `${actor.firstName} ${actor.lastName}`.trim() : '',
      },
    });
    await this.audit.log(actor, 'REMINDER', 'Reminder', r.id, undefined, { studentId: dto.studentId, channel: dto.channel });
    return r;
  }

  listReminders(studentId?: string, dueId?: string) {
    return this.prisma.reminder.findMany({
      where: { studentId, dueId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}
