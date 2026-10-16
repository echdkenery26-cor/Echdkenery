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
import { AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { MAX_UPLOAD_BYTES } from '../../common/files.service';
import { AnnouncementQuery, CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.dto';
import { AnnouncementsService } from './announcements.service';

/** Section « Informations » : administrateur + gestionnaire. */
@ApiTags('Annonces')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  @Get()
  list(@Query() q: AnnouncementQuery) {
    return this.announcements.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.get(id);
  }

  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.announcements.create(dto, u, ip);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.announcements.update(id, dto, u, ip);
  }

  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.announcements.setStatus(id, 'PUBLISHED', u, ip);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.announcements.setStatus(id, 'DRAFT', u, ip);
  }

  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @Post(':id/image')
  image(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu (champ "file").');
    return this.announcements.setImage(id, file.buffer);
  }

  @Delete(':id/image')
  removeImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.removeImage(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.announcements.remove(id, u, ip);
  }
}
