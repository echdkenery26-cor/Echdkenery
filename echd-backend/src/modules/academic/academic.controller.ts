import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audience } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { AdminOnly, AnyRole, AuthUser, ClientIp, CurrentUser, StaffOnly } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { dateOnly } from '../../common/utils';
import {
  ClassQuery,
  ClosureDto,
  CreateClassDto,
  CreateCourseDto,
  CreateSchoolYearDto,
  DuplicateSchoolYearDto,
  SlotDto,
  SlotExceptionDto,
  TimetableQuery,
  UpdateClassDto,
  UpdateCourseDto,
  UpdateSchoolYearDto,
  UpdateSlotDto,
} from './academic.dto';
import { ClassesService } from './classes.service';
import { TimetableService } from './timetable.service';

class CourseQuery {
  @IsOptional()
  @IsEnum(Audience)
  audience?: Audience;

  @IsOptional()
  @IsString()
  active?: string;
}

/* ═══════════════ Cours ═══════════════ */

@ApiTags('Cours')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @Get()
  list(@Query() q: CourseQuery) {
    return this.prisma.course.findMany({
      where: { audience: q.audience, active: q.active === undefined ? undefined : q.active === 'true' },
      include: { level: true, _count: { select: { classes: true } } },
      orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
    });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.course.findUniqueOrThrow({
      where: { id },
      include: { level: true, pathways: { include: { steps: { orderBy: { order: 'asc' } } } }, feeSchedules: true },
    });
  }

  @AdminOnly()
  @Post()
  async create(@Body() dto: CreateCourseDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const row = await this.prisma.course.create({ data: dto });
    await this.audit.log(u, 'CREATE', 'Course', row.id, undefined, row, ip);
    return row;
  }

  @AdminOnly()
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.course.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.course.update({ where: { id }, data: dto });
    await this.audit.log(u, 'UPDATE', 'Course', id, before, row, ip);
    return row;
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.course.findUniqueOrThrow({ where: { id }, include: { _count: { select: { classes: true } } } });
    if (before._count.classes) throw new ConflictException('Ce cours a des classes : masquez-le ou désactivez-le plutôt.');
    await this.prisma.course.delete({ where: { id } });
    await this.audit.log(u, 'DELETE', 'Course', id, before, undefined, ip);
    return { ok: true };
  }
}

/* ═══════════════ Années scolaires & fermetures ═══════════════ */

@ApiTags('Années scolaires')
@ApiBearerAuth()
@Controller()
export class SchoolYearsController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private checkDates(s: string, e: string) {
    if (dateOnly(e) <= dateOnly(s)) throw new BadRequestException('La date de fin doit être après la date de début.');
  }

  @Get('school-years')
  list() {
    return this.prisma.schoolYear.findMany({
      orderBy: { startDate: 'desc' },
      include: { closures: { orderBy: { startDate: 'asc' } }, _count: { select: { classes: true } } },
    });
  }

  @AdminOnly()
  @Post('school-years')
  async create(@Body() dto: CreateSchoolYearDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    this.checkDates(dto.startDate, dto.endDate);
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) await tx.schoolYear.updateMany({ data: { isCurrent: false } });
      return tx.schoolYear.create({
        data: { name: dto.name, startDate: dateOnly(dto.startDate), endDate: dateOnly(dto.endDate), isCurrent: !!dto.isCurrent },
      });
    });
    await this.audit.log(u, 'CREATE', 'SchoolYear', row.id, undefined, row, ip);
    return row;
  }

  @AdminOnly()
  @Patch('school-years/:id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSchoolYearDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.schoolYear.findUniqueOrThrow({ where: { id } });
    const start = dto.startDate ?? before.startDate.toISOString();
    const end = dto.endDate ?? before.endDate.toISOString();
    this.checkDates(start, end);
    const row = await this.prisma.schoolYear.update({
      where: { id },
      data: { name: dto.name, startDate: dateOnly(start), endDate: dateOnly(end) },
    });
    await this.audit.log(u, 'UPDATE', 'SchoolYear', id, before, row, ip);
    return row;
  }

  @AdminOnly()
  @Post('school-years/:id/set-current')
  async setCurrent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    await this.prisma.schoolYear.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.schoolYear.updateMany({ data: { isCurrent: false } }),
      this.prisma.schoolYear.update({ where: { id }, data: { isCurrent: true } }),
    ]);
    await this.audit.log(u, 'UPDATE', 'SchoolYear', id, undefined, { isCurrent: true }, ip);
    return { ok: true };
  }

  /** Rentrée : duplique l'année (et, au choix, ses classes + créneaux, sans les élèves). */
  @AdminOnly()
  @Post('school-years/:id/duplicate')
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateSchoolYearDto,
    @CurrentUser() u: AuthUser,
    @ClientIp() ip: string,
  ) {
    this.checkDates(dto.startDate, dto.endDate);
    const src = await this.prisma.schoolYear.findUniqueOrThrow({ where: { id } });
    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.makeCurrent) await tx.schoolYear.updateMany({ data: { isCurrent: false } });
      const year = await tx.schoolYear.create({
        data: { name: dto.name, startDate: dateOnly(dto.startDate), endDate: dateOnly(dto.endDate), isCurrent: !!dto.makeCurrent },
      });
      let classes = 0;
      let slots = 0;
      if (dto.copyClasses !== false) {
        const olds = await tx.schoolClass.findMany({ where: { schoolYearId: src.id, active: true }, include: { slots: true } });
        for (const c of olds) {
          await tx.schoolClass.create({
            data: {
              name: c.name,
              courseId: c.courseId,
              teacherId: c.teacherId,
              roomId: c.roomId,
              capacity: c.capacity,
              schoolYearId: year.id,
              slots: { create: c.slots.map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, roomId: s.roomId })) },
            },
          });
          classes++;
          slots += c.slots.length;
        }
      }
      return { year, classes, slots };
    });
    await this.audit.log(u, 'DUPLICATE', 'SchoolYear', result.year.id, { from: src.name }, result, ip);
    return result;
  }

  @AdminOnly()
  @Delete('school-years/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.schoolYear.findUniqueOrThrow({ where: { id }, include: { _count: { select: { classes: true } } } });
    if (before.isCurrent) throw new ConflictException("Impossible de supprimer l'année courante.");
    if (before._count.classes) throw new ConflictException('Cette année contient des classes.');
    await this.prisma.schoolYear.delete({ where: { id } });
    await this.audit.log(u, 'DELETE', 'SchoolYear', id, before, undefined, ip);
    return { ok: true };
  }

  /* Vacances / jours fermés */

  @AdminOnly()
  @Post('school-years/:id/closures')
  async addClosure(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ClosureDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    if (dateOnly(dto.endDate) < dateOnly(dto.startDate)) {
      throw new BadRequestException('La date de fin ne peut pas précéder la date de début.');
    }
    await this.prisma.schoolYear.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.closure.create({
      data: { schoolYearId: id, type: dto.type, startDate: dateOnly(dto.startDate), endDate: dateOnly(dto.endDate), labelFr: dto.labelFr, labelAr: dto.labelAr ?? '' },
    });
    await this.audit.log(u, 'CREATE', 'Closure', row.id, undefined, row, ip);
    return row;
  }

  @AdminOnly()
  @Delete('closures/:id')
  async removeClosure(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.closure.findUniqueOrThrow({ where: { id } });
    await this.prisma.closure.delete({ where: { id } });
    await this.audit.log(u, 'DELETE', 'Closure', id, before, undefined, ip);
    return { ok: true };
  }
}

/* ═══════════════ Classes, créneaux, exceptions ═══════════════ */

@ApiTags('Classes')
@ApiBearerAuth()
@Controller()
export class ClassesController {
  constructor(private classes: ClassesService) {}

  @AnyRole()
  @Get('classes')
  list(@Query() q: ClassQuery, @CurrentUser() u: AuthUser) {
    return this.classes.list(q, u);
  }

  @AnyRole()
  @Get('classes/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.classes.get(id, u);
  }

  /** Élèves de la classe (inscrits + liste d'attente). */
  @AnyRole()
  @Get('classes/:id/students')
  students(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.classes.students(id, u);
  }

  @AdminOnly()
  @Post('classes')
  create(@Body() dto: CreateClassDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.classes.create(dto, u, ip);
  }

  @AdminOnly()
  @Patch('classes/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClassDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.classes.update(id, dto, u, ip);
  }

  @AdminOnly()
  @Delete('classes/:id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.classes.remove(id, u, ip);
  }

  @AdminOnly()
  @Post('classes/:id/slots')
  addSlot(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SlotDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.classes.addSlot(id, dto, u, ip);
  }

  @AdminOnly()
  @Patch('slots/:id')
  updateSlot(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSlotDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.classes.updateSlot(id, dto, u, ip);
  }

  @AdminOnly()
  @Delete('slots/:id')
  removeSlot(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.classes.removeSlot(id, u, ip);
  }

  /** Annule ou déplace la séance d'un jour donné ; retourne le message prêt à envoyer aux élèves concernés. */
  @StaffOnly()
  @Post('slots/:id/exceptions')
  addException(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SlotExceptionDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.classes.addException(id, dto, u, ip);
  }

  @StaffOnly()
  @Delete('slot-exceptions/:id')
  removeException(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.classes.removeException(id, u, ip);
  }
}

@ApiTags('Emploi du temps')
@ApiBearerAuth()
@Controller('timetable')
export class TimetableController {
  constructor(private timetable: TimetableService) {}

  /** Vue globale, ou filtrée par élève / enseignant / salle / classe. */
  @AnyRole()
  @Get()
  get(@Query() q: TimetableQuery, @CurrentUser() u: AuthUser) {
    return this.timetable.get(q, u);
  }
}
