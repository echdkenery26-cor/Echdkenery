//echd-backend/src/modules/alerts/alerts.controller.ts
import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { AdminOnly, AnyRole, AuthUser, CurrentUser, StaffOnly } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { PushService } from '../../common/push.service';
import { PageQuery, pageArgs, pageResult } from '../../common/utils';
import { AlertsService } from './alerts.service';

class NotificationQuery extends PageQuery {
  @IsOptional()
  @IsString()
  unreadOnly?: string;
}

class PushKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

class PushSubscribeDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

class PushUnsubscribeDto {
  @IsString()
  endpoint!: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class AlertsController {
  constructor(
    private alerts: AlertsService,
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  /** Carte « À traiter » du tableau de bord. */
  @StaffOnly()
  @Get('alerts/todo')
  todo() {
    return this.alerts.todo();
  }

  /** Lance la tâche quotidienne à la main (retards, notifications, e-mail récapitulatif). */
  @AdminOnly()
  @HttpCode(200)
  @Post('alerts/run')
  run() {
    return this.alerts.runDaily();
  }

  /** Envoie le résumé par e-mail maintenant. */
  @AdminOnly()
  @HttpCode(200)
  @Post('alerts/digest')
  async digest() {
    return { sent: await this.alerts.sendDigest() };
  }

  /* ───── Centre de notifications (cloche + pastille) ───── */

  @AnyRole()
  @Get('notifications')
  async list(@Query() q: NotificationQuery, @CurrentUser() u: AuthUser) {
    const where = { userId: u.id, ...(q.unreadOnly === 'true' ? { read: false } : {}) };
    const [total, rows, unread] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({ where, ...pageArgs(q), orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where: { userId: u.id, read: false } }),
    ]);
    return { ...pageResult(rows, total, q), unread };
  }

  @AnyRole()
  @Get('notifications/unread-count')
  async unread(@CurrentUser() u: AuthUser) {
    return { count: await this.prisma.notification.count({ where: { userId: u.id, read: false } }) };
  }

  @AnyRole()
  @HttpCode(200)
  @Post('notifications/read-all')
  async readAll(@CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: u.id, read: false }, data: { read: true, readAt: new Date() } });
    return { ok: true };
  }

  @AnyRole()
  @HttpCode(200)
  @Post('notifications/:id/read')
  async read(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { id, userId: u.id }, data: { read: true, readAt: new Date() } });
    return { ok: true };
  }

  /* ───── Notifications push (appareils de l'équipe) ───── */

  @AnyRole()
  @Get('push/status')
  async pushStatus(@CurrentUser() u: AuthUser) {
    return { enabled: this.push.enabled, publicKey: this.push.getPublicKey(), devices: await this.push.count(u.id) };
  }

  @AnyRole()
  @HttpCode(200)
  @Post('push/subscribe')
  async pushSubscribe(@Body() dto: PushSubscribeDto, @CurrentUser() u: AuthUser, @Req() req: Request) {
    if (!this.push.enabled) throw new BadRequestException('Les notifications push ne sont pas configurées sur le serveur.');
    await this.push.subscribe(u.id, dto, req.headers['user-agent']);
    return { ok: true };
  }

  @AnyRole()
  @HttpCode(200)
  @Post('push/unsubscribe')
  async pushUnsubscribe(@Body() dto: PushUnsubscribeDto, @CurrentUser() u: AuthUser) {
    await this.push.unsubscribe(u.id, dto.endpoint);
    return { ok: true };
  }

  /** Envoie une notification d'essai à mes appareils. */
  @AnyRole()
  @HttpCode(200)
  @Post('push/test')
  async pushTest(@CurrentUser() u: AuthUser) {
    const sent = await this.push.sendToUsers([u.id], { title: 'ECHD', body: 'Les notifications fonctionnent sur cet appareil.', path: '/admin', tag: 'push-test' });
    return { sent };
  }
}
