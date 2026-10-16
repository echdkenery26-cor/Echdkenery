import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProgressStatus } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { Actor, AuditService } from '../../common/audit.service';
import { attendanceSummary, summarize } from '../../common/attendance.util';
import { AuthUser, userLabel } from '../../common/decorators';
import { FilesService } from '../../common/files.service';
import { NotificationsService } from '../../common/notifications.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { addDays, dateOnly, diffDays, fullName, ymd } from '../../common/utils';
import {
  CreatePathwayDto,
  EvaluationDto,
  MemorizationDto,
  ProgressItemDto,
  UpdatePathwayDto,
} from './progress.dto';
import { surahInfo } from './surahs';

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private access: AccessService,
    private settings: SettingsService,
    private notifications: NotificationsService,
    private files: FilesService,
  ) {}

  /* ═══════════════ Parcours (configurables par l'administrateur) ═══════════════ */

  listPathways(includeInactive = false) {
    return this.prisma.pathway.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
      include: {
        steps: { orderBy: { order: 'asc' } },
        course: { select: { id: true, titleFr: true, titleAr: true } },
        _count: { select: { students: true } },
      },
    });
  }

  async getPathway(id: string) {
    const p = await this.prisma.pathway.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } }, course: { select: { id: true, titleFr: true, titleAr: true } } },
    });
    if (!p) throw new NotFoundException('Parcours introuvable.');
    return p;
  }

  async createPathway(dto: CreatePathwayDto, actor: Actor, ip?: string) {
    const { steps, ...data } = dto;
    const p = await this.prisma.pathway.create({
      data: {
        ...data,
        steps: { create: (steps ?? []).map((s, i) => ({ order: i + 1, titleFr: s.titleFr, titleAr: s.titleAr ?? '' })) },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    await this.audit.log(actor, 'CREATE', 'Pathway', p.id, undefined, p, ip);
    return p;
  }

  async updatePathway(id: string, dto: UpdatePathwayDto, actor: Actor, ip?: string) {
    const before = await this.getPathway(id);
    const { steps, ...data } = dto;
    await this.prisma.$transaction(async (tx) => {
      await tx.pathway.update({ where: { id }, data });
      if (steps) {
        const keep = steps.filter((s) => s.id).map((s) => s.id!);
        const known = new Set(before.steps.map((s) => s.id));
        if (keep.some((k) => !known.has(k))) throw new BadRequestException("Une étape n'appartient pas à ce parcours.");
        await tx.pathwayStep.deleteMany({ where: { pathwayId: id, id: { notIn: keep } } });
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          if (s.id) {
            await tx.pathwayStep.update({ where: { id: s.id }, data: { order: i + 1, titleFr: s.titleFr, titleAr: s.titleAr ?? '' } });
          } else {
            await tx.pathwayStep.create({ data: { pathwayId: id, order: i + 1, titleFr: s.titleFr, titleAr: s.titleAr ?? '' } });
          }
        }
      }
    });
    const after = await this.getPathway(id);
    await this.audit.log(actor, 'UPDATE', 'Pathway', id, before, after, ip);
    return after;
  }

  async removePathway(id: string, actor: Actor, ip?: string) {
    const p = await this.prisma.pathway.findUnique({ where: { id }, include: { _count: { select: { students: true } } } });
    if (!p) throw new NotFoundException('Parcours introuvable.');
    if (p._count.students) throw new ConflictException('Des élèves suivent ce parcours : désactivez-le plutôt.');
    await this.prisma.pathway.delete({ where: { id } });
    await this.audit.log(actor, 'DELETE', 'Pathway', id, p, undefined, ip);
    return { ok: true };
  }

  /* ═══════════════ Affectation ═══════════════ */

  /** À l'inscription dans un cours, l'élève reçoit automatiquement les parcours rattachés à ce cours. */
  async autoAssign(studentId: string, courseId: string) {
    const pathways = await this.prisma.pathway.findMany({ where: { courseId, active: true }, select: { id: true } });
    if (!pathways.length) return;
    await this.prisma.studentPathway.createMany({
      data: pathways.map((p) => ({ studentId, pathwayId: p.id })),
      skipDuplicates: true,
    });
  }

  async assign(studentId: string, pathwayId: string, user: AuthUser) {
    await this.access.assertStudentAccess(user, studentId);
    await this.getPathway(pathwayId);
    await this.prisma.studentPathway.upsert({
      where: { studentId_pathwayId: { studentId, pathwayId } },
      update: {},
      create: { studentId, pathwayId },
    });
    await this.audit.log(user, 'ASSIGN_PATHWAY', 'Student', studentId, undefined, { pathwayId, studentId });
    return this.studentProgress(studentId, user);
  }

  async unassign(studentId: string, pathwayId: string, user: AuthUser) {
    await this.prisma.studentPathway.deleteMany({ where: { studentId, pathwayId } });
    await this.audit.log(user, 'UNASSIGN_PATHWAY', 'Student', studentId, { pathwayId }, undefined);
    return { ok: true };
  }

  /* ═══════════════ Lecture de la progression d'un élève ═══════════════ */

  async studentProgress(studentId: string, user: AuthUser) {
    await this.access.assertStudentAccess(user, studentId);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { currentLevel: true, startLevel: true },
    });
    if (!student) throw new NotFoundException('Élève introuvable.');

    const [assigned, progress, memos, evaluations, events] = await Promise.all([
      this.prisma.studentPathway.findMany({
        where: { studentId },
        include: { pathway: { include: { steps: { orderBy: { order: 'asc' } } } } },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.studentProgress.findMany({ where: { studentId } }),
      this.prisma.memorization.findMany({ where: { studentId }, orderBy: { surah: 'asc' } }),
      this.prisma.evaluation.findMany({ where: { studentId }, orderBy: { date: 'desc' }, take: 50 }),
      this.prisma.progressEvent.findMany({
        where: { studentId },
        orderBy: { createdAt: 'asc' },
        include: { step: { select: { titleFr: true, titleAr: true, pathwayId: true } } },
      }),
    ]);
    const byStep = new Map(progress.map((p) => [p.stepId, p]));

    const pathways = assigned.map((a) => {
      const steps = a.pathway.steps.map((s) => {
        const p = byStep.get(s.id);
        return {
          id: s.id,
          order: s.order,
          titleFr: s.titleFr,
          titleAr: s.titleAr,
          status: (p?.status ?? 'TODO') as ProgressStatus,
          comment: p?.comment ?? null,
          updatedAt: p?.updatedAt ?? null,
        };
      });
      const done = steps.filter((s) => s.status === 'DONE').length;
      return {
        pathway: { id: a.pathway.id, titleFr: a.pathway.titleFr, titleAr: a.pathway.titleAr, active: a.pathway.active },
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        promotedAt: a.promotedAt,
        steps,
        doneCount: done,
        total: steps.length,
        percent: steps.length ? Math.round((done / steps.length) * 100) : 0,
      };
    });

    // Courbe simple : pourcentage global acquis au fil des dates (relecture de l'historique)
    const stepIds = new Set(assigned.flatMap((a) => a.pathway.steps.map((s) => s.id)));
    const state = new Map<string, ProgressStatus>();
    const curve: { date: string; percent: number }[] = [];
    for (const e of events) {
      if (!stepIds.has(e.stepId)) continue;
      state.set(e.stepId, e.status);
      const done = [...state.values()].filter((v) => v === 'DONE').length;
      const point = { date: ymd(e.createdAt), percent: stepIds.size ? Math.round((done / stepIds.size) * 100) : 0 };
      if (curve.length && curve[curve.length - 1].date === point.date) curve[curve.length - 1] = point;
      else curve.push(point);
    }

    // Passage de niveau : proposé quand toutes les étapes d'un parcours sont acquises
    const pending = pathways.find((p) => p.completedAt && !p.promotedAt && p.total > 0);
    let levelUp: any = null;
    if (pending) {
      const next = await this.nextLevel(student.currentLevelId);
      levelUp = { proposed: !!next, pathwayId: pending.pathway.id, pathwayTitleFr: pending.pathway.titleFr, nextLevel: next };
    }

    const totalSteps = pathways.reduce((a, p) => a + p.total, 0);
    const doneSteps = pathways.reduce((a, p) => a + p.doneCount, 0);
    return {
      studentId,
      level: { current: student.currentLevel, start: student.startLevel },
      percent: totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0,
      pathways,
      levelUp,
      curve,
      memorization: memos.map((m) => ({ ...m, ...surahInfo(m.surah), progressPercent: this.versePercent(m.surah, m.verse, m.status) })),
      memorizationSummary: {
        validated: memos.filter((m) => m.status === 'VALIDATED').length,
        inProgress: memos.filter((m) => m.status === 'IN_PROGRESS').length,
      },
      evaluations,
      history: events
        .slice(-100)
        .reverse()
        .map((e) => ({ id: e.id, date: e.createdAt, status: e.status, comment: e.comment, by: e.userLabel, step: e.step })),
    };
  }

  private versePercent(surah: number, verse: number, status: string) {
    if (status === 'VALIDATED') return 100;
    const total = surahInfo(surah)?.verses ?? 0;
    return total ? Math.min(100, Math.round((verse / total) * 100)) : 0;
  }

  private async nextLevel(currentLevelId: string | null) {
    const levels = await this.prisma.level.findMany({ where: { active: true }, orderBy: { order: 'asc' } });
    if (!levels.length) return null;
    if (!currentLevelId) return levels[0];
    const idx = levels.findIndex((l) => l.id === currentLevelId);
    return idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : null;
  }

  /* ═══════════════ Saisie (enseignant ou administration) ═══════════════ */

  async updateProgress(studentId: string, updates: ProgressItemDto[], user: AuthUser) {
    await this.access.assertStudentAccess(user, studentId);
    const assigned = await this.prisma.studentPathway.findMany({
      where: { studentId },
      include: { pathway: { include: { steps: { select: { id: true } } } } },
    });
    const allowed = new Map<string, string>(); // stepId → pathwayId
    for (const a of assigned) for (const s of a.pathway.steps) allowed.set(s.id, a.pathwayId);
    const bad = updates.find((u) => !allowed.has(u.stepId));
    if (bad) throw new BadRequestException("Une étape n'appartient à aucun parcours suivi par cet élève.");

    const current = await this.prisma.studentProgress.findMany({
      where: { studentId, stepId: { in: updates.map((u) => u.stepId) } },
    });
    const cur = new Map(current.map((c) => [c.stepId, c]));
    const label = userLabel(user);

    await this.prisma.$transaction(async (tx) => {
      for (const u of updates) {
        const prev = cur.get(u.stepId);
        const changed = !prev || prev.status !== u.status || (u.comment !== undefined && u.comment !== prev.comment);
        if (!changed) continue;
        await tx.studentProgress.upsert({
          where: { studentId_stepId: { studentId, stepId: u.stepId } },
          update: { status: u.status, comment: u.comment ?? prev?.comment, updatedById: user.id },
          create: { studentId, stepId: u.stepId, status: u.status, comment: u.comment, updatedById: user.id },
        });
        await tx.progressEvent.create({
          data: { studentId, stepId: u.stepId, status: u.status, comment: u.comment, userId: user.id, userLabel: label },
        });
      }
    });

    // Parcours terminé ? (toutes les étapes acquises)
    const touched = new Set(updates.map((u) => allowed.get(u.stepId)!));
    for (const pathwayId of touched) await this.refreshCompletion(studentId, pathwayId, user);
    return this.studentProgress(studentId, user);
  }

  private async refreshCompletion(studentId: string, pathwayId: string, user: AuthUser) {
    const steps = await this.prisma.pathwayStep.findMany({ where: { pathwayId }, select: { id: true } });
    if (!steps.length) return;
    const done = await this.prisma.studentProgress.count({
      where: { studentId, stepId: { in: steps.map((s) => s.id) }, status: 'DONE' },
    });
    const sp = await this.prisma.studentPathway.findUnique({
      where: { studentId_pathwayId: { studentId, pathwayId } },
      include: { pathway: true, student: true },
    });
    if (!sp) return;
    const complete = done === steps.length;
    if (complete && !sp.completedAt) {
      await this.prisma.studentPathway.update({ where: { id: sp.id }, data: { completedAt: new Date(), promotedAt: null } });
      await this.notifications.notifyStaff({
        type: 'INFO',
        title: `Parcours terminé : ${fullName(sp.student)}`,
        body: `« ${sp.pathway.titleFr} » : toutes les étapes sont acquises. Passage de niveau à valider.`,
        entityType: 'Student',
        entityId: studentId,
        dedupeKey: `levelup:${studentId}:${pathwayId}`,
      });
    } else if (!complete && sp.completedAt) {
      await this.prisma.studentPathway.update({ where: { id: sp.id }, data: { completedAt: null } });
    }
  }

  async promoteLevel(studentId: string, levelId: string, user: AuthUser, ip?: string) {
    await this.access.assertStudentAccess(user, studentId);
    const [student, level] = await Promise.all([
      this.prisma.student.findUnique({ where: { id: studentId } }),
      this.prisma.level.findUnique({ where: { id: levelId } }),
    ]);
    if (!student) throw new NotFoundException('Élève introuvable.');
    if (!level) throw new NotFoundException('Niveau introuvable.');
    await this.prisma.student.update({ where: { id: studentId }, data: { currentLevelId: levelId } });
    await this.prisma.studentPathway.updateMany({
      where: { studentId, completedAt: { not: null }, promotedAt: null },
      data: { promotedAt: new Date() },
    });
    await this.audit.log(user, 'PROMOTE_LEVEL', 'Student', studentId, { levelId: student.currentLevelId }, { levelId, studentId }, ip);
    return this.studentProgress(studentId, user);
  }

  /* ───── Mémorisation du Coran ───── */

  async saveMemorization(studentId: string, dto: MemorizationDto, user: AuthUser) {
    await this.access.assertStudentAccess(user, studentId);
    const info = surahInfo(dto.surah)!;
    if (dto.verse > info.verses) throw new BadRequestException(`La sourate ${info.nameLatin} compte ${info.verses} versets.`);
    const status = dto.status ?? (dto.verse >= info.verses ? 'VALIDATED' : 'IN_PROGRESS');
    const today = await this.settings.today();
    const prev = await this.prisma.memorization.findUnique({ where: { studentId_surah: { studentId, surah: dto.surah } } });
    const data = {
      verse: status === 'VALIDATED' ? info.verses : dto.verse,
      status,
      lastReviewAt: dto.lastReviewAt ? dateOnly(dto.lastReviewAt) : today,
      validatedAt: status === 'VALIDATED' ? (prev?.validatedAt ?? today) : null,
      comment: dto.comment ?? prev?.comment,
      updatedById: user.id,
    };
    await this.prisma.memorization.upsert({
      where: { studentId_surah: { studentId, surah: dto.surah } },
      update: data,
      create: { studentId, surah: dto.surah, ...data },
    });
    return this.studentProgress(studentId, user);
  }

  async removeMemorization(studentId: string, surah: number, user: AuthUser) {
    await this.access.assertStudentAccess(user, studentId);
    await this.prisma.memorization.deleteMany({ where: { studentId, surah } });
    return { ok: true };
  }

  /* ───── Évaluations ───── */

  async addEvaluation(studentId: string, dto: EvaluationDto, user: AuthUser) {
    await this.access.assertStudentAccess(user, studentId);
    if (dto.classId) await this.access.assertClassAccess(user, dto.classId);
    const today = await this.settings.today();
    const ev = await this.prisma.evaluation.create({
      data: {
        studentId,
        classId: dto.classId,
        date: dto.date ? dateOnly(dto.date) : today,
        appreciation: dto.appreciation,
        score: dto.score,
        comment: dto.comment,
        authorId: user.id,
        authorLabel: userLabel(user),
      },
    });
    return ev;
  }

  async removeEvaluation(id: string, user: AuthUser) {
    const ev = await this.prisma.evaluation.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Évaluation introuvable.');
    if (this.access.isTeacher(user) && ev.authorId !== user.id) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres évaluations.');
    }
    await this.prisma.evaluation.delete({ where: { id } });
    await this.audit.log(user, 'DELETE', 'Evaluation', id, ev, undefined);
    return { ok: true };
  }

  /* ═══════════════ Vue d'ensemble d'une classe (suivi par l'enseignant) ═══════════════ */

  async classOverview(classId: string, user: AuthUser) {
    await this.access.assertClassAccess(user, classId);
    const enrolls = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE', student: { status: 'ENROLLED' } },
      include: { student: { include: { currentLevel: true } } },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
    const ids = enrolls.map((e) => e.studentId);
    const [assigned, progress, att, evals, memos] = await Promise.all([
      this.prisma.studentPathway.findMany({
        where: { studentId: { in: ids } },
        include: { pathway: { include: { steps: { select: { id: true } } } } },
      }),
      this.prisma.studentProgress.findMany({ where: { studentId: { in: ids }, status: 'DONE' }, select: { studentId: true, stepId: true } }),
      this.prisma.attendance.findMany({ where: { classId, studentId: { in: ids } }, select: { studentId: true, status: true } }),
      this.prisma.evaluation.findMany({ where: { studentId: { in: ids } }, orderBy: { date: 'desc' } }),
      this.prisma.memorization.findMany({ where: { studentId: { in: ids }, status: 'VALIDATED' }, select: { studentId: true } }),
    ]);

    const students = enrolls.map((e) => {
      const sid = e.studentId;
      const steps = new Set(assigned.filter((a) => a.studentId === sid).flatMap((a) => a.pathway.steps.map((s) => s.id)));
      const done = progress.filter((p) => p.studentId === sid && steps.has(p.stepId)).length;
      const lastEval = evals.find((v) => v.studentId === sid);
      return {
        id: sid,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        arabicName: e.student.arabicName,
        photoUrl: this.files.url(e.student.photo),
        level: e.student.currentLevel,
        percent: steps.size ? Math.round((done / steps.size) * 100) : 0,
        doneSteps: done,
        totalSteps: steps.size,
        validatedSurahs: memos.filter((m) => m.studentId === sid).length,
        attendance: summarize(att.filter((a) => a.studentId === sid)),
        lastEvaluation: lastEval ? { date: lastEval.date, appreciation: lastEval.appreciation, score: lastEval.score } : null,
      };
    });
    return { classId, students };
  }

  /* ═══════════════ Données de bulletin (PDF/HTML) ═══════════════ */

  /** Trimestre (1..3) : dates paramétrables ('terms.dates') ou année découpée en trois parts égales. */
  async termRange(term: number, yearId?: string) {
    const year = yearId
      ? await this.prisma.schoolYear.findUnique({ where: { id: yearId } })
      : await this.prisma.schoolYear.findFirst({ where: { isCurrent: true } });
    if (!year) throw new NotFoundException('Année scolaire introuvable.');
    const custom = await this.settings.get<Array<{ start: string; end: string }> | null>('terms.dates');
    if (custom && custom[term - 1]) {
      return { year, start: dateOnly(custom[term - 1].start), end: dateOnly(custom[term - 1].end) };
    }
    const total = diffDays(year.endDate, year.startDate) + 1;
    const part = Math.ceil(total / 3);
    const start = addDays(year.startDate, part * (term - 1));
    const end = term === 3 ? year.endDate : addDays(start, part - 1);
    return { year, start, end };
  }

  async bulletinData(studentId: string, term: number, user: AuthUser, yearId?: string) {
    if (![1, 2, 3].includes(term)) throw new BadRequestException('Trimestre : 1, 2 ou 3.');
    await this.access.assertStudentAccess(user, studentId);
    const { year, start, end } = await this.termRange(term, yearId);
    const [progress, att, evals, memos, student] = await Promise.all([
      this.studentProgress(studentId, user),
      attendanceSummary(this.prisma, studentId, start, end),
      this.prisma.evaluation.findMany({ where: { studentId, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } }),
      this.prisma.memorization.findMany({ where: { studentId, status: 'VALIDATED', validatedAt: { gte: start, lte: end } } }),
      this.prisma.student.findUnique({
        where: { id: studentId },
        include: { enrollments: { where: { status: 'ACTIVE' }, include: { class: { include: { course: true, teacher: true } } } } },
      }),
    ]);
    if (!student) throw new NotFoundException('Élève introuvable.');
    const events = await this.prisma.progressEvent.count({
      where: { studentId, status: 'DONE', createdAt: { gte: start, lt: addDays(end, 1) } },
    });
    return {
      student,
      year,
      term: { index: term, start, end },
      progress,
      attendance: att,
      evaluations: evals,
      validatedSurahsInTerm: memos.map((m) => ({ ...m, ...surahInfo(m.surah) })),
      stepsAcquiredInTerm: events,
    };
  }
}
