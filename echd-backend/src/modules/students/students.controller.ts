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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AdminOnly, AnyRole, AuthUser, ClientIp, CurrentUser, StaffOnly } from '../../common/decorators';
import { MAX_UPLOAD_BYTES } from '../../common/files.service';
import { EnrollmentsService } from './enrollments.service';
import {
  BatchStudentsDto,
  CreateStudentDto,
  EndEnrollmentDto,
  EnrollDto,
  LinkSiblingDto,
  StudentQuery,
  StudentStatusDto,
  TransferDto,
  UpdateStudentDto,
} from './students.dto';
import { StudentsService } from './students.service';

@ApiTags('Élèves')
@ApiBearerAuth()
@Controller()
export class StudentsController {
  constructor(
    private students: StudentsService,
    private enrollments: EnrollmentsService,
  ) {}

  /** Liste paginée (recherche, filtres, tri). Un enseignant ne voit que ses élèves. */
  @AnyRole()
  @Get('students')
  list(@Query() q: StudentQuery, @CurrentUser() u: AuthUser) {
    return this.students.list(q, u);
  }

  @AdminOnly()
  @Get('students/retention/expired')
  retention() {
    return this.students.retentionExpired();
  }

  @AnyRole()
  @Get('students/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.students.get(id, u);
  }

  @StaffOnly()
  @Post('students')
  create(@Body() dto: CreateStudentDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.students.create(dto, u, ip);
  }

  /** Vérifie un doublon présumé avant l'enregistrement (assistant d'inscription). */
  @StaffOnly()
  @Post('students/check-duplicates')
  async check(@Body() dto: CreateStudentDto) {
    return { duplicates: await this.students.findDuplicates(dto) };
  }

  /** Plusieurs personnes d'un coup (fratrie) — une seule famille. */
  @StaffOnly()
  @Post('students/batch')
  batch(@Body() dto: BatchStudentsDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.students.createBatch(dto, u, ip);
  }

  @StaffOnly()
  @Patch('students/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.students.update(id, dto, u, ip);
  }

  @StaffOnly()
  @Post('students/:id/status')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StudentStatusDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.students.setStatus(id, dto.status, dto.reason, u, ip);
  }

  @StaffOnly()
  @Post('students/:id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.students.archive(id, u, ip);
  }

  @StaffOnly()
  @Post('students/:id/unarchive')
  unarchive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.students.unarchive(id, u, ip);
  }

  /** Suppression définitive (droit à l'effacement) : ?confirm=yes obligatoire. */
  @AdminOnly()
  @Delete('students/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('confirm') confirm: string,
    @CurrentUser() u: AuthUser,
    @ClientIp() ip: string,
  ) {
    if (confirm !== 'yes') throw new BadRequestException('Confirmation requise : ajoutez ?confirm=yes.');
    return this.students.remove(id, u, ip);
  }

  @StaffOnly()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Post('students/:id/photo')
  photo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() u: AuthUser,
    @ClientIp() ip: string,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu (champ "file").');
    return this.students.setPhoto(id, file.buffer, u, ip);
  }

  @StaffOnly()
  @Delete('students/:id/photo')
  removePhoto(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.removePhoto(id);
  }

  @StaffOnly()
  @Post('students/:id/siblings')
  link(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkSiblingDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.students.linkSibling(id, dto.studentId, u, ip);
  }

  @StaffOnly()
  @Delete('students/:id/siblings')
  unlink(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.students.unlinkSibling(id, u, ip);
  }

  @StaffOnly()
  @Get('students/:id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.history(id);
  }

  /* ───── Inscriptions en classe ───── */

  @StaffOnly()
  @Post('students/:id/enrollments')
  enroll(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EnrollDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.enrollments.enroll(id, dto, u, ip);
  }

  @StaffOnly()
  @Post('enrollments/:id/end')
  end(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndEnrollmentDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.enrollments.end(id, dto.endDate, u, ip);
  }

  @StaffOnly()
  @Post('enrollments/:id/transfer')
  transfer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.enrollments.transfer(id, dto, u, ip);
  }

  @StaffOnly()
  @Post('enrollments/:id/promote')
  promote(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.enrollments.promote(id, u, ip);
  }
}
