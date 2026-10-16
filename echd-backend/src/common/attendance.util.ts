import { PrismaClient } from '@prisma/client';

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  /** Taux d'assiduité en % : (présents + retards) / (présents + retards + absents). Les absences excusées ne comptent pas. */
  rate: number | null;
}

export function summarize(rows: { status: string }[]): AttendanceCounts {
  const c = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of rows) {
    if (r.status === 'PRESENT') c.present++;
    else if (r.status === 'ABSENT') c.absent++;
    else if (r.status === 'LATE') c.late++;
    else if (r.status === 'EXCUSED') c.excused++;
  }
  const counted = c.present + c.late + c.absent;
  return { ...c, total: rows.length, rate: counted ? Math.round(((c.present + c.late) / counted) * 100) : null };
}

export async function attendanceSummary(
  prisma: PrismaClient,
  studentId: string,
  from?: Date,
  to?: Date,
): Promise<AttendanceCounts> {
  const rows = await prisma.attendance.findMany({
    where: { studentId, date: { gte: from, lte: to } },
    select: { status: true },
  });
  return summarize(rows);
}
