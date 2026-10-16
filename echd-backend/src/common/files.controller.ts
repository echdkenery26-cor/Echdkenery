import { Controller, ForbiddenException, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from './decorators';
import { FilesService } from './files.service';
import { SigningService } from './signing.service';

@ApiExcludeController()
@Controller('files')
export class FilesController {
  constructor(
    private files: FilesService,
    private signing: SigningService,
  ) {}

  @Public()
  @Get('public/:folder/:name')
  async publicFile(@Param('folder') folder: string, @Param('name') name: string, @Res() res: Response) {
    return this.send(`public/${folder}/${name}`, res, 'public, max-age=86400');
  }

  /** Fichiers privés (photos d'élèves) : uniquement via un lien signé et temporaire. */
  @Public()
  @Get('private/:folder/:name')
  async privateFile(
    @Param('folder') folder: string,
    @Param('name') name: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const rel = `private/${folder}/${name}`;
    if (!this.signing.verify(rel, Number(exp), sig)) throw new ForbiddenException('Lien expiré ou invalide.');
    return this.send(rel, res, 'private, max-age=3600');
  }

  private async send(rel: string, res: Response, cache: string) {
    const abs = this.files.abs(rel);
    if (!(await this.files.exists(rel))) throw new NotFoundException('Fichier introuvable.');
    res.setHeader('Cache-Control', cache);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(abs);
  }
}
