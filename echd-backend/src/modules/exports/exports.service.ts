//echd-backend/src/modules/exports/exports.service.ts
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { csvEscape, dateOnly, ymd } from '../../common/utils';
import { DueQuery, PaymentQuery } from '../finance/finance.dto';
import { ExpenseQuery } from '../expenses/expenses.dto';
import { ExpensesService } from '../expenses/expenses.service';
import { FinanceService } from '../finance/finance.service';
import { StudentQuery } from '../students/students.dto';
import { StudentsService } from '../students/students.service';
import { AuthUser } from '../../common/decorators';

export interface Column {
  header: string;
  key: string;
  width?: number;
  type?: 'text' | 'date' | 'money';
}

export interface ExportFile {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

const STATUS_FR: Record<string, string> = {
  PREREGISTERED: 'Préinscrit',
  ENROLLED: 'Inscrit',
  WAITLIST: "Liste d'attente",
  SUSPENDED: 'Suspendu',
  LEFT: 'Parti',
  UPCOMING: 'À venir',
  PARTIAL: 'Partiel',
  PAID: 'À jour',
  LATE: 'En retard',
  CRITICAL: 'Critique',
  EXEMPT: 'Exonéré',
};
const METHOD_FR: Record<string, string> = { CASH: 'Espèces', CHEQUE: 'Chèque', TRANSFER: 'Virement', CARD: 'Carte' };
const EXPENSE_FR: Record<string, string> = { SALARY: 'Salaires', EQUIPMENT: 'Équipements', SUPPLIES: 'Fournitures scolaires', OTHER: 'Autres' };

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private students: StudentsService,
    private finance: FinanceService,
    private settings: SettingsService,
    private expenses: ExpensesService,
  ) {}

  /** Symbole de la devise de l'école (réglage « institute.currency »), pour le format des cellules Excel. */
  private async currencySymbol(): Promise<string> {
    try {
      const code = (await this.settings.get<string>('institute.currency')) || 'EUR';
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
    } catch {
      return '€';
    }
  }

  /* ───────── Génération du fichier ───────── */

  private async build(format: 'xlsx' | 'csv', name: string, sheet: string, columns: Column[], rows: Record<string, any>[]): Promise<ExportFile> {
    const stamp = ymd(new Date());
    if (format === 'csv') {
      // Séparateur « ; » et BOM UTF-8 : s'ouvre correctement dans Excel en français
      const lines = [columns.map((c) => csvEscape(c.header)).join(';')];
      for (const r of rows) {
        lines.push(
          columns
            .map((c) => {
              const v = r[c.key];
              if (c.type === 'money' && typeof v === 'number') return csvEscape((v / 100).toFixed(2).replace('.', ','));
              return csvEscape(v);
            })
            .join(';'),
        );
      }
      return { buffer: Buffer.from('﻿' + lines.join('\r\n'), 'utf8'), contentType: 'text/csv; charset=utf-8', filename: `${name}-${stamp}.csv` };
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ECHD';
    wb.created = new Date();
    const ws = wb.addWorksheet(sheet, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4A3A' } };
    head.alignment = { vertical: 'middle' };
    head.height = 22;
    for (const r of rows) {
      ws.addRow(
        Object.fromEntries(
          columns.map((c) => {
            const v = r[c.key];
            if (c.type === 'money' && typeof v === 'number') return [c.key, v / 100];
            if (c.type === 'date' && v) return [c.key, v instanceof Date ? v : new Date(v)];
            return [c.key, v ?? ''];
          }),
        ),
      );
    }
    const symbol = columns.some((c) => c.type === 'money') ? await this.currencySymbol() : '';
    columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.type === 'money') col.numFmt = `#,##0.00 "${symbol.replace(/"/g, '')}"`;
      if (c.type === 'date') col.numFmt = 'dd/mm/yyyy';
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${name}-${stamp}.xlsx` };
  }

  /* ───────── Élèves ───────── */

  async students_(q: StudentQuery, user: AuthUser, format: 'xlsx' | 'csv') {
    const rows = (await this.students.exportRows(q, user)).map((r) => ({
      ...r,
      audience: r.audience === 'CHILD' ? 'Enfant' : 'Adulte',
      gender: r.gender === 'MALE' ? 'M' : r.gender === 'FEMALE' ? 'F' : '',
      status: STATUS_FR[r.status] ?? r.status,
    }));
    const cols: Column[] = [
      { header: 'Nom', key: 'lastName', width: 20 },
      { header: 'Prénom', key: 'firstName', width: 20 },
      { header: 'Nom en arabe', key: 'arabicName', width: 22 },
      { header: 'Public', key: 'audience', width: 10 },
      { header: 'Âge', key: 'age', width: 7 },
      { header: 'Date de naissance', key: 'birthDate', type: 'date', width: 14 },
      { header: 'Sexe', key: 'gender', width: 6 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'E-mail', key: 'email', width: 26 },
      { header: 'Adresse', key: 'address', width: 34 },
      { header: 'Responsable(s)', key: 'guardians', width: 34 },
      { header: 'Statut', key: 'status', width: 14 },
      { header: 'Niveau', key: 'level', width: 14 },
      { header: 'Classes', key: 'classes', width: 28 },
      { header: "Date d'inscription", key: 'enrolledAt', type: 'date', width: 14 },
      { header: 'Reste à payer', key: 'balanceCents', type: 'money', width: 14 },
      { header: 'Échéances en retard', key: 'lateDues', width: 12 },
    ];
    return this.build(format, 'eleves', 'Élèves', cols, rows);
  }

  /* ───────── Cotisations ───────── */

  async dues(q: DueQuery, format: 'xlsx' | 'csv') {
    await this.finance.refreshStatuses(true);
    const rows = await this.duesRows(q);
    const cols: Column[] = [
      { header: 'Nom', key: 'lastName', width: 20 },
      { header: 'Prénom', key: 'firstName', width: 20 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'Libellé', key: 'label', width: 44 },
      { header: 'Échéance', key: 'dueDate', type: 'date', width: 13 },
      { header: 'Montant', key: 'amountCents', type: 'money', width: 12 },
      { header: 'Payé', key: 'paidCents', type: 'money', width: 12 },
      { header: 'Reste', key: 'remainingCents', type: 'money', width: 12 },
      { header: 'Statut', key: 'status', width: 12 },
    ];
    return this.build(format, 'cotisations', 'Cotisations', cols, rows);
  }

  private async duesRows(q: DueQuery) {
    const all: any[] = [];
    // pagination interne pour dépasser la limite de 200 de l'API de liste
    for (let page = 1; ; page++) {
      const r = await this.finance.listDues(Object.assign(new DueQuery(), q, { page, pageSize: 200 }));
      all.push(...r.items);
      if (all.length >= r.total || !r.items.length) break;
    }
    return all.map((d) => ({
      lastName: d.student.lastName,
      firstName: d.student.firstName,
      phone: d.student.phone ?? d.student.guardians?.[0]?.phone ?? '',
      label: d.label,
      dueDate: d.dueDate,
      amountCents: d.amountCents,
      paidCents: d.paidCents,
      remainingCents: d.remainingCents,
      status: STATUS_FR[d.status] ?? d.status,
    }));
  }

  /* ───────── Paiements ───────── */

  /** Historique des dépenses (filtres de l'écran), annulations comprises si demandé. */
  async expensesList(q: ExpenseQuery, format: 'xlsx' | 'csv') {
    const rows = (
      await this.prisma.expense.findMany({ where: this.expenses.where(q), orderBy: [{ spentAt: 'asc' }, { number: 'asc' }], take: 10000 })
    ).map((e) => ({
      number: e.number,
      spentAt: e.spentAt,
      category: EXPENSE_FR[e.category] ?? e.category,
      label: e.label,
      beneficiary: e.beneficiary ?? '',
      amountCents: e.amountCents,
      method: METHOD_FR[e.method],
      reference: e.reference ?? '',
      by: e.createdByLabel,
      status: e.cancelledAt ? `Annulée : ${e.cancelReason ?? ''}` : 'Valide',
    }));
    const cols: Column[] = [
      { header: 'N°', key: 'number', width: 16 },
      { header: 'Date', key: 'spentAt', type: 'date', width: 13 },
      { header: 'Catégorie', key: 'category', width: 22 },
      { header: 'Objet', key: 'label', width: 40 },
      { header: 'Bénéficiaire', key: 'beneficiary', width: 24 },
      { header: 'Montant', key: 'amountCents', type: 'money', width: 12 },
      { header: 'Mode', key: 'method', width: 12 },
      { header: 'Référence', key: 'reference', width: 18 },
      { header: 'Saisi par', key: 'by', width: 20 },
      { header: 'Statut', key: 'status', width: 28 },
    ];
    return this.build(format, 'depenses', 'Dépenses', cols, rows);
  }

  async payments(q: PaymentQuery, format: 'xlsx' | 'csv') {
    const where = {
      studentId: q.studentId,
      method: q.method,
      cancelledAt: q.includeCancelled === 'true' ? undefined : null,
      paidAt: q.from || q.to ? { gte: q.from ? dateOnly(q.from) : undefined, lte: q.to ? dateOnly(q.to) : undefined } : undefined,
    };
    const rows = (
      await this.prisma.payment.findMany({
        where,
        orderBy: [{ paidAt: 'asc' }, { receiptNumber: 'asc' }],
        include: { student: { select: { firstName: true, lastName: true } }, due: { select: { label: true } } },
        take: 10000,
      })
    ).map((p) => ({
      receipt: p.receiptNumber,
      paidAt: p.paidAt,
      lastName: p.student.lastName,
      firstName: p.student.firstName,
      label: p.periodCovered || p.due.label,
      amountCents: p.amountCents,
      method: METHOD_FR[p.method],
      reference: p.reference ?? '',
      by: p.createdByLabel,
      status: p.cancelledAt ? `Annulé : ${p.cancelReason ?? ''}` : 'Valide',
    }));
    const cols: Column[] = [
      { header: 'Reçu', key: 'receipt', width: 16 },
      { header: 'Date', key: 'paidAt', type: 'date', width: 13 },
      { header: 'Nom', key: 'lastName', width: 20 },
      { header: 'Prénom', key: 'firstName', width: 20 },
      { header: 'Objet', key: 'label', width: 40 },
      { header: 'Montant', key: 'amountCents', type: 'money', width: 12 },
      { header: 'Mode', key: 'method', width: 12 },
      { header: 'Référence', key: 'reference', width: 18 },
      { header: 'Saisi par', key: 'by', width: 20 },
      { header: 'Statut', key: 'status', width: 28 },
    ];
    return this.build(format, 'paiements', 'Paiements', cols, rows);
  }

  /* ───────── Export comptable mensuel ───────── */

  /**
   * Classeur prêt à transmettre à l'expert-comptable : synthèse, journal des encaissements, annulations
   * et restes à encaisser. Les montants sont de vrais nombres (sommes recalculables dans Excel).
   */
  async accounting(month?: string, withExpenses = false): Promise<ExportFile> {
    const today = await this.settings.today();
    const m = month ?? ymd(today).slice(0, 7);
    const [y, mo] = m.split('-').map(Number);
    const from = new Date(Date.UTC(y, mo - 1, 1));
    const to = new Date(Date.UTC(y, mo, 1));
    const cfg = await this.settings.getMany(['institute.name']);
    const symbol = (await this.currencySymbol()).replace(/"/g, '');
    const money = `#,##0.00 "${symbol}"`;

    const [payments, cancelled, expected, open] = await Promise.all([
      this.prisma.payment.findMany({
        where: { paidAt: { gte: from, lt: to } },
        include: { student: { select: { firstName: true, lastName: true } }, due: { select: { label: true } } },
        orderBy: [{ paidAt: 'asc' }, { receiptNumber: 'asc' }],
      }),
      this.prisma.payment.findMany({
        where: { cancelledAt: { gte: from, lt: to } },
        include: { student: { select: { firstName: true, lastName: true } }, due: { select: { label: true } } },
        orderBy: [{ cancelledAt: 'asc' }],
      }),
      this.prisma.due.aggregate({ where: { dueDate: { gte: from, lt: to }, status: { not: 'EXEMPT' } }, _sum: { amountCents: true, paidCents: true } }),
      this.prisma.due.findMany({
        where: { dueDate: { lt: to }, status: { not: 'EXEMPT' } },
        include: { student: { select: { firstName: true, lastName: true, archivedAt: true } } },
        orderBy: [{ dueDate: 'asc' }],
      }),
    ]);
    // Les dépenses (salaires compris) ne figurent que dans l'export de l'administrateur
    const monthExpenses = withExpenses
      ? await this.prisma.expense.findMany({ where: { spentAt: { gte: from, lt: to } }, orderBy: [{ spentAt: 'asc' }, { number: 'asc' }] })
      : [];
    const validExpenses = monthExpenses.filter((e) => !e.cancelledAt);
    const spent = validExpenses.reduce((a, e) => a + e.amountCents, 0);
    const valid = payments.filter((p) => !p.cancelledAt);
    const collected = valid.reduce((a, p) => a + p.amountCents, 0);
    const byMethod = new Map<string, { count: number; cents: number }>();
    for (const p of valid) {
      const cur = byMethod.get(p.method) ?? { count: 0, cents: 0 };
      byMethod.set(p.method, { count: cur.count + 1, cents: cur.cents + p.amountCents });
    }
    const unpaid = open.filter((d) => d.amountCents > d.paidCents);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ECHD';
    wb.created = new Date();
    const header = (ws: ExcelJS.Worksheet) => {
      const r = ws.getRow(1);
      r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4A3A' } };
      r.alignment = { vertical: 'middle' };
      r.height = 22;
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };
    const total = (ws: ExcelJS.Worksheet, label: string, labelCol: number, sumCol: string, last: number, value: number) => {
      const r = ws.addRow([]);
      r.getCell(labelCol).value = label;
      r.getCell(labelCol).font = { bold: true };
      const c = r.getCell(sumCol);
      c.value = { formula: `SUM(${sumCol}2:${sumCol}${Math.max(last, 2)})`, result: value / 100 };
      c.font = { bold: true };
      c.numFmt = money;
    };

    // 1) Synthèse
    const sum = wb.addWorksheet('Synthèse');
    sum.columns = [{ width: 38 }, { width: 20 }, { width: 14 }];
    sum.addRow([`${cfg['institute.name'].fr} — Synthèse comptable`]).font = { bold: true, size: 14 };
    sum.addRow([`Période : ${String(mo).padStart(2, '0')}/${y}`]);
    sum.addRow([`Édité le ${ymd(today).split('-').reverse().join('/')}`]);
    sum.addRow([]);
    const h = sum.addRow(['Encaissements du mois', 'Montant', 'Paiements']);
    h.font = { bold: true };
    for (const [method, v] of byMethod) {
      const r = sum.addRow([METHOD_FR[method] ?? method, v.cents / 100, v.count]);
      r.getCell(2).numFmt = money;
    }
    const tr = sum.addRow(['Total encaissé (hors annulations)', collected / 100, valid.length]);
    tr.font = { bold: true };
    tr.getCell(2).numFmt = money;
    sum.addRow([]);
    const e1 = sum.addRow(['Cotisations attendues ce mois', (expected._sum.amountCents ?? 0) / 100]);
    e1.getCell(2).numFmt = money;
    const e2 = sum.addRow(['… dont déjà réglées', (expected._sum.paidCents ?? 0) / 100]);
    e2.getCell(2).numFmt = money;
    const cancelledTotal = cancelled.reduce((a, p) => a + p.amountCents, 0);
    const e3 = sum.addRow(['Paiements annulés ce mois', cancelledTotal / 100, cancelled.length]);
    e3.getCell(2).numFmt = money;
    const e4 = sum.addRow(['Reste à encaisser (échéances échues, situation actuelle)', unpaid.reduce((a, d) => a + d.amountCents - d.paidCents, 0) / 100, unpaid.length]);
    e4.getCell(2).numFmt = money;
    e4.font = { bold: true };

    if (withExpenses) {
      sum.addRow([]);
      sum.addRow(['Dépenses du mois', 'Montant', 'Opérations']).font = { bold: true };
      for (const [code, label] of Object.entries(EXPENSE_FR)) {
        const rows = validExpenses.filter((e) => e.category === code);
        const r = sum.addRow([label, rows.reduce((a, e) => a + e.amountCents, 0) / 100, rows.length]);
        r.getCell(2).numFmt = money;
      }
      const te = sum.addRow(['Total dépensé (hors annulations)', spent / 100, validExpenses.length]);
      te.font = { bold: true };
      te.getCell(2).numFmt = money;
      sum.addRow([]);
      const bal = sum.addRow(['Solde du mois (encaissé − dépensé)', (collected - spent) / 100]);
      bal.font = { bold: true };
      bal.getCell(2).numFmt = money;
    }

    // 2) Journal des encaissements
    const j = wb.addWorksheet('Journal des encaissements');
    j.columns = [
      { header: 'Date', key: 'date', width: 13 },
      { header: 'Reçu n°', key: 'receipt', width: 16 },
      { header: 'Élève', key: 'student', width: 28 },
      { header: 'Objet', key: 'label', width: 28 },
      { header: 'Mode', key: 'method', width: 14 },
      { header: 'Montant', key: 'amount', width: 14 },
      { header: 'Référence', key: 'reference', width: 20 },
      { header: 'Saisi par', key: 'by', width: 20 },
      { header: 'Statut', key: 'status', width: 14 },
    ];
    header(j);
    for (const p of payments) {
      j.addRow({
        date: p.paidAt,
        receipt: p.receiptNumber,
        student: `${p.student.lastName} ${p.student.firstName}`.trim(),
        label: p.periodCovered || p.due.label,
        method: METHOD_FR[p.method] ?? p.method,
        amount: p.cancelledAt ? 0 : p.amountCents / 100,
        reference: p.reference ?? '',
        by: p.createdByLabel,
        status: p.cancelledAt ? 'Annulé' : 'Valide',
      });
    }
    j.getColumn('date').numFmt = 'dd/mm/yyyy';
    j.getColumn('amount').numFmt = money;
    total(j, 'TOTAL ENCAISSÉ', 5, 'F', payments.length + 1, collected);

    // 2 bis) Journal des dépenses
    if (withExpenses) {
      const d = wb.addWorksheet('Journal des dépenses');
      d.columns = [
        { header: 'Date', key: 'date', width: 13 },
        { header: 'N°', key: 'number', width: 16 },
        { header: 'Catégorie', key: 'category', width: 22 },
        { header: 'Objet', key: 'label', width: 34 },
        { header: 'Bénéficiaire', key: 'beneficiary', width: 24 },
        { header: 'Mode', key: 'method', width: 14 },
        { header: 'Montant', key: 'amount', width: 14 },
        { header: 'Référence', key: 'reference', width: 20 },
        { header: 'Statut', key: 'status', width: 28 },
      ];
      header(d);
      for (const e of monthExpenses) {
        d.addRow({
          date: e.spentAt,
          number: e.number,
          category: EXPENSE_FR[e.category] ?? e.category,
          label: e.label,
          beneficiary: e.beneficiary ?? '',
          method: METHOD_FR[e.method] ?? e.method,
          amount: e.cancelledAt ? 0 : e.amountCents / 100,
          reference: e.reference ?? '',
          status: e.cancelledAt ? `Annulée : ${e.cancelReason ?? ''}` : 'Valide',
        });
      }
      d.getColumn('date').numFmt = 'dd/mm/yyyy';
      d.getColumn('amount').numFmt = money;
      total(d, 'TOTAL DÉPENSÉ', 6, 'G', monthExpenses.length + 1, spent);
    }

    // 3) Annulations
    const a = wb.addWorksheet('Annulations');
    a.columns = [
      { header: 'Annulé le', key: 'cancelledAt', width: 14 },
      { header: 'Reçu n°', key: 'receipt', width: 16 },
      { header: 'Date du paiement', key: 'paidAt', width: 16 },
      { header: 'Élève', key: 'student', width: 28 },
      { header: 'Montant', key: 'amount', width: 14 },
      { header: 'Motif', key: 'reason', width: 40 },
    ];
    header(a);
    for (const p of cancelled) {
      a.addRow({
        cancelledAt: p.cancelledAt,
        receipt: p.receiptNumber,
        paidAt: p.paidAt,
        student: `${p.student.lastName} ${p.student.firstName}`.trim(),
        amount: p.amountCents / 100,
        reason: p.cancelReason ?? '',
      });
    }
    a.getColumn('cancelledAt').numFmt = 'dd/mm/yyyy';
    a.getColumn('paidAt').numFmt = 'dd/mm/yyyy';
    a.getColumn('amount').numFmt = money;
    total(a, 'TOTAL ANNULÉ', 4, 'E', cancelled.length + 1, cancelledTotal);

    // 4) Restes à encaisser
    const r = wb.addWorksheet('Restes à encaisser');
    r.columns = [
      { header: 'Échéance', key: 'dueDate', width: 13 },
      { header: 'Élève', key: 'student', width: 28 },
      { header: 'Objet', key: 'label', width: 28 },
      { header: 'Montant dû', key: 'amount', width: 14 },
      { header: 'Déjà payé', key: 'paid', width: 14 },
      { header: 'Reste', key: 'remaining', width: 14 },
      { header: 'Statut', key: 'status', width: 14 },
    ];
    header(r);
    for (const d of unpaid) {
      r.addRow({
        dueDate: d.dueDate,
        student: `${d.student.lastName} ${d.student.firstName}`.trim(),
        label: d.label,
        amount: d.amountCents / 100,
        paid: d.paidCents / 100,
        remaining: (d.amountCents - d.paidCents) / 100,
        status: STATUS_FR[d.status] ?? d.status,
      });
    }
    r.getColumn('dueDate').numFmt = 'dd/mm/yyyy';
    for (const k of ['amount', 'paid', 'remaining']) r.getColumn(k).numFmt = money;
    total(r, 'TOTAL', 3, 'F', unpaid.length + 1, unpaid.reduce((acc, d) => acc + d.amountCents - d.paidCents, 0));

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `comptabilite-${m}.xlsx` };
  }

  /* ───────── Sauvegarde complète (JSON) ───────── */

  /**
   * Export de toutes les données (sans mots de passe ni jetons) — sauvegarde et portabilité.
   * Les tables sont lues et sérialisées une par une : on ne garde jamais toute la base en objets JS en même temps.
   */
  async backup() {
    const p = this.prisma;
    const tables: Array<[string, () => Promise<unknown>]> = [
      ['counters', () => p.counter.findMany()], // numéros de reçus : indispensables pour une restauration sans doublons
      ['settings', () => p.setting.findMany()],
      ['levels', () => p.level.findMany()],
      ['rooms', () => p.room.findMany()],
      ['schoolYears', () => p.schoolYear.findMany()],
      ['closures', () => p.closure.findMany()],
      ['teachers', () => p.teacher.findMany()],
      ['staffMembers', () => p.staffMember.findMany()],
      ['users', async () => (await p.user.findMany()).map(({ passwordHash, ...u }) => u)],
      ['courses', () => p.course.findMany()],
      ['classes', () => p.schoolClass.findMany()],
      ['slots', () => p.slot.findMany()],
      ['slotExceptions', () => p.slotException.findMany()],
      ['families', () => p.family.findMany()],
      ['students', () => p.student.findMany()],
      ['guardians', () => p.guardian.findMany()],
      ['enrollments', () => p.enrollment.findMany()],
      ['pathways', () => p.pathway.findMany()],
      ['pathwaySteps', () => p.pathwayStep.findMany()],
      ['studentPathways', () => p.studentPathway.findMany()],
      ['studentProgress', () => p.studentProgress.findMany()],
      ['progressEvents', () => p.progressEvent.findMany()],
      ['memorizations', () => p.memorization.findMany()],
      ['evaluations', () => p.evaluation.findMany()],
      ['attendances', () => p.attendance.findMany()],
      ['feeSchedules', () => p.feeSchedule.findMany()],
      ['dues', () => p.due.findMany()],
      ['payments', () => p.payment.findMany()],
      ['expenses', () => p.expense.findMany()],
      ['reminders', () => p.reminder.findMany()],
      ['preRegistrations', () => p.preRegistration.findMany()],
      ['preRegPersons', () => p.preRegPerson.findMany()],
      ['announcements', () => p.announcement.findMany()],
      ['auditLogs', () => p.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50000 })],
    ];
    const parts: Buffer[] = [Buffer.from(`{"exportedAt":${JSON.stringify(new Date().toISOString())},"version":2`, 'utf8')];
    for (const [key, load] of tables) {
      parts.push(Buffer.from(`,\n${JSON.stringify(key)}:${JSON.stringify(await load())}`, 'utf8'));
    }
    parts.push(Buffer.from('\n}\n', 'utf8'));
    return {
      buffer: Buffer.concat(parts),
      contentType: 'application/json; charset=utf-8',
      filename: `sauvegarde-echd-${ymd(new Date())}.json`,
    } as ExportFile;
  }
}
