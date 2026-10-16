import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { memoryStorage } from 'multer';
import { AuditService } from '../../common/audit.service';
import { AdminOnly, AnyRole, AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { FilesService, MAX_UPLOAD_BYTES } from '../../common/files.service';
import { PrismaService } from '../../common/prisma.service';
import { LOOKUP_SETTING_KEYS, SettingsService } from '../../common/settings.service';
import { SURAHS } from '../progress/surahs';

export class UpdateSettingsDto {
  /** Objet { "clé": valeur } — voir GET /settings pour la liste des clés. */
  @IsObject()
  values!: Record<string, any>;
}

@ApiTags('Paramètres')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private settings: SettingsService,
    private files: FilesService,
    private audit: AuditService,
  ) {}

  /** Tous les paramètres (administrateur). */
  @AdminOnly()
  @Get()
  async all() {
    const all = await this.settings.all();
    return { ...all, 'institute.logoUrl': this.files.url(all['institute.logo']) };
  }

  @AdminOnly()
  @Put()
  async update(@Body() dto: UpdateSettingsDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const forbidden = Object.keys(dto.values).filter((k) => k === 'institute.logo');
    if (forbidden.length) throw new BadRequestException('Utilisez POST /settings/logo pour le logo.');
    const before = await this.settings.getMany(Object.keys(dto.values));
    await this.settings.set(dto.values);
    await this.audit.log(u, 'UPDATE', 'Setting', null, before, dto.values, ip);
    return this.all();
  }

  @AdminOnly()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Post('logo')
  async logo(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    if (!file) throw new BadRequestException('Aucun fichier reçu (champ "file").');
    const old = await this.settings.get<string | null>('institute.logo');
    const path = await this.files.saveImage(file.buffer, 'public', 'branding', 'logo');
    await this.settings.set({ 'institute.logo': path });
    await this.files.remove(old);
    await this.audit.log(u, 'UPDATE', 'Setting', 'institute.logo', { old }, { path }, ip);
    return { logoUrl: this.files.url(path) };
  }

  @AdminOnly()
  @Delete('logo')
  async removeLogo(@CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const old = await this.settings.get<string | null>('institute.logo');
    await this.settings.set({ 'institute.logo': null });
    await this.files.remove(old);
    await this.audit.log(u, 'DELETE', 'Setting', 'institute.logo', { old }, undefined, ip);
    return { ok: true };
  }
}

/** Données de référence pour alimenter les listes déroulantes du back-office (tous les rôles connectés). */
@ApiTags('Référentiels')
@ApiBearerAuth()
@AnyRole()
@Controller()
export class LookupsController {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private files: FilesService,
  ) {}

  @Get('lookups')
  async lookups(@CurrentUser() user: AuthUser) {
    const [levels, rooms, schoolYears, courses, classes, teachers, settings] = await Promise.all([
      this.prisma.level.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.room.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.schoolYear.findMany({ orderBy: { startDate: 'desc' } }),
      this.prisma.course.findMany({
        orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
        select: { id: true, titleFr: true, titleAr: true, audience: true, category: true, active: true, color: true },
      }),
      this.prisma.schoolClass.findMany({
        where: user.role === 'TEACHER' ? { teacherId: user.teacherId ?? '__none__' } : undefined,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          courseId: true,
          teacherId: true,
          schoolYearId: true,
          capacity: true,
          active: true,
          roomId: true,
        },
      }),
      this.prisma.teacher.findMany({
        orderBy: { firstName: 'asc' },
        select: { id: true, firstName: true, lastName: true, active: true },
      }),
      this.settings.getMany(LOOKUP_SETTING_KEYS),
    ]);
    return {
      levels,
      rooms,
      schoolYears,
      currentSchoolYear: schoolYears.find((y) => y.isCurrent) ?? null,
      courses,
      classes,
      teachers,
      settings: { ...settings, 'institute.logoUrl': this.files.url(settings['institute.logo']) },
    };
  }

  @Get('reference/surahs')
  surahs() {
    return SURAHS.map(([number, nameAr, nameLatin, verses]) => ({ number, nameAr, nameLatin, verses }));
  }
}
