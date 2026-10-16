import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { AuthUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { addDays, dateOnly, isoWeekday, ymd } from '../../common/utils';
import { TimetableQuery } from './academic.dto';

export type OccurrenceStatus = 'NORMAL' | 'CANCELLED' | 'MOVED' | 'CLOSED';

export interface Occurrence {
  date: string;
  slotId: string;
  classId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  roomId: string | null;
  status: OccurrenceStatus;
  reason?: string;
  exceptionId?: string;
  closureLabelFr?: string;
  closureLabelAr?: string;
}

/**
 * Déplie les créneaux récurrents en séances datées entre `from` et `to`,
 * en appliquant exceptions (annulé / déplacé) et jours fermés.
 */
export function expandOccurrences(
  slots: Array<{
    id: string;
    classId: string;
    weekday: number;
    startTime: string;
    endTime: string;
    roomId: string | null;
    exceptions?: Array<{
      id: string;
      date: Date;
      type: 'CANCELLED' | 'MOVED';
      newStartTime: string | null;
      newEndTime: string | null;
      newRoomId: string | null;
      reason: string;
    }>;
  }>,
  closures: Array<{ startDate: Date; endDate: Date; labelFr: string; labelAr: string }>,
  from: Date,
  to: Date,
): Occurrence[] {
  const out: Occurrence[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    for (const s of slots) {
      if (s.weekday !== wd) continue;
      const base: Occurrence = {
        date: ymd(d),
        slotId: s.id,
        classId: s.classId,
        weekday: wd,
        startTime: s.startTime,
        endTime: s.endTime,
        roomId: s.roomId,
        status: 'NORMAL',
      };
      const closure = closures.find((c) => c.startDate <= d && c.endDate >= d);
      const ex = s.exceptions?.find((e) => ymd(e.date) === base.date);
      if (closure) {
        out.push({ ...base, status: 'CLOSED', closureLabelFr: closure.labelFr, closureLabelAr: closure.labelAr });
      } else if (ex?.type === 'CANCELLED') {
        out.push({ ...base, status: 'CANCELLED', reason: ex.reason, exceptionId: ex.id });
      } else if (ex?.type === 'MOVED') {
        out.push({
          ...base,
          status: 'MOVED',
          startTime: ex.newStartTime ?? s.startTime,
          endTime: ex.newEndTime ?? s.endTime,
          roomId: ex.newRoomId ?? s.roomId,
          reason: ex.reason,
          exceptionId: ex.id,
        });
      } else {
        out.push(base);
      }
    }
  }
  return out.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

@Injectable()
export class TimetableService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private access: AccessService,
  ) {}

  /** Emploi du temps (élève, enseignant, salle, classe ou global) + séances datées des 4 prochaines semaines. */
  async get(q: TimetableQuery, user: AuthUser) {
    const today = await this.settings.today();
    const from = q.from ? dateOnly(q.from) : today;
    const to = q.to ? dateOnly(q.to) : addDays(from, 27);

    const where: Prisma.SlotWhereInput = {
      class: { active: true, schoolYear: { isCurrent: true } },
    };
    const classWhere = where.class as Prisma.SchoolClassWhereInput;

    if (this.access.isTeacher(user)) {
      // Un enseignant ne voit que ses propres classes, ou l'emploi du temps d'un de ses élèves.
      if (q.studentId) await this.access.assertStudentAccess(user, q.studentId);
      else if (q.classId) await this.access.assertClassAccess(user, q.classId);
      else if (!q.teacherId || q.teacherId === user.teacherId) q.teacherId = user.teacherId ?? '__none__';
      else throw new ForbiddenException('Accès refusé.');
      if (q.studentId) {
        // pour l'élève, ne montrer que les créneaux des classes de cet enseignant
        classWhere.teacherId = user.teacherId ?? '__none__';
      }
    }

    if (q.studentId) classWhere.enrollments = { some: { studentId: q.studentId, status: 'ACTIVE' } };
    if (q.teacherId) classWhere.teacherId = q.teacherId;
    if (q.classId) classWhere.id = q.classId;
    if (q.roomId) where.roomId = q.roomId;

    const [slots, closures] = await Promise.all([
      this.prisma.slot.findMany({
        where,
        include: {
          room: true,
          exceptions: { where: { date: { gte: from, lte: to } }, include: { newRoom: true } },
          class: {
            include: {
              course: { select: { id: true, titleFr: true, titleAr: true, color: true, audience: true, icon: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
              room: true,
            },
          },
        },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.closure.findMany({
        where: { schoolYear: { isCurrent: true }, endDate: { gte: from } },
        orderBy: { startDate: 'asc' },
      }),
    ]);

    const items = slots.map((s) => ({
      id: s.id,
      classId: s.classId,
      className: s.class.name,
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      course: s.class.course,
      teacher: s.class.teacher,
      room: s.room ?? s.class.room,
      exceptions: s.exceptions,
    }));

    const occurrences = expandOccurrences(
      slots.map((s) => ({ ...s, exceptions: s.exceptions })),
      closures,
      from,
      to,
    );

    return { slots: items, occurrences, closures, from: ymd(from), to: ymd(to) };
  }
}
