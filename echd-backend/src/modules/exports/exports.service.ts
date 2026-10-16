import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../common/prisma.service';
import { csvEscape, dateOnly, ymd } from '../../common/utils';
import { DueQuery, PaymentQuery } from '../finance/finance.dto';
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

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private students: StudentsService,
    private finance: FinanceService,
  ) {}

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
    columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.type === 'money') col.numFmt = '#,##0.00 "€"';
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

  /* ───────── Sauvegarde complète (JSON) ───────── */

  /** Export de toutes les données (sans mots de passe ni jetons) — sauvegarde et portabilité. */
  async backup() {
    const p = this.prisma;
    const data: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      version: 1,
      settings: await p.setting.findMany(),
      levels: await p.level.findMany(),
      rooms: await p.room.findMany(),
      schoolYears: await p.schoolYear.findMany(),
      closures: await p.closure.findMany(),
      teachers: await p.teacher.findMany(),
      staffMembers: await p.staffMember.findMany(),
      users: (await p.user.findMany()).map(({ passwordHash, ...u }) => u),
      courses: await p.course.findMany(),
      classes: await p.schoolClass.findMany(),
      slots: await p.slot.findMany(),
      slotExceptions: await p.slotException.findMany(),
      families: await p.family.findMany(),
      students: await p.student.findMany(),
      guardians: await p.guardian.findMany(),
      enrollments: await p.enrollment.findMany(),
      pathways: await p.pathway.findMany(),
      pathwaySteps: await p.pathwayStep.findMany(),
      studentPathways: await p.studentPathway.findMany(),
      studentProgress: await p.studentProgress.findMany(),
      progressEvents: await p.progressEvent.findMany(),
      memorizations: await p.memorization.findMany(),
      evaluations: await p.evaluation.findMany(),
      attendances: await p.attendance.findMany(),
      feeSchedules: await p.feeSchedule.findMany(),
      dues: await p.due.findMany(),
      payments: await p.payment.findMany(),
      reminders: await p.reminder.findMany(),
      preRegistrations: await p.preRegistration.findMany(),
      preRegPersons: await p.preRegPerson.findMany(),
      announcements: await p.announcement.findMany(),
      auditLogs: await p.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50000 }),
    };
    return {
      buffer: Buffer.from(JSON.stringify(data, null, 1), 'utf8'),
      contentType: 'application/json; charset=utf-8',
      filename: `sauvegarde-echd-${ymd(new Date())}.json`,
    } as ExportFile;
  }
}
