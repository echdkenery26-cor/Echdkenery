import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Actor, AuditService } from '../../common/audit.service';
import { AdminOnly, AnyRole, AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { FilesService, MAX_UPLOAD_BYTES } from '../../common/files.service';
import { PrismaService } from '../../common/prisma.service';
import {
  CreateStaffDto,
  CreateTeacherDto,
  TeacherAccountDto,
  UpdateStaffDto,
  UpdateTeacherDto,
} from './teachers.dto';
import { TeachersService } from './teachers.service';

const upload = () => FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

function needFile(file?: Express.Multer.File) {
  if (!file) throw new BadRequestException('Aucun fichier reçu (champ "file").');
  return file.buffer;
}

@ApiTags('Enseignants')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private teachers: TeachersService) {}

  @Get()
  list() {
    return this.teachers.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachers.get(id);
  }

  @AdminOnly()
  @Post()
  create(@Body() dto: CreateTeacherDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.teachers.create(dto, u, ip);
  }

  @AdminOnly()
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentUser() u: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.teachers.update(id, dto, u, ip);
  }

  /** Crée le compte de connexion de l'enseignant et retourne son identifiant + mot de passe provisoire. */
  @AdminOnly()
  @Post(':id/account')
  account(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TeacherAccountDto,
    @CurrentUser() u: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.teachers.createAccount(id, dto, u, ip);
  }

  @AdminOnly()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload())
  @Post(':id/photo')
  photo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    return this.teachers.setPhoto(id, needFile(file));
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.teachers.remove(id, u, ip);
  }
}

@ApiTags('Équipe')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private audit: AuditService,
  ) {}

  @Get()
  async list() {
    const rows = await this.prisma.staffMember.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
    return rows.map((r) => this.files.withPhoto(r));
  }

  @AdminOnly()
  @Post()
  async create(@Body() dto: CreateStaffDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const row = await this.prisma.staffMember.create({ data: dto });
    await this.audit.log(u as Actor, 'CREATE', 'StaffMember', row.id, undefined, row, ip);
    return this.files.withPhoto(row);
  }

  @AdminOnly()
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() u: AuthUser,
    @ClientIp() ip: string,
  ) {
    const before = await this.prisma.staffMember.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.staffMember.update({ where: { id }, data: dto });
    await this.audit.log(u as Actor, 'UPDATE', 'StaffMember', id, before, row, ip);
    return this.files.withPhoto(row);
  }

  @AdminOnly()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(upload())
  @Post(':id/photo')
  async photo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    const row = await this.prisma.staffMember.findUniqueOrThrow({ where: { id } });
    const photo = await this.files.saveImage(needFile(file), 'public', 'staff', 'portrait');
    await this.prisma.staffMember.update({ where: { id }, data: { photo } });
    await this.files.remove(row.photo);
    return { photoUrl: this.files.url(photo) };
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const row = await this.prisma.staffMember.findUniqueOrThrow({ where: { id } });
    await this.prisma.staffMember.delete({ where: { id } });
    await this.files.remove(row.photo);
    await this.audit.log(u as Actor, 'DELETE', 'StaffMember', id, row, undefined, ip);
    return { ok: true };
  }
}
