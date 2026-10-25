//echd-backend/src/modules/documents/documents.controller.ts
import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { AnyRole, AuthUser, CurrentUser, Public, StaffOnly } from '../../common/decorators';
import { SigningService } from '../../common/signing.service';
import { DocType, DocumentsService, Lang, SHARE_USER } from './documents.service';

const TYPES = ['receipt', 'student-sheet', 'timetable', 'bulletin', 'year-report', 'class-reports'] as const;
// Documents qu'on peut partager par lien (WhatsApp / e-mail)
const SHAREABLE: DocType[] = ['receipt', 'timetable', 'bulletin', 'year-report'];

class DocQuery {
  @IsOptional()
  @IsIn(['fr', 'ar'])
  lang?: Lang;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  term?: number;
}

class ShareDto {
  @IsIn(TYPES as unknown as string[])
  type!: DocType;

  @IsUUID()
  id!: string;

  @IsOptional()
  @IsIn(['fr', 'ar'])
  lang?: Lang;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  term?: number;

  /** Durée de validité du lien (1 h à 30 jours) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  hours?: number;
}

/**
 * Documents imprimables (reçus, fiches, emplois du temps, bulletins) en FR ou AR.
 * Ils sont rendus en HTML mis en page pour l'impression : « Imprimer → Enregistrer en PDF »
 * donne un PDF avec police arabe correctement jointe (RTL), sans dépendance lourde côté serveur.
 */
@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private docs: DocumentsService,
    private signing: SigningService,
  ) {}

  private send(res: Response, html: string) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src 'self'; img-src 'self' data: https: http:",
    );
    res.send(html);
  }

  private assertType(type: string): DocType {
    if (!(TYPES as readonly string[]).includes(type)) throw new BadRequestException('Type de document inconnu.');
    return type as DocType;
  }

  /** Document HTML prêt à imprimer (authentifié). */
  @ApiBearerAuth()
  @AnyRole()
  @Get(':type/:id')
  async get(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query() q: DocQuery,
    @CurrentUser() u: AuthUser,
    @Res() res: Response,
  ) {
    const html = await this.docs.render(this.assertType(type), id, q.lang ?? (u.language as Lang) ?? 'fr', u, q.term);
    this.send(res, html);
  }

  /** Crée un lien temporaire signé à envoyer par WhatsApp ou e-mail. */
  @ApiBearerAuth()
  @StaffOnly()
  @Post('share')
  share(@Body() dto: ShareDto) {
    if (!SHAREABLE.includes(dto.type)) throw new BadRequestException('Ce document ne peut pas être partagé par lien.');
    const lang = dto.lang ?? 'fr';
    const exp = Math.floor(Date.now() / 1000) + (dto.hours ?? 72) * 3600;
    const payload = `${dto.type}|${dto.id}|${lang}|${dto.term ?? ''}`;
    const sig = this.signing.sign(payload, exp);
    const base = (process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
    const qs = new URLSearchParams({ lang, exp: String(exp), sig, ...(dto.term ? { term: String(dto.term) } : {}) });
    return { url: `${base}/api/documents/shared/${dto.type}/${dto.id}?${qs}`, expiresAt: new Date(exp * 1000) };
  }

  /** Lecture d'un document via lien signé (sans connexion). */
  @Public()
  @Get('shared/:type/:id')
  async shared(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('lang') langQ: string,
    @Query('term') termQ: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const t = this.assertType(type);
    const lang: Lang = langQ === 'ar' ? 'ar' : 'fr';
    const payload = `${t}|${id}|${lang}|${termQ ?? ''}`;
    if (!SHAREABLE.includes(t) || !this.signing.verify(payload, Number(exp), sig)) {
      throw new ForbiddenException('Lien expiré ou invalide.');
    }
    this.send(res, await this.docs.render(t, id, lang, SHARE_USER, termQ ? Number(termQ) : undefined));
  }
}
