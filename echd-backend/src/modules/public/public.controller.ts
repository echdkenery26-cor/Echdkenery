import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Audience } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { memoryStorage } from 'multer';
import { Public } from '../../common/decorators';
import { FilesService, MAX_UPLOAD_BYTES } from '../../common/files.service';
import { PrismaService } from '../../common/prisma.service';
import { PUBLIC_SETTING_KEYS, SettingsService } from '../../common/settings.service';
import { addDays, ymd } from '../../common/utils';
import { expandOccurrences } from '../academic/timetable.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { CreatePreRegDto } from '../prereg/prereg.dto';
import { PreRegService } from '../prereg/prereg.service';

class AudienceQuery {
  @IsOptional()
  @IsEnum(Audience)
  audience?: Audience;
}

class PublicAnnouncementsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsString()
  category?: string;
}

/**
 * Site public : lecture seule + préinscription.
 * Aucune donnée d'élève n'est jamais exposée ici (règle 10).
 */
@ApiTags('Site public')
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private files: FilesService,
    private announcements: AnnouncementsService,
    private prereg: PreRegService,
  ) {}

  @Get('settings')
  async publicSettings() {
    const s = await this.settings.getMany(PUBLIC_SETTING_KEYS);
    return {
      ...s,
      'institute.logoUrl': this.files.url(s['institute.logo']),
      'institute.logo': undefined,
      registrationFee: await this.prereg.registrationFee(),
    };
  }

  /** Chiffres clés de la page d'accueil (agrégats uniquement). */
  @Get('stats')
  async stats() {
    const [students, teachers, courses, slots] = await Promise.all([
      this.prisma.student.count({ where: { status: 'ENROLLED', archivedAt: null } }),
      this.prisma.teacher.count({ where: { active: true, showOnSite: true } }),
      this.prisma.course.count({ where: { active: true, visible: true } }),
      this.prisma.slot.count({ where: { class: { active: true, schoolYear: { isCurrent: true }, course: { visible: true, active: true } } } }),
    ]);
    return { students, teachers, courses, weeklySlots: slots };
  }

  @Get('courses')
  async courses(@Query() q: AudienceQuery) {
    const rows = await this.prisma.course.findMany({
      where: { active: true, visible: true, audience: q.audience },
      orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
      include: {
        level: true,
        classes: { where: { active: true, schoolYear: { isCurrent: true } }, select: { slots: { select: { weekday: true, startTime: true, endTime: true } } } },
      },
    });
    return rows.map(({ classes, active, visible, ...c }) => ({
      ...c,
      slots: classes.flatMap((k) => k.slots).sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
    }));
  }

  /** Planning hebdomadaire par jour + annulations / fermetures à venir. */
  @Get('schedule')
  async schedule(@Query() q: AudienceQuery) {
    const today = await this.settings.today();
    const to = addDays(today, 42);
    const slots = await this.prisma.slot.findMany({
      where: {
        class: { active: true, schoolYear: { isCurrent: true }, course: { visible: true, active: true, audience: q.audience } },
      },
      include: {
        room: { select: { name: true, nameAr: true } },
        exceptions: { where: { date: { gte: today, lte: to } } },
        class: {
          select: {
            name: true,
            course: { select: { id: true, titleFr: true, titleAr: true, audience: true, color: true, icon: true, level: { select: { labelFr: true, labelAr: true } } } },
            teacher: { select: { firstName: true, lastName: true } },
            room: { select: { name: true, nameAr: true } },
          },
        },
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
    const closures = await this.prisma.closure.findMany({ where: { schoolYear: { isCurrent: true }, endDate: { gte: today } }, orderBy: { startDate: 'asc' } });
    const upcoming = expandOccurrences(slots.map((s) => ({ ...s, exceptions: s.exceptions })), closures, today, to).filter((o) => o.status !== 'NORMAL');
    return {
      slots: slots.map((s) => ({
        id: s.id,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
        course: s.class.course,
        teacher: s.class.teacher ? { firstName: s.class.teacher.firstName, lastName: s.class.teacher.lastName } : null,
        room: s.room ?? s.class.room,
      })),
      changes: upcoming.map((o) => ({ ...o, slotId: o.slotId })),
      closures: closures.map((c) => ({ type: c.type, startDate: ymd(c.startDate), endDate: ymd(c.endDate), labelFr: c.labelFr, labelAr: c.labelAr })),
    };
  }

  @Get('team')
  async team() {
    const [staff, teachers] = await Promise.all([
      this.prisma.staffMember.findMany({ where: { visible: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
      this.prisma.teacher.findMany({ where: { active: true, showOnSite: true }, orderBy: { firstName: 'asc' } }),
    ]);
    return {
      administration: staff.map((s) => ({ id: s.id, name: s.name, roleFr: s.roleFr, roleAr: s.roleAr, photoUrl: this.files.url(s.photo) })),
      teachers: teachers.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        specialty: t.specialty,
        audiences: t.audiences,
        photoUrl: this.files.url(t.photo),
      })),
    };
  }

  @Get('announcements')
  list(@Query() q: PublicAnnouncementsQuery) {
    return this.announcements.publicList(q);
  }

  @Get('announcements/banner')
  banner() {
    return this.announcements.banner();
  }

  @Get('announcements/:id')
  one(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.publicGet(id);
  }

  /** Envoi d'une photo avant la préinscription (retourne une clé à joindre à la demande). */
  @Throttle({ default: { limit: 15, ttl: 3600_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Post('uploads/photo')
  photo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu (champ "file").');
    return this.prereg.uploadPhoto(file.buffer);
  }

  /** Formulaire de préinscription (anti-spam : champ piège + limitation de débit). */
  @Throttle({ default: { limit: 8, ttl: 3600_000 } })
  @HttpCode(201)
  @Post('pre-registrations')
  create(@Body() dto: CreatePreRegDto) {
    return this.prereg.create(dto);
  }
}
