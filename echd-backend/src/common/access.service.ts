import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from './decorators';
import { PrismaService } from './prisma.service';

/** Règles de périmètre : un enseignant ne voit que ses classes et ses élèves. */
@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  isTeacher(u: AuthUser) {
    return u.role === Role.TEACHER;
  }

  async assertClassAccess(u: AuthUser, classId: string) {
    const cls = await this.prisma.schoolClass.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Classe introuvable.');
    if (this.isTeacher(u) && (!u.teacherId || cls.teacherId !== u.teacherId)) {
      throw new ForbiddenException("Cette classe n'est pas la vôtre.");
    }
    return cls;
  }

  async teacherStudentIds(u: AuthUser): Promise<string[]> {
    if (!u.teacherId) return [];
    const rows = await this.prisma.enrollment.findMany({
      where: { status: 'ACTIVE', class: { teacherId: u.teacherId, active: true } },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    return rows.map((r) => r.studentId);
  }

  async assertStudentAccess(u: AuthUser, studentId: string) {
    if (!this.isTeacher(u)) return;
    const ids = await this.teacherStudentIds(u);
    if (!ids.includes(studentId)) throw new ForbiddenException("Cet élève n'est pas dans vos classes.");
  }
}
