//echd-backend/src/modules/expenses/expenses.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, Prisma } from '@prisma/client';
import { Actor, AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { dateOnly, pageArgs, pageResult, ymd } from '../../common/utils';
import { CollectionPeriod, periodRange } from '../finance/finance.service';
import { CancelExpenseDto, CreateExpenseDto, ExpenseQuery, UpdateExpenseDto } from './expenses.dto';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['SALARY', 'EQUIPMENT', 'SUPPLIES', 'OTHER'];

/**
 * Calcul pur du solde d'une période : encaissements − dépenses, par catégorie et mois par mois.
 * Séparé de la base de données pour être testé sans elle.
 */
export function buildBalance(input: {
  months: string[];
  payments: Array<{ amountCents: number; paidAt: Date }>;
  expenses: Array<{ amountCents: number; spentAt: Date; category: ExpenseCategory }>;
}) {
  const perMonth = new Map(input.months.map((m) => [m, { collectedCents: 0, spentCents: 0 }]));
  const perCategory = new Map<ExpenseCategory, { cents: number; count: number }>(EXPENSE_CATEGORIES.map((c) => [c, { cents: 0, count: 0 }]));
  let collected = 0;
  let spent = 0;
  for (const p of input.payments) {
    collected += p.amountCents;
    const row = perMonth.get(ymd(p.paidAt).slice(0, 7));
    if (row) row.collectedCents += p.amountCents;
  }
  for (const e of input.expenses) {
    spent += e.amountCents;
    const row = perMonth.get(ymd(e.spentAt).slice(0, 7));
    if (row) row.spentCents += e.amountCents;
    const cat = perCategory.get(e.category)!;
    cat.cents += e.amountCents;
    cat.count += 1;
  }
  return {
    collectedCents: collected,
    spentCents: spent,
    balanceCents: collected - spent,
    expensesCount: input.expenses.length,
    byCategory: [...perCategory].map(([category, v]) => ({ category, ...v })),
    byMonth: input.months.map((month) => {
      const v = perMonth.get(month)!;
      return { month, ...v, balanceCents: v.collectedCents - v.spentCents };
    }),
  };
}

const clean = (v?: string | null) => {
  const t = v?.trim();
  return t ? t : null;
};

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private audit: AuditService,
  ) {}

  /** Dans la transaction : une dépense refusée ne « brûle » pas de numéro. */
  private async nextNumber(year: number, db: Prisma.TransactionClient): Promise<string> {
    const c = await db.counter.upsert({
      where: { key: `expense-${year}` },
      update: { value: { increment: 1 } },
      create: { key: `expense-${year}`, value: 1 },
    });
    return `D-${year}-${String(c.value).padStart(5, '0')}`;
  }

  private async checkDate(spentAt?: string): Promise<Date> {
    const today = await this.settings.today();
    const day = spentAt ? dateOnly(spentAt) : today;
    if (day.getTime() > today.getTime()) throw new BadRequestException('La date d’une dépense ne peut pas être dans le futur.');
    if (day.getUTCFullYear() < 2000) throw new BadRequestException('Date invalide.');
    return day;
  }

  async create(dto: CreateExpenseDto, actor: Actor & { id: string }, ip?: string) {
    const label = dto.label.trim();
    if (label.length < 2) throw new BadRequestException('Précisez l’objet de la dépense.');
    const spentAt = await this.checkDate(dto.spentAt);
    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(spentAt.getUTCFullYear(), tx);
      return tx.expense.create({
        data: {
          number,
          category: dto.category,
          label,
          beneficiary: clean(dto.beneficiary),
          amountCents: dto.amountCents,
          spentAt,
          method: dto.method,
          reference: clean(dto.reference),
          comment: clean(dto.comment),
          createdById: actor.id,
          createdByLabel: [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.username,
        },
      });
    });
    await this.audit.log(actor, 'CREATE', 'Expense', created.id, undefined, created, ip);
    return created;
  }

  async update(id: string, dto: UpdateExpenseDto, actor: Actor & { id: string }, ip?: string) {
    const before = await this.prisma.expense.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Dépense introuvable.');
    if (before.cancelledAt) throw new BadRequestException('Une dépense annulée ne peut plus être modifiée.');
    const data: Prisma.ExpenseUpdateInput = {};
    if (dto.category) data.category = dto.category;
    if (dto.label !== undefined) {
      const label = dto.label.trim();
      if (label.length < 2) throw new BadRequestException('Précisez l’objet de la dépense.');
      data.label = label;
    }
    if (dto.beneficiary !== undefined) data.beneficiary = clean(dto.beneficiary);
    if (dto.amountCents !== undefined) data.amountCents = dto.amountCents;
    if (dto.spentAt) data.spentAt = await this.checkDate(dto.spentAt);
    if (dto.method) data.method = dto.method;
    if (dto.reference !== undefined) data.reference = clean(dto.reference);
    if (dto.comment !== undefined) data.comment = clean(dto.comment);
    // Garde atomique : on ne modifie pas une dépense annulée entre-temps
    const res = await this.prisma.expense.updateMany({ where: { id, cancelledAt: null }, data: data as Prisma.ExpenseUpdateManyMutationInput });
    if (res.count !== 1) throw new BadRequestException('Une dépense annulée ne peut plus être modifiée.');
    const after = await this.prisma.expense.findUniqueOrThrow({ where: { id } });
    await this.audit.log(actor, 'UPDATE', 'Expense', id, before, after, ip);
    return after;
  }

  /** Annulation avec motif obligatoire : la dépense reste dans l'historique mais ne pèse plus sur le solde. */
  async cancel(id: string, dto: CancelExpenseDto, actor: Actor & { id: string }, ip?: string) {
    const before = await this.prisma.expense.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Dépense introuvable.');
    if (before.cancelledAt) throw new BadRequestException('Cette dépense est déjà annulée.');
    const claimed = await this.prisma.expense.updateMany({
      where: { id, cancelledAt: null },
      data: { cancelledAt: new Date(), cancelReason: dto.reason.trim(), cancelledById: actor.id },
    });
    if (claimed.count !== 1) throw new BadRequestException('Cette dépense est déjà annulée.');
    const after = await this.prisma.expense.findUniqueOrThrow({ where: { id } });
    await this.audit.log(actor, 'CANCEL_EXPENSE', 'Expense', id, before, after, ip);
    return after;
  }

  where(q: Pick<ExpenseQuery, 'category' | 'method' | 'from' | 'to' | 'q' | 'includeCancelled'>): Prisma.ExpenseWhereInput {
    const where: Prisma.ExpenseWhereInput = {};
    if (q.category) where.category = q.category;
    if (q.method) where.method = q.method;
    if (q.includeCancelled !== 'true') where.cancelledAt = null;
    if (q.from || q.to) where.spentAt = { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined };
    const text = q.q?.trim();
    if (text) {
      where.OR = [
        { label: { contains: text, mode: 'insensitive' } },
        { beneficiary: { contains: text, mode: 'insensitive' } },
        { reference: { contains: text, mode: 'insensitive' } },
        { number: { contains: text, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  /** Historique de toutes les dépenses (les plus récentes d'abord), annulées comprises sur demande. */
  async list(q: ExpenseQuery) {
    const where = this.where(q);
    const [total, rows, sum] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({ where, ...pageArgs(q), orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.expense.aggregate({ where: { ...where, cancelledAt: null }, _sum: { amountCents: true } }),
    ]);
    return { ...pageResult(rows, total, q), summary: { spentCents: sum._sum.amountCents ?? 0 } };
  }

  /**
   * Solde d'une période (encaissements − dépenses) et solde disponible cumulé
   * (solde de départ + tous les encaissements − toutes les dépenses, annulations exclues).
   */
  async balance(period: CollectionPeriod = 'month', ref?: string) {
    const today = await this.settings.today();
    const base = ref ?? ymd(today).slice(0, 7);
    const { from, to, months } = periodRange(period, base);
    const [payments, expenses, allPayments, allExpenses, opening] = await Promise.all([
      this.prisma.payment.findMany({ where: { cancelledAt: null, paidAt: { gte: from, lt: to } }, select: { amountCents: true, paidAt: true } }),
      this.prisma.expense.findMany({ where: { cancelledAt: null, spentAt: { gte: from, lt: to } }, select: { amountCents: true, spentAt: true, category: true } }),
      this.prisma.payment.aggregate({ where: { cancelledAt: null }, _sum: { amountCents: true } }),
      this.prisma.expense.aggregate({ where: { cancelledAt: null }, _sum: { amountCents: true } }),
      this.settings.get<number>('finance.openingBalanceCents'),
    ]);
    const openingCents = Number(opening) || 0;
    const collectedAll = allPayments._sum.amountCents ?? 0;
    const spentAll = allExpenses._sum.amountCents ?? 0;
    return {
      period,
      ref: base,
      from: ymd(from),
      to: ymd(new Date(to.getTime() - 86400000)),
      ...buildBalance({ months, payments, expenses }),
      cash: {
        openingCents,
        collectedCents: collectedAll,
        spentCents: spentAll,
        balanceCents: openingCents + collectedAll - spentAll,
      },
    };
  }
}
