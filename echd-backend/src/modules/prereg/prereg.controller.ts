import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly, AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { ConvertPreRegDto, PreRegQuery, UpdatePreRegDto } from './prereg.dto';
import { PreRegService } from './prereg.service';

/** Boîte « Préinscriptions » (administration + gestionnaire). */
@ApiTags('Préinscriptions')
@ApiBearerAuth()
@Controller('pre-registrations')
export class PreRegController {
  constructor(private prereg: PreRegService) {}

  @Get()
  list(@Query() q: PreRegQuery) {
    return this.prereg.list(q);
  }

  /** Pastille du menu : nouvelles demandes et demandes en attente depuis trop longtemps. */
  @Get('count')
  count() {
    return this.prereg.counts();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.prereg.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePreRegDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.prereg.update(id, dto, u, ip);
  }

  /** Bouton « Valider et créer l'élève ». */
  @Post(':id/convert')
  convert(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertPreRegDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.prereg.convert(id, dto, u, ip);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.prereg.remove(id, u, ip);
  }
}
