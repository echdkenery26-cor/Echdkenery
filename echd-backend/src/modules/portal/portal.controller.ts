//echd-backend/src/modules/portal/portal.controller.ts
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Response } from 'express';
import { AuditService } from '../../common/audit.service';
import { AdminOnly, AuthUser, ClientIp, CurrentUser, Public, StaffOnly } from '../../common/decorators';
import { PortalService } from './portal.service';

class PortalLinkDto {
  /** Durée de validité en jours (par défaut : réglage « portal.linkDays ») */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @IsOptional()
  @IsIn(['fr', 'ar'])
  lang?: 'fr' | 'ar';
}

@ApiTags('Espace parents')
@Controller()
export class PortalController {
  constructor(
    private portal: PortalService,
    private audit: AuditService,
  ) {}

  /** Crée le lien de suivi d'un élève (à envoyer aux parents). */
  @ApiBearerAuth()
  @StaffOnly()
  @HttpCode(200)
  @Post('students/:id/portal-link')
  async createLink(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PortalLinkDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const link = await this.portal.createLink(id, dto);
    await this.audit.log(u, 'PORTAL_LINK', 'Student', id, undefined, { expiresAt: link.expiresAt }, ip);
    return link;
  }

  /** Invalide d'un coup tous les liens parents déjà envoyés. */
  @ApiBearerAuth()
  @AdminOnly()
  @HttpCode(200)
  @Post('portal/revoke-all')
  async revokeAll(@CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const r = await this.portal.revokeAll();
    await this.audit.log(u, 'PORTAL_REVOKE_ALL', 'System', null, undefined, r, ip);
    return r;
  }

  /** Données du suivi (page publique, protégée par le jeton secret). */
  @Public()
  @Get('portal/:token')
  view(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return this.portal.view(token);
  }
}
