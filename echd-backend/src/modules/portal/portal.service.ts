//echd-backend/src/modules/portal/portal.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { SigningService } from '../../common/signing.service';
import { FilesService } from '../../common/files.service';
import { summarize } from '../../common/attendance.util';
import { addDays, fullName, ymd } from '../../common/utils';
import { TimetableService } from '../academic/timetable.service';
import { SHARE_USER } from '../documents/documents.service';
import { ProgressService } from '../progress/progress.service';

/**
 * Espace parents SANS compte : chaque élève a un lien secret (signé, daté) à envoyer par WhatsApp ou e-mail.
 * Le lien donne accès en lecture seule au suivi de CET élève uniquement (présences, progression, cotisations, reçus).
 * Jeton = « idÉlève.expiration.série.signature ». Augmenter la « série » (réglage portal.epoch) révoque tous les liens.
 */
@Injectable()
export class PortalService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private signing: SigningService,
    private files: FilesService,
    private progress: ProgressService,
    private timetable: TimetableService,
  ) {}

  private payload(studentId: string, epoch: number) {
    return `portal|${studentId}|${epoch}`;
  }

  async createLink(studentId: string, opts: { days?: number; lang?: 'fr' | 'ar' } = {}) {
    const cfg = await this.settings.getMany(['portal.enabled', 'portal.linkDays', 'portal.epoch']);
    if (!cfg['portal.enabled']) throw new BadRequestException('L’espace parents est désactivé dans les réglages.');
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) throw new NotFoundException('Élève introuvable.');
    const days = opts.days ?? Number(cfg['portal.linkDays']);
    const exp = Math.floor(Date.now() / 1000) + days * 86400;
    const epoch = Number(cfg['portal.epoch']);
    const sig = this.signing.sign(this.payload(studentId, epoch), exp);
    const token = `${studentId}.${exp}.${epoch}.${sig}`;
    const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    return { url: `${base}/${opts.lang ?? 'fr'}/suivi/${token}`, expiresAt: new Date(exp * 1000) };
  }

  async revokeAll() {
    return { epoch: await this.settings.bumpPortalEpoch() };
  }

  private async studentIdFrom(token: string): Promise<{ studentId: string; exp: number }> {
    const bad = () => new ForbiddenException('Lien expiré ou invalide. Demandez un nouveau lien à l’école.');
    const parts = (token || '').split('.');
    if (parts.length !== 4) throw bad();
    const [studentId, expS, epochS, sig] = parts;
    const exp = Number(expS);
    const epoch = Number(epochS);
    if (!/^[0-9a-f-]{36}$/i.test(studentId) || !Number.isInteger(exp) || !Number.isInteger(epoch)) throw bad();
    if (!this.signing.verify(this.payload(studentId, epoch), exp, sig)) throw bad();
    const cfg = await this.settings.getMany(['portal.enabled', 'portal.epoch']);
    if (!cfg['portal.enabled'] || Number(cfg['portal.epoch']) !== epoch) throw bad();
    return { studentId, exp };
  }

  /** Données affichées sur la page parents. */
  async view(token: string) {
    const { studentId, exp } = await this.studentIdFrom(token);
    const today = await this.settings.today();
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        currentLevel: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { class: { include: { course: true, teacher: true, slots: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] } } } },
        },
      },
    });
    if (!student || student.archivedAt) throw new NotFoundException('Dossier introuvable.');

    const since = addDays(today, -90);
    const [school, prog, attRows, evals, dues, payments, tt] = await Promise.all([
      this.settings.getMany(['institute.name', 'institute.phone', 'institute.whatsapp', 'institute.email', 'institute.currency', 'display.arabicIndicDigits']),
      this.progress.studentProgress(studentId, SHARE_USER),
      this.prisma.attendance.findMany({
        where: { studentId, date: { gte: since, lte: today } },
        include: { class: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.evaluation.findMany({ where: { studentId }, orderBy: { date: 'desc' }, take: 5 }),
      this.prisma.due.findMany({ where: { studentId, status: { not: 'EXEMPT' } }, orderBy: { dueDate: 'desc' }, take: 24 }),
      this.prisma.payment.findMany({ where: { studentId, cancelledAt: null }, orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }], take: 12 }),
      this.timetable.get({ studentId, from: ymd(today), to: ymd(addDays(today, 28)) } as any, SHARE_USER),
    ]);

    const open = dues.filter((d) => d.amountCents > d.paidCents);
    const remainingCents = open.reduce((a, d) => a + d.amountCents - d.paidCents, 0);
    const recentMemo = prog.memorization
      .filter((m: any) => m.status === 'VALIDATED')
      .sort((a: any, b: any) => String(b.validatedAt ?? '').localeCompare(String(a.validatedAt ?? '')))
      .slice(0, 6)
      .map((m: any) => ({ surah: m.surah, nameLatin: m.nameLatin, nameAr: m.nameAr }));

    return {
      expiresAt: new Date(exp * 1000),
      school: {
        name: school['institute.name'],
        phone: school['institute.phone'],
        whatsapp: school['institute.whatsapp'],
        email: school['institute.email'],
        currency: school['institute.currency'],
        arabicIndicDigits: !!school['display.arabicIndicDigits'],
      },
      student: {
        name: fullName(student),
        firstName: student.firstName,
        arabicName: student.arabicName,
        photoUrl: this.files.url(student.photo, 3600),
        level: student.currentLevel ? { labelFr: student.currentLevel.labelFr, labelAr: student.currentLevel.labelAr } : null,
      },
      classes: student.enrollments.map((e) => ({
        className: e.class.name,
        courseFr: e.class.course.titleFr,
        courseAr: e.class.course.titleAr,
        teacher: e.class.teacher ? fullName(e.class.teacher) : null,
        slots: e.class.slots.map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime })),
      })),
      upcoming: tt.occurrences.slice(0, 6).map((o: any) => ({
        date: o.date,
        startTime: o.startTime,
        endTime: o.endTime,
        status: o.status,
        reason: o.reason ?? null,
        className: o.className ?? null,
      })),
      progress: {
        percent: prog.percent,
        pathways: prog.pathways.map((p) => ({ titleFr: p.pathway.titleFr, titleAr: p.pathway.titleAr, percent: p.percent, doneCount: p.doneCount, total: p.total })),
        memorization: { ...prog.memorizationSummary, recent: recentMemo },
      },
      attendance: {
        days: 90,
        ...summarize(attRows),
        recentIssues: attRows
          .filter((a) => a.status !== 'PRESENT')
          .slice(0, 8)
          .map((a) => ({ date: ymd(a.date), status: a.status, className: a.class.name, remark: a.remark })),
      },
      evaluations: evals.map((e) => ({ date: ymd(e.date), appreciation: e.appreciation, score: e.score, comment: e.comment })),
      finance: {
        remainingCents,
        dues: dues.slice(0, 12).map((d) => ({
          label: d.label,
          dueDate: ymd(d.dueDate),
          amountCents: d.amountCents,
          paidCents: d.paidCents,
          remainingCents: Math.max(d.amountCents - d.paidCents, 0),
          status: d.status,
        })),
        payments: payments.map((p) => ({
          date: ymd(p.paidAt),
          amountCents: p.amountCents,
          method: p.method,
          receiptNumber: p.receiptNumber,
          // lien de reçu valable 6 h : recalculé à chaque ouverture de la page
          receiptUrl: this.signing.documentUrl('receipt', p.id, 'fr', 6).url,
          receiptUrlAr: this.signing.documentUrl('receipt', p.id, 'ar', 6).url,
        })),
      },
    };
  }
}
